import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    requestPasswordReset: vi.fn(),
  },
}));

import { authClient } from "@/lib/auth-client";
import { performForgotPassword, type ForgotPasswordResult } from "../logic";
import type { ForgotPasswordOutput } from "../validation";

describe("performForgotPassword", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const payload: ForgotPasswordOutput = {
    email: "user@example.com",
  };

  it("returns sent status on successful request", async () => {
    vi.mocked(authClient.requestPasswordReset).mockResolvedValueOnce({
      data: { status: true, message: "If this email exists..." },
      error: null,
    } as unknown as Awaited<ReturnType<typeof authClient.requestPasswordReset>>);

    const result = await performForgotPassword(payload);
    expect(result).toEqual<ForgotPasswordResult>({ status: "sent" });
    expect(authClient.requestPasswordReset).toHaveBeenCalledWith({
      email: "user@example.com",
      redirectTo: "/reset-password",
    });
  });

  it("preserves anti-enumeration by returning sent status if user is not found", async () => {
    vi.mocked(authClient.requestPasswordReset).mockResolvedValueOnce({
      data: null,
      error: { code: "USER_NOT_FOUND", message: "User not found" },
    } as unknown as Awaited<ReturnType<typeof authClient.requestPasswordReset>>);

    const result = await performForgotPassword(payload);
    expect(result).toEqual<ForgotPasswordResult>({ status: "sent" });
  });

  it("returns generic failure when unexpected server error occurs", async () => {
    vi.mocked(authClient.requestPasswordReset).mockResolvedValueOnce({
      data: null,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Database down" },
    } as unknown as Awaited<ReturnType<typeof authClient.requestPasswordReset>>);

    const result = await performForgotPassword(payload);
    expect(result).toEqual<ForgotPasswordResult>({
      status: "failure",
      globalError: "Something went wrong. Please try again.",
    });
  });

  it("catches network exceptions without throwing", async () => {
    vi.mocked(authClient.requestPasswordReset).mockRejectedValueOnce(
      new Error("Network disconnect")
    );

    const result = await performForgotPassword(payload);
    expect(result).toEqual<ForgotPasswordResult>({
      status: "failure",
      globalError: "Something went wrong. Please try again.",
    });
  });
});
