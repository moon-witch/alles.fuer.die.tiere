import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db/client';
import { activityEvents, operations, publicationRevisions } from '$lib/server/db/schema';

export const load = async ({ locals, params }) => {
	if (locals.user?.role !== 'steward') error(403, 'Nur für die technische Verwaltung.');
	const database = getDatabase();
	const [event] = await database.select().from(activityEvents).where(eq(activityEvents.id, params.id)).limit(1);
	if (!event) error(404, 'Verlaufseintrag nicht gefunden.');
	const [operation, revision] = await Promise.all([
		event.operationId ? database.select().from(operations).where(eq(operations.id, event.operationId)).limit(1) : Promise.resolve([]),
		event.publicationRevisionId ? database.select({ id: publicationRevisions.id, publishedAt: publicationRevisions.publishedAt, templateVersion: publicationRevisions.templateVersion }).from(publicationRevisions).where(eq(publicationRevisions.id, event.publicationRevisionId)).limit(1) : Promise.resolve([])
	]);
	return { event, operation: operation[0] ?? null, revision: revision[0] ?? null };
};
