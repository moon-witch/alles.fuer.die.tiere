import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { and, eq, gt, sql } from 'drizzle-orm';
import { getDatabase } from '$lib/server/db/client';
import { loginAttempts, sessions, users } from '$lib/server/db/schema';
import { createId } from '$lib/domain/ids';

export const adminSessionCookie = 'admin_session';
const sessionDurationSeconds = 60 * 60 * 12;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const emailHash = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

type AuthUser = { id: string; email: string; displayName: string; role: string; passwordHash: string };

export const verifyLogin = async (email: string, password: string): Promise<AuthUser | undefined> => {
	const database = getDatabase();
	const key = emailHash(email);
	const attempt = await database.select().from(loginAttempts).where(and(eq(loginAttempts.emailHash, key), gt(loginAttempts.windowEndsAt, new Date()))).limit(1);
	if (attempt[0] && attempt[0].attempts >= 5) return undefined;
	const found = await database.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
	const user = found[0];
	if (!user || !(await argon2.verify(user.passwordHash, password))) {
		await database.execute(sql`INSERT INTO login_attempts (email_hash, attempts, window_ends_at)
			VALUES (${key}, 1, NOW() + INTERVAL '15 minutes')
			ON CONFLICT (email_hash) DO UPDATE SET
			attempts = CASE WHEN login_attempts.window_ends_at <= NOW() THEN 1 ELSE login_attempts.attempts + 1 END,
			window_ends_at = CASE WHEN login_attempts.window_ends_at <= NOW() THEN NOW() + INTERVAL '15 minutes' ELSE login_attempts.window_ends_at END`);
		return undefined;
	}
	await database.delete(loginAttempts).where(eq(loginAttempts.emailHash, key));
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
