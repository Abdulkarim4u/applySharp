import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepDef {
  label: string;
}

export const STEPS: StepDef[] = [
  { label: "Advert" },
  { label: "Criteria" },
  { label: "CV" },
  { label: "Gaps" },
  { label: "Generate" },
];

export function Stepper({
  current,
  furthest,
  onJump,
}: {
  current: number;
  furthest: number;
  onJump?: (step: number) => void;
}) {
  return (
    <ol className="flex items-center gap-1 sm:gap-2 w-full">
      {STEPS.map((s, i) => {
        const isCurrent = i === current;
        const isCompleted = i < furthest;
        const isClickable = onJump && i <= furthest;
        return (
          <li
            key={i}
            className={cn(
              "flex items-center gap-1 sm:gap-2",
              i < STEPS.length - 1 ? "flex-1" : "flex-shrink-0",
            )}
          >
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onJump?.(i)}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${s.label}${isCompleted ? ", completed" : isCurrent ? ", current" : ""}`}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm transition-colors flex-shrink-0",
                isCurrent &&
                  "bg-[var(--color-brand-soft)] text-[var(--color-brand)] font-medium",
                !isCurrent &&
                  isCompleted &&
                  "text-[var(--color-fg)] hover:bg-[var(--color-surface)]",
                !isCurrent &&
                  !isCompleted &&
                  "text-[var(--color-muted-soft)] cursor-default",
                isClickable && "cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold flex-shrink-0",
                  isCurrent && "bg-[var(--color-brand)] text-white",
                  !isCurrent && isCompleted && "bg-[var(--color-brand)] text-white",
                  !isCurrent &&
                    !isCompleted &&
                    "bg-[var(--color-border)] text-[var(--color-muted)]",
                )}
              >
                {isCompleted && !isCurrent ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {/* Label: always shown for current step; hidden on mobile for others */}
              <span className={cn(!isCurrent && "hidden sm:inline")}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="h-px flex-1 min-w-[8px] sm:min-w-[16px] bg-[var(--color-border)]" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
