export default function ProjectDetailLoading() {
  return (
    <main
      id="main-content"
      className="flex-1 p-6 md:p-8 bg-slate-50/60 dark:bg-slate-950"
    >
      <div className="mx-auto max-w-5xl flex flex-col gap-6" aria-busy="true">
        <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />

        <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="h-5 w-36 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-8 w-72 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-4 w-96 max-w-full rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 animate-pulse"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
