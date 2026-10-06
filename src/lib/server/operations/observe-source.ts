import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { validPublicUrl } from '$lib/domain/action-policy';
import { createId } from '$lib/domain/ids';
import { getDatabase } from '$lib/server/db/client';
import { activityEvents, attentionItems, claimEvidence, claims, operations, projects, sourceRuns, sourceSnapshots, sources } from '$lib/server/db/schema';
import { capturePublicSource, type CapturedResponse } from '$lib/server/ingestion/safe-fetch';
import { deleteRawSnapshot, putRawSnapshot } from '$lib/server/ingestion/raw-snapshots';

const kinds = ['milestone', 'status', 'outcome', 'context'] as const;
const sourceTypes = ['official_page', 'official_statement', 'partner_message', 'press', 'event'] as const;
const authorities = ['official', 'partner', 'press', 'reference'] as const;
const sensitivities = ['none', 'review'] as const;

export type SourceObservationInput = {
	projectId: string;
	name: string;
	owner: string;
	sourceType: (typeof sourceTypes)[number];
	authority: (typeof authorities)[number];
	url: string;
	kind: (typeof kinds)[number];
	statement: string;
	passage: string;
	sourcePublishedAt?: Date;
	rightsNote: string;
	sensitivity: (typeof sensitivities)[number];
	initiatingUserId: string;
	idempotencyKey: string;
};

type Dependencies = {
	capture: (url: string) => Promise<CapturedResponse>;
	put: typeof putRawSnapshot;
	remove: typeof deleteRawSnapshot;
};

const defaults: Dependencies = {
	capture: (url) => capturePublicSource(url, { maxBodyBytes: 2_000_000, timeoutMs: 10_000, allowedContentTypes: ['text/html', 'application/xhtml+xml', 'application/json', 'text/plain'] }),
	put: putRawSnapshot,
	remove: deleteRawSnapshot
};

export const normalizeSourceObservation = (input: SourceObservationInput) => {
	const normalizedUrl = validPublicUrl(input.url)?.toString();
	if (!normalizedUrl) throw new Error('Eine öffentliche HTTPS-Quelle ist erforderlich.');
	if (!input.name.trim() || input.name.length > 160 || !input.owner.trim() || input.owner.length > 160) throw new Error('Quellenname und Herausgeber sind erforderlich.');
	if (!sourceTypes.includes(input.sourceType) || !authorities.includes(input.authority) || !kinds.includes(input.kind) || !sensitivities.includes(input.sensitivity)) throw new Error('Die Quellenangaben sind ungültig.');
	if (!input.statement.trim() || input.statement.length > 1000 || !input.passage.trim() || input.passage.length > 4000 || !input.rightsNote.trim() || input.rightsNote.length > 1000) throw new Error('Aussage, genaue Belegstelle und Rechtehinweis sind erforderlich.');
	if (input.sourcePublishedAt && !Number.isFinite(input.sourcePublishedAt.getTime())) throw new Error('Das Quelldatum ist ungültig.');
	if (!input.idempotencyKey || input.idempotencyKey.length > 128) throw new Error('Ungültige Anfragekennung.');
	return { projectId: input.projectId, name: input.name.trim(), owner: input.owner.trim(), sourceType: input.sourceType, authority: input.authority, url: normalizedUrl, kind: input.kind, statement: input.statement.trim(), passage: input.passage.trim(), sourcePublishedAt: input.sourcePublishedAt?.toISOString() ?? null, rightsNote: input.rightsNote.trim(), sensitivity: input.sensitivity };
};

