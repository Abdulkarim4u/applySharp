import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 text-[var(--color-fg)] hover:opacity-90 transition-opacity",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-brand)] text-white text-sm font-bold"
      >
        A
      </span>
      <span className="text-base font-semibold tracking-tight">ApplySharp</span>
    </Link>
  );
}
