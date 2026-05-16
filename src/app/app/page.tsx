import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  FileText,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Building2,
  Footprints,
} from "lucide-react";
import { NewStatementButton } from "./NewStatementButton";
import { CvSeedBanner } from "./CvSeedBanner";
import { QuickStatusAction } from "./QuickStatusAction";
import { ScoreChip } from "@/components/score-chip";
import type { ApplicationStatus, PersonSpec } from "@/lib/types";

const WIZARD_STEP_NAMES = ["Advert", "Criteria", "CV", "Stories", "Generate"];

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  // All home-page data in parallel. getClaims reads JWT locally so it adds
  // no latency. Profile + last-CV queries power the CV discoverability
  // banner — they short-circuit if the user already has a saved CV.
  const [
    { data: statements },
    { data: claimsData },
    { data: profileRow },
    { data: lastCvStmt },
  ] = await Promise.all([
    supabase
      .from("statements")
      .select(
        "id, title, sector, status, step, person_spec, last_score, last_decision, application_status, submitted_at, updated_at",
      )
      .order("updated_at", { ascending: false }),
    supabase.auth.getClaims(),
    supabase.from("profiles").select("cv_text").maybeSingle(),
    supabase
      .from("statements")
      .select("title")
      .not("cv_text", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const list = statements ?? [];
  const claims = claimsData?.claims;
  const firstName = pickFirstName(
    claims?.user_metadata?.full_name as string | undefined,
    claims?.email as string | undefined,
  );
  const hasProfileCv = Boolean(profileRow?.cv_text);
  const seedSourceTitle = lastCvStmt?.title ?? null;

  const completedCount = list.filter((s) => s.status === "completed").length;
  const draftCount = list.filter(
    (s) => s.status === "draft" || s.status === "in_progress",
  ).length;
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

  const welcomeSubtitle = buildWelcomeSubtitle({
    count: list.length,
    drafts: draftCount,
    offers: offerCount,
    interviews: interviewCount - offerCount,
    submitted: submittedCount - interviewCount,
    hasProfileCv,
  });

  // Show the CV banner when the user clearly hasn't discovered the profile
  // feature: empty profile cv, but they've already pasted CVs into past
  // statements. First-time users get the in-wizard "save as default" prompt
  // instead — banner stays hidden so the home page stays calm.
  const showCvBanner = !hasProfileCv && seedSourceTitle !== null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-end justify-between gap-4 mb-2 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {list.length === 0
              ? `Welcome, ${firstName}`
              : `Welcome back, ${firstName}`}
          </h1>
          <p className="mt-1 text-[var(--color-muted)]">{welcomeSubtitle}</p>
        </div>
        <NewStatementButton />
      </div>

      {list.length > 0 && (
        <StatsRow
          stats={buildStats({
            count: list.length,
            completed: completedCount,
            submitted: submittedCount - interviewCount,
            interviews: interviewCount - offerCount,
            offers: offerCount,
            bestScore,
          })}
        />
      )}

      {showCvBanner && <CvSeedBanner sourceTitle={seedSourceTitle} />}

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {list.map((s) => {
            const spec = s.person_spec as PersonSpec | null;
            const orgLine = buildOrgLine(spec);
            const appStatus = (s.application_status ??
              "not_submitted") as ApplicationStatus;
            return (
              <li key={s.id}>
                {/* Card is a div with an absolutely-positioned Link covering
                    the click area, so the inline quick-action button can
                    sit as a sibling and capture its own clicks without
                    triggering navigation. */}
                <div className="relative flex items-center gap-3 sm:gap-4 rounded-lg border border-[var(--color-border)] bg-white p-4 sm:p-5 hover:border-[var(--color-brand)] hover:shadow-sm transition-all group">
                  <Link
                    href={`/app/statement/${s.id}`}
                    prefetch
                    aria-label={s.title || "Untitled statement"}
                    className="absolute inset-0 rounded-lg z-0"
                  />
                  <span className="relative pointer-events-none flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-brand-soft)] text-[var(--color-brand)] group-hover:scale-105 transition-transform">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="relative pointer-events-none min-w-0 flex-1">
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
                      {(s.status === "draft" ||
                        s.status === "in_progress") && (
                        <DraftStepPill step={s.step ?? 0} />
                      )}
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
                      {/* Quick-action sits inside the meta-row but is a
                          z-stacked sibling of the Link, so its onClick
                          doesn't navigate. */}
                      <span className="relative z-10 pointer-events-auto">
                        <QuickStatusAction
                          statementId={s.id}
                          currentStatus={appStatus}
                          wizardStatus={s.status}
                        />
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="relative pointer-events-none h-4 w-4 text-[var(--color-muted-soft)] group-hover:text-[var(--color-brand)] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </div>
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

type Stat = {
  key: string;
  value: number;
  label: string;
  highlight?: boolean;
  icon?: "sparkles" | "trending";
};

function buildStats({
  count,
  completed,
  submitted,
  interviews,
  offers,
  bestScore,
}: {
  count: number;
  completed: number;
  submitted: number;
  interviews: number;
  offers: number;
  bestScore: number | null;
}): Stat[] {
  const stats: Stat[] = [
    {
      key: "count",
      value: count,
      label: count === 1 ? "statement" : "statements",
    },
  ];
  if (completed > 0) {
    stats.push({ key: "completed", value: completed, label: "completed" });
  }
  if (submitted > 0) {
    stats.push({ key: "submitted", value: submitted, label: "submitted" });
  }
  if (interviews > 0) {
    stats.push({
      key: "interviews",
      value: interviews,
      label: interviews === 1 ? "interview" : "interviews",
    });
  }
  if (offers > 0) {
    stats.push({
      key: "offers",
      value: offers,
      label: offers === 1 ? "offer" : "offers",
      highlight: true,
      icon: "sparkles",
    });
  }
  if (bestScore !== null) {
    stats.push({
      key: "score",
      value: bestScore,
      label: "Best score",
      icon: "trending",
    });
  }
  return stats;
}

/** Renders a horizontal stats row with separators ONLY between visible
 *  items. Each (separator + stat) is grouped into one whitespace-nowrap
 *  unit so a wrap can never strand a trailing dot. */
function StatsRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="mb-6 flex items-center gap-x-3 gap-y-1.5 flex-wrap text-sm text-[var(--color-muted)]">
      {stats.map((stat, i) => (
        <span
          key={stat.key}
          className="inline-flex items-center gap-3 whitespace-nowrap"
        >
          {i > 0 && (
            <span className="text-[var(--color-muted-soft)]" aria-hidden>
              ·
            </span>
          )}
          <span
            className={
              stat.highlight
                ? "inline-flex items-center gap-1.5 text-[var(--color-brand)] font-medium"
                : "inline-flex items-center gap-1.5"
            }
          >
            {stat.icon === "sparkles" && (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {stat.icon === "trending" && (
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-brand)]" />
            )}
            {stat.label === "Best score" ? (
              <>
                {stat.label}{" "}
                <span className="font-medium text-[var(--color-fg)] tabular-nums">
                  {stat.value}
                </span>
              </>
            ) : (
              <>
                <span
                  className={
                    stat.highlight
                      ? "tabular-nums"
                      : "font-medium text-[var(--color-fg)] tabular-nums"
                  }
                >
                  {stat.value}
                </span>{" "}
                {stat.label}
              </>
            )}
          </span>
        </span>
      ))}
    </div>
  );
}

/** "Up next: CV" — tells users what to do when they reopen a paused
 *  draft so they don't have to click in just to remember the state. */
function DraftStepPill({ step }: { step: number }) {
  const safe = Math.min(Math.max(step, 0), WIZARD_STEP_NAMES.length - 1);
  const label = WIZARD_STEP_NAMES[safe];
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)]">
      <Footprints className="h-3.5 w-3.5 text-[var(--color-muted-soft)]" />
      Up next: <span className="font-medium text-[var(--color-fg)]">{label}</span>
    </span>
  );
}

/** Adaptive welcome subtitle. The order matters: pick the most uplifting
 *  state the user is in. Empty + no profile gets a setup nudge; everything
 *  else reflects their actual progress. */
function buildWelcomeSubtitle({
  count,
  drafts,
  offers,
  interviews,
  submitted,
  hasProfileCv,
}: {
  count: number;
  drafts: number;
  offers: number;
  interviews: number;
  submitted: number;
  hasProfileCv: boolean;
}): string {
  if (count === 0 && !hasProfileCv) {
    return "Let's set you up — start with your first statement or save your CV in profile.";
  }
  if (count === 0) {
    return "Start your first NHS application below.";
  }
  if (offers > 0) {
    return offers === 1
      ? "Congrats on the offer. Keep the momentum going."
      : `Congrats on ${offers} offers — keep the momentum going.`;
  }
  if (interviews > 0) {
    return interviews === 1
      ? "You have an interview on the way. Best of luck."
      : `You have ${interviews} interviews on the way. Best of luck.`;
  }
  if (drafts > 0) {
    return drafts === 1
      ? "You have a draft in progress. Pick up where you left off."
      : `You have ${drafts} drafts in progress. Pick up where you left off.`;
  }
  if (submitted > 0) {
    return "Nice work. Track your applications below, or start the next one.";
  }
  return "Pick up where you left off, or start a new application.";
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
