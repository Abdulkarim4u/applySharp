"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { ApplicationStatus } from "@/lib/types";

const NEXT_ACTION: Partial<
  Record<
    ApplicationStatus,
    { value: ApplicationStatus; label: string; verb: string }
  >
> = {
  not_submitted: {
    value: "submitted",
    label: "Mark as submitted",
    verb: "Submitted",
  },
  submitted: {
    value: "interview",
    label: "Got an interview?",
    verb: "Interview booked",
  },
  interview: {
    value: "offer",
    label: "Got the offer? 🎉",
    verb: "Offer received",
  },
};

/**
 * Inline quick-progress action on each home card. Shows the most likely
 * next step for the application — "Mark as submitted" → "Got an
 * interview?" → "Got the offer?". One click, optimistic, no navigation.
 *
 * Sits as a flex sibling of the Link wrapping the card, so its onClick
 * doesn't bubble into a card-tap → navigate. Hidden once the user
 * reaches a terminal state (offer / rejected).
 */
export function QuickStatusAction({
  statementId,
  currentStatus,
  wizardStatus,
}: {
  statementId: string;
  currentStatus: ApplicationStatus;
  wizardStatus: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only nudge users for completed statements. Drafts have their own
  // "Up next: …" pill that points them at the wizard.
  if (wizardStatus !== "completed") return null;

  const next = NEXT_ACTION[currentStatus];
  if (!next) return null;
  if (done) return null;

  async function handle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/statements/${statementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_status: next!.value }),
      });
      if (!res.ok) throw new Error("Save failed");
      setDone(true);
      // Refresh the server-rendered home so the badge + card state catch up.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={saving}
      title={error ?? `Update status to ${next.verb}`}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-brand)]/40 bg-white px-2.5 py-0.5 text-xs font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] hover:border-[var(--color-brand)] transition-colors disabled:opacity-60 disabled:cursor-wait"
    >
      {saving ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </>
      ) : (
        <>
          <Check className="h-3 w-3" /> {next.label}
        </>
      )}
    </button>
  );
}
