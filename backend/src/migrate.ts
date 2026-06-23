// Runs schema.sql against the database. Run once before seeding:
//   npx tsx src/migrate.ts
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing");
}

const sql = neon(databaseUrl);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schemaSql = readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  console.log("Running migration...");

  const statements = schemaSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await sql.query(statement);
  }

  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
