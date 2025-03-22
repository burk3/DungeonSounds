import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
const { Pool } = pkg;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  console.log("Connecting to database...");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log("Creating drizzle instance...");
  const db = drizzle(pool);

  console.log("Creating/migrating tables...");
  
  try {
    // Create tables for allowedUsers and sounds
    await db.execute/*sql*/`
      CREATE TABLE IF NOT EXISTS allowed_users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        uid TEXT UNIQUE
      );
      
      CREATE TABLE IF NOT EXISTS sounds (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        filename TEXT NOT NULL,
        category TEXT NOT NULL,
        uploader TEXT,
        uploaded_at TIMESTAMP DEFAULT NOW()
      );
    `;

    console.log("Tables created successfully.");
    
    // Add admin user
    await db.execute/*sql*/`
      INSERT INTO allowed_users (email, display_name, is_admin)
      VALUES ('burke.cates@gmail.com', 'Admin', TRUE)
      ON CONFLICT (email) DO UPDATE SET is_admin = TRUE;
    `;
    
    console.log("Admin user added/updated successfully.");
    console.log("Database setup complete!");
  } catch (error) {
    console.error("Error setting up database:", error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);