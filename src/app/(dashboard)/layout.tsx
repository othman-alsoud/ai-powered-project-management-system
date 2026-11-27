export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[--color-bg-canvas] text-[--color-text-primary]">
      {children}
    </div>
  );
}
