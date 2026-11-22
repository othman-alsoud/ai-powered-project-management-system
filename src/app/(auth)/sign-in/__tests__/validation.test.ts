import { describe, it, expect } from "vitest";
import { signInSchema, type SignInInput } from "../validation";

describe("signInSchema validation", () => {
  it("accepts valid email and password", () => {
    const input: SignInInput = {
      email: "user@example.com",
      password: "password123",
    };

    const result = signInSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
      expect(result.data.password).toBe("password123");
      expect(result.data.rememberMe).toBe(false);
    }
  });

  it("trims whitespace and lowercases email", () => {
    const input: SignInInput = {
      email: "  User.Name@Example.COM  ",
      password: "password123",
      rememberMe: true,
    };

    const result = signInSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user.name@example.com");
      expect(result.data.password).toBe("password123");
      expect(result.data.rememberMe).toBe(true);
    }
  });

  it("preserves password whitespace without trimming", () => {
    const input: SignInInput = {
      email: "user@example.com",
      password: "  pass1234  ",
    };

    const result = signInSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password).toBe("  pass1234  ");
    }
  });

  it("rejects missing or empty email", () => {
    const emptyResult = signInSchema.safeParse({ email: "", password: "password123" });
    expect(emptyResult.success).toBe(false);

    const missingResult = signInSchema.safeParse({ password: "password123" });
    expect(missingResult.success).toBe(false);
  });

  it("rejects invalid email formats", () => {
    const invalidFormats = ["not-an-email", "@example.com", "user@", "user@.com"];
    for (const email of invalidFormats) {
      const result = signInSchema.safeParse({ email, password: "password123" });
      expect(result.success).toBe(false);
    }
  });

  it("rejects missing password", () => {
    const result = signInSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = signInSchema.safeParse({
      email: "user@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.issues;
      expect(errors.some((issue) => issue.path.includes("password"))).toBe(true);
    }
  });
});
