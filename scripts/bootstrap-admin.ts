import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../src/lib/server/db/client';
import { users } from '../src/lib/server/db/schema';
import { createId } from '../src/lib/domain/ids';

const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
if (!email || !password) throw new Error('Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD before bootstrapping an account.');

const database = getDatabase();
const existing = await database.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
if (existing[0]) throw new Error('An account with this email already exists.');

await database.insert(users).values({
	id: createId(),
	email,
	displayName: 'Joshua',
	role: 'steward',
	passwordHash: await argon2.hash(password, { type: argon2.argon2id })
});

console.log('Private steward account created.');
process.exit(0);
