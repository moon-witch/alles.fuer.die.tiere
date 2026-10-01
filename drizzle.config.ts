import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './infra/db/migrations',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://local:local@localhost:5432/alles_fuer_die_tiere' },
	strict: true,
	verbose: true
});
