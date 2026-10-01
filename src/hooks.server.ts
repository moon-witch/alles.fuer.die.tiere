import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { redirect, type Handle } from '@sveltejs/kit';
import { adminSessionCookie, getSessionUser } from '$lib/server/auth';

const cookieName = 'reveal_access';
const excludedPaths = new Set(['/reveal', '/healthz', '/robots.txt', '/sitemap.xml']);

const isGateEnabled = () => env.REVEAL_GATE_ENABLED === 'true';
const sign = (value: string) => {
	if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is required when the reveal gate is enabled.');
	return createHmac('sha256', env.SESSION_SECRET).update(value).digest('base64url');
};

export const verifyRevealCookie = (value: string | undefined): boolean => {
	if (!value || !env.SESSION_SECRET) return false;
	const [payload, signature] = value.split('.');
	if (!payload || !signature) return false;
	const expected = sign(payload);
	if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
	const expiresAt = Number(payload);
	return Number.isFinite(expiresAt) && expiresAt > Date.now();
};

export const revealCookie = () => {
	const expiresAt = Date.now() + 1000 * 60 * 60 * 8;
	return `${expiresAt}.${sign(String(expiresAt))}`;
};

export const revealPasswordMatches = (candidate: string) => {
	const configured = env.REVEAL_GATE_PASSWORD;
	if (!configured) return false;
	const candidateBuffer = Buffer.from(candidate);
	const configuredBuffer = Buffer.from(configured);
	return candidateBuffer.length === configuredBuffer.length && timingSafeEqual(candidateBuffer, configuredBuffer);
};

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/admin')) {
		if (event.url.pathname === '/admin/login') return resolve(event);
		const user = await getSessionUser(event.cookies.get(adminSessionCookie));
		if (!user) throw redirect(303, '/admin/login');
		event.locals.user = user;
		return resolve(event);
	}
	if (!isGateEnabled() || excludedPaths.has(event.url.pathname)) return resolve(event);
	if (verifyRevealCookie(event.cookies.get(cookieName))) return resolve(event);
	throw redirect(303, `/reveal?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
};

export const revealAccessCookieName = cookieName;
