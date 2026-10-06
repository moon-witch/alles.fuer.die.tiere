import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';
import type { IncomingHttpHeaders } from 'node:http';

const maxRedirects = 3;
const blocked = new BlockList();
for (const [address, prefix] of [
	['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
	['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
	['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
	['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
] as const) blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
	['::', 128], ['::1', 128], ['2001::', 32],
	['2001:2::', 48], ['2001:10::', 28], ['2001:20::', 28],
	['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10]
] as const) blocked.addSubnet(address, prefix, 'ipv6');

export type FetchPolicy = { maxBodyBytes: number; timeoutMs: number; allowedContentTypes: readonly string[]; ifNoneMatch?: string; ifModifiedSince?: string };
export type CapturedResponse = { url: URL; status: number; headers: Headers; body?: Uint8Array };

export const isBlockedAddress = (address: string): boolean => {
	const family = isIP(address);
	if (!family) return true;
	if (family === 4) return blocked.check(address, 'ipv4');
	const first = Number.parseInt(address.split(':')[0], 16);
	return !Number.isFinite(first) || first < 0x2000 || first > 0x3fff || blocked.check(address, 'ipv6');
};

const resolvePublicAddress = async (url: URL, timeoutMs: number) => {
	if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(url.hostname) || !url.hostname.includes('.')) throw new Error('Only public HTTPS source URLs are permitted.');
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Source DNS lookup timed out.')), timeoutMs); });
	try {
		const addresses = await Promise.race([lookup(url.hostname, { all: true, verbatim: true }), timeout]);
		if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address))) throw new Error('Source host resolves to a blocked address.');
		return addresses[0].address;
	} finally { if (timer) clearTimeout(timer); }
};

const toHeaders = (source: IncomingHttpHeaders) => {
	const headers = new Headers();
	for (const [key, value] of Object.entries(source)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
	return headers;
};

const requestOnce = (url: URL, address: string, policy: FetchPolicy): Promise<CapturedResponse> => new Promise((resolve, reject) => {
	const family = isIP(address);
	const conditional = {
		...(policy.ifNoneMatch && policy.ifNoneMatch.length <= 200 && !/[\r\n]/.test(policy.ifNoneMatch) ? { 'if-none-match': policy.ifNoneMatch } : {}),
		...(policy.ifModifiedSince && policy.ifModifiedSince.length <= 100 && !/[\r\n]/.test(policy.ifModifiedSince) ? { 'if-modified-since': policy.ifModifiedSince } : {})
	};
	const req = request(url, {
		method: 'GET', agent: false, family, servername: url.hostname,
		lookup: (_hostname, _options, callback) => callback(null, address, family),
		headers: { accept: 'text/html,application/xhtml+xml,application/json;q=0.9', 'accept-encoding': 'identity', 'user-agent': 'AllesFuerDieTiereSourceBot/0.1 (+https://allesfuerdietiere.earth)', ...conditional }
	}, (response) => {
		const status = response.statusCode ?? 0;
		const headers = toHeaders(response.headers);
		if ([301, 302, 303, 307, 308, 304].includes(status) || status < 200 || status >= 300) {
			response.destroy();
			resolve({ url, status, headers });
			return;
		}
		const contentType = headers.get('content-type')?.split(';')[0].toLowerCase() ?? '';
		if (!policy.allowedContentTypes.includes(contentType)) { response.destroy(); reject(new Error('Source content type is not permitted.')); return; }
		const declaredLength = Number(headers.get('content-length'));
		if (Number.isFinite(declaredLength) && declaredLength > policy.maxBodyBytes) { response.destroy(); reject(new Error('Source response exceeds the configured size limit.')); return; }
		const chunks: Buffer[] = [];
		let bytes = 0;
		response.on('data', (chunk: Buffer) => {
			bytes += chunk.byteLength;
			if (bytes > policy.maxBodyBytes) { response.destroy(); reject(new Error('Source response exceeds the configured size limit.')); return; }
			chunks.push(chunk);
		});
		response.on('end', () => resolve({ url, status, headers, body: Buffer.concat(chunks) }));
		response.on('error', reject);
		response.on('aborted', () => reject(new Error('Source response was interrupted.')));
	});
	const timer = setTimeout(() => req.destroy(new Error('Source request timed out.')), policy.timeoutMs);
	req.on('error', reject);
	req.on('close', () => clearTimeout(timer));
	req.end();
});

/** Resolves and pins each redirect hop before connecting; no response is published here. */
export const capturePublicSource = async (rawUrl: string, policy: FetchPolicy): Promise<CapturedResponse> => {
	if (!Number.isInteger(policy.maxBodyBytes) || policy.maxBodyBytes < 1 || !Number.isInteger(policy.timeoutMs) || policy.timeoutMs < 1) throw new Error('Invalid source fetch policy.');
	let url = new URL(rawUrl);
	for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
		const address = await resolvePublicAddress(url, policy.timeoutMs);
		const response = await requestOnce(url, address, redirects === 0 ? policy : { ...policy, ifNoneMatch: undefined, ifModifiedSince: undefined });
		if ([301, 302, 303, 307, 308].includes(response.status)) {
			const location = response.headers.get('location');
			if (!location || redirects === maxRedirects) throw new Error('Source redirect cannot be followed safely.');
			url = new URL(location, url);
			continue;
		}
		return response;
	}
	throw new Error('Source redirect limit exceeded.');
};
