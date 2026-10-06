import { randomUUID } from 'node:crypto';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db/client';
import { activityEvents, attentionItems } from '$lib/server/db/schema';
import { resolveAttentionItem } from '$lib/server/operations/resolve-attention-item';

export const load = async ({ locals, url }) => {
	if (locals.user?.role !== 'steward') error(403, 'Nur für die technische Verwaltung.');
	const requestedPage = Number(url.searchParams.get('page') ?? '0');
	const page = Number.isInteger(requestedPage) && requestedPage >= 0 && requestedPage <= 1000 ? requestedPage : 0;
	const rows = await getDatabase().select().from(attentionItems).where(eq(attentionItems.status, 'open')).orderBy(desc(attentionItems.createdAt), desc(attentionItems.id)).limit(51).offset(page * 50);
	const operationIds = rows.map((item) => item.operationId).filter((id): id is string => id !== null);
	const events = operationIds.length ? await getDatabase().select({ id: activityEvents.id, operationId: activityEvents.operationId }).from(activityEvents).where(inArray(activityEvents.operationId, operationIds)).orderBy(asc(activityEvents.createdAt)) : [];
	const firstEventByOperation = new Map<string, string>();
	for (const event of events) if (event.operationId && !firstEventByOperation.has(event.operationId)) firstEventByOperation.set(event.operationId, event.id);
	return { items: rows.slice(0, 50).map((item) => ({ ...item, eventId: item.operationId ? firstEventByOperation.get(item.operationId) ?? null : null, resolveKey: randomUUID() })), page, hasMore: rows.length > 50, resolved: url.searchParams.get('resolved') === '1' };
};

export const actions = {
	resolve: async ({ request, locals }) => {
		if (locals.user?.role !== 'steward') error(403, 'Nur für die technische Verwaltung.');
		const data = await request.formData();
		try {
			await resolveAttentionItem({ attentionItemId: String(data.get('attentionItemId') ?? ''), note: String(data.get('note') ?? ''), initiatingUserId: locals.user!.id, idempotencyKey: String(data.get('idempotencyKey') ?? '') });
		} catch (cause) {
			return fail(400, { error: cause instanceof Error ? cause.message : 'Der Eintrag konnte nicht erledigt werden.' });
		}
		redirect(303, '/admin/aufgaben?resolved=1');
	}
};
