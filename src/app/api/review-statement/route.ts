import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, badRequest, serverError } from "@/lib/api";
import { callClaudeJson } from "@/lib/anthropic-json";
import { REVIEW_MODEL } from "@/lib/anthropic";
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
    // Only send essential criteria to Claude (we don't score desirable
    // anyway, and they bloat the input).
    const essentialOnly = {
      jobTitle: body.personSpec.jobTitle,
      band: body.personSpec.band,
      organisation: body.personSpec.organisation,
      criteria: (
        body.personSpec.criteria as Array<{ type?: string }>
      ).filter((c) => c.type === "essential"),
    };

    const review = await callClaudeJson<ReviewResult>({
      model: REVIEW_MODEL,
      system: REVIEW_STATEMENT_SYSTEM,
      user: buildReviewUser({
        personSpecJson: JSON.stringify(essentialOnly),
        statementText: body.statementText,
        jobTitle: body.personSpec.jobTitle,
        band: body.personSpec.band,
        organisation: body.personSpec.organisation,
      }),
      // Tight output caps in the prompt keep this comfortably under 4096.
      maxTokens: 4096,
      temperature: 0.2,
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
