import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, badRequest, serverError } from "@/lib/api";
import { callClaudeJson } from "@/lib/anthropic-json";
import {
  REVIEW_STATEMENT_SYSTEM,
  buildReviewUser,
} from "@/lib/prompts/review-statement";
import type { ReviewResult } from "@/lib/types";

const Body = z.object({
  personSpec: z.object({
    jobTitle: z.string(),
    band: z.string().nullable(),
    organisation: z.string().nullable(),
    criteria: z.array(z.any()).min(1),
  }),
  statementText: z.string().min(100).max(20_000),
});

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Invalid input");
  }

  try {
    const review = await callClaudeJson<ReviewResult>({
      system: REVIEW_STATEMENT_SYSTEM,
      user: buildReviewUser({
        personSpecJson: JSON.stringify(body.personSpec, null, 2),
        statementText: body.statementText,
        jobTitle: body.personSpec.jobTitle,
        band: body.personSpec.band,
        organisation: body.personSpec.organisation,
      }),
      // Person specs with 10+ essential criteria + 5 topFixes can produce
      // 3.5k+ tokens of JSON. 4096 was hitting max_tokens cutoffs which
      // surfaced as "Review failed" to the user.
      maxTokens: 8192,
      temperature: 0.3,
    });

    if (
      !review ||
      typeof review.overallScore !== "number" ||
      !Array.isArray(review.criterionScores)
    ) {
      console.error("review-statement: malformed review shape", review);
      return serverError(
        "The shortlister response was malformed. Please try again.",
      );
    }

    return NextResponse.json({ review });
  } catch (e) {
    console.error("review-statement failed", e);
    const msg = e instanceof Error ? e.message : "Review failed";
    return serverError(msg);
  }
}
