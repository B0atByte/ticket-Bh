import { log } from "./logger.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Whether a Google API / network error is worth retrying. */
function isTransient(err) {
  const status = err?.code || err?.status || err?.response?.status;
  if (status === 429) return true; // rate limited
  if (typeof status === "number" && status >= 500) return true; // server error
  // Network-level errors (no HTTP status).
  const netCodes = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"];
  return netCodes.includes(err?.code);
}

/**
 * Run `fn` with exponential backoff. Retries only on transient failures.
 * @param {Function} fn  async function to run
 * @param {object}   opts { retries=3, baseMs=500, label }
 */
export async function withRetry(fn, opts = {}) {
  const { retries = 3, baseMs = 500, label = "op" } = opts;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries || !isTransient(err)) throw err;
      const delay = baseMs * 2 ** (attempt - 1);
      log.warn(`retrying ${label} (attempt ${attempt}/${retries}) in ${delay}ms`, {
        reason: err?.message,
      });
      await sleep(delay);
    }
  }
}
