import { sql } from 'drizzle-orm';
import { createId } from '$lib/domain/ids';
import { getDatabase } from '$lib/server/db/client';

export type Job = {
	id: string;
	kind: string;
	dedupeKey: string;
	payload: unknown;
	attempts: number;
	maxAttempts: number;
	leaseUntil: Date;
};

type JobRow = {
	id: string;
	kind: string;
	dedupe_key: string;
	payload: unknown;
	attempts: string;
	max_attempts: string;
	lease_until: Date;
};

const one = <T>(result: Record<string, unknown>[]): T | undefined => result[0] as T | undefined;

/** A dedupe key names one logical occurrence, so retries never create duplicate work. */
export async function enqueueJob(input: {
	kind: string;
	dedupeKey: string;
	payload: Record<string, unknown>;
	runAt?: Date;
	maxAttempts?: number;
}): Promise<{ id: string; created: boolean }> {
	if (!/^[a-z][a-z0-9_.]{0,79}$/.test(input.kind)) throw new Error('Invalid job kind.');
	if (!input.dedupeKey || input.dedupeKey.length > 160) throw new Error('Invalid job dedupe key.');
	if (!Number.isInteger(input.maxAttempts ?? 5) || (input.maxAttempts ?? 5) < 1 || (input.maxAttempts ?? 5) > 99) throw new Error('Invalid maximum attempts.');
	if (input.runAt && Number.isNaN(input.runAt.getTime())) throw new Error('Invalid job run time.');
	const id = createId();
	const result = await getDatabase().execute(sql`
		INSERT INTO jobs (id, kind, dedupe_key, payload, run_at, max_attempts)
		VALUES (${id}, ${input.kind}, ${input.dedupeKey}, ${JSON.stringify(input.payload)}::jsonb, ${(input.runAt ?? new Date()).toISOString()}::timestamptz, ${String(input.maxAttempts ?? 5)})
		ON CONFLICT (dedupe_key) DO NOTHING RETURNING id
	`);
	if (result.length) return { id, created: true };
	const existing = one<{ id: string }>(await getDatabase().execute(sql`SELECT id FROM jobs WHERE dedupe_key = ${input.dedupeKey}`));
	if (!existing) throw new Error('The queued job could not be found.');
	return { id: existing.id, created: false };
}

/** Claim one due job atomically; concurrent workers skip locked rows. */
export async function claimNextJob(workerId: string, leaseSeconds = 120): Promise<Job | null> {
	if (!workerId || workerId.length > 120) throw new Error('Invalid worker ID.');
	if (!Number.isInteger(leaseSeconds) || leaseSeconds < 10 || leaseSeconds > 3600) throw new Error('Invalid lease duration.');
	return getDatabase().transaction(async (tx) => {
		const candidate = one<{ id: string; attempts: string; status: string }>(await tx.execute(sql`
			SELECT id, attempts, status FROM jobs
			WHERE run_at <= now() AND (
				status = 'pending' OR (status = 'running' AND lease_until <= now())
			) AND attempts::integer < max_attempts::integer
			ORDER BY run_at, created_at
			LIMIT 1 FOR UPDATE SKIP LOCKED
		`));
		if (!candidate) return null;
		if (candidate.status === 'running') {
			await tx.execute(sql`
				UPDATE job_attempts SET outcome = 'expired', finished_at = now(), error_code = 'lease_expired'
				WHERE job_id = ${candidate.id} AND attempt = ${Number(candidate.attempts)} AND finished_at IS NULL
			`);
		}
		const row = one<JobRow>(await tx.execute(sql`
			UPDATE jobs SET status = 'running', lease_owner = ${workerId},
				lease_until = now() + ${leaseSeconds} * interval '1 second',
				attempts = (attempts::integer + 1)::text, updated_at = now()
			WHERE id = ${candidate.id} RETURNING id, kind, dedupe_key, payload, attempts, max_attempts, lease_until
		`));
		if (!row) throw new Error('Claimed job disappeared.');
		await tx.execute(sql`
			INSERT INTO job_attempts (id, job_id, attempt, worker_id, started_at)
			VALUES (${createId()}, ${row.id}, ${Number(row.attempts)}, ${workerId}, now())
		`);
		return { id: row.id, kind: row.kind, dedupeKey: row.dedupe_key, payload: row.payload,
			attempts: Number(row.attempts), maxAttempts: Number(row.max_attempts), leaseUntil: row.lease_until };
	});
}

