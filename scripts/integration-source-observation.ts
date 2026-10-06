import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createId } from '../src/lib/domain/ids';
import { getDatabase } from '../src/lib/server/db/client';
import { activityEvents, attentionItems, claimEvidence, claims, operations, sourceRuns, sourceSnapshots, sources, users } from '../src/lib/server/db/schema';
import { createProjectDraft } from '../src/lib/server/operations/create-project-draft';
import { observeSource } from '../src/lib/server/operations/observe-source';
import { getSourceReview, listSourceRegistry } from '../src/lib/server/ingestion/source-review';
import { publishClaim } from '../src/lib/server/operations/publish-claim';
import { getPublishedProject } from '../src/lib/server/public/projects';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for this disposable-database integration check.');
const database = getDatabase();
const userId = createId();
await database.insert(users).values({ id: userId, email: `source-${userId}@example.invalid`, displayName: 'Source integration test', role: 'steward', passwordHash: 'test-only' });
const slug = `source-test-${createId().slice(0, 8)}`;
const project = await createProjectDraft({ name: 'Quellenprojekt', slug, initiatingUserId: userId, idempotencyKey: `project-${createId()}` });
let fetchCount = 0;
let storeCount = 0;
const body = new TextEncoder().encode('<html><body>Genaue Belegstelle.</body></html>');
const dependencies = {
	capture: async () => { fetchCount++; return { url: new URL('https://example.org/report'), status: 200, headers: new Headers({ 'content-type': 'text/html', etag: '"source-v1"' }), body }; },
	put: async () => { storeCount++; return { objectKey: `raw/test/${createId()}.gz`, bodySha256: createHash('sha256').update(body).digest('hex') }; },
	remove: async () => {}
};
const input = { projectId: project.projectId, name: 'Testbericht', owner: 'Beispielorganisation', sourceType: 'official_page' as const, authority: 'official' as const, url: 'https://example.org/report', kind: 'milestone' as const, statement: 'Ein belegter Meilenstein.', passage: 'Genaue Belegstelle.', rightsNote: 'Öffentlich verlinken; keine Medien übernehmen.', sensitivity: 'none' as const, initiatingUserId: userId, idempotencyKey: `source-${createId()}` };
const observed = await observeSource(input, dependencies);
assert.equal(observed.reused, false);
assert.deepEqual(await observeSource(input, dependencies), { ...observed, reused: true });
assert.equal(fetchCount, 1);
assert.equal(storeCount, 1);
assert.equal((await database.select().from(operations).where(eq(operations.id, observed.operationId)))[0].status, 'applied');
assert.equal((await database.select().from(activityEvents).where(eq(activityEvents.operationId, observed.operationId))).length, 3);
const [evidence] = await database.select().from(claimEvidence).where(eq(claimEvidence.claimId, observed.claimId));
assert.equal(evidence.sourceSnapshotId, observed.snapshotId);
const [snapshot] = await database.select().from(sourceSnapshots).where(eq(sourceSnapshots.id, observed.snapshotId));
assert.equal(snapshot.bodySha256, createHash('sha256').update(body).digest('hex'));
assert.equal((snapshot.normalizedExtract as { verification: string }).verification, 'manual_review_required');
const [run] = await database.select().from(sourceRuns).where(eq(sourceRuns.id, snapshot.sourceRunId));
assert.equal(run.etag, '"source-v1"');
assert.equal(run.extractorVersion, 'manual-v1');
const [reviewSource] = await database.select().from(sources).where(eq(sources.id, run.sourceId));
const review = await getSourceReview(reviewSource.id);
assert.equal(review?.source.health, 'healthy');
assert.equal(review?.runs[0].id, run.id);
assert.equal(review?.snapshots[0].bodySha256, snapshot.bodySha256);
assert.equal(review?.evidence[0].claimId, observed.claimId);
assert.equal(review?.evidence[0].passage, input.passage);
assert.ok((await listSourceRegistry()).some((item) => item.id === reviewSource.id));
assert.equal((await database.select().from(attentionItems).where(eq(attentionItems.operationId, observed.operationId)))[0].status, 'open');
assert.equal(await getPublishedProject(slug), null, 'observation remains private');

const [claim] = await database.select().from(claims).where(eq(claims.id, observed.claimId));
await publishClaim({ claimId: observed.claimId, expectedClaimRevision: claim.revision, expectedPublicationRevisionId: null, initiatingUserId: userId, idempotencyKey: `publish-${createId()}` });
assert.equal((await getPublishedProject(slug))?.project.claims[0].evidence[0].url, 'https://example.org/report');

const failed = { ...input, url: 'https://example.org/limited', idempotencyKey: `source-${createId()}` };
await assert.rejects(observeSource(failed, { ...dependencies, capture: async () => ({ url: new URL(failed.url), status: 429, headers: new Headers() }) }), /HTTP 429/);
const [failedSource] = await database.select().from(sources).where(eq(sources.canonicalUrl, failed.url));
assert.equal(failedSource.health, 'paused');
assert.equal((await database.select().from(sourceRuns).where(eq(sourceRuns.sourceId, failedSource.id)))[0].outcome, 'failed');
const failedReview = await getSourceReview(failedSource.id);
assert.equal(failedReview?.runs.length, 1);
assert.equal(failedReview?.snapshots.length, 0);
assert.equal(failedReview?.evidence.length, 0, 'a source detail must not show another source\'s evidence');

console.log('Source snapshot provenance, private draft, source review, idempotency, publication link, and failure attention verified.');
process.exit(0);
