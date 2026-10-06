import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { createId } from '../src/lib/domain/ids';
import { getDatabase } from '../src/lib/server/db/client';
import { claimNextJob, completeJob, enqueueJob, extendJobLease, failExhaustedLeases, failJob } from '../src/lib/server/jobs/queue';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for this disposable-database integration check.');
const database = getDatabase();
const key = `queue-test-${createId()}`;
const scheduled = await enqueueJob({ kind: 'source.capture', dedupeKey: key, payload: { sourceId: 'fixture' }, runAt: new Date(Date.now() - 1000), maxAttempts: 2 });
assert.equal(scheduled.created, true);
assert.deepEqual(await enqueueJob({ kind: 'source.capture', dedupeKey: key, payload: { sourceId: 'different' } }), { id: scheduled.id, created: false });

const claimed = (await Promise.all([claimNextJob('worker-a'), claimNextJob('worker-b')])).filter((job) => job !== null);
assert.equal(claimed.length, 1, 'only one worker may lease a job');
assert.equal(claimed[0].id, scheduled.id);
assert.equal(claimed[0].attempts, 1);
const owner = (await database.execute(sql`SELECT lease_owner FROM jobs WHERE id = ${scheduled.id}`))[0].lease_owner as string;
assert.equal(await completeJob(scheduled.id, owner === 'worker-a' ? 'worker-b' : 'worker-a'), false, 'another worker cannot complete the job');
assert.equal(await extendJobLease(scheduled.id, owner), true);
assert.equal(await failJob(scheduled.id, owner, 'temporary_error'), 'retry');
assert.equal(await claimNextJob('worker-c'), null, 'backoff must defer the retry');
await database.execute(sql`UPDATE jobs SET run_at = now() - interval '1 second' WHERE id = ${scheduled.id}`);
const retry = await claimNextJob('worker-c');
assert.equal(retry?.attempts, 2);
assert.equal(await failJob(scheduled.id, 'worker-c', 'still_unavailable'), 'failed');
assert.equal(await claimNextJob('worker-d'), null, 'exhausted jobs must stay stopped');
const attempts = await database.execute(sql`SELECT attempt, outcome, error_code FROM job_attempts WHERE job_id = ${scheduled.id} ORDER BY attempt`);
assert.deepEqual(attempts.map((attempt) => [attempt.attempt, attempt.outcome, attempt.error_code]), [[1, 'failed', 'temporary_error'], [2, 'failed', 'still_unavailable']]);

const expiredKey = `queue-expired-${createId()}`;
const expired = await enqueueJob({ kind: 'source.poll', dedupeKey: expiredKey, payload: {}, runAt: new Date(Date.now() - 1000), maxAttempts: 2 });
assert.equal((await claimNextJob('worker-lost'))?.id, expired.id);
await database.execute(sql`UPDATE jobs SET lease_until = now() - interval '1 second' WHERE id = ${expired.id}`);
assert.equal(await completeJob(expired.id, 'worker-lost'), false, 'a stale worker must not complete after lease expiry');
assert.equal((await claimNextJob('worker-recovery'))?.attempts, 2);
assert.equal((await database.execute(sql`SELECT outcome FROM job_attempts WHERE job_id = ${expired.id} AND attempt = 1`))[0].outcome, 'expired');
await database.execute(sql`UPDATE jobs SET lease_until = now() - interval '1 second' WHERE id = ${expired.id}`);
assert.equal(await failExhaustedLeases(), 1);
assert.equal((await database.execute(sql`SELECT status, last_error FROM jobs WHERE id = ${expired.id}`))[0].status, 'failed');
assert.equal((await database.execute(sql`SELECT outcome FROM job_attempts WHERE job_id = ${expired.id} AND attempt = 2`))[0].outcome, 'expired');

const success = await enqueueJob({ kind: 'publication.verify', dedupeKey: `queue-success-${createId()}`, payload: {}, runAt: new Date(Date.now() - 1000) });
assert.equal((await claimNextJob('worker-success'))?.id, success.id);
assert.equal(await completeJob(success.id, 'worker-success'), true);
assert.equal(await completeJob(success.id, 'worker-success'), false, 'a completed job cannot finish twice');
assert.equal((await database.execute(sql`SELECT status FROM jobs WHERE id = ${success.id}`))[0].status, 'succeeded');
assert.equal((await database.execute(sql`SELECT outcome FROM job_attempts WHERE job_id = ${success.id}`))[0].outcome, 'succeeded');

console.log('Queue deduplication, concurrent leasing, ownership, completion, retry, terminal failure, and lease recovery verified.');
process.exit(0);
