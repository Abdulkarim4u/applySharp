import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, badRequest, serverError } from "@/lib/api";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { cleanStatementText } from "@/lib/clean-statement";
import {
  IMPROVE_STATEMENT_SYSTEM,
  buildImproveUser,
} from "@/lib/prompts/improve-statement";

const Body = z.object({
  statementId: z.string().uuid(),
  currentStatement: z.string().min(100).max(20_000),
  fixes: z
    .array(
      z.object({
        title: z.string(),
        suggestion: z.string(),
        userInput: z.string().max(2000).optional(),
      }),
    )
    .min(1),
  jobTitle: z.string(),
  organisation: z.string().nullable(),
});

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Invalid input");
  }

  // Verify ownership before burning tokens
  const { data: statement, error: stErr } = await auth.supabase
    .from("statements")
    .select("id, user_id")
    .eq("id", body.statementId)
    .single();

  if (stErr || !statement || statement.user_id !== auth.user.id) {
    return badRequest("Statement not found");
  }

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      // Slightly lower temperature than fresh generation — we want surgical
      // edits, not creative rewrites.
      temperature: 0.5,
      // Cache the static improve system prompt. Auto-improve loops call
      // this 2-3 times in quick succession; subsequent calls within
      // 5 minutes pay 10% of input-token cost.
      system: [
        {
          type: "text",
          text: IMPROVE_STATEMENT_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: buildImproveUser({
            currentStatement: body.currentStatement,
            fixes: body.fixes,
            jobTitle: body.jobTitle,
            organisation: body.organisation,
            currentWordCount: body.currentStatement
              .trim()
              .split(/\s+/)
              .filter(Boolean).length,
          }),
        },
      ],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return serverError("No text response from Claude");
    }

    const cleaned = cleanStatementText(block.text);

    // Save the improved version as the current draft / final
    await auth.supabase
      .from("statements")
      .update({
        draft_text: cleaned,
        final_text: cleaned,
      })
      .eq("id", body.statementId)
      .eq("user_id", auth.user.id);

    return NextResponse.json({ statement: cleaned });
  } catch (e) {
    console.error("improve-statement failed", e);
    return serverError(e instanceof Error ? e.message : "Improvement failed");
  }
}
