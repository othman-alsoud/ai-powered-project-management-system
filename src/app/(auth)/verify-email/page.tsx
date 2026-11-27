"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

type VerifyState =
  | { phase: "no-token" }
  | { phase: "verifying" }
  | { phase: "success" }
  | { phase: "error"; message: string };

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<VerifyState>(() =>
    token ? { phase: "verifying" } : { phase: "no-token" }
  );

  const hasExecutedRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (hasExecutedRef.current) return;
    hasExecutedRef.current = true;

    async function verify() {
      try {
        const response = await authClient.verifyEmail({
          query: { token: token as string },
        });

        const { error } = response as {
          error?: { code?: string; message?: string } | null;
        };

        if (error) {
          setState({
            phase: "error",
            message:
              "This verification link is invalid, has expired, or has already been used.",
          });
          return;
        }

        setState({ phase: "success" });
      } catch {
        setState({
          phase: "error",
          message:
            "An unexpected error occurred during verification. Please try again.",
        });
      }
    }

    verify();
  }, [token]);

  return (
    <main
      id="main-content"
      className="flex w-full items-center justify-center py-6 sm:py-10"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 shadow-lg shadow-slate-900/5">
        <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-teal-500 via-teal-600 to-emerald-500 rounded-t-2xl" />

        {state.phase === "verifying" && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800 shadow-xs">
              <Loader2 className="h-7 w-7 animate-spin" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Verifying your email
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Please wait while we confirm your email credentials with the authorization server...
            </p>
          </div>
        )}

        {state.phase === "success" && (
          <div
            role="status"
            aria-live="polite"
            className="text-center"
          >
            <div
              aria-hidden="true"
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-xs"
            >
              <CheckCircle2 className="h-7 w-7" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Email verified!
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Your email address has been successfully verified. You can now access your team workspace.
            </p>
            <Link
              href="/sign-in"
              className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2"
            >
              <span>Continue to Sign In</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        {(state.phase === "no-token" || state.phase === "error") && (
          <div
            role="alert"
            className="text-center"
          >
            <div
              aria-hidden="true"
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 shadow-xs"
            >
              <AlertTriangle className="h-7 w-7" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Verification link invalid
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {state.phase === "no-token"
                ? "No verification token was provided in the link."
                : state.message}
            </p>
            <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">
              Need a new link? You can request one by attempting to sign in with your email.
            </p>
            <Link
              href="/sign-in"
              className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-medium shadow-2xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2"
            >
              <span>Return to Sign In</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main
          id="main-content"
          className="flex w-full items-center justify-center py-16"
        >
          <div role="status" className="flex items-center justify-center">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-teal-700 border-t-transparent"
              aria-hidden="true"
            />
            <span className="sr-only">Verifying email…</span>
          </div>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
