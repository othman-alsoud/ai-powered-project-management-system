"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { resetPasswordSchema, type ResetPasswordOutput } from "./validation";
import { performResetPassword, type ResetPasswordResult } from "./logic";

type FieldErrors = {
  newPassword?: string;
  confirmPassword?: string;
};

type PageState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "error"; fieldErrors: FieldErrors; globalError?: string }
  | { phase: "success" };

function getField(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value === "string") return value;
  return null;
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<PageState>({ phase: "idle" });
  const isSubmittingRef = useRef(false);

  const isSubmitting = state.phase === "submitting";
  const fieldErrors: FieldErrors = state.phase === "error" ? state.fieldErrors : {};
  const globalError = state.phase === "error" ? state.globalError : undefined;

  if (!token) {
    return (
      <main
        id="main-content"
        className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16 md:py-24"
      >
        <div className="w-full max-w-sm">
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
              Invalid reset link
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[--color-text-secondary]">
              No password reset token was found in this link. Please request a new link.
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-md bg-[--color-accent-primary] px-4 text-sm font-medium text-[--color-text-on-accent] transition-colors duration-150 hover:bg-[--color-accent-primary-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-2"
            >
              Request New Link
            </Link>
          </div>
        </div>
      </main>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingRef.current || !token) return;

    isSubmittingRef.current = true;
    setState({ phase: "submitting" });

    try {
      const formData = new FormData(event.currentTarget);
      const rawInput = {
        newPassword: getField(formData, "newPassword") ?? "",
        confirmPassword: getField(formData, "confirmPassword") ?? "",
      };

      const parseResult = resetPasswordSchema.safeParse(rawInput);

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

      const payload: ResetPasswordOutput = parseResult.data;
      const result: ResetPasswordResult = await performResetPassword(payload, token);

      if (result.status === "success") {
        setState({ phase: "success" });
        return;
      }

      setState({
        phase: "error",
        fieldErrors: {},
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

  return (
    <main
      id="main-content"
      className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16 md:py-24"
    >
      <div className="w-full max-w-sm">
        {state.phase === "success" ? (
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
              Password updated!
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[--color-text-secondary]">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>
            <Link
              href="/sign-in"
              className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-md bg-[--color-accent-primary] px-4 text-sm font-medium text-[--color-text-on-accent] transition-colors duration-150 hover:bg-[--color-accent-primary-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-2"
            >
              Sign In Now
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-[--color-text-primary]">
              Set new password
            </h1>
            <p className="mt-1 text-sm text-[--color-text-muted]">
              Choose a strong password with at least 8 characters.
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
              aria-label="Reset password form"
              className="mt-6 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="newPassword"
                  className="text-sm font-medium text-[--color-text-secondary]"
                >
                  New password
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.newPassword)}
                  aria-describedby={fieldErrors.newPassword ? "newPassword-error" : undefined}
                  className="h-9 w-full rounded-md border border-[--color-border-subtle] bg-[--color-bg-surface] px-3 text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted] transition-colors duration-150 focus:border-[--color-border-focus] focus:outline-none focus:ring-1 focus:ring-[--color-border-focus] disabled:cursor-not-allowed disabled:opacity-50"
                />
                {fieldErrors.newPassword && (
                  <p id="newPassword-error" role="alert" className="text-xs text-[--color-text-destructive]">
                    {fieldErrors.newPassword}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-[--color-text-secondary]"
                >
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  aria-describedby={fieldErrors.confirmPassword ? "confirmPassword-error" : undefined}
                  className="h-9 w-full rounded-md border border-[--color-border-subtle] bg-[--color-bg-surface] px-3 text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted] transition-colors duration-150 focus:border-[--color-border-focus] focus:outline-none focus:ring-1 focus:ring-[--color-border-focus] disabled:cursor-not-allowed disabled:opacity-50"
                />
                {fieldErrors.confirmPassword && (
                  <p id="confirmPassword-error" role="alert" className="text-xs text-[--color-text-destructive]">
                    {fieldErrors.confirmPassword}
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
                    Updating password...
                  </span>
                ) : (
                  "Reset password"
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--color-accent-primary] border-t-transparent" />
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
