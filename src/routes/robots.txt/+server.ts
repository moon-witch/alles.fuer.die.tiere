export const GET = () => new Response('User-agent: *\nDisallow: /admin\n', { headers: { 'content-type': 'text/plain' } });
