import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { createId } from '../src/lib/domain/ids';
import { getDatabase } from '../src/lib/server/db/client';
import { activityEvents, attentionItems, claims, operations, projects, users } from '../src/lib/server/db/schema';
import { createClaimDraft } from '../src/lib/server/operations/create-claim-draft';
import { createProjectDraft } from '../src/lib/server/operations/create-project-draft';
import { publishClaim } from '../src/lib/server/operations/publish-claim';
import { getClaimRevertPreview, revertClaimPublication } from '../src/lib/server/operations/revert-claim-publication';
import { getPublishedProject, listPublishedProjects } from '../src/lib/server/public/projects';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for this disposable-database integration check.');
const database = getDatabase();
const userId = createId();
const slug = `test-project-${createId().slice(0, 8)}`;
await database.insert(users).values({ id: userId, email: `project-${userId}@example.invalid`, displayName: 'Project integration test', role: 'steward', passwordHash: 'test-only' });
const project = await createProjectDraft({ name: 'Testprojekt', slug, initiatingUserId: userId, idempotencyKey: `project-${createId()}` });
assert.equal(await getPublishedProject(slug), null, 'private project must not appear publicly');

const draft = await createClaimDraft({ projectId: project.projectId, kind: 'milestone', statement: 'Ein belegter Meilenstein.', sourceUrl: 'https://example.org/report', passage: 'Genaue stützende Stelle.', occursAt: new Date('2026-09-28T12:00:00Z'), observedAt: new Date('2026-10-01T12:00:00Z'), initiatingUserId: userId, idempotencyKey: `claim-${createId()}` });
const input = { claimId: draft.claimId, expectedClaimRevision: '1', expectedPublicationRevisionId: null, initiatingUserId: userId, idempotencyKey: `publish-${createId()}` };
const first = await publishClaim(input);
assert.equal(first.reused, false);
assert.deepEqual(await publishClaim(input), { ...first, reused: true });
assert.equal((await getPublishedProject(slug))?.project.claims[0].statement, 'Ein belegter Meilenstein.');
assert.equal((await listPublishedProjects()).some((entry) => entry.project.slug === slug), true);
assert.equal((await database.select().from(activityEvents).where(eq(activityEvents.operationId, first.operationId))).length, 3);

const secondDraft = await createClaimDraft({ projectId: project.projectId, kind: 'status', statement: 'Ein weiterer belegter Stand.', sourceUrl: 'https://example.org/update', passage: 'Genaue zweite Stelle.', observedAt: new Date('2026-10-02T12:00:00Z'), initiatingUserId: userId, idempotencyKey: `claim-${createId()}` });
const secondInput = { ...input, claimId: secondDraft.claimId, idempotencyKey: `publish-${createId()}` };
await assert.rejects(publishClaim(secondInput), /seit der Vorschau geändert/);
assert.equal((await database.select().from(claims).where(eq(claims.id, secondDraft.claimId)))[0].visibility, 'private', 'failed publication must roll back claim visibility');
const second = await publishClaim({ ...secondInput, expectedPublicationRevisionId: first.revisionId });
assert.equal((await getPublishedProject(slug))?.project.claims.length, 2, 'timeline must derive from published claims');
const staleInput = { targetOperationId: first.operationId, expectedRevisionId: first.revisionId, initiatingUserId: userId, idempotencyKey: `revert-${createId()}` };
const conflict = await revertClaimPublication(staleInput);
assert.equal(conflict.status, 'failed', 'a newer project publication blocks the old revert');
assert.equal((await database.select().from(attentionItems).where(eq(attentionItems.operationId, conflict.operationId))).length, 1);
assert.equal((await getPublishedProject(slug))?.project.claims.length, 2);

const revertSecondInput = { targetOperationId: second.operationId, expectedRevisionId: second.revisionId, initiatingUserId: userId, idempotencyKey: `revert-${createId()}` };
assert.equal((await getClaimRevertPreview(second.operationId))?.remainingClaims, 1);
const revertedSecond = await revertClaimPublication(revertSecondInput);
assert.equal(revertedSecond.status, 'applied');
assert.deepEqual(await revertClaimPublication(revertSecondInput), { ...revertedSecond, reused: true });
assert.equal((await getPublishedProject(slug))?.project.claims.length, 1);
assert.equal((await database.select().from(claims).where(eq(claims.id, secondDraft.claimId)))[0].visibility, 'private');
assert.equal((await database.select().from(operations).where(eq(operations.id, second.operationId)))[0].inverseOperationId, revertedSecond.operationId);
assert.equal((await database.select().from(activityEvents).where(eq(activityEvents.operationId, revertedSecond.operationId))).length, 3);

const singleSlug = `test-single-${createId().slice(0, 8)}`;
const singleProject = await createProjectDraft({ name: 'Einzelprojekt', slug: singleSlug, initiatingUserId: userId, idempotencyKey: `project-${createId()}` });
const singleDraft = await createClaimDraft({ projectId: singleProject.projectId, kind: 'status', statement: 'Ein einzelner belegter Stand.', sourceUrl: 'https://example.org/single', passage: 'Stützende Stelle.', observedAt: new Date('2026-10-02T12:00:00Z'), initiatingUserId: userId, idempotencyKey: `claim-${createId()}` });
const singlePublication = await publishClaim({ claimId: singleDraft.claimId, expectedClaimRevision: '1', expectedPublicationRevisionId: null, initiatingUserId: userId, idempotencyKey: `publish-${createId()}` });
assert.equal((await getClaimRevertPreview(singlePublication.operationId))?.remainingClaims, 0);
const removeSingle = await revertClaimPublication({ targetOperationId: singlePublication.operationId, expectedRevisionId: singlePublication.revisionId, initiatingUserId: userId, idempotencyKey: `revert-${createId()}` });
assert.equal(removeSingle.status, 'applied');
assert.equal(await getPublishedProject(singleSlug), null, 'reverting the only claim removes the public project page');
assert.equal((await database.select().from(projects).where(eq(projects.id, singleProject.projectId)))[0].visibility, 'private');

console.log('Private project, evidence-backed publication, compensating revert, conflict, audit, and timeline verified.');
process.exit(0);
