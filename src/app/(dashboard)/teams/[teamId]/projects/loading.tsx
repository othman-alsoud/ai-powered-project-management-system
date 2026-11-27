export default function TeamProjectsLoading() {
  return (
    <main
      id="main-content"
      className="flex-1 p-6 md:p-8 bg-slate-50/60 dark:bg-slate-950"
    >
      <div className="mx-auto max-w-7xl flex flex-col gap-6" aria-busy="true">
        <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-7 w-40 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-4 w-56 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
          <div className="h-10 w-32 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-10 w-full rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
