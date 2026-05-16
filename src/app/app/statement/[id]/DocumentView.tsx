"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  FilePlus,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScoreChip, decisionLabel } from "@/components/score-chip";
import { cleanStatementText } from "@/lib/clean-statement";
import type {
  ApplicationStatus,
  ReviewFix,
  ReviewResult,
  ShortlistDecision,
  StatementRecord,
} from "@/lib/types";

type ConfirmKind = "review" | "improve" | null;

const APPLICATION_STATUS_OPTIONS: {
  value: ApplicationStatus;
  label: string;
  tone: string;
}[] = [
  {
    value: "not_submitted",
    label: "Not submitted",
    tone: "bg-slate-100 text-slate-700 border-slate-200",
  },
  {
    value: "submitted",
    label: "Submitted",
    tone: "bg-blue-50 text-blue-800 border-blue-200",
  },
  {
    value: "interview",
    label: "Interview",
    tone: "bg-amber-50 text-amber-800 border-amber-200",
  },
  {
    value: "offer",
    label: "Offer",
    tone:
      "bg-[var(--color-brand-soft)] text-[var(--color-brand)] border-[var(--color-brand)]/30",
  },
  {
    value: "rejected",
    label: "Rejected",
    tone: "bg-red-50 text-red-700 border-red-200",
  },
];

