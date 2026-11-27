"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { resetPasswordSchema, type ResetPasswordOutput } from "./validation";
import { performResetPassword, type ResetPasswordResult } from "./logic";
import { Badge } from "@/components/ui/badge";
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldAlert,
} from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isSubmittingRef = useRef(false);

  const isSubmitting = state.phase === "submitting";
  const fieldErrors: FieldErrors = state.phase === "error" ? state.fieldErrors : {};
  const globalError = state.phase === "error" ? state.globalError : undefined;

  if (!token) {
    return (
      <main
        id="main-content"
        className="flex w-full items-center justify-center py-6 sm:py-10"
      >
        <div className="relative w-full max-w-md rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 p-8 sm:p-10 shadow-lg shadow-slate-900/5 text-center">
          <div className="absolute top-0 inset-x-0 h-1 bg-red-500 rounded-t-2xl" />
          <div
            aria-hidden="true"
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 shadow-xs"
          >
            <ShieldAlert className="h-7 w-7" strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Invalid reset link
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            No password reset token was found in this link or the link has expired. Please request a new recovery link.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            <span>Request New Link</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
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
      className="flex w-full items-center justify-center py-6 sm:py-10"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 shadow-lg shadow-slate-900/5">
        <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-teal-500 via-teal-600 to-emerald-500 rounded-t-2xl" />

        {state.phase === "success" ? (
          <div
            role="status"
            aria-live="polite"
            className="text-center"
          >
            <div
              aria-hidden="true"
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-xs"
            >
              <CheckCircle2 className="h-7 w-7" strokeWidth={2.2} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Password updated!
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>
            <Link
              href="/sign-in"
              className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2"
            >
              <span>Sign In Now</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Badge variant="teal" dot size="sm">
                  Security
                </Badge>
                <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">Stage 1.3</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Set new password
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Choose a strong password with at least 8 characters.
              </p>
            </div>

            {globalError && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 p-3.5 text-sm text-red-700 dark:text-red-300"
              >
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" aria-hidden="true" />
                <span className="leading-snug">{globalError}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              noValidate
              aria-label="Reset password form"
              className="mt-6 flex flex-col gap-4.5"
            >
              {/* New Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="newPassword"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  New password <span aria-hidden="true" className="text-rose-600 dark:text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500 dark:text-slate-400 pointer-events-none" aria-hidden="true" />
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    disabled={isSubmitting}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.newPassword)}
                    aria-describedby={fieldErrors.newPassword ? "newPassword-error" : undefined}
                    className={[
                      "h-10 w-full pl-10 pr-12 rounded-lg border bg-white dark:bg-slate-800/80 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400",
                      "transition-all duration-150",
                      "focus:outline-none focus:ring-2 focus:ring-teal-700/25 focus:border-teal-700 dark:focus:ring-teal-400/25 dark:focus:border-teal-400",
                      "disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:opacity-60",
                      fieldErrors.newPassword
                        ? "border-red-500 ring-2 ring-red-500/20"
                        : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600",
                    ].join(" ")}
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide new password" : "Show new password"}
                    aria-pressed={showPassword}
                    className="absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                {fieldErrors.newPassword && (
                  <p id="newPassword-error" role="alert" className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {fieldErrors.newPassword}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Confirm new password <span aria-hidden="true" className="text-rose-600 dark:text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500 dark:text-slate-400 pointer-events-none" aria-hidden="true" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    disabled={isSubmitting}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    aria-describedby={fieldErrors.confirmPassword ? "confirmPassword-error" : undefined}
                    className={[
                      "h-10 w-full pl-10 pr-12 rounded-lg border bg-white dark:bg-slate-800/80 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400",
                      "transition-all duration-150",
                      "focus:outline-none focus:ring-2 focus:ring-teal-700/25 focus:border-teal-700 dark:focus:ring-teal-400/25 dark:focus:border-teal-400",
                      "disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:opacity-60",
                      fieldErrors.confirmPassword
                        ? "border-red-500 ring-2 ring-red-500/20"
                        : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600",
                    ].join(" ")}
                    placeholder="Repeat new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    aria-pressed={showConfirmPassword}
                    className="absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p id="confirmPassword-error" role="alert" className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                aria-disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-medium shadow-sm hover:shadow transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
                    <span>Updating password...</span>
                  </span>
                ) : (
                  <>
                    <span>Update password</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded-sm"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Back to Sign in</span>
              </Link>
            </div>
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
        <main
          id="main-content"
          className="flex w-full items-center justify-center py-16"
        >
          <div role="status" className="flex items-center justify-center">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-teal-700 border-t-transparent"
              aria-hidden="true"
            />
            <span className="sr-only">Loading reset password page…</span>
          </div>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
