import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication | AI Project Management",
  description: "Secure authentication for AI Project Management System",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[--color-bg-base]">
      {children}
    </div>
  );
}
