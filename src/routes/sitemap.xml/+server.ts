import { env } from '$env/dynamic/private';
import { listPublishedProjects } from '$lib/server/public/projects';

export const GET = async ({ url }: { url: URL }) => {
	const gated = env.REVEAL_GATE_ENABLED === 'true';
	const base = env.PUBLIC_SITE_URL ?? url.origin;
	const routes = gated ? [] : ['/', '/jetzt', '/projekte', '/helfen', '/termine', '/tiere', '/ueber-uns', '/presse', ...(await listPublishedProjects()).map(({ project }) => `/projekte/${project.slug}`)];
	const urls = routes.map((route) => `<url><loc>${new URL(route, base).toString().replaceAll('&', '&amp;')}</loc></url>`).join('');
	return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': gated ? 'no-store' : 'public, max-age=3600' } });
};
