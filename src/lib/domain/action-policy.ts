import { isIP } from 'node:net';

export type ActionInput = {
	destinationUrl: string;
	recipientName: string;
	startsAt?: Date;
	endsAt?: Date;
	fallbackActionId?: string;
};

const isUnsafeHost = (host: string) => {
	const normalized = host.toLowerCase();
	if (isIP(normalized.replace(/^\[|\]$/g, ''))) return true;
	if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local') || normalized.endsWith('.internal')) return true;
	if (/^127\./.test(normalized) || /^10\./.test(normalized) || /^192\.168\./.test(normalized) || /^0\./.test(normalized)) return true;
	const match = normalized.match(/^172\.(\d{1,3})\./);
	return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
};

export const validPublicUrl = (raw: string): URL | undefined => {
	try {
		const url = new URL(raw);
		if (url.protocol !== 'https:' || url.username || url.password || url.port || isUnsafeHost(url.hostname) || !url.hostname.includes('.')) return undefined;
		return url;
	} catch { return undefined; }
};

export const validateAction = (input: ActionInput): string[] => {
	const issues: string[] = [];
	if (!input.recipientName.trim()) issues.push('Ein Empfänger ist erforderlich.');
	try {
		const destination = new URL(input.destinationUrl);
		if (destination.protocol !== 'https:') issues.push('Das Ziel muss HTTPS verwenden.');
		if (!validPublicUrl(input.destinationUrl)) issues.push('Das Ziel ist nicht zulässig.');
	} catch {
		issues.push('Das Ziel ist keine gültige URL.');
	}
	if (input.endsAt && !input.fallbackActionId) issues.push('Eine befristete Aktion braucht einen Fallback.');
	if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) issues.push('Das Ende muss nach dem Beginn liegen.');
	return issues;
};
