import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { createId } from '../src/lib/domain/ids';
import { getDatabase } from '../src/lib/server/db/client';
import { attentionItems, jobs, operations, publications, sourceRuns, sourceSnapshots, sources, users } from '../src/lib/server/db/schema';
import { processNextJob } from '../src/lib/server/jobs/process';
import { scheduleMaForestPoll } from '../src/lib/server/jobs/schedule-ma-forest';
import { pollMaForest } from '../src/lib/server/operations/poll-ma-forest';
import { resumeMaForestPoll } from '../src/lib/server/operations/resume-ma-forest-poll';
import { MA_FOREST_ADAPTER_VERSION, MA_FOREST_CAMPAIGN_ID, MA_FOREST_PAGE_URL, MA_FOREST_STATS_URL } from '../src/lib/server/ingestion/ma-forest';
import type { FetchPolicy } from '../src/lib/server/ingestion/safe-fetch';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for this disposable-database integration check.');
process.env.MA_FOREST_POLL_ENABLED = 'true';
const database = getDatabase();
let clock = new Date();
let mode: 'first' | 'unchanged' | 'downward' | 'limited' | 'forbidden' = 'first';
let writes = 0;
let conditionalSeen = false;
const body = (value: string) => new TextEncoder().encode(value);
const page = (url = 'https://donate.wilderness-international.org?campaign=MA') => body(`<section id="advance-statistic"><div class="block_statis_realtime" data-src-id="${MA_FOREST_CAMPAIGN_ID}" data-goal="2000000"><a class="aw_btn" href="${url}">Protect forest</a></div></section>`);
const statistics = (value: number) => body(JSON.stringify({ result: [{ uuid: MA_FOREST_CAMPAIGN_ID, code: 'MA', no_donations: 96925, protected_size: value, protected_kg_co2: 128412634 }], errorMessage: null }));
const dependencies = {
	now: () => clock,
	capture: async (url: string, policy: FetchPolicy) => {
		if (url === MA_FOREST_STATS_URL) {
			if (mode === 'limited') return { url: new URL(url), status: 429, headers: new Headers() };
			if (mode === 'forbidden') return { url: new URL(url), status: 403, headers: new Headers() };
			if (mode === 'unchanged') { assert.equal(policy.ifNoneMatch, '"ma-v1"'); conditionalSeen = true; return { url: new URL(url), status: 304, headers: new Headers() }; }
			return { url: new URL(url), status: 200, headers: new Headers({ etag: '"ma-v1"' }), body: statistics(mode === 'downward' ? 2_000_000 : 2_140_219) };
		}
		if (url === MA_FOREST_PAGE_URL) return { url: new URL(url), status: 200, headers: new Headers(), body: page(mode === 'downward' ? 'https://donate.wilderness-international.org?campaign=MA&new=1' : undefined) };
		throw new Error('Unexpected source URL.');
	},
	put: async (raw: Uint8Array) => { writes++; return { objectKey: `raw/test/${createId()}.gz`, bodySha256: createHash('sha256').update(raw).digest('hex') }; },
	remove: async () => {}
};
const runJob = () => processNextJob(`ma-test-${createId()}`, undefined, (jobId) => pollMaForest(jobId, dependencies));

const firstJobId = await scheduleMaForestPoll(clock);
assert.ok(firstJobId);
assert.equal((await runJob())?.status, 'observed');
const [source] = await database.select().from(sources).where(eq(sources.canonicalUrl, MA_FOREST_PAGE_URL));
assert.equal(source.adapterKey, 'wilderness-ma-counter');
assert.equal(source.health, 'healthy');
assert.equal((await database.select().from(sourceRuns).where(eq(sourceRuns.sourceId, source.id))).length, 1);
assert.equal((await database.select().from(sourceSnapshots)).length, 2);
assert.equal((await database.select().from(attentionItems).where(eq(attentionItems.entityId, source.id))).length, 1);
assert.equal(await scheduleMaForestPoll(clock), null, 'no second job is due immediately');
await database.insert(sourceRuns).values({ id: createId(), sourceId: source.id, outcome: 'success', extractorVersion: 'manual-v1', fetchedAt: new Date(clock.getTime() + 5 * 60 * 60 * 1000) });

