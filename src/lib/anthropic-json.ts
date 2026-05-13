import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODEL } from "./anthropic";

/**
 * Calls Claude with a system + user prompt and parses the response as JSON.
 * Strips optional ```json fences before parsing. Throws descriptive errors
 * when the response is truncated or unparseable so the API route can surface
 * something more useful than "Review failed".
 */
export async function callClaudeJson<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  /** Enable Anthropic's ephemeral prompt caching on the system prompt.
   *  Only set true when the endpoint is called 2+ times within a 5-minute
   *  window (e.g. inside the auto-improve loop). For once-per-session
   *  endpoints, caching adds a 25% write surcharge with no read to amortise
   *  it against — net cost increases. Default is false. */
  cacheSystem?: boolean;
  /** Optional cached prefix block to prepend to the user message. Useful
   *  when a large input (e.g. person_spec) is identical across consecutive
   *  calls but the rest of the user message changes. */
  cachedUserPrefix?: string;
}): Promise<T> {
  const client = getAnthropic();

  const systemParam = opts.cacheSystem
    ? [
        {
          type: "text" as const,
          text: opts.system,
          cache_control: { type: "ephemeral" as const },
        },
      ]
    : opts.system;

  const userContent = opts.cachedUserPrefix
    ? [
        {
          type: "text" as const,
          text: opts.cachedUserPrefix,
          cache_control: { type: "ephemeral" as const },
        },
        { type: "text" as const, text: opts.user },
      ]
    : opts.user;

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: opts.model ?? MODEL,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature,
      system: systemParam,
      messages: [{ role: "user", content: userContent }],
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      throw new Error(
        `Claude API error (${e.status ?? "unknown"}): ${e.message}`,
      );
    }
    throw e;
  }

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "Claude response was cut off (max_tokens reached). Increase max_tokens.",
    );
  }

  const cleaned = stripFences(block.text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const recovered = extractJson(cleaned);
    if (recovered) {
      try {
        return JSON.parse(recovered) as T;
      } catch {
        // fall through
      }
    }
    const preview = cleaned.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(
      `Claude response was not valid JSON. stop_reason=${response.stop_reason}. preview: ${preview}`,
    );
  }
}

function stripFences(text: string): string {
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return s.trim();
}

function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}
