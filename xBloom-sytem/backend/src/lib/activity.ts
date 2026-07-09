import { db } from "../db/client.js";
import { activityLog } from "../db/schema.js";
import type { AuthUser } from "./auth.js";

/**
 * Writes an audit entry. Called explicitly by handlers that perform
 * important actions so the target/detail are accurate. Never throws into
 * the request path — a logging failure must not fail the user's action.
 */
export async function logActivity(
  actor: AuthUser | null,
  action: string,
  target: string,
  detail?: string,
): Promise<void> {
  try {
    await db.insert(activityLog).values({
      userName: actor?.name ?? "system",
      userRole: actor?.role ?? "system",
      action,
      target,
      detail: detail ?? null,
    });
  } catch (err) {
    console.error("activity log failed:", err);
  }
}
