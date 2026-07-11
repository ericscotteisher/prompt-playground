import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Prompt Playground", description: "Compare LLM responses with OpenRouter" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
