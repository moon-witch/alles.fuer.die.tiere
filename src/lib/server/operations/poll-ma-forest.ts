import { createHash } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { createId } from '$lib/domain/ids';
import { getDatabase } from '$lib/server/db/client';
import { activityEvents, attentionItems, operations, sourceRuns, sourceSnapshots, sources } from '$lib/server/db/schema';
import { capturePublicSource, type CapturedResponse, type FetchPolicy } from '$lib/server/ingestion/safe-fetch';
import { deleteRawSnapshot, putRawSnapshot } from '$lib/server/ingestion/raw-snapshots';
import { classifyMaForestChange, extractMaForestPage, extractMaForestStatistics, MA_FOREST_ADAPTER_VERSION, MA_FOREST_CAMPAIGN_ID, MA_FOREST_PAGE_URL, MA_FOREST_STATS_URL, MaForestExtractionError, type MaForestExtract } from '$lib/server/ingestion/ma-forest';

type Dependencies = {
	capture: (url: string, policy: FetchPolicy) => Promise<CapturedResponse>;
	put: typeof putRawSnapshot;
	remove: typeof deleteRawSnapshot;
	now: () => Date;
};

const defaults: Dependencies = { capture: capturePublicSource, put: putRawSnapshot, remove: deleteRawSnapshot, now: () => new Date() };
const statsPolicy: FetchPolicy = { maxBodyBytes: 2_000_000, timeoutMs: 10_000, allowedContentTypes: ['application/json'] };
const pagePolicy: FetchPolicy = { maxBodyBytes: 2_000_000, timeoutMs: 10_000, allowedContentTypes: ['text/html'] };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const priorExtract = (value: unknown): MaForestExtract | null => {
	if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'ma-forest-counter' || !('version' in value) || value.version !== MA_FOREST_ADAPTER_VERSION) return null;
	const extract = value as MaForestExtract;
	return typeof extract.protectedAreaM2 === 'number' && typeof extract.donationUrl === 'string' && typeof extract.goalM2 === 'number' ? extract : null;
};

const responseError = (status: number) => new MaForestExtractionError(status === 403 ? 'ma_http_403' : status === 429 ? 'ma_http_429' : 'ma_http_unavailable');
const isExpectedUrl = (response: CapturedResponse, expected: string) => response.url.toString() === expected;

