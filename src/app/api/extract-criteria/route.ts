import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, badRequest, serverError } from "@/lib/api";
import { callClaudeJson } from "@/lib/anthropic-json";
import {
  EXTRACT_CRITERIA_SYSTEM,
  buildExtractCriteriaUser,
} from "@/lib/prompts/extract-criteria";
import type { PersonSpec } from "@/lib/types";

const Body = z.object({
  jobAdvert: z.string().min(50, "Job advert is too short").max(40_000),
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
    const personSpec = await callClaudeJson<PersonSpec>({
      system: EXTRACT_CRITERIA_SYSTEM,
      user: buildExtractCriteriaUser(body.jobAdvert),
      maxTokens: 4096,
    });

    if (!personSpec.criteria || personSpec.criteria.length === 0) {
      return serverError("Could not extract any criteria from the advert");
    }

    return NextResponse.json({ personSpec });
  } catch (e) {
    console.error("extract-criteria failed", e);
    return serverError(e instanceof Error ? e.message : "Generation failed");
  }
}
