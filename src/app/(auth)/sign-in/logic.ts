import { authClient } from "@/lib/auth-client";
import type { SignInOutput } from "./validation";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type SignInSuccess = {
  status: "success";
  hasSession: boolean;
};

export type SignInUnverified = {
  status: "unverified";
  email: string;
};

export type SignInFailure = {
  status: "failure";
  fieldErrors?: Record<string, string>;
  globalError?: string;
};

export type SignInResult = SignInSuccess | SignInUnverified | SignInFailure;

const GENERIC_ERROR = "Something went wrong. Please try again.";
const INVALID_CREDENTIALS_MSG = "Invalid email or password.";

// ---------------------------------------------------------------------------
// Core logic helper
// ---------------------------------------------------------------------------

/**
 * Executes email & password sign-in against Better Auth.
 * Never throws — all errors and exceptions are mapped to the discriminated union.
 * Tokens and passwords are never logged or stored.
 */
export async function performSignIn(
  payload: SignInOutput,
  callbackURL?: string
): Promise<SignInResult> {
  try {
    const response = await authClient.signIn.email({
      email: payload.email,
      password: payload.password,
      rememberMe: payload.rememberMe,
      callbackURL,
    });

    const { data, error } = response as {
      data: { token?: string | null } | null;
      error: { code?: string; message?: string } | null;
    };

    if (error !== null && error !== undefined) {
      const code = error.code ?? "";

      if (code === "EMAIL_NOT_VERIFIED") {
        return {
          status: "unverified",
          email: payload.email,
        };
      }

      if (code === "INVALID_EMAIL_OR_PASSWORD" || code === "USER_NOT_FOUND") {
        return {
          status: "failure",
          globalError: INVALID_CREDENTIALS_MSG,
        };
      }

      return {
        status: "failure",
        globalError: GENERIC_ERROR,
      };
    }

    if (data === null || data === undefined) {
      return {
        status: "failure",
        globalError: GENERIC_ERROR,
      };
    }

    return {
      status: "success",
      hasSession: Boolean(data.token),
    };
  } catch {
    return {
      status: "failure",
      globalError: GENERIC_ERROR,
    };
  }
}

/**
 * Requests a new verification email for an unverified account.
 */
export async function resendVerificationEmail(
  email: string
): Promise<{ status: "success" } | { status: "failure"; globalError?: string }> {
  try {
    const response = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/sign-in",
    });

    const { error } = response as {
      error: { code?: string; message?: string } | null;
    };

    if (error) {
      return {
        status: "failure",
        globalError: "Failed to send verification email. Please try again later.",
      };
    }

    return { status: "success" };
  } catch {
    return {
      status: "failure",
      globalError: "Failed to send verification email. Please try again later.",
    };
  }
}
