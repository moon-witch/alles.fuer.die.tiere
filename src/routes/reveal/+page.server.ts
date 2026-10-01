import { fail, redirect } from '@sveltejs/kit';
import { revealAccessCookieName, revealCookie, revealPasswordMatches } from '../../hooks.server';

export const load = ({ url }) => ({ next: url.searchParams.get('next')?.startsWith('/') ? url.searchParams.get('next') : '/' });

export const actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const password = data.get('password');
		const next = data.get('next');
		if (typeof password !== 'string' || !revealPasswordMatches(password)) return fail(400, { invalid: true });
		cookies.set(revealAccessCookieName, revealCookie(), { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 60 * 60 * 8 });
		throw redirect(303, typeof next === 'string' && next.startsWith('/') ? next : '/');
	}
};
