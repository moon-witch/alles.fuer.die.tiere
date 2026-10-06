import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { createId } from '$lib/domain/ids';
import { getDatabase } from '$lib/server/db/client';
import { activityEvents, attentionItems, operations } from '$lib/server/db/schema';

export const resolveAttentionItem = async (input: { attentionItemId: string; note: string; initiatingUserId: string; idempotencyKey: string }) => {
	const note = input.note.trim();
	if (!note || note.length > 1000) throw new Error('Beschreibe die Prüfung in höchstens 1000 Zeichen.');
	if (!input.idempotencyKey || input.idempotencyKey.length > 128) throw new Error('Ungültige Anfragekennung.');
	const requestHash = createHash('sha256').update(JSON.stringify({ attentionItemId: input.attentionItemId, note })).digest('hex');
	return getDatabase().transaction(async (tx) => {
		const operationId = createId();
		const correlationId = createId();
		const inserted = await tx.insert(operations).values({ id: operationId, type: 'attention.resolve', status: 'proposed', origin: 'admin', initiatingUserId: input.initiatingUserId, idempotencyKey: input.idempotencyKey, requestHash, input: { attentionItemId: input.attentionItemId, note }, correlationId }).onConflictDoNothing().returning({ id: operations.id });
		if (!inserted.length) {
			const [existing] = await tx.select().from(operations).where(eq(operations.idempotencyKey, input.idempotencyKey)).limit(1);
			if (!existing || existing.requestHash !== requestHash || existing.status !== 'applied') throw new Error('Diese Anfragekennung wurde bereits anders verwendet.');
			return { operationId: existing.id, reused: true };
		}
		const [item] = await tx.update(attentionItems).set({ status: 'resolved' }).where(and(eq(attentionItems.id, input.attentionItemId), eq(attentionItems.status, 'open'))).returning({ id: attentionItems.id });
		if (!item) throw new Error('Der Aufmerksamkeitseintrag ist nicht mehr offen. Bitte die Liste neu laden.');
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.proposed', origin: 'admin', severity: 'info', summary: 'Aufmerksamkeitseintrag wurde zur Erledigung geprüft.', correlationId, payload: { attentionItemId: item.id } });
		await tx.update(operations).set({ status: 'applied', entityDiff: { attentionItemId: item.id, status: 'resolved', note }, updatedAt: new Date() }).where(eq(operations.id, operationId));
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.applied', origin: 'admin', severity: 'info', summary: 'Aufmerksamkeitseintrag wurde erledigt.', correlationId, payload: { attentionItemId: item.id, note } });
		return { operationId, reused: false };
	});
};
