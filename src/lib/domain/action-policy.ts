export type ActionInput = {
	destinationUrl: string;
	recipientName: string;
	startsAt?: Date;
	endsAt?: Date;
	fallbackActionId?: string;
};

const isUnsafeHost = (host: string) => {
	const normalized = host.toLowerCase();
	if (normalized === 'localhost' || normalized === '::1' || normalized.endsWith('.local')) return true;
	if (/^127\./.test(normalized) || /^10\./.test(normalized) || /^192\.168\./.test(normalized) || /^0\./.test(normalized)) return true;
	const match = normalized.match(/^172\.(\d{1,3})\./);
	return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
};

export const validateAction = (input: ActionInput): string[] => {
	const issues: string[] = [];
	if (!input.recipientName.trim()) issues.push('Ein Empfänger ist erforderlich.');
	try {
		const destination = new URL(input.destinationUrl);
		if (destination.protocol !== 'https:') issues.push('Das Ziel muss HTTPS verwenden.');
		if (destination.username || destination.password || isUnsafeHost(destination.hostname)) issues.push('Das Ziel ist nicht zulässig.');
	} catch {
		issues.push('Das Ziel ist keine gültige URL.');
	}
	if (input.endsAt && !input.fallbackActionId) issues.push('Eine befristete Aktion braucht einen Fallback.');
	if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) issues.push('Das Ende muss nach dem Beginn liegen.');
	return issues;
};
