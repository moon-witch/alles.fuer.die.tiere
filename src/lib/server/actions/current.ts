import { and, eq, isNull } from 'drizzle-orm';
import { getDatabase } from '$lib/server/db/client';
import { actions, publicationRevisions, publications } from '$lib/server/db/schema';
import { parseCurrentActionPublication, resolveCurrentAction, type PublicAction } from '$lib/domain/current-action';

export const getCurrentAction = async (now = new Date()): Promise<{ action: PublicAction | null; revisionId: string | null; publishedAt: string | null }> => {
	const database = getDatabase();
	const rows = await database.select({ revisionId: publicationRevisions.id, payload: publicationRevisions.payload })
		.from(publications)
		.innerJoin(publicationRevisions, eq(publications.currentRevisionId, publicationRevisions.id))
		.where(and(eq(publications.route, '/jetzt'), eq(publications.status, 'published'))).limit(1);
	const publication = parseCurrentActionPublication(rows[0]?.payload);
	return { action: resolveCurrentAction(publication, now), revisionId: publication ? rows[0].revisionId : null, publishedAt: publication?.publishedAt ?? null };
};

export const listFallbackActions = async (): Promise<PublicAction[]> => {
	const rows = await getDatabase().select().from(actions).where(and(eq(actions.visibility, 'public'), eq(actions.reviewStatus, 'published'), eq(actions.state, 'active'), isNull(actions.endsAt)));
	return rows.filter((row) => row.evidenceUrl).map((row) => ({ id: row.id, kind: row.kind, label: row.label, recipientName: row.recipientName, destinationUrl: row.destinationUrl, destinationHost: row.destinationHost, evidenceUrl: row.evidenceUrl! }));
};
