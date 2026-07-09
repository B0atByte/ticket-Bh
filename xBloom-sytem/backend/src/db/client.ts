import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../env.js";
import { schema } from "./schema.js";

/**
 * Shared connection pool + Drizzle instance for the API.
 * A pool (not a single connection) so concurrent requests don't serialize.
 */
export const pool = mysql.createPool({
  uri: env.DATABASE_URL,
  connectionLimit: 10,
  waitForConnections: true,
});

export const db = drizzle(pool, { schema, mode: "default" });
