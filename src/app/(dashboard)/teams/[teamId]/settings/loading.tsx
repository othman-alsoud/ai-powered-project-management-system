export default function TeamSettingsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="h-3 w-36 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="h-8 w-64 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="h-4 w-80 max-w-full rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
      </div>

      {/* Action Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-3.5 w-64 max-w-full rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-36 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-9 w-28 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
      </div>

      {/* Roster Table Skeleton */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-12 w-full rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