mode = 'unchanged';
clock = new Date(clock.getTime() + 6 * 60 * 60 * 1000 + 1_000);
const secondJobId = await scheduleMaForestPoll(clock);
assert.ok(secondJobId);
assert.equal((await runJob())?.status, 'unchanged');
const [unchanged] = await database.select().from(sourceRuns).where(and(eq(sourceRuns.sourceId, source.id), eq(sourceRuns.extractorVersion, MA_FOREST_ADAPTER_VERSION))).orderBy(sourceRuns.fetchedAt).limit(2).then((rows) => rows.slice(-1));
assert.equal(unchanged.outcome, 'not_modified');
assert.equal(conditionalSeen, true);
assert.equal((await database.select().from(sourceSnapshots)).length, 3, 'a 304 has no new API body');

mode = 'downward';
clock = new Date(clock.getTime() + 6 * 60 * 60 * 1000 + 1_000);
const thirdJobId = await scheduleMaForestPoll(clock);
assert.ok(thirdJobId);
assert.equal((await runJob())?.status, 'observed');
const [changed] = await database.select({ entityDiff: operations.entityDiff }).from(operations).where(eq(operations.idempotencyKey, `ma-forest-poll:${thirdJobId}`));
assert.deepEqual((changed.entityDiff as { changes: string[] }).changes, ['destination_changed', 'counter_changed']);

mode = 'limited';
clock = new Date(clock.getTime() + 6 * 60 * 60 * 1000 + 1_000);
const fourthJobId = await scheduleMaForestPoll(clock);
assert.ok(fourthJobId);
assert.equal((await runJob())?.status, 'failed');
assert.equal((await database.select().from(jobs).where(eq(jobs.id, fourthJobId)))[0].lastError, 'ma_http_429');
assert.equal((await database.select().from(sources).where(eq(sources.id, source.id)))[0].health, 'paused');
assert.equal(await scheduleMaForestPoll(new Date(clock.getTime() + 24 * 60 * 60 * 1000)), null, 'paused source must not poll again');
assert.equal((await database.select().from(attentionItems).where(and(eq(attentionItems.entityType, 'job'), eq(attentionItems.entityId, fourthJobId)))).length, 0, 'domain failure already controls attention');
const userId = createId();
await database.insert(users).values({ id: userId, email: `ma-poll-${userId}@example.invalid`, displayName: 'Test steward', role: 'steward', passwordHash: 'test-only' });
const resumeInput = { sourceId: source.id, note: 'HTTP 429 geprüft; offizieller Endpunkt ist wieder erreichbar.', initiatingUserId: userId, idempotencyKey: createId() };
const resumed = await resumeMaForestPoll(resumeInput);
assert.equal(resumed.reused, false);
assert.deepEqual(await resumeMaForestPoll(resumeInput), { ...resumed, reused: true });
assert.equal((await database.select().from(sources).where(eq(sources.id, source.id)))[0].health, 'error');
mode = 'forbidden';
clock = new Date(clock.getTime() + 15 * 60 * 1000 + 1_000);
const fifthJobId = await scheduleMaForestPoll(clock);
assert.ok(fifthJobId);
assert.equal((await runJob())?.status, 'failed');
assert.equal((await database.select().from(jobs).where(eq(jobs.id, fifthJobId)))[0].lastError, 'ma_http_403');
assert.equal((await database.select().from(sources).where(eq(sources.id, source.id)))[0].health, 'paused');
assert.equal((await database.select().from(publications)).length, 0, 'polling never publishes content');
assert.equal(writes, 5);

console.log('MA-Forest first observation, 304, downward correction, destination review, 403/429 pause, and no public publication verified.');
process.exit(0);
