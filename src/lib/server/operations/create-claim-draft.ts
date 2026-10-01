import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createId } from '$lib/domain/ids';
import { getDatabase } from '$lib/server/db/client';
import { activityEvents, claimEvidence, claims, operations } from '$lib/server/db/schema';

export type ClaimDraftInput = {
	projectId: string;
	statement: string;
	kind: 'milestone' | 'status' | 'outcome' | 'context';
	occursAt?: Date;
	sourceUrl: string;
	passage: string;
	observedAt: Date;
	initiatingUserId: string;
	instruction?: string;
	idempotencyKey: string;
};

export type ClaimDraftResult = { operationId: string; claimId: string; reused: boolean };

const requestHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/**
 * A first vertical operation: a source-backed claim becomes a private draft.
 * Publishing remains a separate explicit operation so an observation can never
 * modify a public project page directly.
 */
export const createClaimDraft = async (input: ClaimDraftInput): Promise<ClaimDraftResult> => {
	if (!input.statement.trim() || !input.passage.trim()) throw new Error('A claim draft requires a statement and exact evidence.');
	const database = getDatabase();
	return database.transaction(async (tx) => {
		const existing = await tx.select({ id: operations.id, entityDiff: operations.entityDiff }).from(operations).where(eq(operations.idempotencyKey, input.idempotencyKey)).limit(1);
		if (existing[0]) {
			const claimId = (existing[0].entityDiff as { claimId?: string } | null)?.claimId;
			if (!claimId) throw new Error('The existing operation has no claim result.');
			return { operationId: existing[0].id, claimId, reused: true };
		}
		const operationId = createId();
		const claimId = createId();
		const correlationId = createId();
		const operationInput = { ...input, occursAt: input.occursAt?.toISOString(), observedAt: input.observedAt.toISOString() };
		await tx.insert(operations).values({ id: operationId, status: 'proposed', type: 'claim.draft', origin: 'admin', initiatingUserId: input.initiatingUserId, instruction: input.instruction, idempotencyKey: input.idempotencyKey, requestHash: requestHash(operationInput), input: operationInput, correlationId });
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.proposed', origin: 'admin', severity: 'info', summary: 'Quellenbasierter Faktenentwurf wurde vorbereitet.', correlationId, payload: { claimId } });
		await tx.insert(claims).values({ id: claimId, projectId: input.projectId, kind: input.kind, statement: input.statement.trim(), occurredAt: input.occursAt, visibility: 'private', editorialStatus: 'draft' });
		await tx.insert(claimEvidence).values({ id: createId(), claimId, sourceUrl: input.sourceUrl, passage: input.passage.trim(), observedAt: input.observedAt });
		await tx.update(operations).set({ status: 'applied', entityDiff: { claimId, visibility: 'private', editorialStatus: 'draft' } }).where(eq(operations.id, operationId));
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.applied', origin: 'admin', severity: 'info', summary: 'Privater Faktenentwurf wurde mit Quelle gespeichert.', correlationId, payload: { claimId, publicEffect: 'none' } });
		return { operationId, claimId, reused: false };
	});
};
