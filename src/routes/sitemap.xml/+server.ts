import { env } from '$env/dynamic/private';

export const GET = ({ url }: { url: URL }) => {
	const base = env.PUBLIC_SITE_URL ?? url.origin;
	const routes = ['/', '/jetzt', '/projekte', '/helfen', '/termine', '/tiere', '/ueber-uns', '/presse'];
	const urls = routes.map((route) => `<url><loc>${base}${route}</loc></url>`).join('');
	return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { 'content-type': 'application/xml' } });
};
