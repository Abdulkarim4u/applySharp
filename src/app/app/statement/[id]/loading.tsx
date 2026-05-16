export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8 animate-pulse">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="h-4 w-24 bg-[var(--color-surface)] rounded" />
        <div className="h-3 w-20 bg-[var(--color-surface)] rounded" />
      </div>

      <div className="h-8 w-2/3 bg-[var(--color-surface)] rounded" />

      <div className="mt-3 flex items-center gap-3">
        <div className="h-7 w-12 bg-[var(--color-surface)] rounded-full" />
        <div className="h-4 w-32 bg-[var(--color-surface)] rounded" />
      </div>

      <section className="mt-6 rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-[var(--color-border)]">
          <div className="h-4 w-40 bg-[var(--color-surface)] rounded" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 bg-[var(--color-surface)] rounded-md" />
            <div className="h-8 w-24 bg-[var(--color-surface)] rounded-md" />
          </div>
        </div>
        <div className="p-4 sm:p-6 space-y-3">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="h-4 bg-[var(--color-surface)] rounded"
              style={{ width: `${85 - (i % 4) * 8}%` }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
