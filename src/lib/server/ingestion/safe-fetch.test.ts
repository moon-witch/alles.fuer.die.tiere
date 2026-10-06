import { describe, expect, it } from 'vitest';
import { isBlockedAddress } from './safe-fetch';

describe('isBlockedAddress', () => {
	it.each(['127.0.0.1', '10.0.1.4', '100.64.0.1', '172.20.0.1', '192.168.1.1', '169.254.1.1', '192.0.2.1', '198.51.100.2', '203.0.113.4', '224.0.0.1', '::1', '::ffff:8.8.8.8', 'fd00::1', 'fe80::1', '2001:db8::1', '2002::1'])('blocks private or special address %s', (address) => {
		expect(isBlockedAddress(address)).toBe(true);
	});

	it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])('accepts public address %s', (address) => {
		expect(isBlockedAddress(address)).toBe(false);
	});
});
