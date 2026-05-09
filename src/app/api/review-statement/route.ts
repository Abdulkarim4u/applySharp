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
      maxTokens: 4096,
      // Low temperature for consistent scoring — re-running review on the same
      // text should give the same score within a couple of points.
      temperature: 0.3,
    });

    return NextResponse.json({ review });
  } catch (e) {
    console.error("review-statement failed", e);
    return serverError(e instanceof Error ? e.message : "Review failed");
  }
}
