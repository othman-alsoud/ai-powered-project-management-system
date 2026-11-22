import { describe, expect, it } from "vitest";
import { signUpSchema } from "../validation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parse(data: unknown) {
  return signUpSchema.safeParse(data);
}

function valid(overrides: Record<string, unknown> = {}) {
  return {
    name: "Alice Example",
    email: "alice@example.com",
    password: "securepassword",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Valid input
// ---------------------------------------------------------------------------

describe("signUpSchema — valid input", () => {
  it("accepts a well-formed payload", () => {
    const result = parse(valid());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Alice Example");
      expect(result.data.email).toBe("alice@example.com");
      expect(result.data.password).toBe("securepassword");
    }
  });
});

// ---------------------------------------------------------------------------
// name field
// ---------------------------------------------------------------------------

describe("signUpSchema — name", () => {
  it("rejects a missing name field", () => {
    const result = parse({ email: "a@b.com", password: "password123" });
    expect(result.success).toBe(false);
    // Zod 4 reports a type error ("expected string, received undefined") for
    // a missing field — the fieldErrors array will be non-empty.
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors.name ?? [];
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it("rejects an empty name", () => {
    const result = parse(valid({ name: "" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.flatten().fieldErrors.name?.join(" ") ?? "";
      expect(msg).toContain("required");
    }
  });

  it("rejects a whitespace-only name", () => {
    const result = parse(valid({ name: "   " }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.flatten().fieldErrors.name?.join(" ") ?? "";
      expect(msg).toContain("required");
    }
  });

  it("trims leading/trailing whitespace from name", () => {
    const result = parse(valid({ name: "  Bob  " }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Bob");
    }
  });

  it("accepts a name of exactly 100 characters", () => {
    const name100 = "a".repeat(100);
    const result = parse(valid({ name: name100 }));
    expect(result.success).toBe(true);
  });

  it("rejects a name exceeding 100 characters", () => {
    const name101 = "a".repeat(101);
    const result = parse(valid({ name: name101 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.flatten().fieldErrors.name?.join(" ") ?? "";
      expect(msg).toContain("100");
    }
  });
});

// ---------------------------------------------------------------------------
// email field
// ---------------------------------------------------------------------------

describe("signUpSchema — email", () => {
  it("rejects a missing email field", () => {
    const result = parse({ name: "Alice", password: "password123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors.email ?? [];
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it("rejects an invalid email format", () => {
    const result = parse(valid({ email: "not-an-email" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.flatten().fieldErrors.email?.join(" ") ?? "";
      expect(msg).toContain("valid email");
    }
  });

  it("trims leading/trailing whitespace from email", () => {
    const result = parse(valid({ email: "  alice@example.com  " }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("alice@example.com");
    }
  });

  it("lowercases the email address", () => {
    const result = parse(valid({ email: "Alice@EXAMPLE.COM" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("alice@example.com");
    }
  });

  it("lowercases and trims email together", () => {
    const result = parse(valid({ email: "  ALICE@Example.Com  " }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("alice@example.com");
    }
  });
});

// ---------------------------------------------------------------------------
// password field
// ---------------------------------------------------------------------------

describe("signUpSchema — password", () => {
  it("rejects a password shorter than 8 characters", () => {
    const result = parse(valid({ password: "short" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.flatten().fieldErrors.password?.join(" ") ?? "";
      expect(msg).toContain("8 characters");
    }
  });

  it("accepts a password of exactly 8 characters", () => {
    const result = parse(valid({ password: "exact8pw" }));
    expect(result.success).toBe(true);
  });

  it("does not trim or transform the password", () => {
    const pw = "  spaces  ";
    const result = parse(valid({ password: pw }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password).toBe(pw);
    }
  });

  it("accepts a long password unchanged", () => {
    const pw = "a".repeat(200);
    const result = parse(valid({ password: pw }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password).toBe(pw);
    }
  });
});
