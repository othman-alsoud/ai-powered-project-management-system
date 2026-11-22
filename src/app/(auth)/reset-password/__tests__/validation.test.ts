import { describe, it, expect } from "vitest";
import { resetPasswordSchema, type ResetPasswordInput } from "../validation";

describe("resetPasswordSchema validation", () => {
  it("accepts valid matching passwords", () => {
    const input: ResetPasswordInput = {
      newPassword: "newpassword123",
      confirmPassword: "newpassword123",
    };

    const result = resetPasswordSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newPassword).toBe("newpassword123");
      expect(result.data.confirmPassword).toBe("newpassword123");
    }
  });

  it("preserves password whitespace without trimming", () => {
    const input: ResetPasswordInput = {
      newPassword: "  pass1234  ",
      confirmPassword: "  pass1234  ",
    };

    const result = resetPasswordSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newPassword).toBe("  pass1234  ");
    }
  });

  it("rejects password shorter than 8 characters", () => {
    const input: ResetPasswordInput = {
      newPassword: "short",
      confirmPassword: "short",
    };

    const result = resetPasswordSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues;
      expect(issues.some((issue) => issue.path.includes("newPassword"))).toBe(true);
    }
  });

  it("rejects when passwords do not match", () => {
    const input: ResetPasswordInput = {
      newPassword: "password123",
      confirmPassword: "differentpassword",
    };

    const result = resetPasswordSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues;
      expect(issues.some((issue) => issue.path.includes("confirmPassword"))).toBe(true);
      expect(issues.some((issue) => issue.message.includes("match"))).toBe(true);
    }
  });
});
