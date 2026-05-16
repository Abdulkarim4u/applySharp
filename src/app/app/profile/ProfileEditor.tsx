"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  FileText,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type Mode = "view" | "edit";

export function ProfileEditor({
  initial,
  lastStatementCv,
  statementCount,
}: {
  initial: Profile;
  lastStatementCv: { title: string; cv_text: string } | null;
  statementCount: number;
}) {
  const [profile, setProfile] = useState<Profile>(initial);
  const [mode, setMode] = useState<Mode>(initial.cv_text ? "view" : "edit");
  const [draft, setDraft] = useState<string>(initial.cv_text ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Lazy now so "last updated" can render without violating react-hooks/purity.
  const [now] = useState(() => Date.now());

  const wc = wordCount(profile.cv_text ?? "");
  const draftWc = wordCount(draft);
  const dirty = draft !== (profile.cv_text ?? "");
  const valid = draft.trim().length > 50;

  useEffect(() => {
    // Warn before leaving with unsaved edits.
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = useCallback(
    async (textToSave: string) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cv_text: textToSave }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.profile) {
          throw new Error(data?.error ?? "Save failed");
        }
        setProfile(data.profile);
        setDraft(data.profile.cv_text ?? "");
        setMode("view");
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setParsing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-cv", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't read the PDF");
      setDraft(data.text ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read the PDF");
    } finally {
      setParsing(false);
    }
  }

  function importLastCv() {
    if (!lastStatementCv) return;
    setDraft(lastStatementCv.cv_text);
    setMode("edit");
    setTimeout(() => taRef.current?.focus(), 0);
  }

  async function clearCv() {
    if (
      !window.confirm(
        "Delete your saved CV? New statements will start with an empty CV step.",
      )
    ) {
      return;
    }
    await save("");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href="/app"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Statements
        </Link>
        {savedFlash && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-brand)]">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>

      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Your CV
        </h1>
        <p className="mt-1 text-[var(--color-muted)]">
          Saved once, reused in every new statement. Update it any time.
        </p>
      </header>

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900 underline text-xs"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Empty-profile fast path: when the user has a CV sitting in their
          last statement, surface that BEFORE the editor so they don't waste
          time pasting again. Disappears once they start typing. */}
      {!profile.cv_text && lastStatementCv && mode === "edit" && !dirty && (
        <section className="mt-6 rounded-lg border border-[var(--color-brand)]/30 bg-[var(--color-brand-soft)]/50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white text-[var(--color-brand)] shadow-sm">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--color-fg)]">
                Use the CV from your last statement
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-muted)] truncate">
                From: {lastStatementCv.title}
              </p>
              <div className="mt-3">
                <Button size="sm" onClick={importLastCv}>
                  Import this CV
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {!profile.cv_text && lastStatementCv && mode === "edit" && !dirty && (
        <div
          className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-[var(--color-muted-soft)]"
          aria-hidden
        >
          <span className="flex-1 h-px bg-[var(--color-border)]" />
          <span>Or start fresh</span>
          <span className="flex-1 h-px bg-[var(--color-border)]" />
        </div>
      )}

      {mode === "view" && profile.cv_text ? (
        <ViewCard
          cvText={profile.cv_text}
          updatedAt={profile.cv_updated_at}
          statementCount={statementCount}
          words={wc}
          now={now}
          onEdit={() => {
            setDraft(profile.cv_text ?? "");
            setMode("edit");
            setTimeout(() => taRef.current?.focus(), 0);
          }}
          onClear={clearCv}
          saving={saving}
        />
      ) : null}

      {mode === "edit" && (
        <EditCard
          textareaRef={taRef}
          draft={draft}
          setDraft={setDraft}
          parsing={parsing}
          saving={saving}
          dirty={dirty}
          valid={valid}
          draftWc={draftWc}
          hasSaved={Boolean(profile.cv_text)}
          onFile={handleFile}
          onCancel={() => {
            setDraft(profile.cv_text ?? "");
            setMode(profile.cv_text ? "view" : "edit");
            setError(null);
          }}
          onSave={() => save(draft)}
        />
      )}

      {/* Tips card — small, optional, hidden once there's a saved CV. */}
      {!profile.cv_text && mode === "edit" && (
        <details className="mt-4 rounded-md border border-[var(--color-border)] bg-white p-4">
          <summary className="text-sm font-medium cursor-pointer select-none">
            Tips for a strong CV (click to expand)
          </summary>
          <ul className="mt-3 space-y-1.5 text-sm text-[var(--color-muted)] list-disc pl-5">
            <li>
              Dates and job titles for every role — the scorer looks for
              evidence anchored to specific posts.
            </li>
            <li>
              Specifics over labels — &quot;led 6 ward rounds per day&quot;
              beats &quot;managed ward rounds&quot;.
            </li>
            <li>
              Systems, tools and protocols used by name (EMIS, SystmOne,
              IPC, ANTT).
            </li>
            <li>
              Patient or service-user populations you worked with (acute
              medical, paediatric, mental health).
            </li>
            <li>
              Qualifications with completion dates and registration numbers
              where you have them.
            </li>
          </ul>
        </details>
      )}
    </div>
  );
}

