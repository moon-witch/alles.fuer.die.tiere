import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { createId } from '../src/lib/domain/ids';
import { verifyLogin } from '../src/lib/server/auth';
import { getDatabase } from '../src/lib/server/db/client';
import { loginAttempts, users } from '../src/lib/server/db/schema';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the database integration check.');

const database = getDatabase();
const email = `auth-${createId()}@example.invalid`;
const password = 'integration-test-password';
await database.insert(users).values({
	id: createId(),
	email,
	displayName: 'Password login test',
	role: 'steward',
	passwordHash: await argon2.hash(password, { type: argon2.argon2id })
});

for (let attempt = 0; attempt < 5; attempt += 1) {
	assert.equal(await verifyLogin(email, 'incorrect-password'), undefined);
}
assert.equal(await verifyLogin(email, password), undefined, 'login must be limited after five failures');
await database.update(loginAttempts).set({ windowEndsAt: new Date(Date.now() - 1000) }).where(eq(loginAttempts.emailHash, createHash('sha256').update(email).digest('hex')));
assert.equal((await verifyLogin(email, password))?.email, email, 'password login must work after the limit expires');

console.log('Password login and temporary attempt limit verified against PostgreSQL.');
process.exit(0);
