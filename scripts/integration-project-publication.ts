import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { createId } from '../src/lib/domain/ids';
import { getDatabase } from '../src/lib/server/db/client';
import { activityEvents, claims, users } from '../src/lib/server/db/schema';
import { createClaimDraft } from '../src/lib/server/operations/create-claim-draft';
import { createProjectDraft } from '../src/lib/server/operations/create-project-draft';
import { publishClaim } from '../src/lib/server/operations/publish-claim';
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
await publishClaim({ ...secondInput, expectedPublicationRevisionId: first.revisionId });
assert.equal((await getPublishedProject(slug))?.project.claims.length, 2, 'timeline must derive from published claims');

console.log('Private project, evidence-backed publication, rollback, audit, and timeline verified.');
process.exit(0);
