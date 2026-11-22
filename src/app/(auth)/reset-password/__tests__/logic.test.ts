import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    resetPassword: vi.fn(),
  },
}));

import { authClient } from "@/lib/auth-client";
import { performResetPassword, type ResetPasswordResult } from "../logic";
import type { ResetPasswordOutput } from "../validation";

describe("performResetPassword", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const payload: ResetPasswordOutput = {
    newPassword: "newpassword123",
    confirmPassword: "newpassword123",
  };
  const token = "valid-reset-token-abc";

  it("returns success status when reset succeeds", async () => {
    vi.mocked(authClient.resetPassword).mockResolvedValueOnce({
      data: { status: true },
      error: null,
    } as unknown as Awaited<ReturnType<typeof authClient.resetPassword>>);

    const result = await performResetPassword(payload, token);
    expect(result).toEqual<ResetPasswordResult>({ status: "success" });
    expect(authClient.resetPassword).toHaveBeenCalledWith({
      newPassword: "newpassword123",
      token: "valid-reset-token-abc",
    });
  });

  it("handles INVALID_TOKEN with an expired/invalid message", async () => {
    vi.mocked(authClient.resetPassword).mockResolvedValueOnce({
      data: null,
      error: { code: "INVALID_TOKEN", message: "Token expired" },
    } as unknown as Awaited<ReturnType<typeof authClient.resetPassword>>);

    const result = await performResetPassword(payload, token);
    expect(result).toEqual<ResetPasswordResult>({
      status: "failure",
      globalError: "This reset link is invalid or has expired.",
    });
  });

  it("handles generic server errors", async () => {
    vi.mocked(authClient.resetPassword).mockResolvedValueOnce({
      data: null,
      error: { code: "INTERNAL_SERVER_ERROR", message: "DB failure" },
    } as unknown as Awaited<ReturnType<typeof authClient.resetPassword>>);

    const result = await performResetPassword(payload, token);
    expect(result).toEqual<ResetPasswordResult>({
      status: "failure",
      globalError: "Something went wrong. Please try again.",
    });
  });

  it("catches exceptions without throwing", async () => {
    vi.mocked(authClient.resetPassword).mockRejectedValueOnce(
      new Error("Network disconnect")
    );

    const result = await performResetPassword(payload, token);
    expect(result).toEqual<ResetPasswordResult>({
      status: "failure",
      globalError: "Something went wrong. Please try again.",
    });
  });
});
