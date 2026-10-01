import { desc, isNotNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db/client';
import { activityEvents } from '$lib/server/db/schema';

export const load = async ({ locals, url }) => {
	if (locals.user?.role !== 'steward') error(403, 'Nur für die technische Verwaltung.');
	const requestedPage = Number(url.searchParams.get('page') ?? '0');
	const page = Number.isInteger(requestedPage) && requestedPage >= 0 && requestedPage <= 1000 ? requestedPage : 0;
	const publicOnly = url.searchParams.get('filter') === 'public';
	const query = getDatabase().select({ id: activityEvents.id, eventType: activityEvents.eventType, summary: activityEvents.summary, publicEffect: activityEvents.publicEffect, origin: activityEvents.origin, createdAt: activityEvents.createdAt }).from(activityEvents);
	const rows = await (publicOnly ? query.where(isNotNull(activityEvents.publicEffect)) : query).orderBy(desc(activityEvents.createdAt), desc(activityEvents.id)).limit(31).offset(page * 30);
	return { events: rows.slice(0, 30), hasMore: rows.length > 30, page, publicOnly };
};
