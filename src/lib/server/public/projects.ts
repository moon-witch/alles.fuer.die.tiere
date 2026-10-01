import { and, eq, like } from 'drizzle-orm';
import { parseProjectPublication } from '$lib/domain/project-publication';
import { getDatabase } from '$lib/server/db/client';
import { publicationRevisions, publications } from '$lib/server/db/schema';

export const listPublishedProjects = async () => {
	const rows = await getDatabase().select({ revisionId: publicationRevisions.id, payload: publicationRevisions.payload })
		.from(publications).innerJoin(publicationRevisions, eq(publications.currentRevisionId, publicationRevisions.id))
		.where(and(eq(publications.status, 'published'), like(publications.route, '/projekte/%')));
	return rows.map((row) => ({ revisionId: row.revisionId, project: parseProjectPublication(row.payload) })).filter((row): row is { revisionId: string; project: NonNullable<typeof row.project> } => row.project !== null).sort((a, b) => a.project.name.localeCompare(b.project.name, 'de'));
};

export const getPublishedProject = async (slug: string) => {
	const rows = await getDatabase().select({ revisionId: publicationRevisions.id, payload: publicationRevisions.payload })
		.from(publications).innerJoin(publicationRevisions, eq(publications.currentRevisionId, publicationRevisions.id))
		.where(and(eq(publications.status, 'published'), eq(publications.route, `/projekte/${slug}`))).limit(1);
	const project = parseProjectPublication(rows[0]?.payload);
	return project?.slug === slug ? { project, revisionId: rows[0].revisionId } : null;
};
