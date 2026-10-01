export const GET = () => new Response(JSON.stringify({ status: 'ok' }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
