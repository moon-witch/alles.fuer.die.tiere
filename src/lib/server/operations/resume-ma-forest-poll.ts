import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { createId } from '$lib/domain/ids';
import { getDatabase } from '$lib/server/db/client';
import { activityEvents, operations, sources } from '$lib/server/db/schema';
import { MA_FOREST_PAGE_URL } from '$lib/server/ingestion/ma-forest';

export const resumeMaForestPoll = async (input: { sourceId: string; note: string; initiatingUserId: string; idempotencyKey: string }): Promise<{ operationId: string; reused: boolean }> => {
	const note = input.note.trim();
	if (!note || note.length > 1000) throw new Error('Ein kurzer Prüfvermerk ist erforderlich.');
	if (!input.idempotencyKey || input.idempotencyKey.length > 128) throw new Error('Ungültige Anfragekennung.');
	const requestHash = createHash('sha256').update(JSON.stringify({ sourceId: input.sourceId, note })).digest('hex');
	return getDatabase().transaction(async (tx) => {
		const [existing] = await tx.select({ id: operations.id, status: operations.status, requestHash: operations.requestHash }).from(operations).where(eq(operations.idempotencyKey, input.idempotencyKey)).limit(1);
		if (existing) {
			if (existing.status !== 'applied' || existing.requestHash !== requestHash) throw new Error('Diese Anfragekennung wurde bereits anders verwendet.');
			return { operationId: existing.id, reused: true };
		}
		const [source] = await tx.select({ id: sources.id, canonicalUrl: sources.canonicalUrl, adapterKey: sources.adapterKey, health: sources.health }).from(sources).where(eq(sources.id, input.sourceId)).limit(1);
		if (!source || source.canonicalUrl !== MA_FOREST_PAGE_URL || source.adapterKey !== 'wilderness-ma-counter' || source.health !== 'paused') throw new Error('Diese MA-Forest-Quelle ist nicht pausiert.');
		const operationId = createId();
		const correlationId = createId();
		const now = new Date();
		const inserted = await tx.insert(operations).values({ id: operationId, type: 'source.poll_resume', status: 'applied', origin: 'admin', initiatingUserId: input.initiatingUserId, idempotencyKey: input.idempotencyKey, requestHash, input: { sourceId: input.sourceId, note }, entityDiff: { sourceId: input.sourceId, health: 'error', publicEffect: 'none' }, correlationId }).onConflictDoNothing().returning({ id: operations.id });
		if (!inserted.length) {
			const [prior] = await tx.select({ id: operations.id, status: operations.status, requestHash: operations.requestHash }).from(operations).where(eq(operations.idempotencyKey, input.idempotencyKey)).limit(1);
			if (prior?.status === 'applied' && prior.requestHash === requestHash) return { operationId: prior.id, reused: true };
			throw new Error('Diese Anfragekennung wurde bereits anders verwendet.');
		}
		const updated = await tx.update(sources).set({ health: 'error', updatedAt: now }).where(and(eq(sources.id, input.sourceId), eq(sources.health, 'paused'))).returning({ id: sources.id });
		if (!updated.length) throw new Error('Diese MA-Forest-Quelle ist nicht mehr pausiert.');
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'source.poll_resumed', origin: 'admin', severity: 'info', summary: 'MA-Forest-Beobachtung nach Prüfung fortgesetzt.', correlationId, payload: { sourceId: input.sourceId, note, publicEffect: 'none' } });
		return { operationId, reused: false };
	});
};
