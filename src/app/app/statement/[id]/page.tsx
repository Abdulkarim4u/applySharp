import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatementWizard } from "./StatementWizard";
import type { StatementRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: statement, error } = await supabase
    .from("statements")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !statement) notFound();

  return <StatementWizard initial={statement as StatementRecord} />;
}
