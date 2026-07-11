import type { ModelConfig, RunEvent } from "@/lib/types";

export const runtime = "nodejs";
const encoder = new TextEncoder();
const allowedProviders = new Set(["openai", "anthropic", "x-ai", "x_ai", "google"]);

function emit(controller: ReadableStreamDefaultController, event: RunEvent) { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); }
function safeSettings(settings: ModelConfig["settings"]) {
  const output: Record<string, unknown> = {};
  if (typeof settings.temperature === "number") output.temperature = Math.min(2, Math.max(0, settings.temperature));
  if (typeof settings.max_tokens === "number") output.max_tokens = Math.min(131072, Math.max(1, Math.round(settings.max_tokens)));
  if (typeof settings.top_p === "number") output.top_p = Math.min(1, Math.max(0, settings.top_p));
  if (Array.isArray(settings.stop)) output.stop = settings.stop.slice(0, 4).map(String);
  if (typeof settings.frequency_penalty === "number") output.frequency_penalty = Math.min(2, Math.max(-2, settings.frequency_penalty));
  if (typeof settings.presence_penalty === "number") output.presence_penalty = Math.min(2, Math.max(-2, settings.presence_penalty));
  if (settings.reasoning?.effort) output.reasoning = { effort: settings.reasoning.effort };
  return output;
}

async function runModel(controller: ReadableStreamDefaultController, key: string, config: ModelConfig, system: string, user: string, signal: AbortSignal) {
  emit(controller, { type: "start", instanceId: config.instanceId, at: Date.now() });
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", signal, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "http://localhost:3000", "X-Title": "Prompt Playground" }, body: JSON.stringify({ model: config.modelId, messages: [{ role: "system", content: system }, { role: "user", content: user }], stream: true, usage: { include: true }, ...safeSettings(config.settings) }) });
    if (!response.ok) { const detail = await response.text(); throw new Error(detail.slice(0, 300) || `Request failed (${response.status})`); }
    if (!response.body) throw new Error("OpenRouter returned no response stream");
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let usage: { prompt_tokens?: number; completion_tokens?: number; cost?: number } = {};
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue; const data = line.slice(6).trim(); if (data === "[DONE]") continue;
        try { const chunk = JSON.parse(data); const content = chunk.choices?.[0]?.delta?.content; if (content) emit(controller, { type: "delta", instanceId: config.instanceId, content, at: Date.now() }); if (chunk.usage) usage = chunk.usage; } catch { /* incomplete vendor event */ }
      }
    }
    emit(controller, { type: "complete", instanceId: config.instanceId, at: Date.now(), promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, cost: usage.cost });
  } catch (error) {
    if (signal.aborted) emit(controller, { type: "cancelled", instanceId: config.instanceId });
    else emit(controller, { type: "error", instanceId: config.instanceId, message: error instanceof Error ? error.message : "Request failed" });
  }
}

export async function POST(request: Request) {
  const key = request.headers.get("x-openrouter-key")?.trim();
  if (!key) return Response.json({ error: "Enter your OpenRouter key using the Key button" }, { status: 401 });
  let body: { system?: unknown; user?: unknown; models?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (typeof body.system !== "string" || typeof body.user !== "string" || !Array.isArray(body.models) || body.models.length < 1 || body.models.length > 12) return Response.json({ error: "Provide prompts and 1–12 model configurations" }, { status: 400 });
  const models = body.models as ModelConfig[];
  if (models.some(m => !m?.instanceId || !m?.modelId || !allowedProviders.has(m.modelId.split("/")[0]))) return Response.json({ error: "Unsupported model configuration" }, { status: 400 });
  const stream = new ReadableStream({ async start(controller) { await Promise.allSettled(models.map(m => runModel(controller, key, m, body.system as string, body.user as string, request.signal))); controller.close(); } });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
