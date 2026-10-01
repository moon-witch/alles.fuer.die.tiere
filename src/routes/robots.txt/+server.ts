import { env } from '$env/dynamic/private';

export const GET = ({ url }: { url: URL }) => {
	const gated = env.REVEAL_GATE_ENABLED === 'true';
	const body = gated ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nDisallow: /admin\nSitemap: ${new URL('/sitemap.xml', env.PUBLIC_SITE_URL ?? url.origin)}\n`;
	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
};
