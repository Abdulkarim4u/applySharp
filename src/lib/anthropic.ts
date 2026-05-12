import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const MODEL = "claude-sonnet-4-6";

// Review-specific model. We swap to Haiku for /api/review-statement because
// the route has to fit Vercel Hobby's 10s function timeout — Sonnet was
// taking 15-25s on long statements and returning 504. Haiku 4.5 finishes
// the same JSON in 3-6s, easily under the budget, with comparable scoring
// quality at low temperature.
export const REVIEW_MODEL = "claude-haiku-4-5-20251001";
