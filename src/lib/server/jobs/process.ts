import { claimNextJob, completeJob, failExhaustedLeases, failJob, type Job } from './queue';
import { PublicationVerificationError, verifyPublication } from './verify-publication';
import { recordFailedJob, recordOutstandingFailedJobs } from '$lib/server/operations/record-failed-job';
import { sourceObservationFromJob } from './source-observation';
import { observeSource } from '$lib/server/operations/observe-source';

const runWithTimeout = async <T>(work: Promise<T>, timeoutMs: number): Promise<T> => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new PublicationVerificationError('job_timeout')), timeoutMs); })]);
	} finally { if (timer) clearTimeout(timer); }
};

const errorCode = (cause: unknown, kind: string) => cause instanceof PublicationVerificationError ? cause.code : cause instanceof Error && cause.message === 'invalid_source_job' ? 'invalid_source_job' : kind === 'source.observe' ? 'source_observation_failed' : 'verification_unavailable';

const execute = async (job: Job, observe: typeof observeSource) => {
	if (job.kind === 'publication.verify') return runWithTimeout(verifyPublication(job.payload), 30_000);
	if (job.kind === 'source.observe') {
		await observe(sourceObservationFromJob(job.payload));
		return 'source_observed';
	}
	throw new Error('unknown_job_kind');
};

/** One job at a time; no public request waits on this process. */
export const processNextJob = async (workerId: string, observe: typeof observeSource = observeSource): Promise<{ jobId: string; kind: string; correlationId?: string; status: string; errorCode?: string } | null> => {
	await failExhaustedLeases();
	await recordOutstandingFailedJobs();
	const job = await claimNextJob(workerId, 120);
	if (!job) return null;
	const correlationId = job.payload && typeof job.payload === 'object' && 'correlationId' in job.payload && typeof job.payload.correlationId === 'string' ? job.payload.correlationId : undefined;
	try {
		const outcome = await execute(job, observe);
		const completed = await completeJob(job.id, workerId);
		return { jobId: job.id, kind: job.kind, correlationId, status: completed ? outcome : 'lease_lost' };
	} catch (cause) {
		const code = cause instanceof Error && cause.message === 'unknown_job_kind' ? 'unknown_job_kind' : errorCode(cause, job.kind);
		const status = await failJob(job.id, workerId, code);
		if (status === 'failed') await recordFailedJob({ jobId: job.id, errorCode: code });
		return { jobId: job.id, kind: job.kind, correlationId, status, errorCode: code };
	}
};
