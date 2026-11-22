"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

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
      className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16 md:py-24"
    >
      <div className="w-full max-w-sm">
        {state.phase === "verifying" && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center rounded-lg border border-[--color-border-subtle] bg-[--color-bg-surface] p-8 text-center"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[--color-accent-primary] border-t-transparent" />
            <h1 className="mt-4 text-lg font-semibold text-[--color-text-primary]">
              Verifying your email
            </h1>
            <p className="mt-1 text-sm text-[--color-text-muted]">
              Please wait while we confirm your email address...
            </p>
          </div>
        )}

        {state.phase === "success" && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-[--color-border-subtle] bg-[--color-bg-surface] p-8 text-center"
          >
            <div
              aria-hidden="true"
              className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[--color-accent-secondary]/15 text-[--color-accent-secondary]"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 10l4.5 4.5L16 6"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-[--color-text-primary]">
              Email verified!
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[--color-text-secondary]">
              Your email address has been successfully verified. You can now access your account.
            </p>
            <Link
              href="/sign-in"
              className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-md bg-[--color-accent-primary] px-4 text-sm font-medium text-[--color-text-on-accent] transition-colors duration-150 hover:bg-[--color-accent-primary-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-2"
            >
              Continue to Sign In
            </Link>
          </div>
        )}

        {(state.phase === "no-token" || state.phase === "error") && (
          <div
            role="alert"
            className="rounded-lg border border-[--color-border-destructive] bg-[--color-bg-surface] p-8 text-center"
          >
            <div
              aria-hidden="true"
              className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[--color-destructive-bg] text-[--color-text-destructive]"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M10 6v5m0 3h.01M10 18a8 8 0 100-16 8 8 0 000 16z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-[--color-text-primary]">
              Verification link invalid
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[--color-text-secondary]">
              {state.phase === "no-token"
                ? "No verification token was provided in the link."
                : state.message}
            </p>
            <p className="mt-4 text-xs text-[--color-text-muted]">
              Need a new link? You can request one by attempting to sign in with your email.
            </p>
            <Link
              href="/sign-in"
              className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-md border border-[--color-border-subtle] bg-[--color-bg-surface] px-4 text-sm font-medium text-[--color-text-primary] transition-colors duration-150 hover:bg-[--color-bg-surface-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-2"
            >
              Return to Sign In
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
        <main className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--color-accent-primary] border-t-transparent" />
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
