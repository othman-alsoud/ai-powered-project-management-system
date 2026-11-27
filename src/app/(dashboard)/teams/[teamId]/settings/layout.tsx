export default function TeamSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="flex-1 p-6 md:p-8 bg-slate-50/60 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl">
        {children}
      </div>
    </main>
  );
}