import { error } from '@sveltejs/kit';
import { launchState } from '$lib/content/seed';

export const load = ({ params }) => {
	if (params.slug !== launchState.project.slug) error(404, 'Projekt nicht gefunden');
	return { project: launchState.project };
};
