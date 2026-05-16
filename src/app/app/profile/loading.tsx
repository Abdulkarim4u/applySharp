export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10 animate-pulse">
      <div className="mb-4 h-4 w-24 bg-[var(--color-surface)] rounded" />
      <div className="h-8 w-40 bg-[var(--color-surface)] rounded" />
      <div className="mt-2 h-5 w-3/4 max-w-lg bg-[var(--color-surface)] rounded" />

      <section className="mt-6 rounded-lg border border-[var(--color-border)] bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-[var(--color-border)]">
          <div className="h-4 w-48 bg-[var(--color-surface)] rounded" />
          <div className="h-8 w-20 bg-[var(--color-surface)] rounded-md" />
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
