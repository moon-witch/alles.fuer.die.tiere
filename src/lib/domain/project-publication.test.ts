import { describe, expect, it } from 'vitest';
import { parseProjectPublication } from './project-publication';

const project = { type: 'project', version: 1, slug: 'ma-forest', name: 'MA-Forest', publishedAt: '2026-10-01T12:00:00Z', claims: [{ id: 'claim-1', kind: 'milestone', statement: 'Eine belegte Aussage.', occurredAt: '2026-09-28T12:00:00Z', evidence: [{ url: 'https://example.org/source', publisher: 'example.org', observedAt: '2026-10-01T12:00:00Z' }] }] };

describe('project publication boundary', () => {
	it('accepts a sourced immutable project payload', () => {
		expect(parseProjectPublication(project)?.claims[0].statement).toBe('Eine belegte Aussage.');
	});
	it('rejects a claim without public evidence', () => {
		expect(parseProjectPublication({ ...project, claims: [{ ...project.claims[0], evidence: [] }] })).toBeNull();
		expect(parseProjectPublication({ ...project, claims: [{ ...project.claims[0], evidence: [{ ...project.claims[0].evidence[0], url: 'http://127.0.0.1/source' }] }] })).toBeNull();
	});
});
