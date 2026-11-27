export default function TeamTasksLoading() {
  return (
    <main
      id="main-content"
      className="flex-1 p-6 md:p-8 bg-slate-50/60 dark:bg-slate-950"
    >
      <div className="mx-auto max-w-7xl flex flex-col gap-6" aria-busy="true">
        <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="h-7 w-36 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-4 w-72 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-36 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 w-28 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40 p-3 flex flex-col gap-3"
            >
              <div className="h-6 w-28 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              {Array.from({ length: 3 }).map((__, cardIndex) => (
                <div
                  key={cardIndex}
                  className="h-24 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
