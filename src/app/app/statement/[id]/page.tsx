import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatementWizard } from "./StatementWizard";
import { DocumentView } from "./DocumentView";
import type { StatementRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const supabase = await createClient();

  // No auth check here — the /app layout already gated and RLS protects
  // the row. One fewer network round-trip per navigation.
  const [statementRes, profileRes] = await Promise.all([
    supabase.from("statements").select("*").eq("id", id).single(),
    supabase.from("profiles").select("cv_text, cv_updated_at").maybeSingle(),
  ]);

  if (statementRes.error || !statementRes.data) notFound();

  const record = statementRes.data as StatementRecord;
  const profileCvText = profileRes.data?.cv_text ?? null;

  // Completed statements default to the read-only document view. This avoids
  // accidentally firing expensive Claude calls (Re-score, Auto-improve) from
  // the wizard's step 5 just by clicking through from the home list.
  // ?edit=1 escape hatch routes back into the wizard for users who want to
  // re-run the whole pipeline.
  if (record.status === "completed" && edit !== "1") {
    return <DocumentView initial={record} />;
  }

  return (
    <StatementWizard initial={record} profileCvText={profileCvText} />
  );
}
