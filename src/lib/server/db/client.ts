import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export const getDatabase = () => {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) throw new Error('DATABASE_URL is required for database access.');
	if (!database) database = drizzle(postgres(connectionString, { max: 5 }), { schema });
	return database;
};
