import { zValidator as base } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodSchema } from "zod";

/**
 * Drop-in zValidator that turns Zod failures into a clean
 * `{ error: "field: message" }` 400 — so clients never receive a raw
 * ZodError object (which would render as "[object Object]").
 */
export function zValidator<T extends ZodSchema, Target extends keyof ValidationTargets>(target: Target, schema: T) {
  return base(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
      const msg = issue ? `${path}${issue.message}` : "ข้อมูลไม่ถูกต้อง / Invalid input";
      return c.json({ error: msg }, 400);
    }
  });
}
