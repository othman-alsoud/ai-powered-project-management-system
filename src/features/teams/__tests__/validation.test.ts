import { describe, it, expect } from "vitest";
import { createTeamSchema, type CreateTeamInput } from "../validation";

describe("createTeamSchema validation", () => {
  it("accepts valid team name and optional description", () => {
    const input: CreateTeamInput = {
      name: "Engineering Team",
      description: "Core platform development workspace",
    };

    const result = createTeamSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Engineering Team");
      expect(result.data.description).toBe("Core platform development workspace");
    }
  });

  it("trims whitespace from name and description", () => {
    const input: CreateTeamInput = {
      name: "   Product Design   ",
      description: "   UI/UX squad   ",
    };

    const result = createTeamSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Product Design");
      expect(result.data.description).toBe("UI/UX squad");
    }
  });

  it("accepts empty or omitted description", () => {
    const input: CreateTeamInput = {
      name: "Marketing",
    };

    const result = createTeamSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Marketing");
      expect(result.data.description).toBeUndefined();
    }
  });

  it("rejects empty or missing team name", () => {
    expect(createTeamSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createTeamSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(createTeamSchema.safeParse({}).success).toBe(false);
  });

  it("rejects team name longer than 50 characters", () => {
    const longName = "A".repeat(51);
    const result = createTeamSchema.safeParse({ name: longName });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/50 characters/);
    }
  });

  it("rejects description longer than 200 characters", () => {
    const longDesc = "D".repeat(201);
    const result = createTeamSchema.safeParse({
      name: "Operations",
      description: longDesc,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/200 characters/);
    }
  });
});
