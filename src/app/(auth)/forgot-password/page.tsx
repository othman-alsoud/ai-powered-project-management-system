"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { forgotPasswordSchema, type ForgotPasswordOutput } from "./validation";
import { performForgotPassword, type ForgotPasswordResult } from "./logic";

type PageState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "error"; emailError?: string; globalError?: string }
  | { phase: "sent" };

function getField(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value === "string") return value;
  return null;
}

export default function ForgotPasswordPage() {
  const [state, setState] = useState<PageState>({ phase: "idle" });
  const isSubmittingRef = useRef(false);

  const isSubmitting = state.phase === "submitting";
  const emailError = state.phase === "error" ? state.emailError : undefined;
  const globalError = state.phase === "error" ? state.globalError : undefined;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setState({ phase: "submitting" });

    try {
      const formData = new FormData(event.currentTarget);
      const rawInput = {
        email: getField(formData, "email") ?? "",
      };

      const parseResult = forgotPasswordSchema.safeParse(rawInput);

      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        setState({ phase: "error", emailError: issue?.message });
        return;
      }

      const payload: ForgotPasswordOutput = parseResult.data;
      const result: ForgotPasswordResult = await performForgotPassword(payload);

      if (result.status === "sent") {
        setState({ phase: "sent" });
        return;
      }

      setState({
        phase: "error",
        globalError: result.globalError,
      });
    } catch {
      setState({
        phase: "error",
        globalError: "Something went wrong. Please try again.",
      });
    } finally {
      isSubmittingRef.current = false;
    }
  }

  return (
    <main
      id="main-content"
      className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16 md:py-24"
    >
      <div className="w-full max-w-sm">
        {state.phase === "sent" ? (
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
                  d="M2.5 5.5l7.5 5 7.5-5M3 15h14a1 1 0 001-1V6a1 1 0 00-1-1H3a1 1 0 00-1 1v8a1 1 0 001 1z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-[--color-text-primary]">
              Check your inbox
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[--color-text-secondary]">
              If an account with that email address exists, we have sent a link to reset your password.
            </p>
            <Link
              href="/sign-in"
              className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-md bg-[--color-accent-primary] px-4 text-sm font-medium text-[--color-text-on-accent] transition-colors duration-150 hover:bg-[--color-accent-primary-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-2"
            >
              Return to Sign In
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-[--color-text-primary]">
              Reset password
            </h1>
            <p className="mt-1 text-sm text-[--color-text-muted]">
              Enter your email address and we&apos;ll send you a recovery link.
            </p>

            {globalError && (
              <div
                role="alert"
                className="mt-4 rounded-md border border-[--color-border-destructive] bg-[--color-destructive-bg] px-3 py-2 text-sm text-[--color-text-destructive]"
              >
                {globalError}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              noValidate
              aria-label="Forgot password form"
              className="mt-6 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-[--color-text-secondary]"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isSubmitting}
                  aria-required="true"
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? "email-error" : undefined}
                  className="h-9 w-full rounded-md border border-[--color-border-subtle] bg-[--color-bg-surface] px-3 text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted] transition-colors duration-150 focus:border-[--color-border-focus] focus:outline-none focus:ring-1 focus:ring-[--color-border-focus] disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="you@example.com"
                />
                {emailError && (
                  <p id="email-error" role="alert" className="text-xs text-[--color-text-destructive]">
                    {emailError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                aria-disabled={isSubmitting}
                className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-md bg-[--color-accent-primary] px-4 text-sm font-medium text-[--color-text-on-accent] transition-colors duration-150 hover:bg-[--color-accent-primary-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Sending link...
                  </span>
                ) : (
                  "Send reset link"
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[--color-text-muted]">
              Remember your password?{" "}
              <Link
                href="/sign-in"
                className="font-medium text-[--color-accent-primary] transition-colors duration-150 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
