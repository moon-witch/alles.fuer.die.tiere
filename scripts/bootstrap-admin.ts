import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { encryptTotpSecret } from '../src/lib/server/auth';
import { getDatabase } from '../src/lib/server/db/client';
import { users } from '../src/lib/server/db/schema';
import { createId } from '../src/lib/domain/ids';

const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
const totpSecret = process.env.ADMIN_BOOTSTRAP_TOTP_SECRET?.replace(/\s/g, '');
if (!email || !password || !totpSecret) throw new Error('Set ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD, and ADMIN_BOOTSTRAP_TOTP_SECRET before bootstrapping an account.');

const database = getDatabase();
const existing = await database.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
if (existing[0]) throw new Error('An account with this email already exists.');

await database.insert(users).values({
	id: createId(),
	email,
	displayName: 'Joshua',
	role: 'steward',
	passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
	totpSecret: encryptTotpSecret(totpSecret)
});

console.log('Private steward account created. The TOTP secret was encrypted before storage.');
process.exit(0);
