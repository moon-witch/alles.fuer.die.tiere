import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createId } from '$lib/domain/ids';

let client: S3Client | undefined;

const configuration = () => {
	const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
	if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) throw new Error('Die private S3-Speicherung ist noch nicht konfiguriert.');
	const endpoint = new URL(S3_ENDPOINT);
	if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.pathname !== '/') throw new Error('Der S3-Endpunkt ist ungültig.');
	return { endpoint: endpoint.toString(), region: S3_REGION || 'us-east-1', bucket: S3_BUCKET, credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY } };
};

const storage = () => {
	const config = configuration();
	if (!client) client = new S3Client({ endpoint: config.endpoint, region: config.region, credentials: config.credentials, forcePathStyle: true, maxAttempts: 2 });
	return { client, bucket: config.bucket };
};

export const rawSnapshotStorageConfigured = () => Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);

export const putRawSnapshot = async (body: Uint8Array, observedAt: Date): Promise<{ objectKey: string; bodySha256: string }> => {
	const { client, bucket } = storage();
	const bodySha256 = createHash('sha256').update(body).digest('hex');
	const objectKey = `raw/${observedAt.getUTCFullYear()}/${String(observedAt.getUTCMonth() + 1).padStart(2, '0')}/${createId()}.gz`;
	await client.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey, Body: gzipSync(body), ContentType: 'application/gzip', Metadata: { 'body-sha256': bodySha256 } }));
	return { objectKey, bodySha256 };
};

export const deleteRawSnapshot = async (objectKey: string) => {
	const { client, bucket } = storage();
	await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
};
