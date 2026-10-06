import { eq } from 'drizzle-orm';
import { getDatabase } from '$lib/server/db/client';
import { jobs, projects } from '$lib/server/db/schema';
import { enqueueJob } from './queue';
import { normalizeSourceObservation, type SourceObservationInput } from '$lib/server/operations/observe-source';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Store the editor's complete, validated proposal; the worker performs the fetch later. */
export const queueSourceObservation = async (input: SourceObservationInput): Promise<{ jobId: string; created: boolean }> => {
	const normalized = normalizeSourceObservation(input);
	if (!uuid.test(input.initiatingUserId) || !uuid.test(input.projectId)) throw new Error('Das Projekt ist nicht verfügbar.');
	const [project] = await getDatabase().select({ lifecycleState: projects.lifecycleState }).from(projects).where(eq(projects.id, input.projectId)).limit(1);
	if (project?.lifecycleState !== 'active') throw new Error('Das Projekt ist nicht verfügbar.');
	const payload = { ...normalized, initiatingUserId: input.initiatingUserId, idempotencyKey: input.idempotencyKey };
	const result = await enqueueJob({ kind: 'source.observe', dedupeKey: `source.observe:${input.idempotencyKey}`, payload, maxAttempts: 1 });
	if (!result.created) {
		const [existing] = await getDatabase().select({ payload: jobs.payload }).from(jobs).where(eq(jobs.id, result.id)).limit(1);
		const prior = sourceObservationFromJob(existing?.payload);
		const comparable = { ...normalizeSourceObservation(prior), initiatingUserId: prior.initiatingUserId, idempotencyKey: prior.idempotencyKey };
		if (JSON.stringify(comparable) !== JSON.stringify(payload)) throw new Error('Diese Anfragekennung wurde bereits anders verwendet.');
	}
	return { jobId: result.id, created: result.created };
};

/** Reject malformed queued data before it can reach the domain operation. */
export const sourceObservationFromJob = (payload: unknown): SourceObservationInput => {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid_source_job');
	const value = payload as Record<string, unknown>;
	if (!uuid.test(String(value.initiatingUserId ?? '')) || !uuid.test(String(value.projectId ?? '')) || typeof value.idempotencyKey !== 'string') throw new Error('invalid_source_job');
	const publishedAt = value.sourcePublishedAt;
	if (publishedAt !== null && publishedAt !== undefined && (typeof publishedAt !== 'string' || Number.isNaN(new Date(publishedAt).getTime()))) throw new Error('invalid_source_job');
	const input: SourceObservationInput = {
		projectId: String(value.projectId), name: String(value.name ?? ''), owner: String(value.owner ?? ''),
		sourceType: value.sourceType as SourceObservationInput['sourceType'], authority: value.authority as SourceObservationInput['authority'],
		url: String(value.url ?? ''), kind: value.kind as SourceObservationInput['kind'],
		statement: String(value.statement ?? ''), passage: String(value.passage ?? ''),
		sourcePublishedAt: typeof publishedAt === 'string' ? new Date(publishedAt) : undefined,
		rightsNote: String(value.rightsNote ?? ''), sensitivity: value.sensitivity as SourceObservationInput['sensitivity'],
		initiatingUserId: String(value.initiatingUserId), idempotencyKey: value.idempotencyKey
	};
	normalizeSourceObservation(input);
	return input;
};
