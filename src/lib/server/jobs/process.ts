import { claimNextJob, completeJob, failExhaustedLeases, failJob, type Job } from './queue';
import { PublicationVerificationError, verifyPublication } from './verify-publication';
import { recordFailedJob, recordOutstandingFailedJobs } from '$lib/server/operations/record-failed-job';
import { sourceObservationFromJob } from './source-observation';
import { observeSource } from '$lib/server/operations/observe-source';
import { pollMaForest } from '$lib/server/operations/poll-ma-forest';
import { scheduleMaForestPoll } from './schedule-ma-forest';
import { MaForestExtractionError } from '$lib/server/ingestion/ma-forest';

export class WorkerTickFailure extends Error {
	constructor(readonly stage: string, cause: unknown) {
		super('worker_tick_failed', { cause });
	}
}

const atStage = async <T>(stage: string, work: () => Promise<T>): Promise<T> => {
	try { return await work(); }
	catch (cause) { throw new WorkerTickFailure(stage, cause); }
};

const runWithTimeout = async <T>(work: Promise<T>, timeoutMs: number): Promise<T> => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new PublicationVerificationError('job_timeout')), timeoutMs); })]);
	} finally { if (timer) clearTimeout(timer); }
};

const errorCode = (cause: unknown, kind: string) => cause instanceof PublicationVerificationError ? cause.code : cause instanceof MaForestExtractionError ? cause.code : cause instanceof Error && cause.message === 'invalid_source_job' ? 'invalid_source_job' : kind === 'source.observe' ? 'source_observation_failed' : kind === 'source.poll.ma_forest' ? 'ma_poll_failed' : 'verification_unavailable';

const execute = async (job: Job, observe: typeof observeSource, poll: typeof pollMaForest) => {
	if (job.kind === 'publication.verify') return runWithTimeout(verifyPublication(job.payload), 30_000);
	if (job.kind === 'source.observe') {
		await observe(sourceObservationFromJob(job.payload));
		return 'source_observed';
	}
	if (job.kind === 'source.poll.ma_forest') return process.env.MA_FOREST_POLL_ENABLED === 'true' ? poll(job.id) : 'poll_disabled';
	throw new Error('unknown_job_kind');
};

/** One job at a time; no public request waits on this process. */
export const processNextJob = async (workerId: string, observe: typeof observeSource = observeSource, poll: typeof pollMaForest = pollMaForest): Promise<{ jobId: string; kind: string; correlationId?: string; status: string; errorCode?: string } | null> => {
	await atStage('expire_leases', failExhaustedLeases);
	await atStage('record_failures', recordOutstandingFailedJobs);
	await atStage('schedule_ma_forest', scheduleMaForestPoll);
	const job = await atStage('claim_job', () => claimNextJob(workerId, 120));
	if (!job) return null;
	const correlationId = job.payload && typeof job.payload === 'object' && 'correlationId' in job.payload && typeof job.payload.correlationId === 'string' ? job.payload.correlationId : undefined;
	try {
		const outcome = await execute(job, observe, poll);
		const completed = await atStage('complete_job', () => completeJob(job.id, workerId));
		return { jobId: job.id, kind: job.kind, correlationId, status: completed ? outcome : 'lease_lost' };
	} catch (cause) {
		const code = cause instanceof Error && cause.message === 'unknown_job_kind' ? 'unknown_job_kind' : errorCode(cause, job.kind);
		const status = await atStage('fail_job', () => failJob(job.id, workerId, code));
		if (status === 'failed') await atStage('record_failure', () => recordFailedJob({ jobId: job.id, errorCode: code }));
		return { jobId: job.id, kind: job.kind, correlationId, status, errorCode: code };
	}
};
