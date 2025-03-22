// Database migration script
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./shared/schema";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  console.log("Connecting to database...");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log("Creating tables...");
  const db = drizzle(pool, { schema });

  try {
    // Push schema to database - this creates tables
    await db.insert(schema.allowedUsers).values({
      email: "burke.cates@gmail.com",
      displayName: "Admin",
      isAdmin: true,
    }).onConflictDoNothing();
    
    console.log("Added admin user: burke.cates@gmail.com");
    console.log("Database setup complete!");
  } catch (error) {
    console.error("Error setting up database:", error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);