function ViewCard({
  cvText,
  updatedAt,
  statementCount,
  words,
  now,
  onEdit,
  onClear,
  saving,
}: {
  cvText: string;
  updatedAt: string | null;
  statementCount: number;
  words: number;
  now: number;
  onEdit: () => void;
  onClear: () => void;
  saving: boolean;
}) {
  return (
    <section className="mt-6 rounded-lg border border-[var(--color-border)] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-[var(--color-border)] flex-wrap">
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium text-[var(--color-fg)]">Saved</span>
          <span className="text-[var(--color-muted-soft)]">·</span>
          <span className="tabular-nums">{words.toLocaleString("en-GB")} words</span>
          {updatedAt && (
            <>
              <span className="text-[var(--color-muted-soft)]">·</span>
              <span>Updated {formatRelative(updatedAt, now)}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onEdit}
            disabled={saving}
          >
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            disabled={saving}
            title="Delete your saved CV"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-4 sm:p-6 text-[13px] leading-relaxed text-[var(--color-fg)] whitespace-pre-wrap font-mono max-h-[60vh] overflow-y-auto">
        {cvText}
      </div>
      {statementCount > 0 && (
        <div className="px-4 sm:px-6 py-3 text-xs text-[var(--color-muted)] border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          Used as the starting point for{" "}
          <span className="font-medium text-[var(--color-fg)] tabular-nums">
            {statementCount}
          </span>{" "}
          statement{statementCount === 1 ? "" : "s"}.
        </div>
      )}
    </section>
  );
}

function EditCard({
  textareaRef,
  draft,
  setDraft,
  parsing,
  saving,
  dirty,
  valid,
  draftWc,
  hasSaved,
  onFile,
  onCancel,
  onSave,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  draft: string;
  setDraft: (s: string) => void;
  parsing: boolean;
  saving: boolean;
  dirty: boolean;
  valid: boolean;
  draftWc: number;
  hasSaved: boolean;
  onFile: (file: File | undefined) => Promise<void>;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <section className="mt-6 rounded-lg border border-[var(--color-border)] bg-white shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <label
            className={cn(
              "inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-white px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-surface)] transition-colors",
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
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <span className="text-xs text-[var(--color-muted)]">
            or paste below
          </span>
        </div>
        <span className="text-xs text-[var(--color-muted-soft)] tabular-nums">
          {draftWc.toLocaleString("en-GB")} words
        </span>
      </div>
      <div className="p-4 sm:p-6">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Paste your full CV here — work history, education, qualifications, key responsibilities and achievements."
          rows={10}
          className="font-mono text-[13px] leading-relaxed min-h-[260px] sm:min-h-[420px]"
        />
      </div>
      <div className="px-4 sm:px-6 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-[var(--color-muted)]">
          {valid
            ? "Looks ready."
            : "Add a few more details before saving."}
        </span>
        <div className="flex items-center gap-2">
          {hasSaved && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={onSave}
            disabled={!valid || !dirty || saving}
            // Disabled state needs to look clearly inert (not just a faded
            // brand button) so users don't click and wonder why nothing
            // happened. Override the global opacity-50 with explicit muted
            // colours.
            className="disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100 disabled:shadow-none"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : hasSaved ? (
              "Save changes"
            ) : (
              "Save CV"
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatRelative(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime();
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
