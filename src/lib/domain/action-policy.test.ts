import { describe, expect, it } from 'vitest';
import { validateAction } from './action-policy';

const valid = { destinationUrl: 'https://wilderness-international.org/ma', recipientName: 'Wilderness International' };

describe('validateAction', () => {
	it('accepts a public HTTPS destination without an expiry', () => {
		expect(validateAction(valid)).toEqual([]);
	});

	it('requires a fallback for a time-bounded action', () => {
		expect(validateAction({ ...valid, endsAt: new Date('2026-10-01T10:00:00Z') })).toContain('Eine befristete Aktion braucht einen Fallback.');
	});

	it('rejects insecure and private targets', () => {
		expect(validateAction({ ...valid, destinationUrl: 'http://127.0.0.1/private' })).toEqual(expect.arrayContaining(['Das Ziel muss HTTPS verwenden.', 'Das Ziel ist nicht zulässig.']));
	});

	it('rejects an expiry before the start', () => {
		expect(validateAction({ ...valid, startsAt: new Date('2026-10-02T10:00:00Z'), endsAt: new Date('2026-10-01T10:00:00Z'), fallbackActionId: 'fallback' })).toContain('Das Ende muss nach dem Beginn liegen.');
	});
});
