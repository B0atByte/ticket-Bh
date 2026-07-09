const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Whether a Google API / network error is worth retrying. */
function isTransient(err: unknown): boolean {
  const e = err as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  const status = e?.code ?? e?.status ?? e?.response?.status;
  if (status === 429) return true; // rate limited
  if (typeof status === "number" && status >= 500) return true; // server error
  const netCodes = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"];
  return typeof e?.code === "string" && netCodes.includes(e.code);
}

/** Run `fn` with exponential backoff. Retries only on transient failures. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number; label?: string } = {},
): Promise<T> {
  const { retries = 3, baseMs = 500, label = "op" } = opts;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries || !isTransient(err)) throw err;
      const delay = baseMs * 2 ** (attempt - 1);
      console.warn(`[shopee] retrying ${label} (attempt ${attempt}/${retries}) in ${delay}ms`);
      await sleep(delay);
    }
  }
}
