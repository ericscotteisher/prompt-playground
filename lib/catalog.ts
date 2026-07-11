import type { CatalogModel, ParameterName, Provider } from "./types";

const PROVIDERS: Record<string, Provider> = { openai: "OpenAI", anthropic: "Anthropic", "x-ai": "xAI", x_ai: "xAI", google: "Google" };
const COMMON: ParameterName[] = ["temperature", "max_tokens", "top_p", "stop", "frequency_penalty", "presence_penalty"];

type OpenRouterModel = { id: string; name: string; context_length?: number; pricing?: { prompt?: string; completion?: string }; supported_parameters?: string[] };

export function normalizeModel(model: OpenRouterModel): CatalogModel | null {
  const prefix = model.id.split("/")[0];
  const provider = PROVIDERS[prefix];
  if (!provider) return null;
  const reported = new Set(model.supported_parameters ?? COMMON);
  const supported = COMMON.filter((key) => reported.has(key));
  if (reported.has("reasoning") || /(^|[- ])(o[134]|gpt-5|claude|gemini-2\.5|grok)/i.test(model.id)) supported.push("reasoning");
  return { id: model.id, name: model.name, provider, contextLength: model.context_length ?? 0, pricing: { prompt: Number(model.pricing?.prompt ?? 0), completion: Number(model.pricing?.completion ?? 0) }, supportedParameters: supported };
}

export function normalizeCatalog(models: OpenRouterModel[]) { return models.map(normalizeModel).filter((m): m is CatalogModel => Boolean(m)).sort((a,b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name)); }
