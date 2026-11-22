import { describe, it, expect } from "vitest";
import { forgotPasswordSchema, type ForgotPasswordInput } from "../validation";

describe("forgotPasswordSchema validation", () => {
  it("accepts valid email", () => {
    const input: ForgotPasswordInput = {
      email: "user@example.com",
    };

    const result = forgotPasswordSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("trims whitespace and lowercases email", () => {
    const input: ForgotPasswordInput = {
      email: "  User.Name@Example.COM  ",
    };

    const result = forgotPasswordSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user.name@example.com");
    }
  });

  it("rejects empty or missing email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({}).success).toBe(false);
  });

  it("rejects invalid email formats", () => {
    const invalidFormats = ["not-an-email", "@example.com", "user@", "user@.com"];
    for (const email of invalidFormats) {
      expect(forgotPasswordSchema.safeParse({ email }).success).toBe(false);
    }
  });
});
