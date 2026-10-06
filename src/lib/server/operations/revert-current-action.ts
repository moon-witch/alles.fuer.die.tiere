import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { parseCurrentActionPublication, resolveCurrentAction, type CurrentActionPublication } from '$lib/domain/current-action';
import { createId } from '$lib/domain/ids';
import { getDatabase } from '$lib/server/db/client';
import { actions, activityEvents, attentionItems, jobs, operations, publicationRevisions, publications } from '$lib/server/db/schema';

type ActionDiff = { before?: string | null; after?: string };

const readDiff = (value: unknown): { before: string | null; after: string } | null => {
	if (!value || typeof value !== 'object') return null;
	const diff = value as ActionDiff;
	return (diff.before === null || typeof diff.before === 'string') && typeof diff.after === 'string'
		? { before: diff.before, after: diff.after }
		: null;
};

export const getCurrentActionRevertPreview = async (targetOperationId: string) => {
	const database = getDatabase();
	const [target] = await database.select().from(operations).where(eq(operations.id, targetOperationId)).limit(1);
	if (!target || target.type !== 'action.set_primary') return null;
	const diff = readDiff(target.publicationDiff);
	if (!diff) return null;
	const [publication] = await database.select().from(publications).where(eq(publications.route, '/jetzt')).limit(1);
	const [prior] = diff.before
		? await database.select().from(publicationRevisions).where(eq(publicationRevisions.id, diff.before)).limit(1)
		: [undefined];
	const priorPublication = diff.before ? parseCurrentActionPublication(prior?.payload) : null;
	const restoredAction = resolveCurrentAction(priorPublication);
	let reason: string | null = null;
	if (target.status !== 'applied') reason = 'Diese Änderung wurde bereits rückgängig gemacht oder ist nicht mehr aktiv.';
	else if (publication?.currentRevisionId !== diff.after) reason = 'Es gibt eine neuere Veröffentlichung. Prüfe sie und erstelle eine gezielte Korrektur.';
	else if (diff.before && (!prior || prior.publicationId !== publication.id || !priorPublication)) reason = 'Die vorherige Veröffentlichung kann nicht sicher wiederhergestellt werden.';
	else if (restoredAction) {
		const [record] = await database.select().from(actions).where(eq(actions.id, restoredAction.id)).limit(1);
		if (!record || record.visibility !== 'public' || record.reviewStatus !== 'published' || record.state !== 'active') reason = 'Die vorherige Aktion ist nicht mehr freigegeben.';
	}
	return { targetOperationId, targetStatus: target.status, expectedRevisionId: diff.after, beforeRevisionId: diff.before, currentRevisionId: publication?.currentRevisionId ?? null, restoredAction, reason };
};

