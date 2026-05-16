import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, badRequest, serverError } from "@/lib/api";

export const runtime = "nodejs";

/**
 * GET /api/profile
 * Returns the current user's profile. Defensive — if a legacy user has no
 * profiles row (pre-trigger), we upsert one so the rest of the app can
 * assume the row exists.
 */
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("id, email, full_name, cv_text, cv_updated_at, created_at, updated_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) return serverError(error.message);

  if (data) return NextResponse.json({ profile: data });

  // Legacy user without a profile row — create it now.
  const { data: inserted, error: insertErr } = await auth.supabase
    .from("profiles")
    .insert({
      id: auth.user.id,
      email: auth.user.email ?? "",
      full_name:
        (auth.user.user_metadata?.full_name as string | undefined) ?? null,
    })
    .select("id, email, full_name, cv_text, cv_updated_at, created_at, updated_at")
    .single();

  if (insertErr || !inserted) return serverError(insertErr?.message ?? "Profile create failed");
  return NextResponse.json({ profile: inserted });
}

const PatchBody = z.object({
  cv_text: z.string().max(40_000).nullable().optional(),
  full_name: z.string().max(120).nullable().optional(),
});

/**
 * PATCH /api/profile
 * Updates the current user's profile. When cv_text changes, cv_updated_at
 * is stamped server-side so the UI can show "last updated" reliably.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Invalid input");
  }

  const updates: Record<string, unknown> = { ...body };
  if (Object.prototype.hasOwnProperty.call(body, "cv_text")) {
    updates.cv_updated_at = new Date().toISOString();
  }

  // Upsert so legacy users without a profile row get one on first save.
  const { data, error } = await auth.supabase
    .from("profiles")
    .upsert({
      id: auth.user.id,
      email: auth.user.email ?? "",
      ...updates,
    })
    .select("id, email, full_name, cv_text, cv_updated_at, created_at, updated_at")
    .single();

  if (error || !data) return serverError(error?.message ?? "Save failed");
  return NextResponse.json({ profile: data });
}