export async function extendJobLease(jobId: string, workerId: string, leaseSeconds = 120): Promise<boolean> {
	if (!Number.isInteger(leaseSeconds) || leaseSeconds < 10 || leaseSeconds > 3600) throw new Error('Invalid lease duration.');
	const result = await getDatabase().execute(sql`
		UPDATE jobs SET lease_until = now() + ${leaseSeconds} * interval '1 second', updated_at = now()
		WHERE id = ${jobId} AND status = 'running' AND lease_owner = ${workerId} AND lease_until > now()
		RETURNING id
	`);
	return result.length === 1;
}

export async function completeJob(jobId: string, workerId: string): Promise<boolean> {
	return getDatabase().transaction(async (tx) => {
		const row = one<{ attempts: string }>(await tx.execute(sql`
			UPDATE jobs SET status = 'succeeded', lease_owner = NULL, lease_until = NULL, updated_at = now()
			WHERE id = ${jobId} AND status = 'running' AND lease_owner = ${workerId} AND lease_until > now()
			RETURNING attempts
		`));
		if (!row) return false;
		await tx.execute(sql`
			UPDATE job_attempts SET outcome = 'succeeded', finished_at = now()
			WHERE job_id = ${jobId} AND attempt = ${Number(row.attempts)} AND finished_at IS NULL
		`);
		return true;
	});
}

/** Error codes are short stable labels; raw exception messages must not enter the queue. */
export async function failJob(jobId: string, workerId: string, errorCode: string): Promise<'retry' | 'failed' | 'lease_lost'> {
	if (!/^[a-z][a-z0-9_]{0,79}$/.test(errorCode)) throw new Error('Invalid job error code.');
	return getDatabase().transaction(async (tx) => {
		const row = one<{ attempts: string; max_attempts: string }>(await tx.execute(sql`
			SELECT attempts, max_attempts FROM jobs
			WHERE id = ${jobId} AND status = 'running' AND lease_owner = ${workerId} AND lease_until > now()
			FOR UPDATE
		`));
		if (!row) return 'lease_lost';
		const attempts = Number(row.attempts);
		const terminal = attempts >= Number(row.max_attempts);
		const delaySeconds = Math.min(3600, 30 * 2 ** (attempts - 1)) + Math.floor(Math.random() * 16);
		await tx.execute(sql`
			UPDATE jobs SET status = ${terminal ? 'failed' : 'pending'},
				lease_owner = NULL, lease_until = NULL, last_error = ${errorCode},
				run_at = CASE WHEN ${terminal} THEN run_at ELSE now() + ${delaySeconds} * interval '1 second' END,
				updated_at = now()
			WHERE id = ${jobId}
		`);
		await tx.execute(sql`
			UPDATE job_attempts SET outcome = 'failed', finished_at = now(), error_code = ${errorCode}
			WHERE job_id = ${jobId} AND attempt = ${attempts} AND finished_at IS NULL
		`);
		return terminal ? 'failed' : 'retry';
	});
}

/** Expired final attempts cannot be claimed again; close them for the review queue. */
export async function failExhaustedLeases(): Promise<number> {
	const result = await getDatabase().execute(sql`
		WITH exhausted AS (
			UPDATE jobs SET status = 'failed', lease_owner = NULL, lease_until = NULL,
				last_error = 'lease_expired', updated_at = now()
			WHERE status = 'running' AND lease_until <= now() AND attempts::integer >= max_attempts::integer
			RETURNING id, attempts
		)
		UPDATE job_attempts AS attempt SET outcome = 'expired', finished_at = now(), error_code = 'lease_expired'
		FROM exhausted WHERE attempt.job_id = exhausted.id AND attempt.attempt = exhausted.attempts::integer
			AND attempt.finished_at IS NULL RETURNING attempt.id
	`);
	return result.length;
}
