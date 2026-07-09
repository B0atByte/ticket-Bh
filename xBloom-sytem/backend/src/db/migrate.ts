import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { env } from "../env.js";

/**
 * Applies all generated migrations from /db/migrations, then exits.
 * Run via `npm run db:migrate` (or from the container entrypoint).
 *
 * MySQL can report "healthy" a moment before it accepts TCP connections,
 * so we retry the initial connect a few times before giving up.
 */
async function connectWithRetry(attempts = 10, delayMs = 3000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await mysql.createConnection({ uri: env.DATABASE_URL, multipleStatements: true });
    } catch (err) {
      if (i === attempts) throw err;
      console.log(`waiting for database… (${i}/${attempts})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("unreachable");
}

async function main() {
  const connection = await connectWithRetry();
  const db = drizzle(connection);
  await migrate(db, { migrationsFolder: "../db/migrations" });
  await connection.end();
  console.log("✓ migrations applied");
}

main().catch((err) => {
  console.error("✗ migration failed:", err);
  process.exit(1);
});
