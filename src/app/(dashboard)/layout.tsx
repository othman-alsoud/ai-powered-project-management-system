export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[--color-bg-base] text-[--color-text-primary]">
      {children}
    </div>
  );
}
