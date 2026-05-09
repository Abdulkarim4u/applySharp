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
      maxTokens: 3072,
    });

    return NextResponse.json({ questions: result.questions ?? [] });
  } catch (e) {
    console.error("gap-analysis failed", e);
    return serverError(e instanceof Error ? e.message : "Analysis failed");
  }
}
