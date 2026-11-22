import { authClient } from "@/lib/auth-client";
import type { ForgotPasswordOutput } from "./validation";

export type ForgotPasswordSent = {
  status: "sent";
};

export type ForgotPasswordFailure = {
  status: "failure";
  globalError: string;
};

export type ForgotPasswordResult = ForgotPasswordSent | ForgotPasswordFailure;

const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Initiates a password reset request.
 * Enforces strict anti-enumeration: always reports success if the request was processed,
 * preventing attackers from probing whether an email address exists.
 */
export async function performForgotPassword(
  payload: ForgotPasswordOutput
): Promise<ForgotPasswordResult> {
  try {
    const response = await authClient.requestPasswordReset({
      email: payload.email,
      redirectTo: "/reset-password",
    });

    const { error } = response as {
      error?: { code?: string; message?: string } | null;
    };

    if (error) {
      // Anti-enumeration: treat USER_NOT_FOUND as sent to prevent probing
      if (error.code === "USER_NOT_FOUND") {
        return { status: "sent" };
      }

      return {
        status: "failure",
        globalError: GENERIC_ERROR,
      };
    }

    return { status: "sent" };
  } catch {
    return {
      status: "failure",
      globalError: GENERIC_ERROR,
    };
  }
}
