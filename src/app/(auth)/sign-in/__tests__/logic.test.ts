import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock authClient before importing logic
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
    },
    sendVerificationEmail: vi.fn(),
  },
}));

import { authClient } from "@/lib/auth-client";
import { performSignIn, resendVerificationEmail, type SignInResult } from "../logic";
import type { SignInOutput } from "../validation";

describe("performSignIn", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const validPayload: SignInOutput = {
    email: "user@example.com",
    password: "password123",
    rememberMe: false,
  };

  it("returns success when authClient returns non-null data", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      data: { token: "session-token-xyz" },
      error: null,
    } as unknown as Awaited<ReturnType<typeof authClient.signIn.email>>);

    const result = await performSignIn(validPayload);
    expect(result).toEqual<SignInResult>({
      status: "success",
      hasSession: true,
    });
    expect(authClient.signIn.email).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
      rememberMe: false,
      callbackURL: undefined,
    });
  });

  it("handles INVALID_EMAIL_OR_PASSWORD with a generic credential error", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      data: null,
      error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid credentials" },
    } as unknown as Awaited<ReturnType<typeof authClient.signIn.email>>);

    const result = await performSignIn(validPayload);
    expect(result).toEqual<SignInResult>({
      status: "failure",
      globalError: "Invalid email or password.",
    });
  });

  it("handles EMAIL_NOT_VERIFIED and returns status unverified with email", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      data: null,
      error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
    } as unknown as Awaited<ReturnType<typeof authClient.signIn.email>>);

    const result = await performSignIn(validPayload);
    expect(result).toEqual<SignInResult>({
      status: "unverified",
      email: "user@example.com",
    });
  });

  it("returns generic failure when unexpected error code is returned", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      data: null,
      error: { code: "INTERNAL_ERROR", message: "Database down" },
    } as unknown as Awaited<ReturnType<typeof authClient.signIn.email>>);

    const result = await performSignIn(validPayload);
    expect(result).toEqual<SignInResult>({
      status: "failure",
      globalError: "Something went wrong. Please try again.",
    });
  });

  it("returns generic failure when both data and error are null", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      data: null,
      error: null,
    } as unknown as Awaited<ReturnType<typeof authClient.signIn.email>>);

    const result = await performSignIn(validPayload);
    expect(result).toEqual<SignInResult>({
      status: "failure",
      globalError: "Something went wrong. Please try again.",
    });
  });

  it("catches exceptions and returns generic failure without throwing", async () => {
    vi.mocked(authClient.signIn.email).mockRejectedValueOnce(
      new Error("Network disconnect")
    );

    const result = await performSignIn(validPayload);
    expect(result).toEqual<SignInResult>({
      status: "failure",
      globalError: "Something went wrong. Please try again.",
    });
  });
});

describe("resendVerificationEmail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls authClient.sendVerificationEmail and returns success", async () => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValueOnce({
      data: { status: true },
      error: null,
    } as unknown as Awaited<ReturnType<typeof authClient.sendVerificationEmail>>);

    const result = await resendVerificationEmail("user@example.com");
    expect(result).toEqual({ status: "success" });
    expect(authClient.sendVerificationEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      callbackURL: "/sign-in",
    });
  });

  it("handles errors and returns failure", async () => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValueOnce({
      data: null,
      error: { code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" },
    } as unknown as Awaited<ReturnType<typeof authClient.sendVerificationEmail>>);

    const result = await resendVerificationEmail("user@example.com");
    expect(result.status).toBe("failure");
  });
});
