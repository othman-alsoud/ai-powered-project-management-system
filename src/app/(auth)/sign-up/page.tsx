"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { signUpSchema } from "./validation";
import { performSignUp, type SignUpResult } from "./logic";
import { Badge } from "@/components/ui/badge";
import {
  User,
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
  name?: string;
  email?: string;
  password?: string;
};

type PageState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; fieldErrors: FieldErrors; globalError?: string }
  | { phase: "success"; hasSession: boolean };

function getField(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value === "string") return value;
  return null;
}

export default function SignUpPage() {
  const [state, setState] = useState<PageState>({ phase: "idle" });
  const [showPassword, setShowPassword] = useState(false);
  const isSubmittingRef = useRef(false);

  const isLoading = state.phase === "loading";
  const fieldErrors: FieldErrors =
    state.phase === "error" ? state.fieldErrors : {};
  const globalError =
    state.phase === "error" ? state.globalError : undefined;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setState({ phase: "loading" });

    try {
      const formData = new FormData(event.currentTarget);

      const rawPayload = {
        name: getField(formData, "name"),
        email: getField(formData, "email"),
        password: getField(formData, "password"),
      };

      const parsed = signUpSchema.safeParse(rawPayload);

      if (!parsed.success) {
        const flat = parsed.error.flatten().fieldErrors;
        setState({
          phase: "error",
          fieldErrors: {
            name: flat.name?.[0],
            email: flat.email?.[0],
            password: flat.password?.[0],
          },
        });
        return;
      }

      const result: SignUpResult = await performSignUp(parsed.data);

      if (result.status === "success") {
        setState({ phase: "success", hasSession: result.hasSession });
      } else {
        setState({
          phase: "error",
          fieldErrors: result.fieldErrors ?? {},
          globalError: result.globalError,
        });
      }
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

  // -------------------------------------------------------------------------
  // Success panel
  // -------------------------------------------------------------------------

  if (state.phase === "success") {
    return (
      <main
        id="main-content"
        className="flex w-full items-center justify-center py-6 sm:py-10"
      >
        <div
          className="relative w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 shadow-lg shadow-slate-900/5 text-center"
          role="status"
          aria-live="polite"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-emerald-500 via-teal-500 to-teal-600 rounded-t-2xl" />

          {/* Success icon */}
          <div
            aria-hidden="true"
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-xs"
          >
            <CheckCircle2 className="h-7 w-7" strokeWidth={2.2} aria-hidden="true" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Account created
          </h1>

          {state.hasSession ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Your account is ready. You are now signed in to Polaris.
              </p>
              <Link
                href="/teams"
                className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2"
              >
                <span>Go to Workspace</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Your account has been created. Please sign in to access your workspace.
              </p>
              <Link
                href="/sign-in"
                className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2"
              >
                <span>Sign in now</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Sign-up form
  // -------------------------------------------------------------------------

  return (
    <main
      id="main-content"
      className="flex w-full items-center justify-center py-6 sm:py-10"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 shadow-lg shadow-slate-900/5">
        {/* Subtle top teal accent border */}
        <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-teal-500 via-teal-600 to-emerald-500 rounded-t-2xl" />

        {/* Page heading */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Badge variant="teal" dot size="sm">
              Registration
            </Badge>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">Stage 1.3</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Create an account
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Start organizing your projects and tasks with Swiss precision.
          </p>
        </div>

        {/* Global error alert */}
        {globalError && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 p-3.5 text-sm text-red-700 dark:text-red-300"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" aria-hidden="true" />
            <span className="leading-snug">{globalError}</span>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-label="Sign-up form"
          className="mt-6 flex flex-col gap-4.5"
        >
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="name"
              className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Full name <span aria-hidden="true" className="text-rose-600 dark:text-rose-400">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-500 dark:text-slate-400 pointer-events-none" aria-hidden="true" />
              <input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="name"
                autoCapitalize="words"
                spellCheck={false}
                disabled={isLoading}
                aria-required="true"
                aria-invalid={!!fieldErrors.name}
                aria-describedby={fieldErrors.name ? "name-error" : undefined}
                className={[
                  "h-10 w-full pl-10 pr-3.5 rounded-lg border bg-white dark:bg-slate-800/80 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400",
                  "transition-all duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-teal-700/25 focus:border-teal-700 dark:focus:ring-teal-400/25 dark:focus:border-teal-400",
                  "disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:opacity-60",
                  fieldErrors.name
                    ? "border-red-500 ring-2 ring-red-500/20"
                    : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600",
                ].join(" ")}
                placeholder="Alice Example"
              />
            </div>
            {fieldErrors.name && (
              <p
                id="name-error"
                role="alert"
                className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5"
              >
                <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Email */}
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
                required
                autoComplete="email"
                spellCheck={false}
                disabled={isLoading}
                aria-required="true"
                aria-invalid={!!fieldErrors.email}
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
                placeholder="alice@example.com"
              />
            </div>
            {fieldErrors.email && (
              <p
                id="email-error"
                role="alert"
                className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5"
              >
                <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Password <span aria-hidden="true" className="text-rose-600 dark:text-rose-400">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500 dark:text-slate-400 pointer-events-none" aria-hidden="true" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                disabled={isLoading}
                aria-required="true"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={
                  fieldErrors.password
                    ? "password-error"
                    : "password-hint"
                }
                className={[
                  "h-10 w-full pl-10 pr-12 rounded-lg border bg-white dark:bg-slate-800/80 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400",
                  "transition-all duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-teal-700/25 focus:border-teal-700 dark:focus:ring-teal-400/25 dark:focus:border-teal-400",
                  "disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:opacity-60",
                  fieldErrors.password
                    ? "border-red-500 ring-2 ring-red-500/20"
                    : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600",
                ].join(" ")}
                placeholder="At least 8 characters"
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
            {fieldErrors.password ? (
              <p
                id="password-error"
                role="alert"
                className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5"
              >
                <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                {fieldErrors.password}
              </p>
            ) : (
              <p
                id="password-hint"
                className="text-xs text-slate-600 dark:text-slate-400"
              >
                Minimum 8 characters. Must contain letters and numbers.
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
            className="mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-medium shadow-sm hover:shadow transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
                <span>Creating account…</span>
              </span>
            ) : (
              <>
                <span>Create account</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <p className="mt-6 text-center text-xs text-slate-600 dark:text-slate-400">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded-sm"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
