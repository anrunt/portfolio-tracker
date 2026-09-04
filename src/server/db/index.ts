import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

config({ path: '.env' });

const client = postgres(process.env.DATABASE_URL!);

export const db = drizzle({ client });

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function closeDb() {
  await client.end();
}
