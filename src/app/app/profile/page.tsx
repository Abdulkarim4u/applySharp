import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileEditor } from "./ProfileEditor";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();

  // Layout already gated; getClaims is local and fast.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) redirect("/login");
  const userId = claims.sub as string;
  const userEmail = (claims.email as string | undefined) ?? "";

  // Fetch profile and (for the import flow) the most recent statement with a
  // CV. Done in parallel so the page renders fast even on first visit.
  const [profileRes, lastStatementRes, countRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, full_name, cv_text, cv_updated_at, created_at, updated_at",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("statements")
      .select("id, title, cv_text, updated_at")
      .not("cv_text", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("statements")
      .select("id", { count: "exact", head: true }),
  ]);

  let profile: Profile | null = profileRes.data as Profile | null;
  // Defensive — legacy user might not have a profile row yet. Create one.
  if (!profile) {
    const { data: inserted } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        email: userEmail,
        full_name:
          (claims.user_metadata?.full_name as string | undefined) ?? null,
      })
      .select(
        "id, email, full_name, cv_text, cv_updated_at, created_at, updated_at",
      )
      .single();
    profile = inserted as Profile;
  }

  const lastStatement = lastStatementRes.data;
  const statementCount = countRes.count ?? 0;

  return (
    <ProfileEditor
      initial={profile}
      lastStatementCv={
        lastStatement && lastStatement.cv_text
          ? {
              title: lastStatement.title,
              cv_text: lastStatement.cv_text,
            }
          : null
      }
      statementCount={statementCount}
    />
  );
}
