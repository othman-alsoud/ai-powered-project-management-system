import { authClient } from "@/lib/auth-client";
import type { ResetPasswordOutput } from "./validation";

export type ResetPasswordSuccess = {
  status: "success";
};

export type ResetPasswordFailure = {
  status: "failure";
  globalError: string;
};

export type ResetPasswordResult = ResetPasswordSuccess | ResetPasswordFailure;

const GENERIC_ERROR = "Something went wrong. Please try again.";
const INVALID_TOKEN_ERROR = "This reset link is invalid or has expired.";

/**
 * Resets a user's password using the provided verification token.
 * Tokens and passwords are never logged or exposed.
 */
export async function performResetPassword(
  payload: ResetPasswordOutput,
  token: string
): Promise<ResetPasswordResult> {
  try {
    const response = await authClient.resetPassword({
      newPassword: payload.newPassword,
      token,
    });

    const { error } = response as {
      error?: { code?: string; message?: string } | null;
    };

    if (error) {
      if (error.code === "INVALID_TOKEN") {
        return {
          status: "failure",
          globalError: INVALID_TOKEN_ERROR,
        };
      }

      return {
        status: "failure",
        globalError: GENERIC_ERROR,
      };
    }

    return { status: "success" };
  } catch {
    return {
      status: "failure",
      globalError: GENERIC_ERROR,
    };
  }
}
