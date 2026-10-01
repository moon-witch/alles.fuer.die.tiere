import { randomUUID } from 'node:crypto';
import { error, fail, redirect } from '@sveltejs/kit';
import { getCurrentAction, listFallbackActions } from '$lib/server/actions/current';
import { actionKinds, publishCurrentAction, validateCurrentActionInput, type ActionKind } from '$lib/server/operations/publish-current-action';

const requireSteward = (role: string | undefined) => { if (role !== 'steward') error(403, 'Nur für die technische Verwaltung.'); };
const field = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
const readValues = (data: FormData) => ({ kind: field(data, 'kind'), label: field(data, 'label'), recipientName: field(data, 'recipientName'), destinationUrl: field(data, 'destinationUrl'), evidenceUrl: field(data, 'evidenceUrl'), endsAt: field(data, 'endsAt'), fallbackActionId: field(data, 'fallbackActionId') });
const readProposal = (data: FormData) => {
	const values = readValues(data);
	const expires = values.endsAt;
	return {
		kind: values.kind as ActionKind,
		label: values.label,
		recipientName: values.recipientName,
		destinationUrl: values.destinationUrl,
		evidenceUrl: values.evidenceUrl,
		endsAt: expires ? new Date(`${expires}Z`) : undefined,
		fallbackActionId: values.fallbackActionId || undefined
	};
};

export const load = async ({ locals, url }) => {
	requireSteward(locals.user?.role);
	const [current, fallbacks] = await Promise.all([getCurrentAction(), listFallbackActions()]);
	return { current, fallbacks, published: url.searchParams.get('published') === '1', actionKinds };
};

export const actions = {
	preview: async ({ request, locals }) => {
		requireSteward(locals.user?.role);
		const data = await request.formData();
		const proposal = readProposal(data);
		const issues = validateCurrentActionInput(proposal);
		const fallbacks = await listFallbackActions();
		if (proposal.fallbackActionId && !fallbacks.some((action) => action.id === proposal.fallbackActionId)) issues.push('Der gewählte Fallback ist nicht verfügbar.');
		if (issues.length) return fail(400, { error: issues.join(' '), values: readValues(data) });
		const current = await getCurrentAction();
		return { preview: { ...readValues(data), destinationHost: new URL(proposal.destinationUrl).hostname, expectedRevisionId: current.revisionId, idempotencyKey: randomUUID() } };
	},
	publish: async ({ request, locals }) => {
		requireSteward(locals.user?.role);
		const data = await request.formData();
		const proposal = readProposal(data);
		try {
			await publishCurrentAction({ ...proposal, expectedRevisionId: field(data, 'expectedRevisionId') || null, initiatingUserId: locals.user!.id, idempotencyKey: field(data, 'idempotencyKey') });
		} catch (cause) {
			return fail(400, { error: cause instanceof Error ? cause.message : 'Die Aktion konnte nicht veröffentlicht werden.', values: readValues(data) });
		}
		redirect(303, '/admin/aktuelle-hilfe?published=1');
	}
};
