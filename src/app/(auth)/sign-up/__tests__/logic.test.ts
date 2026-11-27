import { beforeEach, describe, expect, it, vi } from "vitest";
import { performSignUp } from "../logic";

// ---------------------------------------------------------------------------
// Mock @/lib/auth-client so no real HTTP or DB calls are made.
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: {
      email: vi.fn(),
    },
  },
}));

// Pull the mock reference so individual tests can control the return value.
import { authClient } from "@/lib/auth-client";

const mockSignUpEmail = authClient.signUp.email as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// A valid, pre-validated payload (as produced by signUpSchema.parse).
// ---------------------------------------------------------------------------

const validPayload = {
  name: "Alice Example",
  email: "alice@example.com",
  password: "securepassword",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApiResponse(
  data: Record<string, unknown> | null,
  error: { code?: string; message?: string } | null,
) {
  // Better Auth returns a discriminated union from @better-fetch.
  // In tests we simply return an object with both fields; the
  // logic.ts code reads `response.data` and `response.error`.
  return { data, error };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("performSignUp — success", () => {
  it("returns success with hasSession true when a token is present", async () => {
    mockSignUpEmail.mockResolvedValue(
      makeApiResponse({ token: "tok_abc123", user: { id: "u1" } }, null),
    );

    const result = await performSignUp(validPayload);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.hasSession).toBe(true);
    }
  });

  it("returns success with hasSession false when token is null", async () => {
    mockSignUpEmail.mockResolvedValue(
      makeApiResponse({ token: null, user: { id: "u1" } }, null),
    );

    const result = await performSignUp(validPayload);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.hasSession).toBe(false);
    }
  });

  it("allows immediate access with session after registration when email verification is disabled", async () => {
    mockSignUpEmail.mockResolvedValue(
      makeApiResponse(
        {
          token: "tok_immediate_session",
          user: { id: "u1", email: "alice@example.com", emailVerified: false },
        },
        null,
      ),
    );

    const result = await performSignUp(validPayload);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.hasSession).toBe(true);
    }
  });
});

describe("performSignUp — Better Auth field errors", () => {
  it("maps USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL to an email field error", async () => {
    mockSignUpEmail.mockResolvedValue(
      makeApiResponse(null, {
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
        message: "user already exists",
      }),
    );

    const result = await performSignUp(validPayload);

    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.fieldErrors?.email).toBeDefined();
      expect(result.fieldErrors?.email).toContain("already exists");
      expect(result.globalError).toBeUndefined();
    }
  });

  it("maps INVALID_EMAIL to an email field error", async () => {
    mockSignUpEmail.mockResolvedValue(
      makeApiResponse(null, {
        code: "INVALID_EMAIL",
        message: "invalid email",
      }),
    );

    const result = await performSignUp(validPayload);

    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.fieldErrors?.email).toBeDefined();
      expect(result.fieldErrors?.email).toContain("valid email");
      expect(result.globalError).toBeUndefined();
    }
  });

  it("maps PASSWORD_TOO_SHORT to a password field error", async () => {
    mockSignUpEmail.mockResolvedValue(
      makeApiResponse(null, {
        code: "PASSWORD_TOO_SHORT",
        message: "password too short",
      }),
    );

    const result = await performSignUp(validPayload);

    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.fieldErrors?.password).toBeDefined();
      expect(result.fieldErrors?.password).toContain("8 characters");
      expect(result.globalError).toBeUndefined();
    }
  });

  it("maps PASSWORD_TOO_LONG to a password field error", async () => {
    mockSignUpEmail.mockResolvedValue(
      makeApiResponse(null, {
        code: "PASSWORD_TOO_LONG",
        message: "password too long",
      }),
    );

    const result = await performSignUp(validPayload);

    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.fieldErrors?.password).toBeDefined();
      expect(result.fieldErrors?.password).toContain("too long");
      expect(result.globalError).toBeUndefined();
    }
  });
});

describe("performSignUp — generic / unexpected failures", () => {
  it("returns a generic failure for an unknown API error code", async () => {
    mockSignUpEmail.mockResolvedValue(
      makeApiResponse(null, {
        code: "UNKNOWN_SERVER_ERROR",
        message: "something unexpected happened",
      }),
    );

    const result = await performSignUp(validPayload);

    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.globalError).toBeDefined();
      // Must NOT expose internal details
      expect(result.globalError).not.toContain("UNKNOWN_SERVER_ERROR");
      expect(result.fieldErrors).toBeUndefined();
    }
  });

  it("returns a generic failure when both data and error are null", async () => {
    mockSignUpEmail.mockResolvedValue(makeApiResponse(null, null));

    const result = await performSignUp(validPayload);

    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.globalError).toBeDefined();
    }
  });

  it("returns a generic failure when the client throws an exception", async () => {
    mockSignUpEmail.mockRejectedValue(new Error("Network timeout"));

    const result = await performSignUp(validPayload);

    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.globalError).toBeDefined();
      // Must NOT leak the raw exception message
      expect(result.globalError).not.toContain("Network timeout");
    }
  });
});

describe("performSignUp — result type safety", () => {
  it("success results never carry fieldErrors or globalError", async () => {
    mockSignUpEmail.mockResolvedValue(
      makeApiResponse({ token: "tok_xyz", user: { id: "u2" } }, null),
    );

    const result = await performSignUp(validPayload);

    expect(result.status).toBe("success");
    // TypeScript discriminated union: these keys don't exist on success
    expect("fieldErrors" in result).toBe(false);
    expect("globalError" in result).toBe(false);
  });

  it("failure results never carry hasSession", async () => {
    mockSignUpEmail.mockResolvedValue(
      makeApiResponse(null, { code: "INVALID_EMAIL" }),
    );

    const result = await performSignUp(validPayload);

    expect(result.status).toBe("failure");
    expect("hasSession" in result).toBe(false);
  });
});
