import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FolderGit2,
  CheckSquare,
  Clock,
  CalendarDays,
  TrendingUp,
  RefreshCw,
  Lock,
  Grid3X3,
  Compass,
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden">
      {/* Precision Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Logo size="md" />
            <nav className="hidden items-center gap-6 md:flex" aria-label="Global navigation">
              <a
                href="#features"
                className="text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors hover:text-teal-700 dark:hover:text-teal-400"
              >
                Features
              </a>
              <a
                href="#architecture"
                className="text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors hover:text-teal-700 dark:hover:text-teal-400"
              >
                Architecture
              </a>
              <a
                href="#security"
                className="text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors hover:text-teal-700 dark:hover:text-teal-400"
              >
                Security
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="inline-flex min-h-[44px] md:min-h-9 items-center justify-center rounded-lg px-3.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex min-h-[44px] md:min-h-9 items-center justify-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 px-4 text-sm font-medium text-white shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 transition-all duration-150"
            >
              <span>Start Free</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main id="main-content" className="flex-1">
        <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
          {/* Ambient Radial Nordic Glow */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(13,148,136,0.18),transparent_70%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(20,184,166,0.2),transparent_70%)]"
            aria-hidden="true"
          />

          {/* Subtle Hairline Grid */}
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(226,232,240,0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgba(226,232,240,0.6)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(30,41,59,0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,0.6)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40"
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
              {/* Eyebrow Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 dark:border-teal-800/80 bg-white/80 dark:bg-slate-900/80 px-3.5 py-1 text-xs shadow-xs backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Polaris Workspace &bull; Version 1.3
                </span>
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              {/* H1 Title */}
              <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl lg:text-6xl">
                Engineering clarity for{" "}
                <span className="bg-linear-to-r from-teal-700 via-teal-600 to-emerald-700 dark:from-teal-400 dark:via-teal-300 dark:to-emerald-400 bg-clip-text text-transparent">
                  ambitious software teams
                </span>
                .
              </h1>

              {/* Subtitle */}
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
                A calm, high-density project workspace combining Swiss precision structure with Nordic ergonomic design. Built for deep focus and zero distraction.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-col gap-3.5 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 px-6 text-sm font-semibold text-white shadow-sm hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 transition-all duration-150"
                >
                  <span>Create Your Team Workspace</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-6 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-2xs hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 transition-all duration-150"
                >
                  <span>Sign In to Existing Team</span>
                </Link>
              </div>

              {/* Key Specs */}
              <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                  Multi-tenant Isolation
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                  WCAG 2.1 AA Compliant
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="h-4 w-4 text-violet-700 dark:text-violet-400" aria-hidden="true" />
                  Full Keyboard Operable
                </span>
              </div>
            </div>

            {/* Product Interface Mockup Preview */}
            <div className="mt-14 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-900/5">
              {/* Window Header */}
              <div className="flex h-11 items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/60 px-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-400/80 border border-rose-500/40" aria-hidden="true" />
                  <div className="h-3 w-3 rounded-full bg-amber-400/80 border border-amber-500/40" aria-hidden="true" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400/80 border border-emerald-500/40" aria-hidden="true" />
                  <div className="ml-3 hidden sm:flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs text-slate-600 dark:text-slate-300 font-mono shadow-2xs">
                    <Lock className="h-3 w-3 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                    <span>app.polaris.internal/teams/core-platform</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="teal" dot size="sm">
                    LIVE WORKSPACE
                  </Badge>
                </div>
              </div>

              {/* Workspace Content Simulation */}
              <div className="p-6 md:p-8">
                <div className="flex flex-col gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Workspace</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400" aria-hidden="true">/</span>
                      <Badge variant="teal" size="sm">OWNER</Badge>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      Dashboard / Core Platform Team
                    </h2>
                  </div>
                  <div className="mt-3 sm:mt-0">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs">
                      <RefreshCw className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 animate-spin-reverse" aria-hidden="true" />
                      <span>Synchronized Engine</span>
                    </span>
                  </div>
                </div>

                {/* 4 Stat Metrics */}
                <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {/* Card 1: Projects */}
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Active Projects</span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60" aria-hidden="true">
                        <FolderGit2 className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">4</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <TrendingUp className="h-3 w-3" aria-hidden="true" />
                      <span>+2 new this sprint</span>
                    </p>
                  </div>

                  {/* Card 2: Tasks */}
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">My Tasks</span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60" aria-hidden="true">
                        <CheckSquare className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">12</p>
                    <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      3 tasks due today
                    </p>
                  </div>

                  {/* Card 3: In Review */}
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">In Review</span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/60" aria-hidden="true">
                        <Clock className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">3</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Awaiting code review
                    </p>
                  </div>

                  {/* Card 4: Due This Week */}
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Due This Week</span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60" aria-hidden="true">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">5</p>
                    <p className="mt-1 text-[11px] font-medium text-teal-700 dark:text-teal-400">
                      All milestones on track
                    </p>
                  </div>
                </div>

                {/* Task Stream Simulation */}
                <div className="mt-6 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 px-5 py-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Prioritized Task Stream
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">Sorted by urgency &amp; due date</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="flex items-center justify-between px-5 py-3.5 text-sm hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-500" aria-hidden="true" />
                        <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
                          TASK-102
                        </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          Migrate auth token rotation to cryptographically secure cookies
                        </span>
                      </div>
                      <Badge variant="rose" dot size="sm">
                        HIGH
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between px-5 py-3.5 text-sm hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-violet-500" aria-hidden="true" />
                        <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
                          TASK-098
                        </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          Implement tenant isolation composite constraint on team queries
                        </span>
                      </div>
                      <Badge variant="amber" dot size="sm">
                        MEDIUM
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between px-5 py-3.5 text-sm hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                        <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
                          TASK-084
                        </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          Design token architecture for Nordic Calm and Swiss Precision
                        </span>
                      </div>
                      <Badge variant="slate" dot size="sm">
                        LOW
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid Section */}
        <section id="features" className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="teal" dot size="sm">
                Architectural Integrity
              </Badge>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
                Built on rigorous engineering foundations
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
                Engineered from the ground up for software teams that value velocity, signal clarity, and security.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
              {/* Pillar 1 */}
              <div className="flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-7 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60 shadow-2xs" aria-hidden="true">
                  <Grid3X3 className="h-6 w-6" strokeWidth={2} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Precision Swiss Layout
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  A strict 4px/8px mathematical spatial grid, compact hairline borders, and zero ornamental gradients ensure information density remains high.
                </p>
              </div>

              {/* Pillar 2 */}
              <div id="architecture" className="flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-7 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 shadow-2xs" aria-hidden="true">
                  <Compass className="h-6 w-6" strokeWidth={2} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Nordic Calm Ergonomics
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Fatigue-free surfaces calibrated with deep slate backgrounds, muted accents, and comfortable typography designed for all-day focus.
                </p>
              </div>

              {/* Pillar 3 */}
              <div id="security" className="flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-7 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/60 shadow-2xs" aria-hidden="true">
                  <ShieldCheck className="h-6 w-6" strokeWidth={2} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Strict Tenant Isolation
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Every server action and route executes through authoritative composite tenant guards. No accidental data leakage between teams.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Minimal Precision Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo size="sm" showWordmark={true} />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              &copy; 2026 Polaris. All rights reserved.
            </span>
          </div>

          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              All systems operational
            </span>
            <Link
              href="/sign-in"
              className="text-xs text-slate-600 dark:text-slate-300 transition-colors hover:text-teal-700 dark:hover:text-teal-400"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="text-xs text-slate-600 dark:text-slate-300 transition-colors hover:text-teal-700 dark:hover:text-teal-400"
            >
              Create Account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
