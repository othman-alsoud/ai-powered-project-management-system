import { z } from "zod";

/**
 * Schema for creating a new team workspace.
 */
export const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Team name is required.")
    .max(50, "Team name must be 50 characters or fewer."),

  description: z
    .string()
    .trim()
    .max(200, "Description must be 200 characters or fewer.")
    .optional(),
});

export type CreateTeamInput = z.input<typeof createTeamSchema>;
export type CreateTeamOutput = z.output<typeof createTeamSchema>;

/**
 * Schema for adding an existing registered user to a team.
 * The OWNER provides the user's email and selects MANAGER or MEMBER role.
 */
export const addMemberSchema = z.object({
  teamId: z.string().uuid("Invalid team ID."),
  email: z
    .string()
    .trim()
    .min(1, "Email address is required.")
    .email("Please enter a valid email address."),
  role: z.enum(["MANAGER", "MEMBER"] as const),
});

export type AddMemberInput = z.input<typeof addMemberSchema>;
export type AddMemberOutput = z.output<typeof addMemberSchema>;

/**
 * Schema for updating an existing member's role.
 * Only MANAGER or MEMBER roles can be assigned (OWNER changes via transfer only).
 */
export const updateMemberRoleSchema = z.object({
  teamId: z.string().uuid("Invalid team ID."),
  userId: z.string().uuid("Invalid user ID."),
  role: z.enum(["MANAGER", "MEMBER"] as const),
});

export type UpdateMemberRoleInput = z.input<typeof updateMemberRoleSchema>;
export type UpdateMemberRoleOutput = z.output<typeof updateMemberRoleSchema>;

/**
 * Schema for removing a member from a team.
 */
export const removeMemberSchema = z.object({
  teamId: z.string().uuid("Invalid team ID."),
  userId: z.string().uuid("Invalid user ID."),
});

export type RemoveMemberInput = z.input<typeof removeMemberSchema>;
export type RemoveMemberOutput = z.output<typeof removeMemberSchema>;

/**
 * Schema for transferring team ownership to another active member.
 */
export const transferOwnershipSchema = z.object({
  teamId: z.string().uuid("Invalid team ID."),
  newOwnerUserId: z.string().uuid("Invalid user ID."),
});

export type TransferOwnershipInput = z.input<typeof transferOwnershipSchema>;
export type TransferOwnershipOutput = z.output<typeof transferOwnershipSchema>;

/**
 * Schema for switching the active team navigation preference.
 */
export const switchTeamSchema = z.object({
  teamId: z.string().uuid("Invalid team ID."),
});

export type SwitchTeamInput = z.input<typeof switchTeamSchema>;
export type SwitchTeamOutput = z.output<typeof switchTeamSchema>;
