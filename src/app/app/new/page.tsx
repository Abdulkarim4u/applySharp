import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewStatementRedirectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("statements")
    .insert({
      user_id: user.id,
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
