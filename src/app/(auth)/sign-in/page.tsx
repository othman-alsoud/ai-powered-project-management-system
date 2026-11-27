"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { signInSchema, type SignInOutput } from "./validation";
import { performSignIn, resendVerificationEmail, type SignInResult } from "./logic";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
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
      className="flex w-full items-center justify-center py-6 sm:py-10"
    >
      {/* Precision Swiss Auth Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 shadow-lg shadow-slate-900/5">
        {/* Subtle top teal accent border */}
        <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-teal-500 via-teal-600 to-emerald-500 rounded-t-2xl" />

        {/* Card Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Badge variant="teal" dot size="sm">
              Authentication
            </Badge>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">Workspace 1.3</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome back
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sign in to your Polaris workspace to access your projects and tasks.
          </p>
        </div>

        {/* Global Error Alert */}
        {globalError && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 p-3.5 text-sm text-red-700 dark:text-red-300"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" aria-hidden="true" />
            <span className="leading-snug">{globalError}</span>
          </div>
        )}

        {/* Unverified Account Notice */}
        {state.phase === "unverified" && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 p-4 text-sm text-amber-900 dark:text-amber-200"
          >
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>Email verification required</span>
            </div>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Your email address has not been verified yet. Check your inbox for the verification link.
            </p>
            <div className="mt-3 pt-2.5 border-t border-amber-200/60 dark:border-amber-800/60">
              {state.resendState === "sent" ? (
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Verification link sent! Check your inbox.
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleResendVerification(state.email)}
                  disabled={state.resendState === "resending"}
                  className="inline-flex min-h-[44px] md:min-h-0 items-center text-xs font-semibold text-teal-700 dark:text-teal-400 underline hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded-sm disabled:opacity-50 cursor-pointer"
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
          className="mt-6 flex flex-col gap-4.5"
        >
          {/* Email Field */}
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
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                className={[
                  "h-10 w-full pl-10 pr-3.5 rounded-lg border bg-white dark:bg-slate-800/80 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400",
                  "transition-all duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-teal-700/25 focus:border-teal-700 dark:focus:ring-teal-400/25 dark:focus:border-teal-400",
                  "disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:opacity-60",
                  fieldErrors.email
                    ? "border-red-500 ring-2 ring-red-500/20"
                    : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600",
                ].join(" ")}
                placeholder="name@company.com"
              />
            </div>
            {fieldErrors.email && (
              <p id="email-error" role="alert" className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5">
                <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Password <span aria-hidden="true" className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded-sm"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500 dark:text-slate-400 pointer-events-none" aria-hidden="true" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
                className={[
                  "h-10 w-full pl-10 pr-12 rounded-lg border bg-white dark:bg-slate-800/80 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400",
                  "transition-all duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-teal-700/25 focus:border-teal-700 dark:focus:ring-teal-400/25 dark:focus:border-teal-400",
                  "disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:opacity-60",
                  fieldErrors.password
                    ? "border-red-500 ring-2 ring-red-500/20"
                    : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600",
                ].join(" ")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p id="password-error" role="alert" className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5">
                <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center gap-2.5 pt-0.5">
            <input
              id="rememberMe"
              name="rememberMe"
              type="checkbox"
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700 accent-teal-700 cursor-pointer"
            />
            <label htmlFor="rememberMe" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              Remember me for 30 days
            </label>
          </div>

          {/* Primary Submit Button */}
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
                Signing in...
              </span>
            ) : (
              <>
                <span>Sign in to Workspace</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-800" />
          <span className="absolute bg-white dark:bg-slate-900 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            or continue with
          </span>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
          className="inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-2xs hover:border-slate-400 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
          <span>Sign in with Google</span>
        </button>

        {/* Footer Link */}
        <p className="mt-6 text-center text-xs text-slate-600 dark:text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded-sm"
          >
            Create an account
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
        <main
          id="main-content"
          className="flex w-full items-center justify-center py-16"
        >
          <div role="status" className="flex items-center justify-center">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-teal-700 border-t-transparent"
              aria-hidden="true"
            />
            <span className="sr-only">Loading sign-in page…</span>
          </div>
        </main>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
