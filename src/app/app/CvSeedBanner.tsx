"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, FileText, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Discoverability banner for the master-CV feature. Shown on the home
 * page when the user has at least one statement with a CV but no saved
 * profile CV — meaning we already have everything we need to give them
 * the speed-up, they just don't know about it.
 *
 * The primary CTA is a single click — no navigation, no re-pasting. The
 * secondary "Open profile" link is for users who want to see/edit what
 * gets saved before committing.
 */
export function CvSeedBanner({
  sourceTitle,
}: {
  sourceTitle: string | null;
}) {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  async function seed() {
    setSeeding(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/seed-from-last", {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Could not save");
      }
      setDone(true);
      // Refresh server data so the banner disappears on next render.
      setTimeout(() => router.refresh(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="relative mb-5 rounded-lg border border-[var(--color-brand)]/30 bg-[var(--color-brand-soft)]/50 px-3 sm:px-4 py-3">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-white/60 hover:text-[var(--color-fg)] transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-2.5 pr-7">
        <Sparkles className="h-4 w-4 text-[var(--color-brand)] mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {done ? (
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand)]">
              <Check className="h-4 w-4" /> Saved. Your next statement will skip the CV step.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-[var(--color-fg)]">
                Save your CV — skip the paste step in every new statement.
              </p>
              {error && (
                <p className="mt-1 text-xs text-red-700">{error}</p>
              )}
              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                {sourceTitle && (
                  <Button size="sm" onClick={seed} disabled={seeding}>
                    {seeding ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        <span className="truncate max-w-[14rem] sm:max-w-none">
                          Use CV from &ldquo;{sourceTitle}&rdquo;
                        </span>
                      </>
                    )}
                  </Button>
                )}
                <Button asChild size="sm" variant="ghost" disabled={seeding}>
                  <Link href="/app/profile">
                    {sourceTitle ? "Open profile" : "Add your CV"}
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
