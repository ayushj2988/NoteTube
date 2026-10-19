import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createDb } from "./index.js";

export async function runMigrations(url: string) {
  const { db, pool } = createDb(url);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  await pool.end();
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  await runMigrations(url);
  console.log("migrations applied");
}
