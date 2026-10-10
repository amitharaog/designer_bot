import "server-only";
import { cfg } from "./config";

export type GeminiMsg = { role: "user" | "model"; text: string };
export type GeminiUsage = { input_tokens: number; output_tokens: number };

/** Parse model JSON, tolerating code fences or stray text around the object. */
function parseJsonLoose<T>(text: string, finish: string): T {
  const unfenced = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try {
    return JSON.parse(unfenced) as T;
  } catch {}
  const a = unfenced.indexOf("{");
  const b = unfenced.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(unfenced.slice(a, b + 1)) as T;
    } catch {}
  }
  throw new Error(`Gemini returned unparseable JSON (finishReason=${finish}): ${text.slice(0, 200)}`);
}

/** One structured-JSON call to the Gemini REST API. Throws on any non-2xx or unparseable reply. */
export async function geminiJson<T>(opts: Parameters<typeof geminiOnce>[0]): Promise<{ data: T; usage: GeminiUsage }> {
  try {
    return await geminiOnce<T>(opts);
  } catch (e) {
    // A cut-off or malformed answer is usually fine on a second try; auth/quota errors are not retried.
    if (e instanceof Error && /unparseable|no content/.test(e.message)) {
      console.warn("[studio] Gemini output unusable, retrying once:", e.message);
      return geminiOnce<T>(opts);
    }
    throw e;
  }
}

async function geminiOnce<T>(opts: {
  system: string;
  messages: GeminiMsg[];
  schema: object;
  timeoutMs?: number;
}): Promise<{ data: T; usage: GeminiUsage }> {
  const key = cfg.gemini.key();
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  // Model names get retired; try the configured one, then current aliases. A 404 means "no such model": try the next.
  const models = [...new Set([cfg.gemini.model(), "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"].filter(Boolean))];
  let res: Response | null = null;
  for (const model of models) {
    res = await fetch(`${cfg.gemini.base()}/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: opts.messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: opts.schema,
          temperature: 0.4,
          maxOutputTokens: 8192, // newer models spend output tokens on thinking first; leave room for the JSON
          // thinkingBudget is a 2.x-only knob; newer models reject or ignore it
          ...(model.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });
    if (res.status !== 404) break;
    console.warn(`[studio] Gemini model ${model} not found, trying next`);
  }
  res = res!;
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const text: string | undefined = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  const finish = body?.candidates?.[0]?.finishReason ?? "?";
  if (!text) throw new Error(`Gemini returned no content (finishReason=${finish})`);
  return {
    data: parseJsonLoose<T>(text, finish),
    usage: {
      input_tokens: body?.usageMetadata?.promptTokenCount ?? 0,
      // thinking tokens (if any) are billed as output
      output_tokens: (body?.usageMetadata?.candidatesTokenCount ?? 0) + (body?.usageMetadata?.thoughtsTokenCount ?? 0),
    },
  };
}
