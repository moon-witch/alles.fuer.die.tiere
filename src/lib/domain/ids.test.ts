import { describe, expect, it } from 'vitest';
import { createId } from './ids';

describe('createId', () => {
	it('creates RFC 9562 version 7 UUIDs', () => {
		const id = createId();
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});
});
