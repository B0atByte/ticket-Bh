import type { AuthUser } from "./lib/auth.js";

/** Shared Hono generics so `c.get("user")` is typed across the app. */
export type AppEnv = {
  Variables: {
    user: AuthUser | null;
  };
};
