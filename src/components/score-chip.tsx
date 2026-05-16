export function ScoreChip({
  score,
  decision,
  size = "sm",
}: {
  score: number;
  decision: string | null;
  size?: "sm" | "lg";
}) {
  const tone = decision
    ? decision === "shortlist"
      ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)] border-[var(--color-brand)]/30"
      : decision === "borderline"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-red-50 text-red-700 border-red-200"
    : score >= 80
      ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)] border-[var(--color-brand)]/30"
      : score >= 65
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-red-50 text-red-700 border-red-200";

  const sizing =
    size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium tabular-nums ${sizing} ${tone}`}
      title={
        decision
          ? `Shortlister: ${decision} (${score}/100)`
          : `Score ${score}/100`
      }
    >
      {score}
    </span>
  );
}

export function decisionLabel(decision: string | null): string {
  if (decision === "shortlist") return "Likely shortlist";
  if (decision === "borderline") return "Borderline";
  if (decision === "reject") return "Below shortlist";
  return "";
}
