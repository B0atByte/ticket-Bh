import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Generated SQL migrations are written to the top-level /db folder
// so the monorepo keeps a single source of truth for the schema history.
export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema.ts",
  out: "../db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
