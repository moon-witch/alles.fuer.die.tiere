import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db/client';
import { activityEvents, operations, publicationRevisions } from '$lib/server/db/schema';
import { getCurrentActionRevertPreview, revertCurrentAction } from '$lib/server/operations/revert-current-action';
import { getClaimRevertPreview, revertClaimPublication } from '$lib/server/operations/revert-claim-publication';

export const load = async ({ locals, params, url }) => {
	if (locals.user?.role !== 'steward') error(403, 'Nur für die technische Verwaltung.');
	const database = getDatabase();
	const [event] = await database.select().from(activityEvents).where(eq(activityEvents.id, params.id)).limit(1);
	if (!event) error(404, 'Verlaufseintrag nicht gefunden.');
	const [operation, revision] = await Promise.all([
		event.operationId ? database.select().from(operations).where(eq(operations.id, event.operationId)).limit(1) : Promise.resolve([]),
		event.publicationRevisionId ? database.select({ id: publicationRevisions.id, publishedAt: publicationRevisions.publishedAt, templateVersion: publicationRevisions.templateVersion }).from(publicationRevisions).where(eq(publicationRevisions.id, event.publicationRevisionId)).limit(1) : Promise.resolve([])
	]);
	const revertPreview = operation[0]?.type === 'action.set_primary' ? await getCurrentActionRevertPreview(operation[0].id) : null;
	const claimRevertPreview = operation[0]?.type === 'claim.publish' ? await getClaimRevertPreview(operation[0].id) : null;
	const claimId = ['claim.publish', 'source.observe'].includes(operation[0]?.type ?? '') && operation[0]?.entityDiff && typeof operation[0].entityDiff === 'object' && 'claimId' in operation[0].entityDiff && typeof operation[0].entityDiff.claimId === 'string' && /^[0-9a-f-]{36}$/i.test(operation[0].entityDiff.claimId) ? operation[0].entityDiff.claimId : null;
	return { event, operation: operation[0] ?? null, revision: revision[0] ?? null, claimId, revertPreview, claimRevertPreview, revertKey: randomUUID(), reverted: url.searchParams.get('reverted') === '1' };
};

export const actions = {
	revert: async ({ request, locals, params }) => {
		if (locals.user?.role !== 'steward') error(403, 'Nur für die technische Verwaltung.');
		const data = await request.formData();
		const [event] = await getDatabase().select({ operationId: activityEvents.operationId }).from(activityEvents).where(eq(activityEvents.id, params.id)).limit(1);
		if (!event?.operationId || String(data.get('targetOperationId') ?? '') !== event.operationId) return fail(400, { error: 'Dieser Verlaufseintrag gehört nicht zur gewählten Änderung.' });
		const [target] = await getDatabase().select({ type: operations.type }).from(operations).where(eq(operations.id, event.operationId)).limit(1);
		try {
			const input = { targetOperationId: event.operationId, expectedRevisionId: String(data.get('expectedRevisionId') ?? ''), initiatingUserId: locals.user!.id, idempotencyKey: String(data.get('idempotencyKey') ?? '') };
			const result = target?.type === 'action.set_primary' ? await revertCurrentAction(input) : target?.type === 'claim.publish' ? await revertClaimPublication(input) : null;
			if (!result) return fail(400, { error: 'Diese Änderung kann hier nicht rückgängig gemacht werden.' });
			if (result.status === 'failed') return fail(409, { error: 'Die Seite wurde inzwischen geändert. Der Konflikt wurde zur Prüfung vorgemerkt.' });
		} catch (cause) {
			return fail(400, { error: cause instanceof Error ? cause.message : 'Rückgängigmachen fehlgeschlagen.' });
		}
		redirect(303, `/admin/verlauf/${params.id}?reverted=1`);
	}
};
