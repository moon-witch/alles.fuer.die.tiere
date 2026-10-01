import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { createId } from '../src/lib/domain/ids';
import { getDatabase } from '../src/lib/server/db/client';
import { claims, claimEvidence, operations, projects, users } from '../src/lib/server/db/schema';
import { createClaimDraft } from '../src/lib/server/operations/create-claim-draft';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the database integration check.');

const database = getDatabase();
const suffix = createId();
const userId = createId();
const projectId = createId();
const idempotencyKey = `integration-claim-${suffix}`;

await database.insert(users).values({ id: userId, email: `integration-${suffix}@example.invalid`, displayName: 'Integration test', role: 'steward', passwordHash: 'not-a-real-password-hash' });
await database.insert(projects).values({ id: projectId, slug: `integration-${suffix}`, name: 'Integration project', summary: 'Temporary test content', status: 'active' });

const input = { projectId, statement: 'A private, evidence-linked claim.', kind: 'status' as const, sourceUrl: 'https://example.invalid/source', passage: 'Exact supporting passage.', observedAt: new Date('2026-09-28T12:00:00Z'), initiatingUserId: userId, idempotencyKey };
const first = await createClaimDraft(input);
const repeated = await createClaimDraft(input);
assert.equal(first.reused, false);
assert.equal(repeated.reused, true);
assert.equal(repeated.claimId, first.claimId);

const savedClaims = await database.select().from(claims).where(eq(claims.id, first.claimId));
const savedEvidence = await database.select().from(claimEvidence).where(eq(claimEvidence.claimId, first.claimId));
const savedOperations = await database.select().from(operations).where(eq(operations.id, first.operationId));
assert.equal(savedClaims.length, 1);
assert.equal(savedClaims[0].visibility, 'private');
assert.equal(savedClaims[0].editorialStatus, 'draft');
assert.equal(savedEvidence.length, 1);
assert.equal(savedOperations[0].status, 'applied');

console.log('Database integration check passed: private claim draft, evidence, audit operation, and idempotency verified.');
process.exit(0);
