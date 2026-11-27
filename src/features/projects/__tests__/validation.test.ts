import { describe, it, expect } from "vitest";
import {
  createProjectSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
  deleteProjectSchema,
  parseProjectQueryParams,
  PROJECT_STATUSES,
} from "../validation";
import {
  parseUtcDateInput,
  toUtcDateInputValue,
  formatUtcDateLabel,
} from "../date-utils";

const VALID_TEAM_ID = "550e8400-e29b-41d4-a716-446655440001";
const VALID_PROJECT_ID = "550e8400-e29b-41d4-a716-446655440002";

describe("Project Date Utilities (UTC)", () => {
  it("parses YYYY-MM-DD strings into UTC midnight Dates and formats back identically", () => {
    const parsed = parseUtcDateInput("2026-11-24");
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.toISOString()).toBe("2026-11-24T00:00:00.000Z");
    expect(toUtcDateInputValue(parsed)).toBe("2026-11-24");
    expect(formatUtcDateLabel(parsed)).toBe("Nov 24, 2026");
  });

  it("treats blank date strings as null and rejects impossible calendar dates", () => {
    expect(parseUtcDateInput("")).toBeNull();
    expect(parseUtcDateInput("   ")).toBeNull();
    expect(parseUtcDateInput("2026-02-30")).toBeUndefined();
    expect(parseUtcDateInput("11/24/2026")).toBeUndefined();
  });

  it("handles null and undefined formatting safely", () => {
    expect(toUtcDateInputValue(null)).toBe("");
    expect(toUtcDateInputValue(undefined)).toBe("");
    expect(formatUtcDateLabel(null)).toBeNull();
  });
});

describe("Project Validation Schemas", () => {
  describe("createProjectSchema", () => {
    it("accepts valid project input with defaults and trims whitespace", () => {
      const result = createProjectSchema.safeParse({
        teamId: VALID_TEAM_ID,
        name: "  Core Platform Rewrite  ",
        description: "   ",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Core Platform Rewrite");
        expect(result.data.description).toBeNull();
        expect(result.data.status).toBe("PLANNING");
        expect(result.data.startDate).toBeNull();
        expect(result.data.endDate).toBeNull();
      }
    });

    it("supports all 5 ProjectStatus values", () => {
      for (const status of PROJECT_STATUSES) {
        const result = createProjectSchema.safeParse({
          teamId: VALID_TEAM_ID,
          name: `Project ${status}`,
          status,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects ARCHIVED or unknown status values", () => {
      const result = createProjectSchema.safeParse({
        teamId: VALID_TEAM_ID,
        name: "Legacy Status Project",
        status: "ARCHIVED",
      });
      expect(result.success).toBe(false);
    });

    it("enforces name required (min 1) and max 100 chars, description max 1000 chars", () => {
      expect(
        createProjectSchema.safeParse({ teamId: VALID_TEAM_ID, name: "   " }).success
      ).toBe(false);
      expect(
        createProjectSchema.safeParse({
          teamId: VALID_TEAM_ID,
          name: "a".repeat(101),
        }).success
      ).toBe(false);
      expect(
        createProjectSchema.safeParse({
          teamId: VALID_TEAM_ID,
          name: "Valid",
          description: "d".repeat(1001),
        }).success
      ).toBe(false);
      expect(
        createProjectSchema.safeParse({
          teamId: VALID_TEAM_ID,
          name: "a".repeat(100),
          description: "d".repeat(1000),
        }).success
      ).toBe(true);
    });

    it("allows same-day startDate and endDate (endDate >= startDate)", () => {
      const result = createProjectSchema.safeParse({
        teamId: VALID_TEAM_ID,
        name: "One Day Sprint",
        startDate: "2026-12-01",
        endDate: "2026-12-01",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startDate?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
        expect(result.data.endDate?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
      }
    });

    it("allows startDate without endDate and endDate without startDate", () => {
      expect(
        createProjectSchema.safeParse({
          teamId: VALID_TEAM_ID,
          name: "Open End",
          startDate: "2026-12-01",
          endDate: "",
        }).success
      ).toBe(true);

      expect(
        createProjectSchema.safeParse({
          teamId: VALID_TEAM_ID,
          name: "Deadline Only",
          startDate: "",
          endDate: "2026-12-15",
        }).success
      ).toBe(true);
    });

    it("rejects endDate earlier than startDate with field error on endDate", () => {
      const result = createProjectSchema.safeParse({
        teamId: VALID_TEAM_ID,
        name: "Invalid Dates",
        startDate: "2026-12-10",
        endDate: "2026-12-05",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const endIssue = result.error.issues.find((i) => i.path.includes("endDate"));
        expect(endIssue?.message).toMatch(/earlier than start date/i);
      }
    });

    it("rejects malformed date strings and invalid UUIDs", () => {
      expect(
        createProjectSchema.safeParse({
          teamId: "not-a-uuid",
          name: "Test",
        }).success
      ).toBe(false);

      expect(
        createProjectSchema.safeParse({
          teamId: VALID_TEAM_ID,
          name: "Test",
          startDate: "2026-02-30",
        }).success
      ).toBe(false);
    });
  });

  describe("updateProjectSchema", () => {
    it("validates UUIDs, normalizes empty optional values to null, and preserves omitted fields as undefined", () => {
      const result = updateProjectSchema.safeParse({
        teamId: VALID_TEAM_ID,
        projectId: VALID_PROJECT_ID,
        name: "Updated Name",
        description: "",
        startDate: "",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBeNull();
        expect(result.data.startDate).toBeNull();
        expect(result.data.endDate).toBeUndefined();
        expect(result.data.status).toBeUndefined();
      }
    });

    it("rejects endDate earlier than startDate when both are provided", () => {
      const result = updateProjectSchema.safeParse({
        teamId: VALID_TEAM_ID,
        projectId: VALID_PROJECT_ID,
        name: "Updated Name",
        startDate: "2026-12-10",
        endDate: "2026-12-09",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateProjectStatusSchema & deleteProjectSchema", () => {
    it("validates teamId, projectId, and ProjectStatus", () => {
      expect(
        updateProjectStatusSchema.safeParse({
          teamId: VALID_TEAM_ID,
          projectId: VALID_PROJECT_ID,
          status: "COMPLETED",
        }).success
      ).toBe(true);

      expect(
        deleteProjectSchema.safeParse({
          teamId: VALID_TEAM_ID,
          projectId: "bad-id",
        }).success
      ).toBe(false);
    });
  });

  describe("parseProjectQueryParams", () => {
    it("defaults to createdAt desc and validates allowed project sort fields cleanly", () => {
      expect(parseProjectQueryParams({})).toEqual({
        sort: "createdAt",
        dir: "desc",
      });
      expect(
        parseProjectQueryParams({ sort: "priority", dir: "up" }),
      ).toEqual({
        sort: "createdAt",
        dir: "desc",
      });
      expect(parseProjectQueryParams({ sort: "name" })).toEqual({
        sort: "name",
        dir: "asc",
      });
      expect(
        parseProjectQueryParams({ sort: "endDate", dir: "desc" }),
      ).toEqual({
        sort: "endDate",
        dir: "desc",
      });
    });
  });
});
