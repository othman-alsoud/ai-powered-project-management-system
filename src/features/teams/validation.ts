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
