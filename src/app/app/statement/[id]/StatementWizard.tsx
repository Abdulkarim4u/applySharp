"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { wordCount, cn } from "@/lib/utils";
import { cleanStatementText } from "@/lib/clean-statement";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Save,
  Trash2,
  Plus,
  Copy,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Pencil,
  Upload,
  Gauge,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Download,
  ChevronDown,
  Wand2,
  TrendingUp,
} from "lucide-react";
import { Stepper, STEPS } from "./Stepper";
import type {
  StatementRecord,
  PersonSpec,
  Criterion,
  GapFillQuestion,
  GapFillAnswer,
  ReviewResult,
  ShortlistDecision,
} from "@/lib/types";

type Updates = Partial<
  Pick<
    StatementRecord,
    | "title"
    | "job_advert_text"
    | "cv_text"
    | "person_spec"
    | "gap_fills"
    | "draft_text"
    | "final_text"
    | "status"
    | "step"
  >
>;

export function StatementWizard({ initial }: { initial: StatementRecord }) {
  const router = useRouter();
  const [s, setS] = useState<StatementRecord>(initial);
  const [step, setStep] = useState<number>(initial.step ?? 0);
  const [furthest, setFurthest] = useState<number>(initial.step ?? 0);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyStartedAt, setBusyStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startBusy(label: string) {
    setBusy(label);
    setBusyStartedAt(Date.now());
  }
  function endBusy() {
    setBusy(null);
    setBusyStartedAt(null);
  }

  const [savedAt, setSavedAt] = useState<number | null>(null);

  const pendingRef = useRef<Updates>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (updates: Updates) => {
      // Update local state immediately so UI feels instant
      setS((prev) => ({ ...prev, ...updates }));
      // Merge into pending batch
      pendingRef.current = { ...pendingRef.current, ...updates };

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const batch = pendingRef.current;
        pendingRef.current = {};
        timerRef.current = null;
        if (Object.keys(batch).length === 0) return;
        try {
          const res = await fetch(`/api/statements/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batch),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error ?? "Save failed");
          }
          const { statement } = await res.json();
          setS(statement);
          setSavedAt(Date.now());
        } catch (e) {
          setError(e instanceof Error ? e.message : "Save failed");
        }
      }, 800);
    },
    [s.id],
  );

  // Flush pending updates when the component unmounts (best-effort)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const goto = useCallback(
    (next: number) => {
      setStep(next);
      setFurthest((f) => Math.max(f, next));
      void persist({ step: next });
    },
    [persist],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href="/app"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Statements
        </Link>
        <SaveIndicator savedAt={savedAt} />
      </div>

      <TitleEditor
        title={s.title}
        onSave={(title) => persist({ title })}
      />

      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Step {step + 1} of {STEPS.length}
        <span className="hidden sm:inline">
          {" · About 10 minutes total · Progress saves automatically"}
        </span>
      </p>

      <div className="mt-6 mb-8">
        <Stepper current={step} furthest={furthest} onJump={(i) => setStep(i)} />
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-700 hover:text-red-900 underline text-xs"
          >
            dismiss
          </button>
        </div>
      )}

      {step === 0 && (
        <JobAdvertStep
          initialValue={s.job_advert_text ?? ""}
          busy={busy === "extract"}
          busyStartedAt={busy === "extract" ? busyStartedAt : null}
          onContinue={async (text) => {
            startBusy("extract");
            setError(null);
            try {
              await persist({ job_advert_text: text });
              const res = await fetch("/api/extract-criteria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobAdvert: text }),
              });
              if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error ?? "Extraction failed");
              }
              const { personSpec } = await res.json();
              await persist({
                person_spec: personSpec,
                title:
                  s.title === "Untitled statement"
                    ? `${personSpec.jobTitle}${personSpec.band ? ` · ${personSpec.band}` : ""}`
                    : s.title,
              });
              goto(1);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Extraction failed");
            } finally {
              endBusy();
            }
          }}
        />
      )}

      {step === 1 && (
        <CriteriaStep
          personSpec={s.person_spec}
          onChange={(spec) => persist({ person_spec: spec })}
          onContinue={() => goto(2)}
          onBack={() => setStep(0)}
        />
      )}

      {step === 2 && (
        <CvStep
          initialValue={s.cv_text ?? ""}
          busy={busy === "gap"}
          busyStartedAt={busy === "gap" ? busyStartedAt : null}
          onContinue={async (text) => {
            startBusy("gap");
            setError(null);
            try {
              await persist({ cv_text: text });
              if (!s.person_spec) throw new Error("Missing criteria");
              const res = await fetch("/api/gap-analysis", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ personSpec: s.person_spec, cv: text }),
              });
              if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error ?? "Gap analysis failed");
              }
              const { questions } = await res.json();
              const seeded: GapFillAnswer[] = (questions as GapFillQuestion[]).map(
                (q) => ({ criterionId: q.criterionId, answer: "" }),
              );
              await persist({
                gap_fills: seededWithMeta(questions, seeded),
              });
              goto(3);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Gap analysis failed");
            } finally {
              endBusy();
            }
          }}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <GapFillStep
          gapFills={(s.gap_fills as GapFillAnswerWithMeta[] | null) ?? []}
          onChange={(fills) => persist({ gap_fills: fills })}
          onContinue={() => goto(4)}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (
        <GenerateStep
          statement={s}
          onTextUpdate={(text) =>
            persist({ final_text: text, status: "completed" })
          }
          onBack={() => setStep(3)}
        />
      )}
    </div>
  );
}

// ---------- Step components ----------

const GENERATION_STAGES = [
  "Reading the person specification…",
  "Mapping each essential criterion to your experience…",
  "Drafting your opening paragraph…",
  "Weaving your STAR stories into the narrative…",
  "Threading NHS values through your actions…",
  "Polishing British English and sentence rhythm…",
  "Final review pass…",
];

const EXTRACT_STAGES = [
  "Reading the advert…",
  "Finding the person specification section…",
  "Pulling out essential criteria…",
  "Pulling out desirable criteria…",
  "Categorising by skills, experience, qualifications, values…",
  "Almost done…",
];

const GAP_STAGES = [
  "Reading your CV…",
  "Comparing your experience to each criterion…",
  "Spotting where the evidence is thin…",
  "Drafting focused STAR questions…",
  "Personalising hints from your CV…",
  "Almost done…",
];

const REVIEW_STAGES = [
  "Reading your statement…",
  "Scoring against each essential criterion…",
  "Looking for AI tells and generic phrasing…",
  "Drafting honest feedback…",
  "Compiling the verdict…",
];

function StepProgressCard({
  stages,
  estimatedSeconds = 12,
  startedAt,
}: {
  stages: string[];
  estimatedSeconds?: number;
  startedAt: number;
}) {
  const [stageIdx, setStageIdx] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 200);
    const rotate = setInterval(() => {
      setStageIdx((i) => (i + 1) % stages.length);
    }, 3000);
    return () => {
      clearInterval(tick);
      clearInterval(rotate);
    };
  }, [stages.length]);

  const elapsed = now - startedAt;
  const progress = Math.min(95, (elapsed / (estimatedSeconds * 1000)) * 95);

  return (
    <div
      className="rounded-md border border-[var(--color-brand)] bg-[var(--color-brand-soft)] p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand)] flex-shrink-0" />
        <span className="text-sm font-medium text-[var(--color-brand)]">
          {stages[stageIdx]}
        </span>
      </div>
      <div
        className="mt-3 h-2 w-full bg-white rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-[var(--color-brand)] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--color-brand)]">
        Usually takes {estimatedSeconds} seconds
      </p>
    </div>
  );
}


function GenerationProgress({
  wordCount,
  targetWords = 1000,
  startedAt,
}: {
  wordCount: number;
  targetWords?: number;
  startedAt: number;
}) {
  const [stageIdx, setStageIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt);
      setStageIdx((i) => (i + 1) % GENERATION_STAGES.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [startedAt]);

  // Use word count when streaming has started; otherwise fall back to time-based
  // estimate so the bar moves immediately on click.
  const wordProgress = Math.min(95, (wordCount / targetWords) * 100);
  const timeProgress = Math.min(30, (elapsed / 4000) * 30);
  const progress = Math.max(wordProgress, timeProgress);

  return (
    <div
      className="rounded-md border border-[var(--color-brand)] bg-[var(--color-brand-soft)] p-4 mb-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand)] flex-shrink-0" />
        <span className="text-sm font-medium text-[var(--color-brand)]">
          {GENERATION_STAGES[stageIdx]}
        </span>
      </div>
      <div
        className="mt-3 h-2 w-full bg-white rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-[var(--color-brand)] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--color-brand)] tabular-nums">
        {wordCount.toLocaleString("en-GB")} words · target ~{targetWords.toLocaleString("en-GB")} · usually 15–30 seconds
      </p>
    </div>
  );
}

function AutoGrowTextarea({
  value,
  onChange,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={onChange}
      rows={1}
      className={cn("resize-none overflow-hidden", className)}
      {...rest}
    />
  );
}

function SaveIndicator({ savedAt }: { savedAt: number | null }) {
  // Track "now" in state so render stays pure (no Date.now() in render).
  // Initialise once at mount, then tick from the interval callback.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!savedAt) return;
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, [savedAt]);

  if (!savedAt) {
    return (
      <span className="text-xs text-[var(--color-muted-soft)]">
        Auto-saves as you go
      </span>
    );
  }

  // Clamp negative values: between mount-time `now` and a fresh `savedAt`, the
  // diff can be negative briefly. Showing "Saved" until the next tick is fine.
  const seconds = Math.max(0, Math.floor((now - savedAt) / 1000));
  const label =
    seconds < 5
      ? "Saved"
      : seconds < 60
        ? `Saved ${seconds}s ago`
        : `Saved ${Math.floor(seconds / 60)}m ago`;

  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)]">
      <CheckCircle2 className="h-3 w-3 text-[var(--color-brand)]" />
      {label}
    </span>
  );
}

function TitleEditor({
  title,
  onSave,
}: {
  title: string;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  // Sync local value to the current prop only when the user enters edit mode.
  // Avoids clobbering user input if the prop changes mid-edit (e.g. autosave).
  function startEditing() {
    setValue(title);
    setEditing(true);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (value.trim() && value !== title) onSave(value.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setValue(title);
              setEditing(false);
            }
          }}
          className="text-lg font-semibold"
        />
      </div>
    );
  }

  return (
    <button
      onClick={startEditing}
      className="group inline-flex items-center gap-2 text-xl sm:text-2xl font-semibold tracking-tight text-left hover:text-[var(--color-brand)] transition-colors max-w-full"
      title="Click to rename"
    >
      <span className="truncate">{title || "Untitled statement"}</span>
      <Pencil className="h-4 w-4 flex-shrink-0 text-[var(--color-muted-soft)] group-hover:text-[var(--color-brand)] transition-colors" />
    </button>
  );
}

function StepShell({
  title,
  description,
  children,
  primary,
  back,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  primary: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <section>
      <div className="rounded-lg border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 text-sm sm:text-base text-[var(--color-muted)]">
            {description}
          </p>
        )}
        <div className="mt-5 sm:mt-6">{children}</div>
      </div>
      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <div>{back}</div>
        <div>{primary}</div>
      </div>
    </section>
  );
}

function JobAdvertStep({
  initialValue,
  busy,
  busyStartedAt,
  onContinue,
}: {
  initialValue: string;
  busy: boolean;
  busyStartedAt: number | null;
  onContinue: (text: string) => void;
}) {
  const [text, setText] = useState(initialValue);
  const wc = wordCount(text);
  const ok = text.trim().length > 50;

  return (
    <StepShell
      title="Paste the job advert"
      description="Include the full advert: job description, person specification, and any duties section. The more detail, the better the criteria extraction."
      primary={
        <Button
          onClick={() => onContinue(text)}
          disabled={!ok || busy}
          size="lg"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Extracting criteria…
            </>
          ) : (
            <>
              Extract criteria
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      }
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the full NHS job advert here. Include the job title, band, person specification (essential & desirable criteria), and duties."
        rows={busy ? 8 : 18}
        disabled={busy}
        className="font-mono text-[13px] leading-relaxed"
      />
      {busy && busyStartedAt ? (
        <div className="mt-3">
          <StepProgressCard
            stages={EXTRACT_STAGES}
            estimatedSeconds={12}
            startedAt={busyStartedAt}
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-[var(--color-muted-soft)]">
          {wc === 0
            ? "Paste from Trac, NHS Jobs or JobTrain. Include the person spec."
            : `${wc.toLocaleString("en-GB")} words · ${ok ? "Ready" : "Add the person spec section too"}`}
        </p>
      )}
    </StepShell>
  );
}

function CriteriaStep({
  personSpec,
  onChange,
  onContinue,
  onBack,
}: {
  personSpec: PersonSpec | null;
  onChange: (spec: PersonSpec) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const spec = personSpec ?? {
    jobTitle: "",
    band: null,
    organisation: null,
    criteria: [],
  };

  const [recentlyDeleted, setRecentlyDeleted] = useState<Criterion | null>(null);
  const [filter, setFilter] = useState<"all" | "essential" | "desirable">("all");

  const updateCriterion = (id: string, updates: Partial<Criterion>) => {
    onChange({
      ...spec,
      criteria: spec.criteria.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
    });
  };

  const removeCriterion = (id: string) => {
    const removed = spec.criteria.find((c) => c.id === id) ?? null;
    setRecentlyDeleted(removed);
    onChange({
      ...spec,
      criteria: spec.criteria.filter((c) => c.id !== id),
    });
    setTimeout(() => setRecentlyDeleted((cur) => (cur?.id === id ? null : cur)), 6000);
  };

  const undoDelete = () => {
    if (!recentlyDeleted) return;
    onChange({ ...spec, criteria: [...spec.criteria, recentlyDeleted] });
    setRecentlyDeleted(null);
  };

  const addCriterion = () => {
    const id = `c${Date.now()}`;
    onChange({
      ...spec,
      criteria: [
        ...spec.criteria,
        { id, text: "", type: "essential", category: "experience" },
      ],
    });
  };

  const essentialCount = spec.criteria.filter((c) => c.type === "essential").length;
  const desirableCount = spec.criteria.filter((c) => c.type === "desirable").length;

  // Essential first, then desirable; preserve original order within each group
  const sorted = [...spec.criteria].sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === "essential" ? -1 : 1;
  });
  const visible = sorted.filter((c) => filter === "all" || c.type === filter);

  return (
    <StepShell
      title="Review the criteria"
      description="We extracted these from the advert. Edit any wording, remove items that aren't relevant, or add ones we missed. The accuracy here drives everything downstream."
      back={
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      }
      primary={
        <Button
          onClick={onContinue}
          size="lg"
          disabled={spec.criteria.length === 0}
        >
          Continue to CV <ArrowRight className="h-4 w-4" />
        </Button>
      }
    >
      <div className="rounded-md bg-[var(--color-surface)] p-3 mb-4 text-sm">
        <div>
          <span className="text-[var(--color-muted)]">Role:</span>{" "}
          <span className="font-medium">{spec.jobTitle || "—"}</span>
          {spec.band && (
            <>
              <span className="text-[var(--color-muted)]"> · Band</span>{" "}
              <span className="font-medium">{spec.band}</span>
            </>
          )}
        </div>
        {spec.organisation && (
          <div className="mt-1">
            <span className="text-[var(--color-muted)]">Trust:</span>{" "}
            <span className="font-medium">{spec.organisation}</span>
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-[var(--color-muted)]">
          <span className="font-medium text-[var(--color-fg)]">
            {spec.criteria.length}
          </span>{" "}
          criteria ·{" "}
          <span className="font-medium text-[var(--color-brand)]">
            {essentialCount} essential
          </span>{" "}
          ·{" "}
          <span className="font-medium">{desirableCount} desirable</span>
        </p>
        <div className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-white text-xs">
          {(["all", "essential", "desirable"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2.5 py-1 capitalize",
                filter === f
                  ? "bg-[var(--color-brand)] text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)]",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {recentlyDeleted && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-md bg-[var(--color-fg)] text-white p-3 text-sm">
          <span className="truncate">Removed: {recentlyDeleted.text.slice(0, 60)}…</span>
          <button
            onClick={undoDelete}
            className="font-medium underline whitespace-nowrap"
          >
            Undo
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {visible.map((c) => {
          const isEssential = c.type === "essential";
          return (
            <li
              key={c.id}
              className={cn(
                "rounded-md border p-3 transition-colors",
                isEssential
                  ? "border-[var(--color-border)] bg-white border-l-[3px] border-l-[var(--color-brand)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]",
              )}
            >
              <div className="flex items-start gap-2">
                <AutoGrowTextarea
                  value={c.text}
                  onChange={(e) => updateCriterion(c.id, { text: e.target.value })}
                  className="text-sm flex-1 min-h-[2.25rem] py-1.5"
                />
                <button
                  onClick={() => removeCriterion(c.id)}
                  className="p-2 text-[var(--color-muted)] hover:text-red-700 rounded-md hover:bg-red-50"
                  aria-label="Remove criterion"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs">
                <select
                  value={c.type}
                  onChange={(e) =>
                    updateCriterion(c.id, {
                      type: e.target.value as Criterion["type"],
                    })
                  }
                  className={cn(
                    "rounded-md border px-2 py-0.5 font-medium",
                    isEssential
                      ? "border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)] bg-white",
                  )}
                >
                  <option value="essential">Essential</option>
                  <option value="desirable">Desirable</option>
                </select>
                <select
                  value={c.category}
                  onChange={(e) =>
                    updateCriterion(c.id, {
                      category: e.target.value as Criterion["category"],
                    })
                  }
                  className="rounded-md border border-[var(--color-border)] px-2 py-0.5 bg-white text-[var(--color-muted)]"
                >
                  <option value="experience">Experience</option>
                  <option value="skills">Skills</option>
                  <option value="qualifications">Qualifications</option>
                  <option value="values">Values</option>
                </select>
              </div>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className="text-sm text-[var(--color-muted)] py-6 text-center">
          No {filter} criteria.
        </p>
      )}

      <button
        onClick={addCriterion}
        className="mt-3 inline-flex items-center gap-1 text-sm text-[var(--color-brand)] hover:underline"
      >
        <Plus className="h-4 w-4" /> Add a criterion
      </button>
    </StepShell>
  );
}

function CvStep({
  initialValue,
  busy,
  busyStartedAt,
  onContinue,
  onBack,
}: {
  initialValue: string;
  busy: boolean;
  busyStartedAt: number | null;
  onContinue: (text: string) => void;
  onBack: () => void;
}) {
  const [text, setText] = useState(initialValue);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const wc = wordCount(text);
  const ok = text.trim().length > 50;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setParseError(null);
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-cv", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Couldn't read the PDF");
      }
      setText(data.text ?? "");
    } catch (e) {
      setParseError(
        e instanceof Error ? e.message : "Couldn't read the PDF",
      );
    } finally {
      setParsing(false);
    }
  }

  return (
    <StepShell
      title="Paste your CV"
      description="Work history, education, key responsibilities and achievements. Specifics help: dates, employer names, systems used, the kind of patients or clients you worked with."
      back={
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      }
      primary={
        <Button onClick={() => onContinue(text)} disabled={!ok || busy} size="lg">
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analysing your experience…
            </>
          ) : (
            <>
              Continue <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      }
    >
      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <label
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-white px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface)] transition-colors",
            parsing ? "cursor-wait opacity-60" : "cursor-pointer",
          )}
        >
          {parsing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {parsing ? "Reading PDF…" : "Upload PDF"}
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            disabled={parsing}
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = ""; // reset so re-uploading the same file works
            }}
          />
        </label>
        <span className="text-sm text-[var(--color-muted)]">
          or paste below
        </span>
      </div>

      {parseError && (
        <div className="mb-3 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{parseError}</span>
        </div>
      )}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your full CV here, or upload it above."
        rows={busy ? 8 : 18}
        disabled={busy}
        className="font-mono text-[13px] leading-relaxed"
      />
      {busy && busyStartedAt ? (
        <div className="mt-3">
          <StepProgressCard
            stages={GAP_STAGES}
            estimatedSeconds={12}
            startedAt={busyStartedAt}
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-[var(--color-muted-soft)]">
          {wc === 0
            ? "PDF or copy-paste both work. We never share your CV."
            : `${wc.toLocaleString("en-GB")} words · ${ok ? "Ready" : "Add your work history and key responsibilities"}`}
        </p>
      )}
    </StepShell>
  );
}

interface GapFillAnswerWithMeta extends GapFillAnswer {
  criterionText?: string;
  question?: string;
  hint?: string;
  draftAnswer?: string;
}

function seededWithMeta(
  questions: GapFillQuestion[],
  seeded: GapFillAnswer[],
): GapFillAnswerWithMeta[] {
  return seeded.map((s, i) => ({
    ...s,
    // Pre-fill the answer with the AI-drafted skeleton when available.
    // User can edit the brackets or clear and write from scratch.
    answer: questions[i]?.draftAnswer ?? s.answer,
    criterionText: questions[i]?.criterionText,
    question: questions[i]?.question,
    hint: questions[i]?.hint,
    draftAnswer: questions[i]?.draftAnswer,
  }));
}

function GapFillStep({
  gapFills,
  onChange,
  onContinue,
  onBack,
}: {
  gapFills: GapFillAnswerWithMeta[];
  onChange: (next: GapFillAnswerWithMeta[]) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  // Count answers that the user has actually filled in (not the AI draft, not
  // bracketed placeholders left as-is).
  const personalisedCount = gapFills.filter((g) => {
    const trimmed = g.answer.trim();
    if (trimmed.length === 0) return false;
    if (g.draftAnswer && trimmed === g.draftAnswer.trim()) return false;
    return true;
  }).length;
  const total = gapFills.length;

  return (
    <StepShell
      title="Personal stories (optional)"
      back={
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      }
      primary={
        <Button onClick={onContinue} size="lg">
          {personalisedCount > 0
            ? `Generate with my ${personalisedCount} ${personalisedCount === 1 ? "story" : "stories"}`
            : "Generate from my CV"}{" "}
          <ArrowRight className="h-4 w-4" />
        </Button>
      }
    >
      {gapFills.length === 0 ? (
        <div className="rounded-md bg-[var(--color-brand-soft)] p-4 text-sm">
          Your CV already evidences every criterion strongly. You can move
          straight to generating.
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-[var(--color-brand)] bg-[var(--color-brand-soft)] p-4 sm:p-5 mb-4">
            <Button onClick={onContinue} size="lg" className="w-full sm:w-auto">
              <Sparkles className="h-4 w-4" />
              Skip and generate now
            </Button>
            <p className="text-sm text-[var(--color-brand)] mt-3 leading-relaxed">
              Quickest path. The AI writes from your CV, then asks for any
              specifics that need real-world detail after scoring.
            </p>
          </div>

          <details
            className="rounded-md border border-[var(--color-border)] bg-white group"
            open={personalisedCount > 0}
          >
            <summary className="cursor-pointer p-4 text-sm font-medium hover:bg-[var(--color-surface)] transition-colors list-none flex items-center justify-between gap-3">
              <span>
                Add personal stories first
                <span className="text-[var(--color-muted)] font-normal ml-1">
                  (~10 min)
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-[var(--color-muted)] transition-transform group-open:rotate-180 flex-shrink-0" />
            </summary>
            <div className="border-t border-[var(--color-border)] p-4">
              <p className="text-xs text-[var(--color-muted)] leading-relaxed mb-5">
                Each answer is pre-filled from your CV. Replace the
                [bracketed parts] with your specifics.
              </p>
              <ul className="space-y-6">
                {gapFills.map((g, i) => {
                  const hasBrackets = /\[[^\]]+\]/.test(g.answer);
                  const isDraftStillIntact =
                    g.draftAnswer && g.answer === g.draftAnswer;
                  return (
                    <li key={g.criterionId} className="space-y-2.5">
                      <div>
                        <p className="text-xs font-medium text-[var(--color-brand)] uppercase tracking-wider">
                          Question {i + 1} of {total}
                        </p>
                        <p className="font-medium mt-1.5">{g.criterionText}</p>
                        {g.question && (
                          <p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">
                            {g.question}
                          </p>
                        )}
                        {g.hint && (
                          <p className="text-xs text-[var(--color-muted-soft)] mt-2 leading-relaxed">
                            {g.hint}
                          </p>
                        )}
                      </div>
                      <Textarea
                        value={g.answer}
                        onChange={(e) => {
                          const next = gapFills.slice();
                          next[i] = { ...g, answer: e.target.value };
                          onChange(next);
                        }}
                        placeholder="Tell us about a specific time…"
                        rows={5}
                      />
                      <div className="flex items-center justify-between gap-3 text-xs flex-wrap">
                        {hasBrackets ? (
                          <span className="text-amber-700">
                            Replace the [brackets] with your real details
                          </span>
                        ) : g.answer.trim().length > 0 ? (
                          <span className="text-[var(--color-brand)]">
                            Personalised
                          </span>
                        ) : (
                          <span className="text-[var(--color-muted-soft)]">
                            Skipped
                          </span>
                        )}
                        {g.draftAnswer && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = gapFills.slice();
                              next[i] = {
                                ...g,
                                answer: isDraftStillIntact
                                  ? ""
                                  : (g.draftAnswer ?? ""),
                              };
                              onChange(next);
                            }}
                            className="text-[var(--color-muted)] hover:text-[var(--color-fg)] underline"
                          >
                            {isDraftStillIntact ? "Clear" : "Reset to draft"}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        </>
      )}
    </StepShell>
  );
}

function GenerateStep({
  statement,
  onTextUpdate,
  onBack,
}: {
  statement: StatementRecord;
  onTextUpdate: (text: string) => void;
  onBack: () => void;
}) {
  const criteriaCount = statement.person_spec?.criteria.length ?? 0;
  const essentialCount =
    statement.person_spec?.criteria.filter((c) => c.type === "essential")
      .length ?? 0;
  const gapFillsRaw = (statement.gap_fills as GapFillAnswerWithMeta[] | null) ?? [];
  const answeredCount = gapFillsRaw.filter(
    (g) => g.answer.trim().length > 0,
  ).length;

  const [text, setText] = useState(statement.final_text ?? "");
  const [streaming, setStreaming] = useState(false);
  const [streamStartedAt, setStreamStartedAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useSubheadings, setUseSubheadings] = useState(criteriaCount >= 8);

  const [review, setReview] = useState<ReviewResult | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewStartedAt, setReviewStartedAt] = useState<number | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [improving, setImproving] = useState(false);
  const [improveStartedAt, setImproveStartedAt] = useState<number | null>(null);
  const [improveStage, setImproveStage] = useState<string>("");
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const [improveError, setImproveError] = useState<string | null>(null);

  const [justSaved, setJustSaved] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // Close the download menu when clicking outside
  useEffect(() => {
    if (!downloadMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        downloadMenuRef.current &&
        !downloadMenuRef.current.contains(e.target as Node)
      ) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [downloadMenuOpen]);

  const wc = wordCount(text);

  async function generate() {
    if (!statement.person_spec || !statement.cv_text) {
      setError("Missing person spec or CV. Go back and complete earlier steps.");
      return;
    }

    setStreaming(true);
    setStreamStartedAt(Date.now());
    setError(null);
    setText("");

    try {
      const res = await fetch("/api/generate-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statementId: statement.id,
          personSpec: statement.person_spec,
          cv: statement.cv_text,
          gapFills: (statement.gap_fills as GapFillAnswerWithMeta[] | null) ?? [],
          useSubheadings,
        }),
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Generation failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setText(acc);
      }
      // Strip AI tells (markdown, em-dashes, semicolons) once the stream ends.
      // Server saves the cleaned version too — this just keeps the textarea
      // in sync without a refresh.
      const cleaned = cleanStatementText(acc);
      setText(cleaned);
      onTextUpdate(cleaned);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setStreaming(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function runReview() {
    if (!statement.person_spec || !text) return;
    setReviewing(true);
    setReviewStartedAt(Date.now());
    setReviewError(null);
    setReview(null);
    try {
      const res = await fetch("/api/review-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personSpec: statement.person_spec,
          statementText: text,
        }),
      });
      // 504 / HTML error pages don't return JSON; build a sensible message.
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        if (res.status === 504 || res.status === 408) {
          throw new Error(
            "Scoring took too long and timed out. Try again. It usually works on the second attempt.",
          );
        }
        if (res.status >= 500) {
          throw new Error(
            (data && data.error) ||
              `Scoring failed (${res.status}). Try again in a moment.`,
          );
        }
        throw new Error((data && data.error) || `Scoring failed (${res.status})`);
      }
      if (!data.review) throw new Error("No review returned from server");
      setReview(data.review as ReviewResult);
    } catch (e) {
      console.error("review failed", e);
      setReviewError(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setReviewing(false);
    }
  }

  function commitEdit() {
    if (text !== statement.final_text) onTextUpdate(text);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  async function trimToLimit() {
    if (!statement.person_spec || trimming) return;
    setTrimming(true);
    try {
      const res = await fetch("/api/improve-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statementId: statement.id,
          currentStatement: text,
          fixes: [
            {
              title: "Trim to under 1,100 words",
              suggestion:
                "Cut padding, generic openers and closers, repetitive phrases, and any throat-clearing. KEEP every STAR example and every specific piece of evidence. Aim for 1,000-1,100 words. Do not delete substance.",
              requiresUserInput: false,
            },
          ],
          jobTitle: statement.person_spec.jobTitle,
          organisation: statement.person_spec.organisation,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.statement) {
        setText(data.statement);
        onTextUpdate(data.statement);
      }
    } catch (e) {
      console.error("Trim failed", e);
    } finally {
      setTrimming(false);
    }
  }

  function getFilename() {
    return (statement.title || "supporting-statement")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function triggerDownload(blob: Blob, ext: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${getFilename()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setDownloadMenuOpen(false);
    setTimeout(() => setDownloaded(false), 2000);
  }

  function downloadTxt() {
    triggerDownload(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
      "txt",
    );
  }

  async function downloadDocx() {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import(
      "docx"
    );

    // Split on double-newlines into paragraphs. Within a paragraph, treat single
    // newlines as soft line breaks.
    const blocks = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

    const docParagraphs = blocks.map((block, idx) => {
      // Heuristic: a short standalone line in Title Case is probably a heading.
      const isHeading =
        block.length < 80 &&
        !block.includes(". ") &&
        block === block.replace(/[a-z]+\s+[a-z]+/, (m) => m); // very rough
      const titleCaseMatch =
        block.length < 80 &&
        !block.endsWith(".") &&
        /^[A-Z][a-zA-Z\s,&'\-]+$/.test(block);

      if (isHeading && titleCaseMatch && idx > 0) {
        return new Paragraph({
          children: [new TextRun({ text: block, bold: true })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        });
      }

      const lines = block.split("\n");
      const children = lines.flatMap((line, i) =>
        i === 0
          ? [new TextRun(line)]
          : [new TextRun({ text: line, break: 1 })],
      );
      return new Paragraph({
        children,
        spacing: { after: 200, line: 320 },
      });
    });

    const doc = new Document({
      creator: "ApplySharp",
      title: statement.title || "Supporting statement",
      styles: {
        default: {
          document: {
            run: { font: "Calibri", size: 22 },
          },
        },
      },
      sections: [{ children: docParagraphs }],
    });

    const blob = await Packer.toBlob(doc);
    triggerDownload(blob, "docx");
  }

  async function downloadPdf() {
    const { jsPDF } = await import("jspdf");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 56; // ~ 0.78 inch
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    const blocks = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

    for (const block of blocks) {
      const isHeading =
        block.length < 80 &&
        !block.endsWith(".") &&
        /^[A-Z][a-zA-Z\s,&'\-]+$/.test(block);

      if (isHeading) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        if (y + 22 > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(block, margin, y);
        y += 22;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        continue;
      }

      const lines = pdf.splitTextToSize(block, maxWidth);
      for (const line of lines as string[]) {
        if (y + 16 > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += 15;
      }
      y += 8; // extra gap between paragraphs
    }

    const blob = pdf.output("blob");
    triggerDownload(blob, "pdf");
  }

  async function autoImprove() {
    if (!review || !statement.person_spec) return;
    const TARGET_SCORE = 95;
    const MAX_ITERATIONS = 3;

    setImproving(true);
    setImproveStartedAt(Date.now());
    setImproveError(null);
    setScoreHistory([review.overallScore]);

    let currentReview = review;
    let currentText = text;
    let previousScore = review.overallScore;

    try {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        if (currentReview.overallScore >= TARGET_SCORE) break;
        const fixes = currentReview.topFixes;
        if (fixes.length === 0) break;

        setImproveStage(
          `Round ${i + 1} of ${MAX_ITERATIONS} · applying ${fixes.length} fix${fixes.length === 1 ? "" : "es"}…`,
        );
        const improveRes = await fetch("/api/improve-statement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            statementId: statement.id,
            currentStatement: currentText,
            fixes,
            jobTitle: statement.person_spec.jobTitle,
            organisation: statement.person_spec.organisation,
          }),
        });
        const improveData = await improveRes.json().catch(() => ({}));
        if (!improveRes.ok) {
          throw new Error(improveData.error ?? "Improvement failed");
        }
        currentText = improveData.statement;
        setText(currentText);

        setImproveStage(`Round ${i + 1} of ${MAX_ITERATIONS} · re-scoring…`);
        const reviewRes = await fetch("/api/review-statement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personSpec: statement.person_spec,
            statementText: currentText,
          }),
        });
        const reviewData = await reviewRes.json().catch(() => ({}));
        if (!reviewRes.ok) {
          throw new Error(reviewData.error ?? "Re-scoring failed");
        }
        currentReview = reviewData.review as ReviewResult;
        setReview(currentReview);
        setScoreHistory((h) => [...h, currentReview.overallScore]);

        // Stop early if no real improvement (less than 2 points gain)
        if (currentReview.overallScore - previousScore < 2) {
          break;
        }
        previousScore = currentReview.overallScore;
      }

      // Scroll the statement back to the top so user can see the changes
      setTimeout(() => {
        const ta = document.querySelector<HTMLTextAreaElement>(
          'textarea[placeholder*="Streaming"], textarea[placeholder*="statement"]',
        );
        if (ta) {
          ta.scrollTop = 0;
          ta.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } catch (e) {
      setImproveError(e instanceof Error ? e.message : "Improvement failed");
    } finally {
      setImproving(false);
      setImproveStage("");
    }
  }

  const hasOutput = text.length > 0;

  return (
    <section>
      <div className="rounded-lg border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Your supporting statement
            </h2>
            <p className="mt-1.5 text-[var(--color-muted)]">
              {hasOutput
                ? "Edit anything. Score it when you're ready."
                : "Choose a format and generate."}
            </p>
          </div>
          {hasOutput && !streaming && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={copy}>
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy
                  </>
                )}
              </Button>
              <div className="relative" ref={downloadMenuRef}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDownloadMenuOpen((o) => !o)}
                >
                  {downloaded ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Saved
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" /> Download
                      <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </Button>
                {downloadMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-[var(--color-border)] bg-white shadow-lg z-20 overflow-hidden">
                    <button
                      type="button"
                      onClick={downloadPdf}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm hover:bg-[var(--color-surface)]"
                    >
                      <span className="font-medium">PDF</span>
                      <span className="text-xs text-[var(--color-muted)] ml-auto">.pdf</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadDocx}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm hover:bg-[var(--color-surface)] border-t border-[var(--color-border)]"
                    >
                      <span className="font-medium">Word</span>
                      <span className="text-xs text-[var(--color-muted)] ml-auto">.docx</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadTxt}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm hover:bg-[var(--color-surface)] border-t border-[var(--color-border)]"
                    >
                      <span className="font-medium">Plain text</span>
                      <span className="text-xs text-[var(--color-muted)] ml-auto">.txt</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {!hasOutput && !streaming && (
          <div className="mt-6 space-y-5">
            <div className="rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand)] mb-3">
                Ready to generate
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                    Role
                  </dt>
                  <dd className="font-medium mt-0.5">
                    {statement.person_spec?.jobTitle ?? "—"}
                    {statement.person_spec?.band && (
                      <span className="text-[var(--color-muted)]">
                        {" "}· Band {statement.person_spec.band}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                    Trust
                  </dt>
                  <dd className="font-medium mt-0.5 break-words">
                    {statement.person_spec?.organisation ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                    Criteria
                  </dt>
                  <dd className="font-medium mt-0.5 tabular-nums">
                    {criteriaCount}{" "}
                    <span className="text-[var(--color-muted)]">
                      ({essentialCount} essential)
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                    Stories shared
                  </dt>
                  <dd className="font-medium mt-0.5 tabular-nums">
                    {answeredCount}{" "}
                    {gapFillsRaw.length > 0 && (
                      <span className="text-[var(--color-muted)]">
                        of {gapFillsRaw.length}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={useSubheadings}
                onChange={(e) => setUseSubheadings(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--color-border-strong)] text-[var(--color-brand)]"
              />
              <span>
                <span className="font-medium">
                  Use a heading for each criterion
                </span>
                <span className="block text-xs text-[var(--color-muted)] mt-0.5">
                  {criteriaCount >= 8
                    ? "Recommended. Easier for shortlisters to scan when there are many criteria."
                    : "Better for short statements with few criteria."}
                </span>
              </span>
            </label>

            <div>
              <Button onClick={generate} size="lg">
                <Sparkles className="h-4 w-4" /> Generate my statement
              </Button>
              <p className="mt-2 text-xs text-[var(--color-muted-soft)]">
                Takes 15-30 seconds.
              </p>
            </div>
          </div>
        )}

        {(hasOutput || streaming) && (
          <div className="mt-6">
            {streaming && streamStartedAt && (
              <GenerationProgress
                wordCount={wc}
                startedAt={streamStartedAt}
              />
            )}
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={commitEdit}
              rows={streaming ? 14 : 28}
              className={cn(
                "leading-relaxed text-[15px]",
                streaming && "border-[var(--color-brand)]",
              )}
              placeholder={streaming ? "Your statement will appear here as it writes…" : ""}
              disabled={streaming}
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-xs flex-wrap">
              <WordCountIndicator wordCount={wc} streaming={streaming} />
              <div className="flex items-center gap-3">
                {!streaming && hasOutput && wc > 1200 && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={trimToLimit}
                    disabled={trimming}
                  >
                    {trimming ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Trimming…
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3 w-3" />
                        Trim to under 1,100 words
                      </>
                    )}
                  </Button>
                )}
                {!streaming && hasOutput && (
                  <Button variant="link" size="sm" onClick={generate}>
                    <Sparkles className="h-3 w-3" /> Regenerate
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {!hasOutput && !streaming && (
        <div className="mt-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back to gaps
          </Button>
        </div>
      )}

      {hasOutput && !streaming && (
        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          <Button onClick={runReview} disabled={reviewing || improving} size="lg">
            {reviewing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scoring with shortlister…
              </>
            ) : (
              <>
                <Gauge className="h-4 w-4" />
                {review ? "Re-score with shortlister" : "Score with NHS shortlister"}
              </>
            )}
          </Button>
          <Button variant="secondary" onClick={commitEdit}>
            {justSaved ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Saved
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save edits
              </>
            )}
          </Button>
        </div>
      )}

      {reviewing && reviewStartedAt && (
        <div className="mt-4">
          <StepProgressCard
            stages={REVIEW_STAGES}
            estimatedSeconds={15}
            startedAt={reviewStartedAt}
          />
        </div>
      )}

      {reviewError && (
        <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1 break-words">{reviewError}</span>
          </div>
          <div className="mt-2 pl-6">
            <button
              type="button"
              onClick={runReview}
              className="text-xs font-medium underline underline-offset-2 hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {improving && improveStartedAt && (
        <div className="mt-4 rounded-md border border-[var(--color-brand)] bg-[var(--color-brand-soft)] p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand)] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-brand)]">
                Auto-improving your statement
              </p>
              {improveStage && (
                <p className="text-xs text-[var(--color-brand)] mt-0.5">
                  {improveStage}
                </p>
              )}
            </div>
          </div>
          {scoreHistory.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-brand)] flex-wrap">
              <span className="font-medium">Score:</span>
              {scoreHistory.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1.5">
                  {i > 0 && <span className="text-[var(--color-muted-soft)]">→</span>}
                  <span className="font-semibold tabular-nums">{s}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {improveError && (
        <div className="mt-4 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{improveError}</span>
        </div>
      )}

      {review && !reviewing && (
        <ReviewCard
          review={review}
          scoreHistory={scoreHistory}
          onAutoImprove={autoImprove}
          improving={improving}
        />
      )}
    </section>
  );
}

function WordCountIndicator({
  wordCount,
  streaming,
}: {
  wordCount: number;
  streaming: boolean;
}) {
  if (streaming) {
    return (
      <span className="text-[var(--color-muted-soft)]">
        {wordCount.toLocaleString("en-GB")} words · streaming…
      </span>
    );
  }

  let tone = "text-[var(--color-muted-soft)]";
  let label = "";

  if (wordCount === 0) {
    label = "no statement yet";
  } else if (wordCount < 600) {
    tone = "text-amber-700";
    label = "shorter than typical (aim 800–1,200)";
  } else if (wordCount <= 1200) {
    tone = "text-[var(--color-brand)]";
    label = "within ideal range (800–1,200)";
  } else if (wordCount <= 1400) {
    tone = "text-amber-700";
    label = "approaching NHS form limit (1,500)";
  } else {
    tone = "text-red-700";
    label = "over NHS form limit — trim before submitting";
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", tone)}>
      <span className="font-semibold tabular-nums">
        {wordCount.toLocaleString("en-GB")} words
      </span>
      {label && (
        <span className="text-[var(--color-muted-soft)]">· {label}</span>
      )}
    </span>
  );
}

function ReviewCard({
  review,
  scoreHistory,
  onAutoImprove,
  improving,
}: {
  review: ReviewResult;
  scoreHistory: number[];
  onAutoImprove: () => void;
  improving: boolean;
}) {
  const decisionStyle = decisionStyles[review.shortlistDecision];
  const previousScore = scoreHistory.length >= 2 ? scoreHistory[0] : null;
  const scoreImproved =
    previousScore !== null && review.overallScore > previousScore;
  const fixCount = review.topFixes.length;
  const canAutoImprove =
    review.overallScore < 95 && fixCount > 0 && !improving;

  const lowScoring = review.criterionScores.filter((c) => c.score < 2);
  const highScoring = review.criterionScores.filter((c) => c.score >= 2);

  return (
    <div className="mt-6 space-y-4">
      <div
        className={cn(
          "rounded-lg border p-4 sm:p-5",
          decisionStyle.cardClass,
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
              decisionStyle.iconBg,
            )}
          >
            {decisionStyle.icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider",
                  decisionStyle.label,
                )}
              >
                {decisionStyle.title}
              </p>
              <p className="text-2xl font-semibold tabular-nums flex items-center gap-1.5">
                {scoreImproved && previousScore !== null && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-brand)]">
                    <TrendingUp className="h-3 w-3" />+
                    {review.overallScore - previousScore}
                  </span>
                )}
                {review.overallScore}
                <span className="text-sm text-[var(--color-muted)] font-normal">
                  /100
                </span>
              </p>
            </div>
            <p className="text-sm sm:text-base mt-1 leading-snug">
              {review.verdict}
            </p>
          </div>
        </div>

        {canAutoImprove && (
          <Button
            onClick={onAutoImprove}
            disabled={improving}
            className="w-full mt-4"
            size="lg"
          >
            <Wand2 className="h-4 w-4" />
            Auto-improve
          </Button>
        )}
      </div>

      {(review.strengths.length > 0 || review.weaknesses.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {review.strengths.length > 0 && (
            <ReviewList
              icon={<ThumbsUp className="h-4 w-4" />}
              title="Strengths"
              items={review.strengths}
              accentClass="text-[var(--color-brand)] bg-[var(--color-brand-soft)]"
            />
          )}
          {review.weaknesses.length > 0 && (
            <ReviewList
              icon={<ThumbsDown className="h-4 w-4" />}
              title="Gaps"
              items={review.weaknesses}
              accentClass="text-amber-800 bg-amber-50"
            />
          )}
        </div>
      )}

      {(lowScoring.length > 0 || highScoring.length > 0) && (
        <details className="rounded-lg border border-[var(--color-border)] bg-white group">
          <summary className="cursor-pointer p-4 text-sm font-medium hover:bg-[var(--color-surface)] transition-colors list-none flex items-center justify-between gap-3">
            <span>
              Criteria breakdown
              <span className="text-[var(--color-muted)] font-normal ml-1.5">
                ({lowScoring.length > 0
                  ? `${lowScoring.length} need work, ${highScoring.length} met`
                  : `all ${highScoring.length} met`})
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-[var(--color-muted)] transition-transform group-open:rotate-180 flex-shrink-0" />
          </summary>
          <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
            {[...lowScoring, ...highScoring].map((c) => (
              <li key={c.criterionId} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <p className="font-medium flex-1 min-w-0 text-sm">
                    {c.criterionText}
                  </p>
                  <ScoreBadge score={c.score} label={c.label} />
                </div>
                <p className="mt-1.5 text-sm text-[var(--color-muted)] leading-relaxed">
                  {c.feedback}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {fixCount > 0 && (
        <details className="rounded-lg border border-[var(--color-border)] bg-white group">
          <summary className="cursor-pointer p-4 text-sm font-medium hover:bg-[var(--color-surface)] transition-colors list-none flex items-center justify-between gap-3">
            <span>
              What auto-improve will do
              <span className="text-[var(--color-muted)] font-normal ml-1.5">
                ({fixCount} {fixCount === 1 ? "fix" : "fixes"})
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-[var(--color-muted)] transition-transform group-open:rotate-180 flex-shrink-0" />
          </summary>
          <ol className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
            {review.topFixes.map((fix, i) => (
              <li key={i} className="p-4">
                <p className="font-medium text-sm">
                  {i + 1}. {fix.title}
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted)] leading-relaxed">
                  {fix.suggestion}
                </p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

const decisionStyles: Record<
  ShortlistDecision,
  {
    title: string;
    cardClass: string;
    label: string;
    iconBg: string;
    icon: React.ReactNode;
  }
> = {
  shortlist: {
    title: "Likely shortlist",
    cardClass:
      "border-[var(--color-brand)] bg-[var(--color-brand-soft)]",
    label: "text-[var(--color-brand)]",
    iconBg: "bg-[var(--color-brand)] text-white",
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  borderline: {
    title: "Borderline",
    cardClass: "border-amber-300 bg-amber-50",
    label: "text-amber-800",
    iconBg: "bg-amber-500 text-white",
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  reject: {
    title: "Likely rejection",
    cardClass: "border-red-300 bg-red-50",
    label: "text-red-700",
    iconBg: "bg-red-600 text-white",
    icon: <ThumbsDown className="h-5 w-5" />,
  },
};

function ScoreBadge({
  score,
  label,
}: {
  score: 0 | 1 | 2 | 3;
  label: string;
}) {
  const styles = [
    "bg-red-50 text-red-700 border-red-200",
    "bg-amber-50 text-amber-800 border-amber-200",
    "bg-[var(--color-brand-soft)] text-[var(--color-brand)] border-[var(--color-brand)]",
    "bg-[var(--color-brand-soft)] text-[var(--color-brand)] border-[var(--color-brand)]",
  ];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border whitespace-nowrap",
        styles[score],
      )}
    >
      <span className="font-semibold tabular-nums">{score}/3</span>
      <span>·</span>
      <span>{label}</span>
    </span>
  );
}

function ReviewList({
  icon,
  title,
  items,
  accentClass,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  accentClass: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-md",
            accentClass,
          )}
        >
          {icon}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-soft)]">Nothing flagged.</p>
      ) : (
        <ul className="space-y-2 text-sm leading-relaxed">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[var(--color-muted-soft)]">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
