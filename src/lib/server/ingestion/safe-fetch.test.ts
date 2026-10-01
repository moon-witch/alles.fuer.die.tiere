import { describe, expect, it } from 'vitest';
import { isBlockedAddress } from './safe-fetch';

describe('isBlockedAddress', () => {
	it.each(['127.0.0.1', '10.0.1.4', '172.20.0.1', '192.168.1.1', '169.254.1.1', '::1', 'fd00::1', 'fe80::1'])('blocks private or special address %s', (address) => {
		expect(isBlockedAddress(address)).toBe(true);
	});

	it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])('accepts public address %s', (address) => {
		expect(isBlockedAddress(address)).toBe(false);
	});
});
