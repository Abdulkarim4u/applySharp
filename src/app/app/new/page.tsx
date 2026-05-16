import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewStatementRedirectPage() {
  const supabase = await createClient();
  // Use getClaims for fast local JWT verify (no network round-trip).
  // Middleware/layout already gated, this just gives us the user id.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const { data, error } = await supabase
    .from("statements")
    .insert({
      user_id: userId,
      title: "Untitled statement",
      sector: "nhs",
      status: "draft",
      step: 0,
    })
    .select("id")
    .single();

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <h1 className="text-xl font-semibold">Could not create statement</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          {error?.message ?? "Unknown error"}
        </p>
      </div>
    );
  }

  redirect(`/app/statement/${data.id}`);
}
