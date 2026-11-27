import { describe, it, expect } from "vitest";
import { deleteAccountSchema } from "../validation";

describe("deleteAccountSchema validation", () => {
  it("accepts exact DELETE phrase without password for OAuth-only accounts", () => {
    const result = deleteAccountSchema.safeParse({
      confirmationPhrase: "DELETE",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmationPhrase).toBe("DELETE");
    }
  });

  it("trims whitespace around DELETE phrase", () => {
    const result = deleteAccountSchema.safeParse({
      confirmationPhrase: "  DELETE  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmationPhrase).toBe("DELETE");
    }
  });

  it("accepts DELETE phrase with password for credential accounts", () => {
    const result = deleteAccountSchema.safeParse({
      confirmationPhrase: "DELETE",
      password: "my-secret-password",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password).toBe("my-secret-password");
    }
  });

  it("rejects incorrect, lowercase, or empty confirmation phrase", () => {
    expect(deleteAccountSchema.safeParse({ confirmationPhrase: "" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirmationPhrase: "delete" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirmationPhrase: "REMOVE" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({}).success).toBe(false);
  });
});