export const revertCurrentAction = async (input: { targetOperationId: string; expectedRevisionId: string; initiatingUserId: string; idempotencyKey: string }) => {
	if (!input.idempotencyKey || input.idempotencyKey.length > 128) throw new Error('Ungültige Anfragekennung.');
	const requestHash = createHash('sha256').update(JSON.stringify({ targetOperationId: input.targetOperationId, expectedRevisionId: input.expectedRevisionId })).digest('hex');
	return getDatabase().transaction(async (tx) => {
		const operationId = createId();
		const correlationId = createId();
		const inserted = await tx.insert(operations).values({ id: operationId, type: 'action.revert', status: 'proposed', origin: 'admin', initiatingUserId: input.initiatingUserId, idempotencyKey: input.idempotencyKey, requestHash, input: { targetOperationId: input.targetOperationId, expectedRevisionId: input.expectedRevisionId }, correlationId }).onConflictDoNothing().returning({ id: operations.id });
		if (!inserted.length) {
			const [existing] = await tx.select().from(operations).where(eq(operations.idempotencyKey, input.idempotencyKey)).limit(1);
			if (!existing || existing.requestHash !== requestHash || !['applied', 'failed'].includes(existing.status)) throw new Error('Diese Anfragekennung wurde bereits anders verwendet.');
			return { operationId: existing.id, status: existing.status, reused: true };
		}
		const [target] = await tx.select().from(operations).where(eq(operations.id, input.targetOperationId)).limit(1);
		const diff = target?.type === 'action.set_primary' ? readDiff(target.publicationDiff) : null;
		if (!target || !diff) throw new Error('Diese Änderung kann nicht automatisch rückgängig gemacht werden.');
		const now = new Date();
		const [publication] = await tx.update(publications).set({ updatedAt: now }).where(eq(publications.route, '/jetzt')).returning();
		if (!publication) throw new Error('Die Veröffentlichung wurde nicht gefunden.');
		const [prior] = diff.before
			? await tx.select().from(publicationRevisions).where(eq(publicationRevisions.id, diff.before)).limit(1)
			: [undefined];
		const priorPublication = diff.before ? parseCurrentActionPublication(prior?.payload) : null;
		if (diff.before && (!prior || prior.publicationId !== publication.id || !priorPublication)) throw new Error('Die vorherige Veröffentlichung kann nicht sicher wiederhergestellt werden.');
		const restoredAction = resolveCurrentAction(priorPublication, now);
		if (restoredAction) {
			const [record] = await tx.select().from(actions).where(eq(actions.id, restoredAction.id)).limit(1);
			if (!record || record.visibility !== 'public' || record.reviewStatus !== 'published' || record.state !== 'active') throw new Error('Die vorherige Aktion ist nicht mehr freigegeben.');
		}
		if (target.status !== 'applied' || publication.currentRevisionId !== diff.after || input.expectedRevisionId !== diff.after) {
			const reason = 'Eine neuere Änderung verhindert das automatische Rückgängigmachen.';
			await tx.insert(attentionItems).values({ id: createId(), kind: 'revert_conflict', severity: 'warning', summary: reason, entityType: 'operation', entityId: target.id, operationId });
			await tx.update(operations).set({ status: 'failed', entityDiff: { reason, targetOperationId: target.id, currentRevisionId: publication.currentRevisionId }, updatedAt: now }).where(eq(operations.id, operationId));
			await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.failed', origin: 'admin', severity: 'warning', summary: reason, correlationId, payload: { targetOperationId: target.id, currentRevisionId: publication.currentRevisionId } });
			return { operationId, status: 'failed' as const, reused: false };
		}
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.proposed', origin: 'admin', severity: 'info', summary: 'Rückgängigmachen der aktuellen Hilfe wurde bestätigt.', correlationId, payload: { targetOperationId: target.id, route: '/jetzt' } });
		const originalActionId = (target.entityDiff as { actionId?: string } | null)?.actionId;
		if (originalActionId) await tx.update(actions).set({ state: 'reverted', visibility: 'archived', updatedAt: now }).where(eq(actions.id, originalActionId));
		let revisionId: string | null = null;
		if (priorPublication) {
			revisionId = createId();
			const payload: CurrentActionPublication = { ...priorPublication, publishedAt: now.toISOString() };
			await tx.insert(publicationRevisions).values({ id: revisionId, publicationId: publication.id, operationId, payload, templateVersion: 'current-action-v1', renderedDiff: { restoredFromRevisionId: diff.before, revertedRevisionId: diff.after }, publishedAt: now });
		}
		await tx.update(publications).set({ currentRevisionId: revisionId, status: revisionId ? 'published' : 'archived', updatedAt: now }).where(eq(publications.id, publication.id));
		await tx.update(operations).set({ status: 'applied', entityDiff: { targetOperationId: target.id, originalActionId, restoredActionId: restoredAction?.id ?? null }, publicationDiff: { route: '/jetzt', before: diff.after, after: revisionId }, updatedAt: now }).where(eq(operations.id, operationId));
		await tx.update(operations).set({ status: 'reverted', inverseOperationId: operationId, updatedAt: now }).where(eq(operations.id, target.id));
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.applied', origin: 'admin', severity: 'info', summary: 'Die Änderung der aktuellen Hilfe wurde rückgängig gemacht.', publicEffect: '/jetzt wurde wiederhergestellt.', correlationId, payload: { targetOperationId: target.id, revisionId } });
		await tx.insert(activityEvents).values({ id: createId(), operationId, publicationRevisionId: revisionId, eventType: revisionId ? 'publication.published' : 'publication.unpublished', origin: 'admin', severity: 'info', summary: revisionId ? 'Vorherige aktuelle Hilfe wurde erneut veröffentlicht.' : 'Aktuelle Hilfe wurde entfernt.', publicEffect: revisionId ? '/jetzt zeigt die vorherige Aktion.' : '/jetzt zeigt keine Aktion.', correlationId, payload: { targetOperationId: target.id, revisionId, route: '/jetzt' } });
		if (revisionId && process.env.PUBLICATION_VERIFY_JOBS_ENABLED === 'true') await tx.insert(jobs).values({ id: createId(), kind: 'publication.verify', dedupeKey: `publication.verify:${revisionId}`, payload: { revisionId, route: '/jetzt', correlationId }, runAt: now, maxAttempts: '3' });
		return { operationId, status: 'applied' as const, reused: false };
	});
};
