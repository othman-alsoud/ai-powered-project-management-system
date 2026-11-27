export default function TeamActivityLoading() {
  return (
    <main
      id="main-content"
      className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50/60 dark:bg-slate-950"
    >
      <div className="mx-auto max-w-5xl flex flex-col gap-6" aria-busy="true">
        <div className="flex flex-col gap-2 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-4 w-80 max-w-full rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>

        <div className="h-20 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-14 rounded-md bg-slate-100 dark:bg-slate-800/70 animate-pulse"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
