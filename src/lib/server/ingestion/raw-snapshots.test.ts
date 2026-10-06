import { afterEach, describe, expect, it } from 'vitest';
import { rawSnapshotStorageConfigured } from './raw-snapshots';

const keys = ['S3_ENDPOINT', 'S3_BUCKET_RAW', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_ACCESS_KEY_ID', 'S3_SECRET_KEY', 'S3_SECRET_ACCESS_KEY'] as const;
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const clear = () => { for (const key of keys) delete process.env[key]; };
afterEach(() => { clear(); for (const key of keys) if (previous[key] !== undefined) process.env[key] = previous[key]; });

describe('raw snapshot configuration', () => {
	it('accepts the existing four-bucket Coolify variable names', () => {
		clear();
		process.env.S3_ENDPOINT = 'http://seaweedfs:8333';
		process.env.S3_BUCKET_RAW = 'raw';
		process.env.S3_ACCESS_KEY = 'test-key';
		process.env.S3_SECRET_KEY = 'test-secret';
		expect(rawSnapshotStorageConfigured()).toBe(true);
	});

	it('also accepts the earlier single-bucket variable names', () => {
		clear();
		process.env.S3_ENDPOINT = 'http://seaweedfs:8333';
		process.env.S3_BUCKET = 'raw';
		process.env.S3_ACCESS_KEY_ID = 'test-key';
		process.env.S3_SECRET_ACCESS_KEY = 'test-secret';
		expect(rawSnapshotStorageConfigured()).toBe(true);
	});

	it('requires credentials and a bucket', () => {
		clear();
		process.env.S3_ENDPOINT = 'http://seaweedfs:8333';
		expect(rawSnapshotStorageConfigured()).toBe(false);
	});
});
