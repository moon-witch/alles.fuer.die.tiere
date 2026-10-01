import { fail, redirect } from '@sveltejs/kit';
import { adminSessionCookie, createSession, sessionDurationSeconds, verifyLogin } from '$lib/server/auth';

export const actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const email = form.get('email');
		const password = form.get('password');
		if (typeof email !== 'string' || typeof password !== 'string') return fail(400, { invalid: true });
		const user = await verifyLogin(email, password);
		if (!user) return fail(400, { invalid: true });
		const session = await createSession(user.id);
		cookies.set(adminSessionCookie, session.token, { path: '/admin', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: sessionDurationSeconds });
		throw redirect(303, '/admin/chat');
	}
};
