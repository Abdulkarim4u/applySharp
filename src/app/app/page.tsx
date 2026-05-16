import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  FileText,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Building2,
} from "lucide-react";
import { NewStatementButton } from "./NewStatementButton";
import { ScoreChip } from "@/components/score-chip";
import type { PersonSpec } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  // getClaims reads the cached JWT locally — no network round-trip.
  // Layout already gated us, so claims are guaranteed here.
  const [{ data: statements }, { data: claimsData }] = await Promise.all([
    supabase
      .from("statements")
      .select(
        "id, title, sector, status, step, person_spec, last_score, last_decision, application_status, submitted_at, updated_at",
      )
      .order("updated_at", { ascending: false }),
    supabase.auth.getClaims(),
  ]);

  const list = statements ?? [];
  const claims = claimsData?.claims;
  const firstName = pickFirstName(
    claims?.user_metadata?.full_name as string | undefined,
    claims?.email as string | undefined,
  );

  const completedCount = list.filter((s) => s.status === "completed").length;
  const submittedCount = list.filter(
    (s) =>
      s.application_status === "submitted" ||
      s.application_status === "interview" ||
      s.application_status === "offer",
  ).length;
  const interviewCount = list.filter(
    (s) => s.application_status === "interview" || s.application_status === "offer",
  ).length;
  const offerCount = list.filter(
    (s) => s.application_status === "offer",
  ).length;
  const bestScore = list.reduce<number | null>((acc, s) => {
    if (typeof s.last_score !== "number") return acc;
    if (acc === null) return s.last_score;
    return Math.max(acc, s.last_score);
  }, null);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-end justify-between gap-4 mb-2 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {list.length === 0
              ? `Welcome, ${firstName}`
              : `Welcome back, ${firstName}`}
          </h1>
          <p className="mt-1 text-[var(--color-muted)]">
            {list.length === 0
              ? "Start your first NHS application below."
              : "Pick up where you left off, or start a new application."}
          </p>
        </div>
        <NewStatementButton />
      </div>

      {list.length > 0 && (
        <div className="mb-8 flex items-center gap-4 flex-wrap text-sm text-[var(--color-muted)]">
          <span>
            <span className="font-medium text-[var(--color-fg)] tabular-nums">
              {list.length}
            </span>{" "}
            {list.length === 1 ? "statement" : "statements"}
          </span>
          {completedCount > 0 && (
            <>
              <span className="text-[var(--color-muted-soft)]">·</span>
              <span>
                <span className="font-medium text-[var(--color-fg)] tabular-nums">
                  {completedCount}
                </span>{" "}
                completed
              </span>
            </>
          )}
          {submittedCount > 0 && (
            <>
              <span className="text-[var(--color-muted-soft)]">·</span>
              <span>
                <span className="font-medium text-[var(--color-fg)] tabular-nums">
                  {submittedCount}
                </span>{" "}
                submitted
              </span>
            </>
          )}
          {interviewCount > 0 && (
            <>
              <span className="text-[var(--color-muted-soft)]">·</span>
              <span>
                <span className="font-medium text-[var(--color-fg)] tabular-nums">
                  {interviewCount}
                </span>{" "}
                interview{interviewCount === 1 ? "" : "s"}
              </span>
            </>
          )}
          {offerCount > 0 && (
            <>
              <span className="text-[var(--color-muted-soft)]">·</span>
              <span className="inline-flex items-center gap-1.5 text-[var(--color-brand)] font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="tabular-nums">{offerCount}</span>{" "}
                offer{offerCount === 1 ? "" : "s"}
              </span>
            </>
          )}
          {bestScore !== null && (
            <>
              <span className="text-[var(--color-muted-soft)]">·</span>
              <span className="inline-flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-[var(--color-brand)]" />
                Best score{" "}
                <span className="font-medium text-[var(--color-fg)] tabular-nums">
                  {bestScore}
                </span>
              </span>
            </>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {list.map((s) => {
            const spec = s.person_spec as PersonSpec | null;
            const orgLine = buildOrgLine(spec);
            return (
              <li key={s.id}>
                <Link
                  href={`/app/statement/${s.id}`}
                  prefetch
                  className="flex items-center gap-3 sm:gap-4 rounded-lg border border-[var(--color-border)] bg-white p-4 sm:p-5 hover:border-[var(--color-brand)] hover:shadow-sm transition-all group"
                >
                  <span className="flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-brand-soft)] text-[var(--color-brand)] group-hover:scale-105 transition-transform">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium truncate">
                      {s.title || "Untitled statement"}
                    </h3>
                    {orgLine && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[var(--color-muted)] truncate">
                        <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-muted-soft)]" />
                        <span className="truncate">{orgLine}</span>
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-x-2 gap-y-1 text-sm text-[var(--color-muted)] flex-wrap">
                      <StatusBadge
                        wizardStatus={s.status}
                        applicationStatus={s.application_status}
                      />
                      {typeof s.last_score === "number" && (
                        <ScoreChip
                          score={s.last_score}
                          decision={s.last_decision}
                        />
                      )}
                      <span className="truncate">
                        {s.application_status === "submitted" && s.submitted_at
                          ? `Applied ${formatRelative(s.submitted_at)}`
                          : formatRelative(s.updated_at)}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[var(--color-muted-soft)] group-hover:text-[var(--color-brand)] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border-strong)] bg-white p-8 sm:p-12 text-center">
      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
        <Sparkles className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">Your first statement</h2>
      <p className="mt-2 text-[var(--color-muted)] max-w-md mx-auto">
        Paste a job advert, paste your CV, and we&apos;ll write you an NHS
        supporting statement scored against the shortlister rubric. Around
        three to five minutes.
      </p>
      <div className="mt-6 flex justify-center">
        <NewStatementButton />
      </div>
      <p className="mt-6 text-xs text-[var(--color-muted-soft)]">
        Built for NHS England, Wales and Scotland (Trac, NHS Jobs and JobTrain).
      </p>
    </div>
  );
}

/** Shows whichever badge is most informative: in-flight writing status while
 *  the wizard isn't done, then application outcome status (Submitted /
 *  Interview / Offer / Rejected) once the user marks progress. Completed
 *  but not_submitted stays as "Completed" so it nudges the user to mark it. */
function StatusBadge({
  wizardStatus,
  applicationStatus,
}: {
  wizardStatus: string;
  applicationStatus: string | null;
}) {
  const map: Record<string, { label: string; className: string }> = {
    draft: {
      label: "Draft",
      className: "bg-slate-100 text-slate-700",
    },
    in_progress: {
      label: "In progress",
      className: "bg-amber-50 text-amber-800",
    },
    completed: {
      label: "Completed",
      className: "bg-[var(--color-brand-soft)] text-[var(--color-brand)]",
    },
    submitted: {
      label: "Submitted",
      className: "bg-blue-50 text-blue-800",
    },
    interview: {
      label: "Interview",
      className: "bg-amber-50 text-amber-800",
    },
    offer: {
      label: "Offer",
      className: "bg-[var(--color-brand-soft)] text-[var(--color-brand)]",
    },
    rejected: {
      label: "Rejected",
      className: "bg-red-50 text-red-700",
    },
  };
  const key =
    wizardStatus === "completed" &&
    applicationStatus &&
    applicationStatus !== "not_submitted"
      ? applicationStatus
      : wizardStatus;
  const v = map[key] ?? map.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${v.className}`}
    >
      {v.label}
    </span>
  );
}

function pickFirstName(fullName: string | undefined, email: string | undefined): string {
  if (fullName && fullName.trim()) {
    const first = fullName.trim().split(/\s+/)[0];
    return capitalise(first);
  }
  if (email) {
    // "abdul.moro4u@gmail.com" -> "Abdul"
    const local = email.split("@")[0] ?? "";
    const head = local.split(/[._\-+]/)[0] ?? local;
    const cleaned = head.replace(/\d+$/g, "");
    if (cleaned) return capitalise(cleaned);
  }
  return "there";
}

function capitalise(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** One-line subtitle for a statement card: "Band 3 at Doncaster NHS Trust",
 *  "Doncaster NHS Trust", "Band 3", or null when neither field is set. */
function buildOrgLine(spec: PersonSpec | null): string | null {
  if (!spec) return null;
  const org = spec.organisation?.trim();
  const band = spec.band?.trim();
  if (org && band) return `Band ${band} at ${org}`;
  if (org) return org;
  if (band) return `Band ${band}`;
  return null;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
