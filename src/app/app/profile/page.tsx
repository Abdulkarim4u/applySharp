import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileEditor } from "./ProfileEditor";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const PROFILE_COLS =
  "id, email, full_name, cv_text, cv_updated_at, created_at, updated_at";

export default async function ProfilePage() {
  const supabase = await createClient();

  // Layout already gated; getClaims is local and fast.
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims();
  if (claimsErr) {
    console.error("[profile] getClaims failed", claimsErr);
    redirect("/login");
  }
  const claims = claimsData?.claims;
  if (!claims?.sub) redirect("/login");
  const userId = claims.sub as string;
  const userEmail = (claims.email as string | undefined) ?? "";
  const userFullName =
    ((claims.user_metadata as Record<string, unknown> | undefined)?.full_name as
      | string
      | undefined) ?? null;

  // Three queries in parallel. Each result is treated as optional — if any
  // single one errors we still render a usable page rather than 500-ing.
  const [profileRes, lastStatementRes, countRes] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle(),
    supabase
      .from("statements")
      .select("id, title, cv_text, updated_at")
      .not("cv_text", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase.from("statements").select("id", { count: "exact", head: true }),
  ]);

  if (profileRes.error) {
    console.error("[profile] read profile failed", profileRes.error);
  }
  if (lastStatementRes.error) {
    console.error("[profile] read last statement failed", lastStatementRes.error);
  }
  if (countRes.error) {
    console.error("[profile] count statements failed", countRes.error);
  }

  let profile = (profileRes.data ?? null) as Profile | null;

  // Defensive create — covers legacy users whose profiles row never got
  // created by the on_auth_user_created trigger. Upsert so a race with the
  // trigger doesn't blow up either.
  if (!profile) {
    const { data: upserted, error: upsertErr } = await supabase
      .from("profiles")
      .upsert(
        { id: userId, email: userEmail, full_name: userFullName },
        { onConflict: "id" },
      )
      .select(PROFILE_COLS)
      .maybeSingle();
    if (upsertErr) {
      console.error("[profile] upsert profile failed", upsertErr);
    }
    profile = (upserted ?? null) as Profile | null;
  }

  // Last-resort synthesized record so the page can still render. Saves still
  // work because PATCH /api/profile upserts.
  if (!profile) {
    profile = {
      id: userId,
      email: userEmail,
      full_name: userFullName,
      cv_text: null,
      cv_updated_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const lastStatementRow =
    Array.isArray(lastStatementRes.data) && lastStatementRes.data.length > 0
      ? lastStatementRes.data[0]
      : null;
  const lastStatement =
    lastStatementRow && lastStatementRow.cv_text
      ? {
          title: lastStatementRow.title as string,
          cv_text: lastStatementRow.cv_text as string,
        }
      : null;

  const statementCount = countRes.count ?? 0;

  return (
    <ProfileEditor
      initial={profile}
      lastStatementCv={lastStatement}
      statementCount={statementCount}
    />
  );
}