export const observeSource = async (input: SourceObservationInput, dependencies: Dependencies = defaults): Promise<{ operationId: string; claimId: string; snapshotId: string; reused: boolean }> => {
	const normalized = normalizeSourceObservation(input);
	const normalizedUrl = normalized.url;
	const requestHash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
	const database = getDatabase();
	const started = await database.transaction(async (tx) => {
		const operationId = createId();
		const correlationId = createId();
		const inserted = await tx.insert(operations).values({ id: operationId, type: 'source.observe', status: 'proposed', origin: 'admin', initiatingUserId: input.initiatingUserId, idempotencyKey: input.idempotencyKey, requestHash, input: normalized, correlationId }).onConflictDoNothing().returning({ id: operations.id });
		if (!inserted.length) {
			const [existing] = await tx.select().from(operations).where(eq(operations.idempotencyKey, input.idempotencyKey)).limit(1);
			const diff = existing?.entityDiff as { claimId?: string; snapshotId?: string } | null;
			if (!existing || existing.requestHash !== requestHash || existing.status !== 'applied' || !diff?.claimId || !diff.snapshotId) throw new Error('Diese Anfragekennung wurde bereits anders verwendet oder der frühere Versuch ist fehlgeschlagen.');
			return { reused: true as const, operationId: existing.id, correlationId: existing.correlationId, claimId: diff.claimId, snapshotId: diff.snapshotId };
		}
		const [project] = await tx.select({ id: projects.id, lifecycleState: projects.lifecycleState }).from(projects).where(eq(projects.id, input.projectId)).limit(1);
		if (!project || project.lifecycleState !== 'active') throw new Error('Das Projekt ist nicht verfügbar.');
		const [source] = await tx.insert(sources).values({ id: createId(), canonicalUrl: normalizedUrl, name: normalized.name, owner: normalized.owner, authority: normalized.authority, publicationPolicy: 'review_only', health: 'unknown', termsNotes: normalized.rightsNote }).onConflictDoUpdate({ target: sources.canonicalUrl, set: { updatedAt: new Date() } }).returning({ id: sources.id });
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.proposed', origin: 'admin', severity: 'info', summary: 'Öffentliche Quelle wird für einen privaten Entwurf erfasst.', correlationId, payload: { sourceId: source.id, projectId: input.projectId } });
		return { reused: false as const, operationId, correlationId, sourceId: source.id };
	});
	if (started.reused) return { operationId: started.operationId, claimId: started.claimId, snapshotId: started.snapshotId, reused: true };
	let objectKey: string | null = null;
	let observedStatus: number | null = null;
	try {
		const captured = await dependencies.capture(normalizedUrl);
		observedStatus = captured.status;
		if (captured.status !== 200 || !captured.body?.length) throw new Error(`Die Quelle lieferte keinen verwertbaren Inhalt (HTTP ${captured.status}).`);
		const finalUrl = validPublicUrl(captured.url.toString());
		if (!finalUrl) throw new Error('Die endgültige Quellenadresse ist nicht zulässig.');
		const observedAt = new Date();
		const stored = await dependencies.put(captured.body, observedAt);
		objectKey = stored.objectKey;
		const extract = { type: 'manual-source-observation', version: 1, sourceType: normalized.sourceType, contentType: captured.headers.get('content-type')?.split(';')[0] ?? null, enteredUrl: normalized.url, finalUrl: finalUrl.toString(), statement: normalized.statement, passage: normalized.passage, rightsNote: normalized.rightsNote, sensitivity: normalized.sensitivity, sourcePublishedAt: normalized.sourcePublishedAt, verification: 'manual_review_required' };
		const normalizedSha256 = createHash('sha256').update(JSON.stringify(extract)).digest('hex');
		return await database.transaction(async (tx) => {
			const runId = createId();
			const snapshotId = createId();
			const claimId = createId();
			await tx.insert(sourceRuns).values({ id: runId, sourceId: started.sourceId, outcome: 'success', statusCode: String(captured.status), etag: captured.headers.get('etag'), lastModified: captured.headers.get('last-modified'), extractorVersion: 'manual-v1', fetchedAt: observedAt });
			await tx.insert(sourceSnapshots).values({ id: snapshotId, sourceRunId: runId, objectKey: stored.objectKey, bodySha256: stored.bodySha256, normalizedExtract: extract, normalizedSha256, retentionClass: 'raw_public_24_months' });
			await tx.insert(claims).values({ id: claimId, projectId: input.projectId, kind: input.kind, statement: normalized.statement, visibility: 'private', editorialStatus: 'draft' });
			await tx.insert(claimEvidence).values({ id: createId(), claimId, sourceSnapshotId: snapshotId, sourceUrl: finalUrl.toString(), passage: normalized.passage, sourcePublishedAt: input.sourcePublishedAt, observedAt });
			await tx.update(sources).set({ health: 'healthy', lastSuccessfulAt: observedAt, updatedAt: observedAt }).where(eq(sources.id, started.sourceId));
			await tx.insert(attentionItems).values({ id: createId(), kind: 'source_observation', severity: input.sensitivity === 'review' ? 'warning' : 'info', summary: `Quellenbeleg für „${normalized.statement.slice(0, 140)}“ prüfen.`, entityType: 'claim', entityId: claimId, operationId: started.operationId });
			await tx.update(operations).set({ status: 'applied', entityDiff: { sourceId: started.sourceId, runId, snapshotId, claimId, visibility: 'private' }, updatedAt: observedAt }).where(eq(operations.id, started.operationId));
			await tx.insert(activityEvents).values({ id: createId(), operationId: started.operationId, sourceRunId: runId, eventType: 'source.observed', origin: 'admin', severity: 'info', summary: 'Öffentliche Quelle wurde privat gesichert.', correlationId: started.correlationId, payload: { sourceId: started.sourceId, snapshotId, bodySha256: stored.bodySha256, finalUrl: finalUrl.toString() } });
			await tx.insert(activityEvents).values({ id: createId(), operationId: started.operationId, eventType: 'operation.applied', origin: 'admin', severity: 'info', summary: 'Privater Faktenentwurf mit gesichertem Quellenbeleg wurde angelegt.', correlationId: started.correlationId, payload: { claimId, snapshotId, publicEffect: 'none' } });
			return { operationId: started.operationId, claimId, snapshotId, reused: false };
		});
	} catch (cause) {
		if (objectKey) await dependencies.remove(objectKey).catch(() => {});
		const message = cause instanceof Error ? cause.message.slice(0, 500) : 'Unbekannter Quellenfehler.';
		await database.transaction(async (tx) => {
			const now = new Date();
			const runId = createId();
			await tx.insert(sourceRuns).values({ id: runId, sourceId: started.sourceId, outcome: 'failed', statusCode: observedStatus === null ? undefined : String(observedStatus), errorCode: 'capture_or_storage_failed', fetchedAt: now });
			await tx.update(sources).set({ health: observedStatus === 403 || observedStatus === 429 ? 'paused' : 'error', updatedAt: now }).where(eq(sources.id, started.sourceId));
			await tx.update(operations).set({ status: 'failed', entityDiff: { sourceId: started.sourceId, reason: message }, updatedAt: now }).where(eq(operations.id, started.operationId));
			await tx.insert(attentionItems).values({ id: createId(), kind: 'source_capture_failed', severity: 'warning', summary: `Quelle konnte nicht gesichert werden: ${message}`, entityType: 'source', entityId: started.sourceId, operationId: started.operationId });
			await tx.insert(activityEvents).values({ id: createId(), operationId: started.operationId, sourceRunId: runId, eventType: 'source.fetch_failed', origin: 'admin', severity: 'warning', summary: 'Quellenerfassung fehlgeschlagen.', correlationId: started.correlationId, payload: { sourceId: started.sourceId, status: observedStatus, reason: message } });
		});
		throw cause;
	}
};
