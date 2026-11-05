import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL environment variable is required in production.");
}

/**
 * Disable prefetch as required for Supabase Transaction Pooler (PgBouncer).
 */
const queryClient = postgres(
  connectionString ?? "postgresql://postgres:postgres@localhost:5432/inspirespace",
  {
    prepare: false,
    max: 10,
  }
);

export const db = drizzle(queryClient, { schema });
export type Database = typeof db;

