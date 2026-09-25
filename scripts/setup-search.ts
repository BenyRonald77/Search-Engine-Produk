import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";

async function main() {
  const sql = readFileSync(join(__dirname, "..", "prisma", "sql", "001_setup_search.sql"), "utf-8");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
    console.log("[setup-search] Berhasil: extension pg_trgm/unaccent, kolom search_vector, dan index GIN siap.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[setup-search] ERROR:", error);
  process.exit(1);
});
