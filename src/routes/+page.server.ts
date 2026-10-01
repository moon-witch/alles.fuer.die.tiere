import { env } from '$env/dynamic/private';
import { getCurrentAction } from '$lib/server/actions/current';
import { listPublishedProjects } from '$lib/server/public/projects';

export const load = async ({ setHeaders }) => {
	const [current, projects] = await Promise.all([getCurrentAction(), listPublishedProjects()]);
	setHeaders({ 'cache-control': env.REVEAL_GATE_ENABLED === 'true' ? 'private, no-store' : 'public, max-age=0, must-revalidate' });
	return { action: current.action, featuredProject: projects[0]?.project ?? null };
};
