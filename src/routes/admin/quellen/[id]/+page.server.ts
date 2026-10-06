import { error } from '@sveltejs/kit';
import { getSourceReview } from '$lib/server/ingestion/source-review';

export const load = async ({ locals, params }) => {
	if (locals.user?.role !== 'steward') error(403, 'Nur für die technische Verwaltung.');
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) error(404, 'Quelle nicht gefunden.');
	const review = await getSourceReview(params.id);
	if (!review) error(404, 'Quelle nicht gefunden.');
	return review;
};
