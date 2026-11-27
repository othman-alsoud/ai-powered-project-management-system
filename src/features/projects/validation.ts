import { z } from "zod";
import { parseUtcDateInput } from "./date-utils";

export const PROJECT_STATUSES = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;

export const projectStatusSchema = z.enum(PROJECT_STATUSES);

const optionalDateValueSchema = z
  .union([z.string(), z.date(), z.null()])
  .transform((value, ctx): Date | null => {
    if (value === null) return null;

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        ctx.addIssue({
          code: "custom",
          message: "Please enter a valid date.",
        });
        return z.NEVER;
      }
      return new Date(
        Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
      );
    }

    const parsed = parseUtcDateInput(value);
    if (parsed === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Please enter a valid date (YYYY-MM-DD).",
      });
      return z.NEVER;
    }

    return parsed;
  })
  .optional();

const projectNameSchema = z
  .string()
  .trim()
  .min(1, "Project name is required.")
  .max(100, "Project name must be 100 characters or fewer.");

const projectDescriptionSchema = z
  .string()
  .trim()
  .max(1000, "Description must be 1000 characters or fewer.")
  .nullish()
  .transform((value): string | null | undefined => {
    if (value === undefined) return undefined;
    return value === null || value.length === 0 ? null : value;
  });

function validateDateRange(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
  ctx: z.RefinementCtx
) {
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date cannot be earlier than start date.",
    });
  }
}

/**
 * Schema for creating a team-scoped project.
 */
export const createProjectSchema = z
  .object({
    teamId: z.string().uuid("Invalid team ID."),
    name: projectNameSchema,
    description: projectDescriptionSchema.transform((v) => v ?? null),
    status: projectStatusSchema.default("PLANNING"),
    startDate: optionalDateValueSchema.transform((v) => v ?? null),
    endDate: optionalDateValueSchema.transform((v) => v ?? null),
  })
  .superRefine((data, ctx) => {
    validateDateRange(data.startDate, data.endDate, ctx);
  });

export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type CreateProjectOutput = z.output<typeof createProjectSchema>;

/**
 * Schema for updating an existing project's details, status, and optional dates.
 * Omitted fields remain undefined so updateProjectAction can validate effective persisted pairs.
 */
export const updateProjectSchema = z
  .object({
    teamId: z.string().uuid("Invalid team ID."),
    projectId: z.string().uuid("Invalid project ID."),
    name: projectNameSchema,
    description: projectDescriptionSchema,
    status: projectStatusSchema.optional(),
    startDate: optionalDateValueSchema,
    endDate: optionalDateValueSchema,
  })
  .superRefine((data, ctx) => {
    validateDateRange(data.startDate, data.endDate, ctx);
  });

export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
export type UpdateProjectOutput = z.output<typeof updateProjectSchema>;

/**
 * Schema for transitioning a project's status.
 */
export const updateProjectStatusSchema = z.object({
  teamId: z.string().uuid("Invalid team ID."),
  projectId: z.string().uuid("Invalid project ID."),
  status: projectStatusSchema,
});

export type UpdateProjectStatusInput = z.input<typeof updateProjectStatusSchema>;
export type UpdateProjectStatusOutput = z.output<typeof updateProjectStatusSchema>;

/**
 * Schema for soft-deleting a project.
 */
export const deleteProjectSchema = z.object({
  teamId: z.string().uuid("Invalid team ID."),
  projectId: z.string().uuid("Invalid project ID."),
});

export type DeleteProjectInput = z.input<typeof deleteProjectSchema>;
export type DeleteProjectOutput = z.output<typeof deleteProjectSchema>;

export const PROJECT_SORT_FIELDS = ["createdAt", "endDate", "name"] as const;
export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number];

export const PROJECT_SORT_DIRECTIONS = ["asc", "desc"] as const;
export type ProjectSortDirection = (typeof PROJECT_SORT_DIRECTIONS)[number];

export const PROJECT_SORT_LABELS: Record<ProjectSortField, string> = {
  createdAt: "Created Date",
  endDate: "Target End Date",
  name: "Name",
};

export interface ProjectQueryParams {
  sort: ProjectSortField;
  dir: ProjectSortDirection;
}

function readRawParam(
  raw: Record<string, string | string[] | undefined> | URLSearchParams | undefined,
  key: string,
): string | undefined {
  if (!raw) return undefined;
  if (raw instanceof URLSearchParams) {
    return raw.get(key) ?? undefined;
  }
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parses and validates project list sorting parameters with deterministic defaults.
 */
export function parseProjectQueryParams(
  raw?: Record<string, string | string[] | undefined> | URLSearchParams,
): ProjectQueryParams {
  const rawSort = readRawParam(raw, "sort")?.trim();
  const sortResult = z.enum(PROJECT_SORT_FIELDS).safeParse(rawSort);
  const sort: ProjectSortField = sortResult.success ? sortResult.data : "createdAt";

  const rawDir = readRawParam(raw, "dir")?.trim().toLowerCase();
  const dirResult = z.enum(PROJECT_SORT_DIRECTIONS).safeParse(rawDir);
  const defaultDir: ProjectSortDirection =
    sort === "name" || sort === "endDate" ? "asc" : "desc";
  const dir: ProjectSortDirection = dirResult.success ? dirResult.data : defaultDir;

  return { sort, dir };
}
