import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { DeleteObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createId } from '$lib/domain/ids';

let client: S3Client | undefined;

const configuration = () => {
	const { S3_ENDPOINT, S3_REGION } = process.env;
	const bucket = process.env.S3_BUCKET_RAW || process.env.S3_BUCKET;
	const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY;
	const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY;
	if (!S3_ENDPOINT || !bucket || !accessKeyId || !secretAccessKey) throw new Error('Die private S3-Speicherung ist noch nicht konfiguriert.');
	const endpoint = new URL(S3_ENDPOINT);
	if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.pathname !== '/') throw new Error('Der S3-Endpunkt ist ungültig.');
	return { endpoint: endpoint.toString(), region: S3_REGION || 'eu-central-1', bucket, credentials: { accessKeyId, secretAccessKey } };
};

const storage = () => {
	const config = configuration();
	if (!client) client = new S3Client({ endpoint: config.endpoint, region: config.region, credentials: config.credentials, forcePathStyle: true, maxAttempts: 2 });
	return { client, bucket: config.bucket };
};

export const rawSnapshotStorageConfigured = () => Boolean(process.env.S3_ENDPOINT && (process.env.S3_BUCKET_RAW || process.env.S3_BUCKET) && (process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY) && (process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY));

export type RawBucketCheck = 'ready' | 'missing' | 'forbidden' | 'connection_refused' | 'name_not_found' | 'unavailable';

const networkErrorCode = (cause: unknown): unknown => {
	let current = cause;
	for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth++) {
		if ('code' in current && typeof current.code === 'string') return current.code;
		current = 'cause' in current ? current.cause : undefined;
	}
	return undefined;
};

export const checkRawSnapshotBucket = async (): Promise<RawBucketCheck> => {
	const { client, bucket } = storage();
	try {
		await client.send(new HeadBucketCommand({ Bucket: bucket }));
		return 'ready';
	} catch (cause) {
		const status = cause && typeof cause === 'object' && '$metadata' in cause ? (cause as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode : undefined;
		if (status === 404) return 'missing';
		if (status === 403) return 'forbidden';
		const code = networkErrorCode(cause);
		if (code === 'ECONNREFUSED') return 'connection_refused';
		if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'name_not_found';
		return 'unavailable';
	}
};

export const putRawSnapshot = async (body: Uint8Array, observedAt: Date): Promise<{ objectKey: string; bodySha256: string }> => {
	const { client, bucket } = storage();
	const bodySha256 = createHash('sha256').update(body).digest('hex');
	const objectKey = `${observedAt.getUTCFullYear()}/${String(observedAt.getUTCMonth() + 1).padStart(2, '0')}/${createId()}.gz`;
	await client.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey, Body: gzipSync(body), ContentType: 'application/gzip', Metadata: { 'body-sha256': bodySha256 } }));
	return { objectKey, bodySha256 };
};

export const deleteRawSnapshot = async (objectKey: string) => {
	const { client, bucket } = storage();
	await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
};
