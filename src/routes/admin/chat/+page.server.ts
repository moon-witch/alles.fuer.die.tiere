import { fail } from '@sveltejs/kit';
import { runContentChat } from '$lib/server/chat/agent';

export const load = ({ locals }) => ({ isSteward: locals.user?.role === 'steward' });

export const actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Nicht angemeldet.' });
		const data = await request.formData();
		const message = data.get('message');
		if (typeof message !== 'string' || !message.trim()) return fail(400, { error: 'Schreib kurz, was du ändern möchtest.' });
		try { return { message: (await runContentChat({ message, userId: locals.user.id })).message, sent: message }; }
		catch { return fail(503, { error: 'Gerade nicht verfügbar. Joshua kümmert sich darum.', sent: message }); }
	}
};
