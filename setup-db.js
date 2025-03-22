import pkg from 'pg';
const { Client } = pkg;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  console.log("Connecting to database...");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Connected to database");

    // Create tables
    console.log("Creating tables...");
    await client.query(`
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
    `);
    console.log("Tables created successfully");

    // Add admin user
    console.log("Adding admin user...");
    await client.query(`
      INSERT INTO allowed_users (email, display_name, is_admin)
      VALUES ('burke.cates@gmail.com', 'Admin', TRUE)
      ON CONFLICT (email) DO UPDATE SET is_admin = TRUE;
    `);
    console.log("Admin user added/updated successfully");

    console.log("Database setup complete!");
  } catch (error) {
    console.error("Error setting up database:", error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);