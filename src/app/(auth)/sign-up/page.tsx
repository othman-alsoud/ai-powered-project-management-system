"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { signUpSchema } from "./validation";
import { performSignUp, type SignUpResult } from "./logic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely extracts a string value from FormData.
 * Returns `null` if the field is missing or not a string — never the literal
 * string "null" that `String(formData.get(...))` would produce.
 */
function getField(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value === "string") return value;
  return null;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SignUpPage() {
  const [state, setState] = useState<PageState>({ phase: "idle" });
  // Prevents duplicate submissions while a request is in-flight.
  // This guard cannot be covered by automated tests in the current Node-only
  // Vitest environment (no DOM), but is required for runtime correctness.
  const isSubmittingRef = useRef(false);

  const isLoading = state.phase === "loading";
  const fieldErrors: FieldErrors =
    state.phase === "error" ? state.fieldErrors : {};
  const globalError =
    state.phase === "error" ? state.globalError : undefined;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Duplicate-submission guard
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

      // Client-side validation using Zod schema (also normalises/trims fields)
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

      // Perform sign-up with normalised payload
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
      // Unexpected UI-level exception — show safe generic message
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
      <main className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16 md:py-24">
        <div
          className="w-full max-w-sm"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-lg border border-[--color-border-subtle] bg-[--color-bg-surface] p-8">
            {/* Success icon */}
            <div
              aria-hidden="true"
              className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[--color-accent-secondary]/15 text-[--color-accent-secondary]"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                focusable="false"
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
              Account created
            </h1>

            {state.hasSession ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-[--color-text-secondary]">
                  Your account is ready. You are now signed in.
                </p>
                <Link
                  href="/"
                  className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-md bg-[--color-accent-primary] px-4 text-sm font-medium text-[--color-text-on-accent] transition-colors duration-150 hover:bg-[--color-accent-primary-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-2"
                >
                  Go to Home
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-[--color-text-secondary]">
                Your account has been created. Sign-in will be available in an
                upcoming step — check back soon.
              </p>
            )}
          </div>
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
      className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16 md:py-24"
    >
      <div className="w-full max-w-sm">
        {/* Page heading */}
        <h1 className="text-xl font-semibold tracking-tight text-[--color-text-primary]">
          Create an account
        </h1>
        <p className="mt-1 text-sm text-[--color-text-muted]">
          Fill in the details below to get started.
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

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-label="Sign-up form"
          className="mt-6 flex flex-col gap-4"
        >
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="name"
              className="text-sm font-medium text-[--color-text-secondary]"
            >
              Full name{" "}
              <span aria-hidden="true" className="text-[--color-priority-high]">
                *
              </span>
            </label>
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
                "h-9 w-full rounded-md border bg-[--color-bg-surface] px-3 text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted]",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-0 focus-visible:border-transparent",
                "disabled:cursor-not-allowed disabled:bg-[--color-bg-muted] disabled:text-[--color-text-disabled] disabled:opacity-60",
                fieldErrors.name
                  ? "border-[--color-border-destructive] ring-2 ring-[--color-destructive]/20"
                  : "border-[--color-border-default]",
              ].join(" ")}
              placeholder="Alice Example"
            />
            {fieldErrors.name && (
              <p
                id="name-error"
                role="alert"
                className="text-xs text-[--color-text-destructive]"
              >
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="email"
              className="text-sm font-medium text-[--color-text-secondary]"
            >
              Email address{" "}
              <span aria-hidden="true" className="text-[--color-priority-high]">
                *
              </span>
            </label>
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
                "h-9 w-full rounded-md border bg-[--color-bg-surface] px-3 text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted]",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-0 focus-visible:border-transparent",
                "disabled:cursor-not-allowed disabled:bg-[--color-bg-muted] disabled:text-[--color-text-disabled] disabled:opacity-60",
                fieldErrors.email
                  ? "border-[--color-border-destructive] ring-2 ring-[--color-destructive]/20"
                  : "border-[--color-border-default]",
              ].join(" ")}
              placeholder="alice@example.com"
            />
            {fieldErrors.email && (
              <p
                id="email-error"
                role="alert"
                className="text-xs text-[--color-text-destructive]"
              >
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="password"
              className="text-sm font-medium text-[--color-text-secondary]"
            >
              Password{" "}
              <span aria-hidden="true" className="text-[--color-priority-high]">
                *
              </span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
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
                "h-9 w-full rounded-md border bg-[--color-bg-surface] px-3 text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted]",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-0 focus-visible:border-transparent",
                "disabled:cursor-not-allowed disabled:bg-[--color-bg-muted] disabled:text-[--color-text-disabled] disabled:opacity-60",
                fieldErrors.password
                  ? "border-[--color-border-destructive] ring-2 ring-[--color-destructive]/20"
                  : "border-[--color-border-default]",
              ].join(" ")}
              placeholder="At least 8 characters"
            />
            {fieldErrors.password ? (
              <p
                id="password-error"
                role="alert"
                className="text-xs text-[--color-text-destructive]"
              >
                {fieldErrors.password}
              </p>
            ) : (
              <p
                id="password-hint"
                className="text-xs text-[--color-text-muted]"
              >
                Minimum 8 characters.
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
            className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[--color-accent-primary] px-4 text-sm font-medium text-[--color-text-on-accent] transition-colors duration-150 hover:bg-[--color-accent-primary-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? (
              <>
                {/* Accessible spinner */}
                <svg
                  aria-hidden="true"
                  focusable="false"
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                <span>Creating account…</span>
              </>
            ) : (
              "Create account"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