export function DocumentView({ initial }: { initial: StatementRecord }) {
  const [statement, setStatement] = useState<StatementRecord>(initial);
  const [text, setText] = useState<string>(
    initial.final_text ?? initial.draft_text ?? "",
  );

  const [editing, setEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState<string>(text);

  const [reviewing, setReviewing] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improveStage, setImproveStage] = useState<string>("");
  const [latestReview, setLatestReview] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const [duplicating, setDuplicating] = useState(false);
  const router = useRouter();

  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);

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

  useEffect(() => {
    if (!statusMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(e.target as Node)
      ) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [statusMenuOpen]);

  async function updateApplicationStatus(next: ApplicationStatus) {
    setStatusMenuOpen(false);
    if (next === statement.application_status) return;
    const prev = statement;
    // Optimistic — feels instant. Server stamps submitted_at when needed.
    setStatement((s) => ({
      ...s,
      application_status: next,
      submitted_at:
        next === "submitted" && !s.submitted_at
          ? new Date().toISOString()
          : s.submitted_at,
    }));
    try {
      const res = await fetch(`/api/statements/${statement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_status: next }),
      });
      if (!res.ok) throw new Error("Save failed");
      const { statement: saved } = await res.json();
      // Sync any server-stamped fields (submitted_at) back into local state.
      setStatement((s) => ({
        ...s,
        application_status: saved.application_status,
        submitted_at: saved.submitted_at,
      }));
    } catch {
      setStatement(prev);
      setError("Couldn't update status. Try again.");
    }
  }

  async function duplicateStatement() {
    if (duplicating) return;
    setDuplicating(true);
    setError(null);
    try {
      const res = await fetch("/api/statements/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: statement.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id) {
        throw new Error(data?.error ?? "Could not duplicate");
      }
      router.push(`/app/statement/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not duplicate");
      setDuplicating(false);
    }
  }

  const persistTitle = useCallback(
    async (nextTitle: string) => {
      const prev = statement.title;
      setStatement((s) => ({ ...s, title: nextTitle }));
      try {
        const res = await fetch(`/api/statements/${statement.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: nextTitle }),
        });
        if (!res.ok) throw new Error("Save failed");
      } catch {
        setStatement((s) => ({ ...s, title: prev }));
        setError("Couldn't save title. Try again.");
      }
    },
    [statement.id, statement.title],
  );

  async function saveEdit() {
    const cleaned = editBuffer.trim();
    if (!cleaned) return;
    setText(cleaned);
    setEditing(false);
    try {
      const res = await fetch(`/api/statements/${statement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft_text: cleaned,
          final_text: cleaned,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
    } catch {
      setError("Edit saved locally but couldn't sync. Try again.");
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
    const blocks = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const docParagraphs = blocks.map((block, idx) => {
      const isHeading =
        block.length < 80 &&
        !block.endsWith(".") &&
        /^[A-Z][a-zA-Z\s,&'\-]+$/.test(block);
      if (isHeading && idx > 0) {
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
          document: { run: { font: "Calibri", size: 22 } },
        },
      },
      sections: [{ children: docParagraphs }],
    });
    const blob = await Packer.toBlob(doc);
    triggerDownload(blob, "docx");
  }

  async function downloadPdf() {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 56;
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
      y += 8;
    }
    const blob = pdf.output("blob");
    triggerDownload(blob, "pdf");
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function persistScore(
    score: number | null,
    decision: ShortlistDecision | null,
  ) {
    setStatement((s) => ({
      ...s,
      last_score: score,
      last_decision: decision,
    }));
    try {
      await fetch(`/api/statements/${statement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_score: score, last_decision: decision }),
      });
    } catch {
      // non-fatal — the next save will catch up
    }
  }

  async function runReview() {
    if (!statement.person_spec || !text) return;
    setReviewing(true);
    setError(null);
    setLatestReview(null);
    try {
      const res = await fetch("/api/review-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personSpec: statement.person_spec,
          statementText: text,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        if (res.status === 504 || res.status === 408) {
          throw new Error(
            "Scoring took too long and timed out. Try again — it usually works on the second attempt.",
          );
        }
        throw new Error(
          (data && data.error) || `Scoring failed (${res.status})`,
        );
      }
      const review = data.review as ReviewResult;
      setLatestReview(review);
      await persistScore(review.overallScore, review.shortlistDecision);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setReviewing(false);
    }
  }

  async function runAutoImprove() {
    if (!statement.person_spec || !text) return;
    const TARGET_SCORE = 95;
    const MAX_ITERATIONS = 3;
    const REGRESSION_TOLERANCE = 2;

    setImproving(true);
    setError(null);

    // First score the current statement so we know where we start.
    let currentReview: ReviewResult;
    try {
      setImproveStage("Scoring current version…");
      const res = await fetch("/api/review-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personSpec: statement.person_spec,
          statementText: text,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error("Scoring failed");
      currentReview = data.review as ReviewResult;
      await persistScore(
        currentReview.overallScore,
        currentReview.shortlistDecision,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-improve failed");
      setImproving(false);
      return;
    }

    let bestReview = currentReview;
    let bestText = text;
    let currentText = text;

    try {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        if (bestReview.overallScore >= TARGET_SCORE) break;
        const fixes: { title: string; suggestion: string }[] =
          currentReview.topFixes
            .filter((f: ReviewFix) => !f.requiresUserInput)
            .map((f: ReviewFix) => ({
              title: f.title,
              suggestion: f.suggestion,
            }));
        if (fixes.length === 0) break;

        setImproveStage(
          `Round ${i + 1} of ${MAX_ITERATIONS} · applying ${fixes.length} fix${
            fixes.length === 1 ? "" : "es"
          }…`,
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
        if (!improveRes.ok) throw new Error("Improve step failed");
        const { statement: improved } = await improveRes.json();
        const candidateText = cleanStatementText(improved);

        setImproveStage(`Round ${i + 1} of ${MAX_ITERATIONS} · re-scoring…`);
        const reviewRes = await fetch("/api/review-statement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personSpec: statement.person_spec,
            statementText: candidateText,
          }),
        });
        if (!reviewRes.ok) throw new Error("Re-score failed");
        const reviewData = await reviewRes.json();
        const candidateReview = reviewData.review as ReviewResult;

        if (candidateReview.overallScore > bestReview.overallScore) {
          bestReview = candidateReview;
          bestText = candidateText;
        }

        if (
          candidateReview.overallScore + REGRESSION_TOLERANCE <
          bestReview.overallScore
        ) {
          break;
        }
        currentText = candidateText;
        currentReview = candidateReview;
      }

      setText(bestText);
      setLatestReview(bestReview);
      await persistScore(bestReview.overallScore, bestReview.shortlistDecision);

      // Save the best text back to the DB
      try {
        await fetch(`/api/statements/${statement.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draft_text: bestText,
            final_text: bestText,
          }),
        });
      } catch {
        // non-fatal
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-improve failed");
    } finally {
      setImproving(false);
      setImproveStage("");
    }
  }

  const score = statement.last_score;
  const decision = statement.last_decision;
  const verdict = latestReview?.verdict ?? null;
  const busy = reviewing || improving;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href="/app"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Statements
        </Link>
        <span className="text-xs text-[var(--color-muted-soft)]">
          {wordCount(text).toLocaleString("en-GB")} words
        </span>
      </div>

      <TitleEditor title={statement.title} onSave={persistTitle} />

      <div className="mt-3 flex items-center gap-x-3 gap-y-2 flex-wrap">
        {typeof score === "number" ? (
          <>
            <ScoreChip score={score} decision={decision} size="lg" />
            {decisionLabel(decision) && (
              <span className="text-sm text-[var(--color-muted)]">
                {decisionLabel(decision)}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-[var(--color-muted)]">
            Not scored yet
          </span>
        )}
        <span
          aria-hidden
          className="hidden sm:inline text-[var(--color-muted-soft)]"
        >
          ·
        </span>
        <StatusSelector
          status={statement.application_status}
          submittedAt={statement.submitted_at}
          open={statusMenuOpen}
          onToggle={() => setStatusMenuOpen((o) => !o)}
          onSelect={updateApplicationStatus}
          containerRef={statusMenuRef}
        />
      </div>

      {verdict && (
        <p className="mt-2 text-sm text-[var(--color-muted)] italic">
          “{verdict}”
        </p>
      )}

      <FollowUpHint
        status={statement.application_status}
        submittedAt={statement.submitted_at}
      />

      {error && (
        <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-start gap-2">
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900 underline text-xs"
          >
            dismiss
          </button>
        </div>
      )}

      <section className="mt-6 rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-medium text-[var(--color-muted)]">
            Your supporting statement
          </h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={copyToClipboard}
              disabled={editing}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copy
                </>
              )}
            </Button>
            <div className="relative" ref={downloadMenuRef}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setDownloadMenuOpen((o) => !o)}
                disabled={editing}
              >
                {downloaded ? (
                  <>
                    <Check className="h-4 w-4" /> Saved
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" /> Download
                  </>
                )}
              </Button>
              {downloadMenuOpen && (
                <div className="absolute right-0 mt-1 w-44 rounded-md border border-[var(--color-border)] bg-white shadow-lg z-10">
                  <button
                    onClick={downloadPdf}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface)]"
                  >
                    PDF (.pdf)
                  </button>
                  <button
                    onClick={downloadDocx}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface)]"
                  >
                    Word (.docx)
                  </button>
                  <button
                    onClick={downloadTxt}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface)]"
                  >
                    Plain text (.txt)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {editing ? (
            <Textarea
              value={editBuffer}
              onChange={(e) => setEditBuffer(e.target.value)}
              className="min-h-[400px] text-[15px] leading-7"
              autoFocus
            />
          ) : (
            <article className="prose prose-sm sm:prose-base max-w-none text-[var(--color-fg)] whitespace-pre-wrap text-[15px] leading-7">
              {text}
            </article>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] rounded-b-lg flex-wrap">
          {editing ? (
            <>
              <div className="text-xs text-[var(--color-muted)]">
                Editing — no API credits used until you re-score.
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditBuffer(text);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={saveEdit}>
                  Save changes
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditBuffer(text);
                    setEditing(true);
                  }}
                  disabled={busy || duplicating}
                >
                  <Pencil className="h-4 w-4" /> Edit content
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={duplicateStatement}
                  disabled={busy || duplicating}
                  title="Reuse this CV for another Trust or role"
                >
                  {duplicating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Copying…
                    </>
                  ) : (
                    <>
                      <FilePlus className="h-4 w-4" /> Duplicate
                    </>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setConfirmKind("review")}
                  disabled={busy || duplicating}
                  title="Re-score this statement against the person spec"
                >
                  {reviewing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Scoring…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" /> Re-score
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setConfirmKind("improve")}
                  disabled={busy || duplicating}
                  title="Apply AI fixes until the score reaches 95+"
                >
                  {improving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />{" "}
                      {improveStage || "Improving…"}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Auto-improve
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </section>

      {confirmKind && (
        <ConfirmDialog
          kind={confirmKind}
          onCancel={() => setConfirmKind(null)}
          onConfirm={() => {
            const k = confirmKind;
            setConfirmKind(null);
            if (k === "review") void runReview();
            else if (k === "improve") void runAutoImprove();
          }}
        />
      )}
    </div>
  );
}

