import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getPublishedProject } from '$lib/server/public/projects';

export const load = async ({ params, setHeaders }) => {
	const result = await getPublishedProject(params.slug);
	if (!result) error(404, 'Projekt nicht gefunden');
	const gated = env.REVEAL_GATE_ENABLED === 'true';
	setHeaders({ 'cache-control': gated ? 'private, no-store' : 'public, max-age=0, must-revalidate', ...(!gated ? { etag: `"${result.revisionId}"`, 'x-publication-revision': result.revisionId } : {}) });
	return { project: result.project };
};
