import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { TOTP } from 'otpauth';
import { and, eq, gt } from 'drizzle-orm';
import { getDatabase } from '$lib/server/db/client';
import { sessions, users } from '$lib/server/db/schema';
import { createId } from '$lib/domain/ids';

export const adminSessionCookie = 'admin_session';
const sessionDurationSeconds = 60 * 60 * 12;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

type AuthUser = { id: string; email: string; displayName: string; role: string; passwordHash: string; totpSecret: string | null };

const getEncryptionKey = () => {
	const raw = process.env.TOTP_ENCRYPTION_KEY;
	if (!raw) throw new Error('TOTP_ENCRYPTION_KEY is required for admin authentication.');
	const key = Buffer.from(raw, 'base64');
	if (key.length !== 32) throw new Error('TOTP_ENCRYPTION_KEY must decode to 32 bytes.');
	return key;
};

export const encryptTotpSecret = (secret: string) => {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
	const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
	return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
};

const decryptTotpSecret = (value: string) => {
	const [ivRaw, tagRaw, encryptedRaw] = value.split('.');
	if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Stored TOTP secret is malformed.');
	const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivRaw, 'base64url'));
	decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
	return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64url')), decipher.final()]).toString('utf8');
};

const verifyTotp = (encryptedSecret: string, token: string) => new TOTP({ issuer: 'Alles für die Tiere', label: 'Admin', algorithm: 'SHA1', digits: 6, period: 30, secret: decryptTotpSecret(encryptedSecret) }).validate({ token, window: 1 }) !== null;

export const verifyLogin = async (email: string, password: string, totpToken: string): Promise<AuthUser | undefined> => {
	const database = getDatabase();
	const found = await database.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
	const user = found[0];
	if (!user?.totpSecret || !(await argon2.verify(user.passwordHash, password)) || !verifyTotp(user.totpSecret, totpToken)) return undefined;
	return user;
};

export const createSession = async (userId: string) => {
	const database = getDatabase();
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + sessionDurationSeconds * 1000);
	await database.delete(sessions).where(eq(sessions.userId, userId));
	await database.insert(sessions).values({ id: createId(), userId, tokenHash: tokenHash(token), expiresAt });
	return { token, expiresAt };
};

export const getSessionUser = async (token: string | undefined) => {
	if (!token) return undefined;
	const database = getDatabase();
	const found = await database.select({ id: users.id, email: users.email, displayName: users.displayName, role: users.role }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date()))).limit(1);
	return found[0];
};

export const removeSession = async (token: string | undefined) => {
	if (token) await getDatabase().delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
};

export { sessionDurationSeconds };
