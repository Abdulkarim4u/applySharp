import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, badRequest, serverError } from "@/lib/api";

export const runtime = "nodejs";

const Body = z.object({
  sourceId: z.string().uuid(),
});

/**
 * Clones the CV from an existing statement into a fresh draft so the user
 * can apply to a similar role at a different Trust without re-pasting their
 * CV. Everything else (advert, criteria, gap fills, draft, scores) starts
 * blank — the user walks the wizard from step 0.
 *
 * Ownership is enforced by RLS on the source select. If a malicious caller
 * passes a sourceId they don't own, the select returns no row → 404.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Invalid input");
  }

  // Pull source and profile in parallel — profile fallback covers the edge
  // case where the source predates the CV being saved on the statement.
  const [sourceRes, profileRes] = await Promise.all([
    auth.supabase
      .from("statements")
      .select("cv_text, sector")
      .eq("id", body.sourceId)
      .single(),
    auth.supabase
      .from("profiles")
      .select("cv_text")
      .eq("id", auth.user.id)
      .maybeSingle(),
  ]);

  if (sourceRes.error || !sourceRes.data) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const cvText = sourceRes.data.cv_text ?? profileRes.data?.cv_text ?? null;

  const { data: created, error: insertErr } = await auth.supabase
    .from("statements")
    .insert({
      user_id: auth.user.id,
      title: "Untitled statement",
      sector: sourceRes.data.sector,
      cv_text: cvText,
      status: "draft",
      step: 0,
    })
    .select("id")
    .single();

  if (insertErr || !created) {
    return serverError(insertErr?.message ?? "Could not duplicate");
  }

  return NextResponse.json({ id: created.id });
}
