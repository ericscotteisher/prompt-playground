import { describe, expect, it } from "vitest";
import { normalizeCatalog, normalizeModel } from "./catalog";

describe("catalog normalization", () => {
  it("keeps only selected providers", () => { expect(normalizeCatalog([{id:"openai/gpt-5",name:"GPT-5"},{id:"meta/llama",name:"Llama"}])).toHaveLength(1); });
  it("normalizes pricing and capabilities", () => { const m=normalizeModel({id:"google/gemini-2.5-pro",name:"Gemini",context_length:100,pricing:{prompt:"0.000001"},supported_parameters:["temperature","reasoning"]}); expect(m).toMatchObject({provider:"Google",contextLength:100,pricing:{prompt:.000001},supportedParameters:["temperature","reasoning"]}); });
});
