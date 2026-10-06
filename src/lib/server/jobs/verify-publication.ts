import { eq } from 'drizzle-orm';
import { parseCurrentActionPublication } from '$lib/domain/current-action';
import { parseProjectPublication } from '$lib/domain/project-publication';
import { getDatabase } from '$lib/server/db/client';
import { publicationRevisions, publications } from '$lib/server/db/schema';
import { getCurrentAction } from '$lib/server/actions/current';
import { getPublishedProject } from '$lib/server/public/projects';

export class PublicationVerificationError extends Error {
	constructor(readonly code: 'invalid_job_payload' | 'revision_missing' | 'route_mismatch' | 'invalid_payload' | 'render_mismatch' | 'job_timeout') {
		super(code);
	}
}

const readPayload = (value: unknown): { revisionId: string; route: string } => {
	if (!value || typeof value !== 'object') throw new PublicationVerificationError('invalid_job_payload');
	const { revisionId, route } = value as Record<string, unknown>;
	if (typeof revisionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(revisionId) || typeof route !== 'string' || (route !== '/jetzt' && !/^\/projekte\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route))) throw new PublicationVerificationError('invalid_job_payload');
	return { revisionId, route };
};

/** Verify the immutable payload and, if still current, the public read path. Never changes public state. */
export const verifyPublication = async (payload: unknown): Promise<'current' | 'superseded'> => {
	const { revisionId, route } = readPayload(payload);
	const [record] = await getDatabase().select({ revision: publicationRevisions, publication: publications })
		.from(publicationRevisions).innerJoin(publications, eq(publicationRevisions.publicationId, publications.id))
		.where(eq(publicationRevisions.id, revisionId)).limit(1);
	if (!record) throw new PublicationVerificationError('revision_missing');
	if (record.publication.route !== route) throw new PublicationVerificationError('route_mismatch');
	if (route === '/jetzt') {
		if (!parseCurrentActionPublication(record.revision.payload)) throw new PublicationVerificationError('invalid_payload');
	} else {
		const project = parseProjectPublication(record.revision.payload);
		if (!project || route !== `/projekte/${project.slug}`) throw new PublicationVerificationError('invalid_payload');
	}
	if (record.publication.status !== 'published' || record.publication.currentRevisionId !== revisionId) return 'superseded';
	const rendered = route === '/jetzt' ? await getCurrentAction() : await getPublishedProject(route.slice('/projekte/'.length));
	if (rendered?.revisionId !== revisionId) throw new PublicationVerificationError('render_mismatch');
	return 'current';
};
