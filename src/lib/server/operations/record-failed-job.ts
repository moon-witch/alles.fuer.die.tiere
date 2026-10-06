import { createHash } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { createId } from '$lib/domain/ids';
import { getDatabase } from '$lib/server/db/client';
import { activityEvents, attentionItems, jobs, operations } from '$lib/server/db/schema';

/** Idempotently surface an exhausted background job to the steward. */
export const recordFailedJob = async (input: { jobId: string; errorCode: string }): Promise<boolean> => {
	const idempotencyKey = `job-failed:${input.jobId}`;
	const requestHash = createHash('sha256').update(input.jobId).digest('hex');
	return getDatabase().transaction(async (tx) => {
		const [job] = await tx.select({ kind: jobs.kind, status: jobs.status }).from(jobs).where(eq(jobs.id, input.jobId)).limit(1);
		if (!job || job.status !== 'failed') return false;
		const operationId = createId();
		const correlationId = createId();
		const inserted = await tx.insert(operations).values({ id: operationId, type: 'job.failure_recorded', status: 'applied', origin: 'worker', idempotencyKey, requestHash, input: { jobId: input.jobId, kind: job.kind, errorCode: input.errorCode }, correlationId }).onConflictDoNothing().returning({ id: operations.id });
		if (!inserted.length) return false;
		await tx.insert(attentionItems).values({ id: createId(), kind: 'job_failed', severity: 'warning', summary: 'Eine Hintergrundprüfung ist fehlgeschlagen. Bitte den technischen Verlauf prüfen.', entityType: 'job', entityId: input.jobId, operationId });
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'job.failed', origin: 'worker', severity: 'warning', summary: 'Hintergrundprüfung nach mehreren Versuchen fehlgeschlagen.', correlationId, payload: { jobId: input.jobId, kind: job.kind, errorCode: input.errorCode } });
		return true;
	});
};

/** Reconcile terminal failures after a crash or expired final lease. */
export const recordOutstandingFailedJobs = async (): Promise<number> => {
	const unreported = await getDatabase().select({ id: jobs.id, errorCode: jobs.lastError }).from(jobs)
		.leftJoin(operations, eq(operations.idempotencyKey, sql`'job-failed:' || ${jobs.id}::text`))
		.where(and(eq(jobs.status, 'failed'), isNull(operations.id))).limit(20);
	let recorded = 0;
	for (const job of unreported) if (await recordFailedJob({ jobId: job.id, errorCode: job.errorCode ?? 'unknown' })) recorded++;
	return recorded;
};
