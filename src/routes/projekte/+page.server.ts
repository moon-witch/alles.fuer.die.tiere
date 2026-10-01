import { env } from '$env/dynamic/private';
import { listPublishedProjects } from '$lib/server/public/projects';

export const load = async ({ setHeaders }) => {
	const projects = await listPublishedProjects();
	setHeaders({ 'cache-control': env.REVEAL_GATE_ENABLED === 'true' ? 'private, no-store' : 'public, max-age=0, must-revalidate' });
	return { projects };
};
