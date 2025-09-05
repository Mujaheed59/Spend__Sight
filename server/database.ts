import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

let db: any = null;

if (!connectionString) {
  console.warn("⚠️  DATABASE_URL environment variable is not set - PostgreSQL features will be unavailable");
  db = null;
} else {
  // Create the connection
  const client = postgres(connectionString);
  db = drizzle(client, { schema });
}

export { db };
export default db;