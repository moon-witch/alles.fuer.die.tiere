import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { createId } from '../src/lib/domain/ids';
import { getCurrentAction } from '../src/lib/server/actions/current';
import { getDatabase } from '../src/lib/server/db/client';
import { verifyPublication } from '../src/lib/server/jobs/verify-publication';
import { actions, activityEvents, attentionItems, jobs, operations, publicationRevisions, users } from '../src/lib/server/db/schema';
import { publishCurrentAction } from '../src/lib/server/operations/publish-current-action';
import { getCurrentActionRevertPreview, revertCurrentAction } from '../src/lib/server/operations/revert-current-action';
import { resolveAttentionItem } from '../src/lib/server/operations/resolve-attention-item';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for this disposable-database integration check.');
const database = getDatabase();
const userId = createId();
await database.insert(users).values({ id: userId, email: `action-${userId}@example.invalid`, displayName: 'Action integration test', role: 'steward', passwordHash: 'test-only' });

const firstInput = { kind: 'information' as const, label: 'Hilfe A', recipientName: 'Example Organisation', destinationUrl: 'https://example.org/a', evidenceUrl: 'https://example.org/source', expectedRevisionId: null, initiatingUserId: userId, idempotencyKey: `action-${createId()}` };
const first = await publishCurrentAction(firstInput);
assert.equal(first.reused, false);
assert.deepEqual(await publishCurrentAction(firstInput), { ...first, reused: true });
assert.equal((await getCurrentAction()).action?.id, first.actionId);
assert.equal(await verifyPublication({ revisionId: first.revisionId, route: '/jetzt' }), 'current');
const removeFirstInput = { targetOperationId: first.operationId, expectedRevisionId: first.revisionId, initiatingUserId: userId, idempotencyKey: `revert-${createId()}` };
assert.equal((await getCurrentActionRevertPreview(first.operationId))?.restoredAction, null);
const removeFirst = await revertCurrentAction(removeFirstInput);
assert.equal(removeFirst.status, 'applied');
assert.deepEqual(await revertCurrentAction(removeFirstInput), { ...removeFirst, reused: true });
assert.equal((await getCurrentAction()).action, null, 'reverting the first publication leaves a safe empty state');
assert.equal(await verifyPublication({ revisionId: first.revisionId, route: '/jetzt' }), 'superseded');
assert.equal((await database.select().from(operations).where(eq(operations.id, first.operationId)))[0].status, 'reverted');

const base = await publishCurrentAction({ ...firstInput, expectedRevisionId: null, idempotencyKey: `action-${createId()}` });

const endsAt = new Date('2099-01-01T00:00:00Z');
const second = await publishCurrentAction({ ...firstInput, label: 'Hilfe B', destinationUrl: 'https://example.org/b', endsAt, fallbackActionId: base.actionId, expectedRevisionId: base.revisionId, idempotencyKey: `action-${createId()}` });
assert.equal((await getCurrentAction()).action?.id, second.actionId);
assert.equal((await getCurrentAction(new Date('2099-01-01T00:00:01Z'))).action?.id, base.actionId);
assert.equal((await database.select().from(publicationRevisions).where(eq(publicationRevisions.id, second.revisionId))).length, 1);
assert.equal((await database.select().from(operations).where(eq(operations.id, second.operationId)))[0].status, 'applied');
assert.equal((await database.select().from(activityEvents).where(eq(activityEvents.operationId, second.operationId))).length, 3);
await assert.rejects(publishCurrentAction({ ...firstInput, label: 'Hilfe C', endsAt: new Date('2099-02-01T00:00:00Z'), fallbackActionId: second.actionId, expectedRevisionId: second.revisionId, idempotencyKey: `action-${createId()}` }), /unbefristete/);
const staleInput = { targetOperationId: base.operationId, expectedRevisionId: base.revisionId, initiatingUserId: userId, idempotencyKey: `revert-${createId()}` };
const conflict = await revertCurrentAction(staleInput);
assert.equal(conflict.status, 'failed', 'an intervening publication must block the revert');
assert.deepEqual(await revertCurrentAction(staleInput), { ...conflict, reused: true });
assert.equal((await database.select().from(attentionItems).where(eq(attentionItems.operationId, conflict.operationId))).length, 1);
assert.equal((await getCurrentAction()).action?.id, second.actionId, 'conflict must leave the public route unchanged');
const [attention] = await database.select().from(attentionItems).where(eq(attentionItems.operationId, conflict.operationId));
const resolveInput = { attentionItemId: attention.id, note: 'Neuere Veröffentlichung geprüft; die passende Aktion bleibt sichtbar.', initiatingUserId: userId, idempotencyKey: `resolve-${createId()}` };
const resolved = await resolveAttentionItem(resolveInput);
assert.deepEqual(await resolveAttentionItem(resolveInput), { ...resolved, reused: true });
assert.equal((await database.select().from(attentionItems).where(eq(attentionItems.id, attention.id)))[0].status, 'resolved');
assert.equal((await database.select().from(activityEvents).where(eq(activityEvents.operationId, resolved.operationId))).length, 2);
assert.equal((await getCurrentAction()).action?.id, second.actionId, 'resolving attention must not publish content');

const revertSecondInput = { targetOperationId: second.operationId, expectedRevisionId: second.revisionId, initiatingUserId: userId, idempotencyKey: `revert-${createId()}` };
assert.equal((await getCurrentActionRevertPreview(second.operationId))?.restoredAction?.id, base.actionId);
const revertedSecond = await revertCurrentAction(revertSecondInput);
assert.equal(revertedSecond.status, 'applied');
assert.equal((await getCurrentAction()).action?.id, base.actionId);
assert.equal((await database.select().from(actions).where(eq(actions.id, second.actionId)))[0].visibility, 'archived');
assert.equal((await database.select().from(activityEvents).where(eq(activityEvents.operationId, revertedSecond.operationId))).length, 3);
assert.equal((await database.select().from(operations).where(eq(operations.id, second.operationId)))[0].inverseOperationId, revertedSecond.operationId);
assert.equal((await database.select().from(jobs).where(inArray(jobs.dedupeKey, [first, base, second].map((publication) => `publication.verify:${publication.revisionId}`)))).length, 0, 'verification jobs stay disabled until the worker is configured');

console.log('Current action publication, expiry fallback, compensating revert, conflict, and audit trail verified.');
process.exit(0);
