import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const maxRedirects = 3;

export type FetchPolicy = { maxBodyBytes: number; timeoutMs: number; allowedContentTypes: readonly string[] };
export type CapturedResponse = { url: URL; status: number; headers: Headers; body?: Uint8Array };

export const isBlockedAddress = (address: string): boolean => {
	if (isIP(address) === 4) {
		const [a, b] = address.split('.').map(Number);
		return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
	}
	const normalized = address.toLowerCase();
	return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
};

const validateUrl = async (url: URL) => {
	if (url.protocol !== 'https:') throw new Error('Only HTTPS source URLs are permitted.');
	if (url.username || url.password || url.port) throw new Error('Source URL credentials and custom ports are not permitted.');
	const addresses = await lookup(url.hostname, { all: true, verbatim: true });
	if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) throw new Error('Source host resolves to a blocked address.');
};

const boundedBody = async (response: Response, maxBytes: number): Promise<Uint8Array> => {
	const length = Number(response.headers.get('content-length'));
	if (Number.isFinite(length) && length > maxBytes) throw new Error('Source response exceeds the configured size limit.');
	if (!response.body) return new Uint8Array();
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let bytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			bytes += value.byteLength;
			if (bytes > maxBytes) throw new Error('Source response exceeds the configured size limit.');
			chunks.push(value);
		}
	} finally { reader.releaseLock(); }
	const result = new Uint8Array(bytes);
	let offset = 0;
	for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
	return result;
};

/** Performs the capture step only. Extraction and publication are separate operations. */
export const capturePublicSource = async (rawUrl: string, policy: FetchPolicy): Promise<CapturedResponse> => {
	let url = new URL(rawUrl);
	for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
		await validateUrl(url);
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), policy.timeoutMs);
		let response: Response;
		try {
			response = await fetch(url, { redirect: 'manual', signal: controller.signal, headers: { accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.1', 'user-agent': 'AllesFuerDieTiereSourceBot/0.1 (+https://allesfuerdietiere.earth)' } });
		} finally { clearTimeout(timeout); }
		if ([301, 302, 303, 307, 308].includes(response.status)) {
			const location = response.headers.get('location');
			if (!location || redirects === maxRedirects) throw new Error('Source redirect cannot be followed safely.');
			url = new URL(location, url);
			continue;
		}
		if (response.status === 304) return { url, status: response.status, headers: response.headers };
		if (!response.ok) return { url, status: response.status, headers: response.headers };
		const contentType = response.headers.get('content-type')?.split(';')[0].toLowerCase() ?? '';
		if (!policy.allowedContentTypes.includes(contentType)) throw new Error('Source content type is not permitted.');
		return { url, status: response.status, headers: response.headers, body: await boundedBody(response, policy.maxBodyBytes) };
	}
	throw new Error('Source redirect limit exceeded.');
};
