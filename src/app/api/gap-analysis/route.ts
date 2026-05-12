import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, badRequest, serverError } from "@/lib/api";
import { callClaudeJson } from "@/lib/anthropic-json";
import {
  GAP_ANALYSIS_SYSTEM,
  buildGapAnalysisUser,
} from "@/lib/prompts/gap-analysis";
import type { GapFillQuestion } from "@/lib/types";

const Body = z.object({
  personSpec: z.object({
    jobTitle: z.string(),
    band: z.string().nullable(),
    organisation: z.string().nullable(),
    criteria: z
      .array(
        z.object({
          id: z.string(),
          text: z.string(),
          type: z.enum(["essential", "desirable"]),
          category: z.enum(["experience", "skills", "qualifications", "values"]),
        }),
      )
      .min(1),
  }),
  cv: z.string().min(50).max(40_000),
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
    const result = await callClaudeJson<{ questions: GapFillQuestion[] }>({
      system: GAP_ANALYSIS_SYSTEM,
      user: buildGapAnalysisUser(JSON.stringify(body.personSpec, null, 2), body.cv),
      maxTokens: 4096,
    });

    // Strip em-dashes / en-dashes from the AI-drafted skeletons. The system
    // prompt forbids them but Claude still emits them inside [bracketed
    // prompts], and the user sees those drafts verbatim.
    const questions = (result.questions ?? []).map((q) => ({
      ...q,
      draftAnswer: q.draftAnswer ? sanitiseDraft(q.draftAnswer) : q.draftAnswer,
      hint: sanitiseDraft(q.hint ?? ""),
      question: sanitiseDraft(q.question ?? ""),
    }));

    return NextResponse.json({ questions });
  } catch (e) {
    console.error("gap-analysis failed", e);
    return serverError(e instanceof Error ? e.message : "Analysis failed");
  }
}

function sanitiseDraft(s: string): string {
  return s
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s*–\s*/g, ", ")
    .replace(/\s--\s/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/[ \t]{2,}/g, " ");
}
