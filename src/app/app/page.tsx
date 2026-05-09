import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FileText, ArrowRight } from "lucide-react";
import { NewStatementButton } from "./NewStatementButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: statements } = await supabase
    .from("statements")
    .select("id, title, sector, status, step, person_spec, updated_at")
    .order("updated_at", { ascending: false });

  const list = statements ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Your statements
          </h1>
          <p className="mt-1 text-[var(--color-muted)]">
            Pick up where you left off, or start a new application.
          </p>
        </div>
        <NewStatementButton />
      </div>

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {list.map((s) => (
            <li key={s.id}>
              <Link
                href={`/app/statement/${s.id}`}
                className="flex items-center gap-3 sm:gap-4 rounded-lg border border-[var(--color-border)] bg-white p-4 sm:p-5 hover:border-[var(--color-border-strong)] hover:shadow-sm transition-all group"
              >
                <span className="flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium truncate">
                      {s.title || "Untitled statement"}
                    </h3>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-sm text-[var(--color-muted)] mt-0.5 truncate">
                    {jobLabel(s.person_spec)} · Updated{" "}
                    {formatRelative(s.updated_at)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--color-muted-soft)] group-hover:text-[var(--color-fg)] transition-colors" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border-strong)] bg-white p-8 sm:p-12 text-center">
      <FileText className="mx-auto h-10 w-10 text-[var(--color-muted-soft)]" />
      <h2 className="mt-4 text-lg font-semibold">No statements yet</h2>
      <p className="mt-2 text-[var(--color-muted)] max-w-md mx-auto">
        Start your first NHS supporting statement. Takes about ten minutes,
        and we save your progress as you go.
      </p>
      <div className="mt-6 flex justify-center">
        <NewStatementButton />
      </div>
      <p className="mt-6 text-xs text-[var(--color-muted-soft)]">
        Built for NHS England, Wales and Scotland (Trac, NHS Jobs and JobTrain).
        Civil Service, council and teaching flows coming next.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
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
  };
  const v = map[status] ?? map.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${v.className}`}
    >
      {v.label}
    </span>
  );
}

function jobLabel(spec: unknown): string {
  if (!spec || typeof spec !== "object") return "NHS application";
  const s = spec as { jobTitle?: string; band?: string | null };
  if (!s.jobTitle) return "NHS application";
  return s.band ? `${s.jobTitle} · Band ${s.band}` : s.jobTitle;
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
