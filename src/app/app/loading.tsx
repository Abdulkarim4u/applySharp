export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12 animate-pulse">
      <div className="flex items-end justify-between gap-4 mb-2 flex-wrap">
        <div className="space-y-2">
          <div className="h-8 w-72 bg-[var(--color-surface)] rounded" />
          <div className="h-5 w-96 max-w-full bg-[var(--color-surface)] rounded" />
        </div>
        <div className="h-10 w-40 bg-[var(--color-surface)] rounded-md" />
      </div>

      <div className="mb-8 mt-4 h-5 w-64 bg-[var(--color-surface)] rounded" />

      <ul className="space-y-3">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="flex items-center gap-4 rounded-lg border border-[var(--color-border)] bg-white p-4 sm:p-5"
          >
            <span className="h-10 w-10 rounded-md bg-[var(--color-surface)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-[var(--color-surface)] rounded" />
              <div className="h-3 w-1/3 bg-[var(--color-surface)] rounded" />
            </div>
            <span className="h-4 w-4 rounded bg-[var(--color-surface)]" />
          </li>
        ))}
      </ul>
    </div>
  );
}