/** One observe-only MA-Forest fetch. It records private evidence and review items, never a public metric. */
export const pollMaForest = async (jobId: string, dependencies: Dependencies = defaults): Promise<'observed' | 'unchanged' | 'already_observed'> => {
	const database = getDatabase();
	const key = `ma-forest-poll:${jobId}`;
	const started = await database.transaction(async (tx) => {
		await tx.insert(sources).values({ id: createId(), canonicalUrl: MA_FOREST_PAGE_URL, name: 'MA-Forest', owner: 'Wilderness International', authority: 'official', adapterKey: 'wilderness-ma-counter', adapterVersion: MA_FOREST_ADAPTER_VERSION, cadenceMinutes: '360', publicationPolicy: 'review_only', health: 'unknown', termsNotes: 'Öffentliche Kampagnenseite und ihr eigener Statistik-Endpunkt; nur beobachten, keine automatische Veröffentlichung.' }).onConflictDoNothing();
		const [source] = await tx.select().from(sources).where(eq(sources.canonicalUrl, MA_FOREST_PAGE_URL)).limit(1);
		if (!source || source.health === 'paused' || (source.adapterKey && source.adapterKey !== 'wilderness-ma-counter')) throw new MaForestExtractionError('ma_source_unavailable');
		const [existing] = await tx.select({ status: operations.status }).from(operations).where(eq(operations.idempotencyKey, key)).limit(1);
		if (existing?.status === 'applied') return { reused: true as const, sourceId: source.id, operationId: null, correlationId: null };
		if (existing) throw new MaForestExtractionError('ma_poll_already_started');
		const operationId = createId();
		const correlationId = createId();
		await tx.insert(operations).values({ id: operationId, type: 'source.poll.ma_forest', status: 'proposed', origin: 'worker', idempotencyKey: key, requestHash: digest({ sourceId: source.id, jobId }), input: { sourceId: source.id, pageUrl: MA_FOREST_PAGE_URL, statisticsUrl: MA_FOREST_STATS_URL }, correlationId });
		await tx.update(sources).set({ adapterKey: 'wilderness-ma-counter', adapterVersion: MA_FOREST_ADAPTER_VERSION, cadenceMinutes: '360', updatedAt: dependencies.now() }).where(eq(sources.id, source.id));
		return { reused: false as const, sourceId: source.id, operationId, correlationId };
	});
	if (started.reused) return 'already_observed';
	const [previous, lastRun] = await Promise.all([
		database.select({ id: sourceSnapshots.id, extract: sourceSnapshots.normalizedExtract, etag: sourceRuns.etag }).from(sourceSnapshots)
			.innerJoin(sourceRuns, eq(sourceSnapshots.sourceRunId, sourceRuns.id))
			.where(and(eq(sourceRuns.sourceId, started.sourceId), sql`${sourceSnapshots.normalizedExtract}->>'type' = 'ma-forest-counter'`))
			.orderBy(desc(sourceRuns.fetchedAt)).limit(1).then((rows) => rows[0]),
		database.select({ outcome: sourceRuns.outcome }).from(sourceRuns).where(and(eq(sourceRuns.sourceId, started.sourceId), eq(sourceRuns.extractorVersion, MA_FOREST_ADAPTER_VERSION))).orderBy(desc(sourceRuns.fetchedAt)).limit(1).then((rows) => rows[0])
	]);
	const prior = priorExtract(previous?.extract);
	const storedKeys: string[] = [];
	let statusCode: number | null = null;
	try {
		const stats = await dependencies.capture(MA_FOREST_STATS_URL, { ...statsPolicy, ifNoneMatch: prior ? previous?.etag ?? undefined : undefined });
		statusCode = stats.status;
		if (!isExpectedUrl(stats, MA_FOREST_STATS_URL)) throw new MaForestExtractionError('ma_redirect_changed');
		if (stats.status !== 200 && stats.status !== 304) throw responseError(stats.status);
		if (stats.status === 304 && !prior) throw new MaForestExtractionError('ma_statistics_invalid');
		if (stats.status === 200 && !stats.body?.length) throw new MaForestExtractionError('ma_statistics_invalid');
		const values = stats.status === 304 ? prior! : extractMaForestStatistics(stats.body!);
		const page = await dependencies.capture(MA_FOREST_PAGE_URL, pagePolicy);
		if (!isExpectedUrl(page, MA_FOREST_PAGE_URL)) throw new MaForestExtractionError('ma_redirect_changed');
		if (page.status !== 200) { statusCode = page.status; throw responseError(page.status); }
		if (!page.body?.length) throw new MaForestExtractionError('ma_section_missing');
		const pageValues = extractMaForestPage(page.body);
		const extract: MaForestExtract = { type: 'ma-forest-counter', version: MA_FOREST_ADAPTER_VERSION, campaignId: MA_FOREST_CAMPAIGN_ID, protectedAreaM2: values.protectedAreaM2, donations: values.donations, protectedKgCo2: values.protectedKgCo2, ...pageValues, pageUrl: MA_FOREST_PAGE_URL, statisticsUrl: MA_FOREST_STATS_URL };
		const changes = classifyMaForestChange(extract, prior);
		const observedAt = dependencies.now();
		const pageStored = await dependencies.put(page.body, observedAt);
		storedKeys.push(pageStored.objectKey);
		const statsStored = stats.status === 200 ? await dependencies.put(stats.body!, observedAt) : null;
		if (statsStored) storedKeys.push(statsStored.objectKey);
		await database.transaction(async (tx) => {
			const runId = createId();
			await tx.insert(sourceRuns).values({ id: runId, sourceId: started.sourceId, outcome: stats.status === 304 && changes.length === 0 ? 'not_modified' : 'success', statusCode: String(stats.status), etag: stats.headers.get('etag') ?? previous?.etag ?? null, lastModified: stats.headers.get('last-modified'), extractorVersion: MA_FOREST_ADAPTER_VERSION, fetchedAt: observedAt });
			const pageExtract = stats.status === 304 ? { ...extract, statisticsReusedFromSnapshotId: previous?.id, rawResponse: 'campaign_page' } : { type: 'ma-forest-page', version: MA_FOREST_ADAPTER_VERSION, ...pageValues };
			await tx.insert(sourceSnapshots).values({ id: createId(), sourceRunId: runId, objectKey: pageStored.objectKey, bodySha256: pageStored.bodySha256, normalizedExtract: pageExtract, normalizedSha256: digest(pageExtract), retentionClass: 'raw_public_24_months' });
			if (statsStored) await tx.insert(sourceSnapshots).values({ id: createId(), sourceRunId: runId, objectKey: statsStored.objectKey, bodySha256: statsStored.bodySha256, normalizedExtract: extract, normalizedSha256: digest(extract), retentionClass: 'raw_public_24_months' });
			await tx.update(sources).set({ health: 'healthy', lastSuccessfulAt: observedAt, updatedAt: observedAt }).where(eq(sources.id, started.sourceId));
			await tx.update(operations).set({ status: 'applied', entityDiff: { sourceId: started.sourceId, runId, changes, protectedAreaM2: extract.protectedAreaM2, publicEffect: 'none' }, updatedAt: observedAt }).where(eq(operations.id, started.operationId));
			await tx.insert(activityEvents).values({ id: createId(), operationId: started.operationId, sourceRunId: runId, eventType: 'source.polled', origin: 'worker', severity: changes.length ? 'info' : 'debug', summary: 'MA-Forest wurde ohne öffentliche Änderung beobachtet.', correlationId: started.correlationId!, payload: { sourceId: started.sourceId, changes, protectedAreaM2: extract.protectedAreaM2, statusCode: stats.status } });
			if (changes.length) await tx.insert(attentionItems).values({ id: createId(), kind: 'ma_forest_review', severity: changes.some((change) => ['destination_changed', 'goal_changed', 'large_counter_change'].includes(change)) ? 'warning' : 'info', summary: `MA-Forest-Beobachtung prüfen: ${changes.join(', ')}.`, entityType: 'source', entityId: started.sourceId, operationId: started.operationId });
		});
		return changes.length ? 'observed' : 'unchanged';
	} catch (cause) {
		for (const key of storedKeys) await dependencies.remove(key).catch(() => {});
		const code = cause instanceof MaForestExtractionError ? cause.code : cause instanceof Error && cause.message === 'Source content type is not permitted.' ? 'ma_content_type_changed' : cause instanceof Error && cause.message === 'Source response exceeds the configured size limit.' ? 'ma_response_too_large' : 'ma_fetch_or_storage_failed';
		const paused = ['ma_http_403', 'ma_http_429', 'ma_section_missing', 'ma_statistics_invalid', 'ma_destination_invalid', 'ma_goal_invalid', 'ma_redirect_changed', 'ma_content_type_changed', 'ma_response_too_large'].includes(code);
		const needsAttention = paused || lastRun?.outcome === 'failed';
		const failedAt = dependencies.now();
		await database.transaction(async (tx) => {
			const runId = createId();
			await tx.insert(sourceRuns).values({ id: runId, sourceId: started.sourceId, outcome: 'failed', statusCode: statusCode === null ? null : String(statusCode), errorCode: code, extractorVersion: MA_FOREST_ADAPTER_VERSION, fetchedAt: failedAt });
			await tx.update(sources).set({ health: paused ? 'paused' : 'error', updatedAt: failedAt }).where(eq(sources.id, started.sourceId));
			await tx.update(operations).set({ status: 'failed', entityDiff: { sourceId: started.sourceId, runId, errorCode: code }, updatedAt: failedAt }).where(eq(operations.id, started.operationId));
			await tx.insert(activityEvents).values({ id: createId(), operationId: started.operationId, sourceRunId: runId, eventType: 'source.fetch_failed', origin: 'worker', severity: 'warning', summary: 'MA-Forest-Beobachtung fehlgeschlagen.', correlationId: started.correlationId!, payload: { sourceId: started.sourceId, errorCode: code, statusCode } });
			if (needsAttention) await tx.insert(attentionItems).values({ id: createId(), kind: 'ma_forest_poll_failed', severity: 'warning', summary: `MA-Forest-Beobachtung prüfen: ${code}.`, entityType: 'source', entityId: started.sourceId, operationId: started.operationId });
		});
		throw cause;
	}
};
