import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { createId } from '../src/lib/domain/ids';
import { getCurrentAction } from '../src/lib/server/actions/current';
import { getDatabase } from '../src/lib/server/db/client';
import { activityEvents, operations, publicationRevisions, users } from '../src/lib/server/db/schema';
import { publishCurrentAction } from '../src/lib/server/operations/publish-current-action';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for this disposable-database integration check.');
const database = getDatabase();
const userId = createId();
await database.insert(users).values({ id: userId, email: `action-${userId}@example.invalid`, displayName: 'Action integration test', role: 'steward', passwordHash: 'test-only' });

const firstInput = { kind: 'information' as const, label: 'Hilfe A', recipientName: 'Example Organisation', destinationUrl: 'https://example.org/a', evidenceUrl: 'https://example.org/source', expectedRevisionId: null, initiatingUserId: userId, idempotencyKey: `action-${createId()}` };
const first = await publishCurrentAction(firstInput);
assert.equal(first.reused, false);
assert.deepEqual(await publishCurrentAction(firstInput), { ...first, reused: true });
assert.equal((await getCurrentAction()).action?.id, first.actionId);

const endsAt = new Date('2099-01-01T00:00:00Z');
const second = await publishCurrentAction({ ...firstInput, label: 'Hilfe B', destinationUrl: 'https://example.org/b', endsAt, fallbackActionId: first.actionId, expectedRevisionId: first.revisionId, idempotencyKey: `action-${createId()}` });
assert.equal((await getCurrentAction()).action?.id, second.actionId);
assert.equal((await getCurrentAction(new Date('2099-01-01T00:00:01Z'))).action?.id, first.actionId);
assert.equal((await database.select().from(publicationRevisions).where(eq(publicationRevisions.id, second.revisionId))).length, 1);
assert.equal((await database.select().from(operations).where(eq(operations.id, second.operationId)))[0].status, 'applied');
assert.equal((await database.select().from(activityEvents).where(eq(activityEvents.operationId, second.operationId))).length, 3);
await assert.rejects(publishCurrentAction({ ...firstInput, label: 'Hilfe C', endsAt: new Date('2099-02-01T00:00:00Z'), fallbackActionId: second.actionId, expectedRevisionId: second.revisionId, idempotencyKey: `action-${createId()}` }), /unbefristete/);

console.log('Current action publication, idempotency, audit trail, and expiry fallback verified.');
process.exit(0);
