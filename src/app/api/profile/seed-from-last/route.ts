import { NextResponse } from "next/server";
import { requireUser, serverError } from "@/lib/api";

export const runtime = "nodejs";

const PROFILE_COLS =
  "id, email, full_name, cv_text, cv_updated_at, created_at, updated_at";

/**
 * POST /api/profile/seed-from-last
 * One-click migration for users who've been pasting CVs into every
 * statement. Copies the CV from their most recent statement that has
 * one into profiles.cv_text.
 *
 * Refuses to overwrite an existing profile CV — that path goes through
 * the Profile editor instead, with explicit intent.
 */
export async function POST() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  // Don't overwrite an existing saved CV — banner shouldn't have shown,
  // but be defensive.
  const { data: existing, error: existingErr } = await auth.supabase
    .from("profiles")
    .select("cv_text")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (existingErr) return serverError(existingErr.message);
  if (existing?.cv_text) {
    return NextResponse.json(
      { error: "Profile already has a saved CV. Edit it in your profile." },
      { status: 409 },
    );
  }

  // Most recent statement with a CV
  const { data: lastStmt, error: lastErr } = await auth.supabase
    .from("statements")
    .select("cv_text")
    .not("cv_text", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (lastErr) return serverError(lastErr.message);
  const sourceCv = lastStmt?.[0]?.cv_text ?? null;
  if (!sourceCv) {
    return NextResponse.json(
      { error: "No previous statement with a CV found." },
      { status: 404 },
    );
  }

  const { data: profile, error: upsertErr } = await auth.supabase
    .from("profiles")
    .upsert(
      {
        id: auth.user.id,
        email: auth.user.email ?? "",
        cv_text: sourceCv,
        cv_updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select(PROFILE_COLS)
    .single();

  if (upsertErr || !profile) {
    return serverError(upsertErr?.message ?? "Could not save profile");
  }

  return NextResponse.json({ profile });
}
