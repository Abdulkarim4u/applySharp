import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, badRequest } from "@/lib/api";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { cleanStatementText } from "@/lib/clean-statement";
import {
  GENERATE_STATEMENT_SYSTEM,
  buildGenerateStatementUser,
} from "@/lib/prompts/generate-statement";

const Body = z.object({
  statementId: z.string().uuid(),
  personSpec: z.object({
    jobTitle: z.string(),
    band: z.string().nullable(),
    organisation: z.string().nullable(),
    criteria: z.array(z.any()),
  }),
  cv: z.string().min(50).max(40_000),
  gapFills: z.array(
    z.object({
      criterionId: z.string(),
      criterionText: z.string().optional(),
      question: z.string().optional(),
      answer: z.string(),
    }),
  ),
  useSubheadings: z.boolean().default(false),
});

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Invalid input");
  }

  // Verify the statement belongs to this user before we burn tokens
  const { data: statement, error: stErr } = await auth.supabase
    .from("statements")
    .select("id, user_id")
    .eq("id", body.statementId)
    .single();

  if (stErr || !statement || statement.user_id !== auth.user.id) {
    return badRequest("Statement not found");
  }

  const gapFillsText = body.gapFills
    .map(
      (g) =>
        `Criterion: ${g.criterionText ?? g.criterionId}\nQuestion: ${g.question ?? ""}\nAnswer: ${g.answer}`,
    )
    .join("\n\n");

  const anthropic = getAnthropic();

  const stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    // No prompt caching here: this endpoint is called once per wizard
    // session. Caching has a 25% write surcharge that only pays off when
    // the same prompt is reused 2+ times within 5 minutes.
    system: GENERATE_STATEMENT_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildGenerateStatementUser({
          personSpec: JSON.stringify(body.personSpec, null, 2),
          cv: body.cv,
          gapFills: gapFillsText,
          jobTitle: body.personSpec.jobTitle,
          band: body.personSpec.band,
          organisation: body.personSpec.organisation,
          useSubheadings: body.useSubheadings,
        }),
      },
    ],
  });

  let fullText = "";
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = event.delta.text;
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }

        // Strip AI tells (markdown, em-dashes, semicolons) before saving so the
        // version users see on next load is clean and paste-ready for NHS forms.
        const cleaned = cleanStatementText(fullText);

        await auth.supabase
          .from("statements")
          .update({
            draft_text: cleaned,
            final_text: cleaned,
            status: "completed",
          })
          .eq("id", body.statementId)
          .eq("user_id", auth.user.id);

        controller.close();
      } catch (err) {
        console.error("stream failed", err);
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
