import { getAnthropic, MODEL } from "./anthropic";

/**
 * Calls Claude with a system + user prompt and parses the response as JSON.
 * Strips optional ```json fences before parsing.
 */
export async function callClaudeJson<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<T> {
  const client = getAnthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const cleaned = stripFences(block.text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const recovered = extractJson(cleaned);
    if (!recovered) {
      throw new Error("Claude response was not valid JSON");
    }
    return JSON.parse(recovered) as T;
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
