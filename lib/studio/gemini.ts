import "server-only";
import { cfg } from "./config";

export type GeminiMsg = { role: "user" | "model"; text: string };
export type GeminiUsage = { input_tokens: number; output_tokens: number };

/** One structured-JSON call to the Gemini REST API. Throws on any non-2xx or unparseable reply. */
export async function geminiJson<T>(opts: {
  system: string;
  messages: GeminiMsg[];
  schema: object;
  timeoutMs?: number;
}): Promise<{ data: T; usage: GeminiUsage }> {
  const key = cfg.gemini.key();
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const res = await fetch(`${cfg.gemini.base()}/v1beta/models/${cfg.gemini.model()}:generateContent`, {
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
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 }, // phone latency matters more than deliberation
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const text: string | undefined = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error(`Gemini returned no content (finishReason=${body?.candidates?.[0]?.finishReason ?? "?"})`);
  return {
    data: JSON.parse(text) as T,
    usage: {
      input_tokens: body?.usageMetadata?.promptTokenCount ?? 0,
      // thinking tokens (if any) are billed as output
      output_tokens: (body?.usageMetadata?.candidatesTokenCount ?? 0) + (body?.usageMetadata?.thoughtsTokenCount ?? 0),
    },
  };
}
