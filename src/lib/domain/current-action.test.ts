import { describe, expect, it } from 'vitest';
import { parseCurrentActionPublication, resolveCurrentAction } from './current-action';

const primary = { id: 'primary', kind: 'spende', label: 'Helfen', recipientName: 'Organisation', destinationUrl: 'https://example.org/help', destinationHost: 'example.org', evidenceUrl: 'https://example.org/source' };
const fallback = { ...primary, id: 'fallback', label: 'Weiter helfen' };
const publication = { type: 'current-action', version: 1, primary, fallback, startsAt: '2026-10-01T10:00:00.000Z', endsAt: '2026-10-02T10:00:00.000Z', publishedAt: '2026-10-01T10:00:00.000Z' };

describe('current-action publication', () => {
	it('resolves the primary action during its interval and the explicit fallback after expiry', () => {
		const parsed = parseCurrentActionPublication(publication);
		expect(resolveCurrentAction(parsed, new Date('2026-10-01T11:00:00Z'))?.id).toBe('primary');
		expect(resolveCurrentAction(parsed, new Date('2026-10-02T10:00:00Z'))?.id).toBe('fallback');
	});

	it('shows no action before start or when a stored destination is unsafe', () => {
		expect(resolveCurrentAction(parseCurrentActionPublication(publication), new Date('2026-09-30T10:00:00Z'))).toBeNull();
		expect(parseCurrentActionPublication({ ...publication, primary: { ...primary, destinationUrl: 'http://example.org/help' } })).toBeNull();
	});
});
