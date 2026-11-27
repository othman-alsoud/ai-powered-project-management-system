export default function TeamDashboardLoading() {
  return (
    <main
      id="main-content"
      className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50/60 dark:bg-slate-950 min-w-0"
    >
      <div className="mx-auto max-w-7xl flex flex-col gap-6" aria-busy="true">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-7 w-64 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
          <div className="h-10 w-28 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>

        {/* 4-Metric Bar Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="p-5 border-b sm:border-b-0 sm:border-r last:border-r-0 border-slate-200 dark:border-slate-800 flex flex-col gap-3"
            >
              <div className="h-3.5 w-24 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="h-7 w-12 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Breakdown Row Skeleton */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-3"
            >
              <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="h-6 w-full rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Two-Column Content Skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-9 w-full rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse"
              />
            ))}
          </div>
          <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-12 w-full rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
