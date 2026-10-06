import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db/client';
import { jobs, operations, projects, sourceRuns, sources } from '$lib/server/db/schema';
import { checkRawSnapshotBucket, rawSnapshotStorageConfigured } from '$lib/server/ingestion/raw-snapshots';
import { listSourceRegistry } from '$lib/server/ingestion/source-review';
import { observeSource, type SourceObservationInput } from '$lib/server/operations/observe-source';
import { queueSourceObservation } from '$lib/server/jobs/source-observation';

const field = (data: FormData, key: string) => String(data.get(key) ?? '').trim();

export const load = async ({ locals, url }) => {
	if (locals.user?.role !== 'steward') error(403, 'Nur für die technische Verwaltung.');
	const database = getDatabase();
	const sourceJobsEnabled = process.env.SOURCE_OBSERVATION_JOBS_ENABLED === 'true';
	const requestedJobId = url.searchParams.get('queued');
	const [projectRows, recent, registry, sourceJobs] = await Promise.all([
		database.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.lifecycleState, 'active')).orderBy(projects.name),
		database.select({ sourceId: sources.id, name: sources.name, url: sources.canonicalUrl, outcome: sourceRuns.outcome, statusCode: sourceRuns.statusCode, fetchedAt: sourceRuns.fetchedAt }).from(sourceRuns).innerJoin(sources, eq(sourceRuns.sourceId, sources.id)).orderBy(desc(sourceRuns.fetchedAt)).limit(20),
		listSourceRegistry(),
		sourceJobsEnabled || requestedJobId ? database.select({ id: jobs.id, status: jobs.status, createdAt: jobs.createdAt, payload: jobs.payload }).from(jobs)
			.where(and(eq(jobs.kind, 'source.observe'), sql`${jobs.payload}->>'initiatingUserId' = ${locals.user.id}`))
			.orderBy(desc(jobs.createdAt)).limit(10) : Promise.resolve([])
	]);
	let queued: { jobId: string; status: string; claimId: string | null } | null = null;
	if (requestedJobId && /^[0-9a-f-]{36}$/i.test(requestedJobId)) {
		const [job] = await database.select({ kind: jobs.kind, status: jobs.status, payload: jobs.payload }).from(jobs).where(eq(jobs.id, requestedJobId)).limit(1);
		const payload = job?.payload && typeof job.payload === 'object' ? job.payload as Record<string, unknown> : null;
		if (job?.kind === 'source.observe' && payload?.initiatingUserId === locals.user.id && typeof payload.idempotencyKey === 'string') {
			const [operation] = await database.select({ status: operations.status, entityDiff: operations.entityDiff }).from(operations).where(eq(operations.idempotencyKey, payload.idempotencyKey)).limit(1);
			const diff = operation?.entityDiff && typeof operation.entityDiff === 'object' ? operation.entityDiff as Record<string, unknown> : null;
			queued = { jobId: requestedJobId, status: job.status, claimId: operation?.status === 'applied' && typeof diff?.claimId === 'string' ? diff.claimId : null };
		}
	}
	return { projects: projectRows, recent, registry, sourceJobs: sourceJobs.map((job) => ({ id: job.id, status: job.status, createdAt: job.createdAt, name: job.payload && typeof job.payload === 'object' && 'name' in job.payload && typeof job.payload.name === 'string' ? job.payload.name : 'Quelle' })), storageReady: rawSnapshotStorageConfigured(), observationKey: randomUUID(), queued, sourceJobsEnabled };
};

export const actions = {
	checkStorage: async ({ locals }) => {
		if (locals.user?.role !== 'steward') error(403, 'Nur für die technische Verwaltung.');
		if (!rawSnapshotStorageConfigured()) return fail(400, { error: 'S3-Endpunkt, raw-Bucket oder Zugangsdaten fehlen in der Web-Ressource.' });
		return { storageCheck: await checkRawSnapshotBucket() };
	},
	observe: async ({ request, locals }) => {
		if (locals.user?.role !== 'steward') error(403, 'Nur für die technische Verwaltung.');
		const data = await request.formData();
		const sourcePublishedDate = field(data, 'sourcePublishedAt');
		if (sourcePublishedDate && !/^\d{4}-\d{2}-\d{2}$/.test(sourcePublishedDate)) return fail(400, { error: 'Das Quelldatum ist ungültig.' });
		const input: SourceObservationInput = {
			projectId: field(data, 'projectId'), name: field(data, 'name'), owner: field(data, 'owner'),
			sourceType: field(data, 'sourceType') as SourceObservationInput['sourceType'],
			authority: field(data, 'authority') as SourceObservationInput['authority'],
			url: field(data, 'url'), kind: field(data, 'kind') as SourceObservationInput['kind'],
			statement: field(data, 'statement'), passage: field(data, 'passage'),
			sourcePublishedAt: sourcePublishedDate ? new Date(`${sourcePublishedDate}T12:00:00Z`) : undefined,
			rightsNote: field(data, 'rightsNote'), sensitivity: field(data, 'sensitivity') as SourceObservationInput['sensitivity'],
			initiatingUserId: locals.user!.id, idempotencyKey: field(data, 'idempotencyKey')
		};
		let destination: string;
		try {
			if (process.env.SOURCE_OBSERVATION_JOBS_ENABLED === 'true') {
				const result = await queueSourceObservation(input);
				destination = `/admin/quellen?queued=${result.jobId}`;
			} else {
				const result = await observeSource(input);
				destination = `/admin/inhalte/${result.claimId}`;
			}
		} catch (cause) {
			return fail(400, { error: cause instanceof Error ? cause.message : 'Quelle konnte nicht erfasst werden.' });
		}
		redirect(303, destination);
	}
};
