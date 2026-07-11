import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function getOpenRouterKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  try {
    const raw = await readFile(path.join(process.cwd(), ".secrets"), "utf8");
    const match = raw.match(/^(?:OPENROUTER_API_KEY\s*=\s*)?['"]?([^\s'"=]+)['"]?\s*$/m);
    return match?.[1];
  } catch { return undefined; }
}
