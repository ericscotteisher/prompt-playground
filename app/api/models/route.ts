import { NextResponse } from "next/server";
import { normalizeCatalog } from "@/lib/catalog";

export const revalidate = 3600;
export async function GET() {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", { next: { revalidate: 3600 } });
    if (!response.ok) throw new Error(`OpenRouter returned ${response.status}`);
    const json = await response.json();
    return NextResponse.json({ models: normalizeCatalog(json.data ?? []) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load models" }, { status: 502 });
  }
}
