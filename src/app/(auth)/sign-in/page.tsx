"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { signInSchema, type SignInOutput } from "./validation";
import { performSignIn, resendVerificationEmail, type SignInResult } from "./logic";

type FieldErrors = {
  email?: string;
  password?: string;
};

type PageState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "error"; fieldErrors: FieldErrors; globalError?: string }
  | { phase: "unverified"; email: string; resendState?: "idle" | "resending" | "sent" | "failed" }
  | { phase: "success" };

function getField(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value === "string") return value;
  return null;
}

function SignInContent() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirectTo");
  // Prevent open redirect vulnerabilities: only allow relative paths starting with a single '/'
  const redirectTo = rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
    ? rawRedirect
    : "/";

  const [state, setState] = useState<PageState>({ phase: "idle" });
  const isSubmittingRef = useRef(false);

  const isSubmitting = state.phase === "submitting";
  const fieldErrors: FieldErrors = state.phase === "error" ? state.fieldErrors : {};
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
        password: getField(formData, "password") ?? "",
        rememberMe: formData.get("rememberMe") === "on",
      };

      const parseResult = signInSchema.safeParse(rawInput);

      if (!parseResult.success) {
        const errors: FieldErrors = {};
        for (const issue of parseResult.error.issues) {
          const field = issue.path[0] as keyof FieldErrors;
          if (field && !errors[field]) {
            errors[field] = issue.message;
          }
        }
        setState({ phase: "error", fieldErrors: errors });
        return;
      }

      const payload: SignInOutput = parseResult.data;
      const result: SignInResult = await performSignIn(payload, redirectTo);

      if (result.status === "success") {
        setState({ phase: "success" });
        window.location.href = redirectTo;
        return;
      }

      if (result.status === "unverified") {
        setState({ phase: "unverified", email: result.email, resendState: "idle" });
        return;
      }

      setState({
        phase: "error",
        fieldErrors: result.fieldErrors ?? {},
        globalError: result.globalError,
      });
    } catch {
      setState({
        phase: "error",
        fieldErrors: {},
        globalError: "Something went wrong. Please try again.",
      });
    } finally {
      isSubmittingRef.current = false;
    }
  }

  async function handleResendVerification(email: string) {
    if (state.phase !== "unverified" || state.resendState === "resending") return;

    setState({ phase: "unverified", email, resendState: "resending" });
    const res = await resendVerificationEmail(email);

    if (res.status === "success") {
      setState({ phase: "unverified", email, resendState: "sent" });
    } else {
      setState({ phase: "unverified", email, resendState: "failed" });
    }
  }

  async function handleGoogleSignIn() {
    if (isSubmittingRef.current) return;
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectTo,
      });
    } catch {
      setState({
        phase: "error",
        fieldErrors: {},
        globalError: "Failed to initiate Google sign-in. Please try again.",
      });
    }
  }

  return (
    <main
      id="main-content"
      className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16 md:py-24"
    >
      <div className="w-full max-w-sm">
        {/* Page heading */}
        <h1 className="text-xl font-semibold tracking-tight text-[--color-text-primary]">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-[--color-text-muted]">
          Sign in to your account to continue.
        </p>

        {/* Global error banner */}
        {globalError && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-[--color-border-destructive] bg-[--color-destructive-bg] px-3 py-2 text-sm text-[--color-text-destructive]"
          >
            {globalError}
          </div>
        )}

        {/* Unverified account notice */}
        {state.phase === "unverified" && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-[--color-border-warning] bg-[--color-warning-bg] p-3 text-sm text-[--color-text-warning]"
          >
            <p className="font-medium">Email verification required</p>
            <p className="mt-1 text-xs text-[--color-text-secondary]">
              Your email address has not been verified yet. Check your inbox for the verification link.
            </p>
            <div className="mt-3">
              {state.resendState === "sent" ? (
                <span className="text-xs font-medium text-[--color-accent-secondary]">
                  ✓ Verification link sent! Check your inbox.
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleResendVerification(state.email)}
                  disabled={state.resendState === "resending"}
                  className="inline-flex items-center text-xs font-semibold text-[--color-accent-primary] underline hover:text-[--color-accent-primary-hover] disabled:opacity-50"
                >
                  {state.resendState === "resending" ? "Sending link..." : "Resend verification email"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-label="Sign-in form"
          className="mt-6 flex flex-col gap-4"
        >
          {/* Email */}
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
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              className="h-9 w-full rounded-md border border-[--color-border-subtle] bg-[--color-bg-surface] px-3 text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted] transition-colors duration-150 focus:border-[--color-border-focus] focus:outline-none focus:ring-1 focus:ring-[--color-border-focus] disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="you@example.com"
            />
            {fieldErrors.email && (
              <p id="email-error" role="alert" className="text-xs text-[--color-text-destructive]">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-sm font-medium text-[--color-text-secondary]"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[--color-accent-primary] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isSubmitting}
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              className="h-9 w-full rounded-md border border-[--color-border-subtle] bg-[--color-bg-surface] px-3 text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted] transition-colors duration-150 focus:border-[--color-border-focus] focus:outline-none focus:ring-1 focus:ring-[--color-border-focus] disabled:cursor-not-allowed disabled:opacity-50"
            />
            {fieldErrors.password && (
              <p id="password-error" role="alert" className="text-xs text-[--color-text-destructive]">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2">
            <input
              id="rememberMe"
              name="rememberMe"
              type="checkbox"
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-[--color-border-subtle] text-[--color-accent-primary] focus:ring-[--color-accent-primary]"
            />
            <label htmlFor="rememberMe" className="text-xs text-[--color-text-secondary]">
              Remember me for 30 days
            </label>
          </div>

          {/* Submit button */}
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
                Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {/* Social divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full border-t border-[--color-border-subtle]" />
          <span className="absolute bg-[--color-bg-base] px-2 text-xs text-[--color-text-muted]">
            or continue with
          </span>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[--color-border-subtle] bg-[--color-bg-surface] px-4 text-sm font-medium text-[--color-text-primary] transition-colors duration-150 hover:bg-[--color-bg-surface-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          Sign in with Google
        </button>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-[--color-text-muted]">
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-[--color-accent-primary] transition-colors duration-150 hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--color-accent-primary] border-t-transparent" />
        </main>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
