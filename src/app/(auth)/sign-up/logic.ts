import { authClient } from "@/lib/auth-client";
import type { SignUpOutput } from "./validation";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Returned when sign-up succeeds. hasSession is true if Better Auth issued a session token. */
export type SignUpSuccess = {
  status: "success";
  hasSession: boolean;
};

/** Returned when sign-up fails for any reason. */
export type SignUpFailure = {
  status: "failure";
  fieldErrors?: Record<string, string>;
  globalError?: string;
};

export type SignUpResult = SignUpSuccess | SignUpFailure;

// ---------------------------------------------------------------------------
// Verified Better Auth error codes (v1.7.25)
// Source: node_modules/better-auth/dist/api/routes/sign-up.mjs
//         node_modules/better-auth/dist/utils/password.mjs
// ---------------------------------------------------------------------------

const EMAIL_FIELD_CODES = new Set([
  "INVALID_EMAIL",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
]);

const PASSWORD_FIELD_CODES = new Set([
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
]);

// User-facing messages for each verified error code.
const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL: "Enter a valid email address.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "An account with this email already exists. Please use a different email.",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
  PASSWORD_TOO_LONG: "Password is too long.",
};

const GENERIC_ERROR = "Something went wrong. Please try again.";

// ---------------------------------------------------------------------------
// Core logic helper
// ---------------------------------------------------------------------------

/**
 * Calls the Better Auth sign-up endpoint and returns a discriminated-union
 * result. This function never throws — all exceptions are caught and
 * converted into a failure result.
 *
 * IMPORTANT: This function does NOT log passwords, tokens, or other
 * sensitive data.
 */
export async function performSignUp(
  payload: SignUpOutput,
): Promise<SignUpResult> {
  try {
    const response = await authClient.signUp.email({
      name: payload.name,
      email: payload.email,
      password: payload.password,
    });

    // Better Auth returns { data, error } via @better-fetch.
    // The union is Data<T> | Error — cast to the common shape we need.
    const { data, error } = response as {
      data: { token?: string | null } | null;
      error: { code?: string; message?: string } | null;
    };

    // --- Error path ---
    if (error !== null && error !== undefined) {
      const code = error.code ?? "";

      if (EMAIL_FIELD_CODES.has(code)) {
        return {
          status: "failure",
          fieldErrors: { email: ERROR_MESSAGES[code] ?? GENERIC_ERROR },
        };
      }

      if (PASSWORD_FIELD_CODES.has(code)) {
        return {
          status: "failure",
          fieldErrors: { password: ERROR_MESSAGES[code] ?? GENERIC_ERROR },
        };
      }

      // Unknown API error — do not expose internal details.
      return { status: "failure", globalError: GENERIC_ERROR };
    }

    // --- Unexpected empty response ---
    if (data === null || data === undefined) {
      return { status: "failure", globalError: GENERIC_ERROR };
    }

    // --- Success path ---
    // Store only a boolean — never expose the raw token.
    return {
      status: "success",
      hasSession: Boolean(data.token),
    };
  } catch {
    // Unexpected exception (network failure, etc.). Safe generic message.
    return { status: "failure", globalError: GENERIC_ERROR };
  }
}
