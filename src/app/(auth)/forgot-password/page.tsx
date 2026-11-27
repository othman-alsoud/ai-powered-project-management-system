"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { forgotPasswordSchema, type ForgotPasswordOutput } from "./validation";
import { performForgotPassword, type ForgotPasswordResult } from "./logic";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
} from "lucide-react";

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
      className="flex w-full items-center justify-center py-6 sm:py-10"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 shadow-lg shadow-slate-900/5">
        <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-teal-500 via-teal-600 to-emerald-500 rounded-t-2xl" />

        {state.phase === "sent" ? (
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
              Check your inbox
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              If an account with that email address exists, we have dispatched a secure password reset link.
            </p>
            <Link
              href="/sign-in"
              className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Return to Sign In</span>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Badge variant="teal" dot size="sm">
                  Recovery
                </Badge>
                <KeyRound className="h-4 w-4 text-slate-600 dark:text-slate-400" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Reset password
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Enter your verified email address and we&apos;ll send you a recovery link.
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
              aria-label="Forgot password form"
              className="mt-6 flex flex-col gap-4.5"
            >
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Email address <span aria-hidden="true" className="text-rose-600 dark:text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500 dark:text-slate-400 pointer-events-none" aria-hidden="true" />
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
                    className={[
                      "h-10 w-full pl-10 pr-3.5 rounded-lg border bg-white dark:bg-slate-800/80 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400",
                      "transition-all duration-150",
                      "focus:outline-none focus:ring-2 focus:ring-teal-700/25 focus:border-teal-700 dark:focus:ring-teal-400/25 dark:focus:border-teal-400",
                      "disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:opacity-60",
                      emailError
                        ? "border-red-500 ring-2 ring-red-500/20"
                        : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600",
                    ].join(" ")}
                    placeholder="name@company.com"
                  />
                </div>
                {emailError && (
                  <p id="email-error" role="alert" className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {emailError}
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
                    <span>Sending recovery link...</span>
                  </span>
                ) : (
                  <>
                    <span>Send recovery link</span>
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
