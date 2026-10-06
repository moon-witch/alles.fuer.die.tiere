import { randomUUID } from 'node:crypto';
import { error, fail, redirect } from '@sveltejs/kit';
import { getSourceReview } from '$lib/server/ingestion/source-review';
import { resumeMaForestPoll } from '$lib/server/operations/resume-ma-forest-poll';

export const load = async ({ locals, params, url }) => {
	if (locals.user?.role !== 'steward') error(403, 'Nur für die technische Verwaltung.');
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) error(404, 'Quelle nicht gefunden.');
	const review = await getSourceReview(params.id);
	if (!review) error(404, 'Quelle nicht gefunden.');
	return { ...review, resumeKey: randomUUID(), resumed: url.searchParams.get('resumed') === '1' };
};

export const actions = {
	resume: async ({ locals, params, request }) => {
		if (locals.user?.role !== 'steward') error(403, 'Nur für die technische Verwaltung.');
		const data = await request.formData();
		try {
			await resumeMaForestPoll({ sourceId: params.id, note: String(data.get('note') ?? ''), initiatingUserId: locals.user.id, idempotencyKey: String(data.get('idempotencyKey') ?? '') });
		} catch (cause) {
			return fail(400, { error: cause instanceof Error ? cause.message : 'Die Quelle konnte nicht fortgesetzt werden.' });
		}
		redirect(303, `/admin/quellen/${params.id}?resumed=1`);
	}
};
