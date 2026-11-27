import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Authentication",
  description: "Secure authentication for Polaris Workspace",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden">
      {/* Ambient Radial Nordic Glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(13,148,136,0.12),transparent_70%)] dark:bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(20,184,166,0.15),transparent_70%)]"
        aria-hidden="true"
      />

      {/* Subtle Hairline Grid */}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(226,232,240,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(226,232,240,0.5)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(30,41,59,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,0.5)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40"
        aria-hidden="true"
      />

      {/* Top Header */}
      <header className="relative z-10 flex h-16 w-full items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 px-4 sm:px-8 backdrop-blur-md">
        <Logo size="md" />
        <div className="flex items-center gap-2 rounded-full border border-teal-200/60 dark:border-teal-800/60 bg-teal-50/60 dark:bg-teal-950/40 px-3 py-1 text-xs text-teal-700 dark:text-teal-300 shadow-2xs">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span className="font-medium">256-bit TLS Encrypted</span>
        </div>
      </header>

      {/* Auth Content Frame */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        {children}
      </div>

      {/* Minimal Footer */}
      <footer className="relative z-10 flex h-12 w-full items-center justify-between border-t border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 px-6 text-xs text-slate-500 dark:text-slate-400">
        <span>Polaris Multi-tenant Workspace &bull; Version 1.3</span>
        <span>Swiss Precision Structure &bull; Nordic Calm</span>
      </footer>
    </div>
  );
}
