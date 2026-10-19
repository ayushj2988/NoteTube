import pg from "pg";
import { runMigrations } from "../src/db/migrate.js";

export const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://notetube:notetube@localhost:5432/notetube_test";

export default async function setup() {
  const pool = new pg.Pool({ connectionString: TEST_DB });
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await pool.end();
  await runMigrations(TEST_DB);
}
