export type Provider = "OpenAI" | "Anthropic" | "xAI" | "Google";
export type ParameterName = "temperature" | "max_tokens" | "top_p" | "stop" | "frequency_penalty" | "presence_penalty" | "reasoning";

export interface CatalogModel {
  id: string; name: string; provider: Provider; contextLength: number;
  pricing: { prompt: number; completion: number };
  supportedParameters: ParameterName[];
}

export interface ModelSettings {
  temperature?: number; max_tokens?: number; top_p?: number; stop?: string[];
  frequency_penalty?: number; presence_penalty?: number;
  reasoning?: { effort?: "low" | "medium" | "high" };
}

export interface ModelConfig { instanceId: string; modelId: string; displayName: string; provider: Provider; settings: ModelSettings }
export type RunStatus = "idle" | "streaming" | "completed" | "failed" | "cancelled";
export interface RunResult { status: RunStatus; content: string; error?: string; startedAt?: number; firstTokenAt?: number; completedAt?: number; promptTokens?: number; completionTokens?: number; cost?: number; estimatedCost?: boolean }

export type RunEvent =
  | { type: "start"; instanceId: string; at: number }
  | { type: "delta"; instanceId: string; content: string; at: number }
  | { type: "complete"; instanceId: string; at: number; promptTokens?: number; completionTokens?: number; cost?: number; estimatedCost?: boolean }
  | { type: "error"; instanceId: string; message: string }
  | { type: "cancelled"; instanceId: string };
