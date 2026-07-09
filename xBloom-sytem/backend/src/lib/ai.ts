// DeepSeek client (OpenAI-compatible). The API key lives only on the server.
// Optional: set DEEPSEEK_API_KEY to enable; otherwise AI features report disabled.
const KEY = process.env.DEEPSEEK_API_KEY;
const BASE = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

export const aiEnabled = !!KEY;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Call DeepSeek chat completions. Throws a clean Error on failure so the route
 * can map it to a safe response. `json` requests a strict JSON object reply.
 */
export async function chat(messages: ChatMessage[], opts: { json?: boolean; timeoutMs?: number } = {}): Promise<string> {
  if (!KEY) throw new Error("AI not configured");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 800,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error(`[ai] request failed ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
      throw new Error(`AI request failed (${res.status})`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("AI request timed out");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
