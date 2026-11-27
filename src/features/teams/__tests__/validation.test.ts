import { describe, it, expect } from "vitest";
import {
  createTeamSchema,
  type CreateTeamInput,
  addMemberSchema,
  type AddMemberInput,
  updateMemberRoleSchema,
  type UpdateMemberRoleInput,
  removeMemberSchema,
  type RemoveMemberInput,
  transferOwnershipSchema,
  type TransferOwnershipInput,
  switchTeamSchema,
  type SwitchTeamInput,
} from "../validation";

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

describe("addMemberSchema validation", () => {
  const validTeamId = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid teamId, email, and MANAGER role", () => {
    const input: AddMemberInput = {
      teamId: validTeamId,
      email: "alice@example.com",
      role: "MANAGER",
    };
    const result = addMemberSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.teamId).toBe(validTeamId);
      expect(result.data.email).toBe("alice@example.com");
      expect(result.data.role).toBe("MANAGER");
    }
  });

  it("accepts valid teamId, email, and MEMBER role", () => {
    const input: AddMemberInput = {
      teamId: validTeamId,
      email: "bob@example.com",
      role: "MEMBER",
    };
    const result = addMemberSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects invalid email address", () => {
    const result = addMemberSchema.safeParse({
      teamId: validTeamId,
      email: "not-an-email",
      role: "MEMBER",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) => i.path.includes("email"));
      expect(emailIssue?.message).toMatch(/email/i);
    }
  });

  it("rejects whitespace-only email", () => {
    const result = addMemberSchema.safeParse({
      teamId: validTeamId,
      email: "   ",
      role: "MEMBER",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = addMemberSchema.safeParse({
      teamId: validTeamId,
      role: "MEMBER",
    });
    expect(result.success).toBe(false);
  });

  it("rejects role OWNER (not allowed for add)", () => {
    const result = addMemberSchema.safeParse({
      teamId: validTeamId,
      email: "alice@example.com",
      role: "OWNER",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing teamId", () => {
    const result = addMemberSchema.safeParse({
      email: "alice@example.com",
      role: "MEMBER",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid teamId UUID", () => {
    const result = addMemberSchema.safeParse({
      teamId: "not-a-uuid",
      email: "alice@example.com",
      role: "MEMBER",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateMemberRoleSchema validation", () => {
  const validTeamId = "550e8400-e29b-41d4-a716-446655440000";
  const validUserId = "550e8400-e29b-41d4-a716-446655440001";

  it("accepts valid teamId, userId, and MANAGER role", () => {
    const input: UpdateMemberRoleInput = {
      teamId: validTeamId,
      userId: validUserId,
      role: "MANAGER",
    };
    const result = updateMemberRoleSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts valid teamId, userId, and MEMBER role", () => {
    const input: UpdateMemberRoleInput = {
      teamId: validTeamId,
      userId: validUserId,
      role: "MEMBER",
    };
    const result = updateMemberRoleSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects role OWNER (not allowed for role update)", () => {
    const result = updateMemberRoleSchema.safeParse({
      teamId: validTeamId,
      userId: validUserId,
      role: "OWNER",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing userId", () => {
    const result = updateMemberRoleSchema.safeParse({
      teamId: validTeamId,
      role: "MEMBER",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid userId UUID", () => {
    const result = updateMemberRoleSchema.safeParse({
      teamId: validTeamId,
      userId: "not-a-uuid",
      role: "MEMBER",
    });
    expect(result.success).toBe(false);
  });
});

describe("removeMemberSchema validation", () => {
  const validTeamId = "550e8400-e29b-41d4-a716-446655440000";
  const validUserId = "550e8400-e29b-41d4-a716-446655440001";

  it("accepts valid teamId and userId", () => {
    const input: RemoveMemberInput = {
      teamId: validTeamId,
      userId: validUserId,
    };
    const result = removeMemberSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects missing teamId", () => {
    const result = removeMemberSchema.safeParse({ userId: validUserId });
    expect(result.success).toBe(false);
  });

  it("rejects missing userId", () => {
    const result = removeMemberSchema.safeParse({ teamId: validTeamId });
    expect(result.success).toBe(false);
  });

  it("rejects invalid teamId UUID", () => {
    const result = removeMemberSchema.safeParse({
      teamId: "not-a-uuid",
      userId: validUserId,
    });
    expect(result.success).toBe(false);
  });
});

describe("transferOwnershipSchema validation", () => {
  const validTeamId = "550e8400-e29b-41d4-a716-446655440000";
  const validUserId = "550e8400-e29b-41d4-a716-446655440001";

  it("accepts valid teamId and newOwnerUserId", () => {
    const input: TransferOwnershipInput = {
      teamId: validTeamId,
      newOwnerUserId: validUserId,
    };
    const result = transferOwnershipSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects missing teamId", () => {
    const result = transferOwnershipSchema.safeParse({
      newOwnerUserId: validUserId,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing newOwnerUserId", () => {
    const result = transferOwnershipSchema.safeParse({ teamId: validTeamId });
    expect(result.success).toBe(false);
  });

  it("rejects invalid newOwnerUserId UUID", () => {
    const result = transferOwnershipSchema.safeParse({
      teamId: validTeamId,
      newOwnerUserId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("switchTeamSchema validation", () => {
  const validTeamId = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts a valid teamId UUID", () => {
    const input: SwitchTeamInput = { teamId: validTeamId };
    const result = switchTeamSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.teamId).toBe(validTeamId);
    }
  });

  it("rejects empty or invalid teamId UUID", () => {
    expect(switchTeamSchema.safeParse({ teamId: "" }).success).toBe(false);
    expect(switchTeamSchema.safeParse({ teamId: "not-a-uuid" }).success).toBe(false);
    expect(switchTeamSchema.safeParse({}).success).toBe(false);
  });
});
