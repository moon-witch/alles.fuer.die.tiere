import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { validPublicUrl } from '$lib/domain/action-policy';
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
	if (!input.statement.trim() || !input.passage.trim()) throw new Error('Ein Faktenentwurf braucht eine Aussage und eine genaue Belegstelle.');
	if (input.statement.length > 1000 || input.passage.length > 4000) throw new Error('Aussage oder Belegstelle ist zu lang.');
	if (!validPublicUrl(input.sourceUrl)) throw new Error('Eine öffentliche HTTPS-Quelle ist erforderlich.');
	if (!['milestone', 'status', 'outcome', 'context'].includes(input.kind)) throw new Error('Die Faktenart ist nicht zulässig.');
	if (!Number.isFinite(input.observedAt.getTime()) || (input.occursAt && !Number.isFinite(input.occursAt.getTime()))) throw new Error('Das Datum ist ungültig.');
	if (!input.idempotencyKey || input.idempotencyKey.length > 128) throw new Error('Ungültige Anfragekennung.');
	const comparableInput = { projectId: input.projectId, statement: input.statement.trim(), kind: input.kind, occursAt: input.occursAt?.toISOString() ?? null, sourceUrl: input.sourceUrl, passage: input.passage.trim(), initiatingUserId: input.initiatingUserId, instruction: input.instruction ?? null };
	const hash = requestHash(comparableInput);
	const database = getDatabase();
	return database.transaction(async (tx) => {
		const operationId = createId();
		const claimId = createId();
		const correlationId = createId();
		const operationInput = { ...comparableInput, observedAt: input.observedAt.toISOString() };
		const inserted = await tx.insert(operations).values({ id: operationId, status: 'proposed', type: 'claim.draft', origin: 'admin', initiatingUserId: input.initiatingUserId, instruction: input.instruction, idempotencyKey: input.idempotencyKey, requestHash: hash, input: operationInput, correlationId }).onConflictDoNothing().returning({ id: operations.id });
		if (!inserted.length) {
			const [existing] = await tx.select({ id: operations.id, entityDiff: operations.entityDiff, requestHash: operations.requestHash, status: operations.status }).from(operations).where(eq(operations.idempotencyKey, input.idempotencyKey)).limit(1);
			if (!existing || existing.requestHash !== hash || existing.status !== 'applied') throw new Error('Diese Anfragekennung wurde bereits anders verwendet.');
			const claimId = (existing.entityDiff as { claimId?: string } | null)?.claimId;
			if (!claimId) throw new Error('The existing operation has no claim result.');
			return { operationId: existing.id, claimId, reused: true };
		}
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.proposed', origin: 'admin', severity: 'info', summary: 'Quellenbasierter Faktenentwurf wurde vorbereitet.', correlationId, payload: { claimId } });
		await tx.insert(claims).values({ id: claimId, projectId: input.projectId, kind: input.kind, statement: input.statement.trim(), occurredAt: input.occursAt, visibility: 'private', editorialStatus: 'draft' });
		await tx.insert(claimEvidence).values({ id: createId(), claimId, sourceUrl: input.sourceUrl, passage: input.passage.trim(), observedAt: input.observedAt });
		await tx.update(operations).set({ status: 'applied', entityDiff: { claimId, visibility: 'private', editorialStatus: 'draft' } }).where(eq(operations.id, operationId));
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.applied', origin: 'admin', severity: 'info', summary: 'Privater Faktenentwurf wurde mit Quelle gespeichert.', correlationId, payload: { claimId, publicEffect: 'none' } });
		return { operationId, claimId, reused: false };
	});
};