function ConfirmDialog({
  kind,
  onCancel,
  onConfirm,
}: {
  kind: "review" | "improve";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title =
    kind === "review" ? "Re-score this statement?" : "Auto-improve to 95+?";
  const body =
    kind === "review"
      ? "This sends your statement to Claude for re-scoring. It uses roughly 1¢ of API credit and takes about 5 seconds."
      : "This re-scores then applies AI fixes in a short loop until the score reaches 95+ (max 3 rounds). It uses roughly 3–5¢ of API credit and takes 30–60 seconds.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white border border-[var(--color-border)] shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{body}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Continue</Button>
        </div>
      </div>
    </div>
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

  function startEditing() {
    setValue(title);
    setEditing(true);
  }

  if (editing) {
    return (
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

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function StatusSelector({
  status,
  submittedAt,
  open,
  onToggle,
  onSelect,
  containerRef,
}: {
  status: ApplicationStatus;
  submittedAt: string | null;
  open: boolean;
  onToggle: () => void;
  onSelect: (next: ApplicationStatus) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const current =
    APPLICATION_STATUS_OPTIONS.find((o) => o.value === status) ??
    APPLICATION_STATUS_OPTIONS[0];

  const submittedNote =
    status === "submitted" && submittedAt
      ? `Applied ${formatRelativeShort(submittedAt)}`
      : null;

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-2">
      <button
        onClick={onToggle}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${current.tone} hover:opacity-90`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Update application status"
      >
        {current.label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {submittedNote && (
        <span className="hidden sm:inline text-xs text-[var(--color-muted-soft)]">
          {submittedNote}
        </span>
      )}
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 z-20 w-44 rounded-md border border-[var(--color-border)] bg-white shadow-lg overflow-hidden"
        >
          {APPLICATION_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="menuitem"
              onClick={() => onSelect(opt.value)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface)] flex items-center justify-between gap-2 ${
                opt.value === status ? "font-medium" : ""
              }`}
            >
              <span>{opt.label}</span>
              {opt.value === status && (
                <Check className="h-3.5 w-3.5 text-[var(--color-brand)]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FollowUpHint({
  status,
  submittedAt,
}: {
  status: ApplicationStatus;
  submittedAt: string | null;
}) {
  // Lazy state initializer runs once on mount — keeps Date.now() out of render
  // body (react-hooks/purity). The value is stable for the page lifetime,
  // which is fine: nobody sits on this page for 24 hours.
  const [now] = useState(() => Date.now());
  if (status !== "submitted" || !submittedAt) return null;
  const days = Math.floor(
    (now - new Date(submittedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days < 14) return null;
  return (
    <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
      Applied {days} days ago — consider following up with the recruitment team.
    </div>
  );
}

function formatRelativeShort(iso: string): string {
  const now = typeof window === "undefined" ? new Date(iso).getTime() : Date.now();
  const diff = now - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
