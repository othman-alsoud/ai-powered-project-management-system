import { describe, expect, it } from "vitest";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_FEED_DEFAULT_LIMIT,
  ACTIVITY_FEED_MAX_LIMIT,
} from "../constants";
import {
  activityFeedQuerySchema,
  buildActivityQueryUrl,
  decodeActivityCursor,
  encodeActivityCursor,
  isValidUuid,
  parseActivitySearchParams,
  parseProjectDetailTab,
} from "../validation";

const VALID_UUID_1 = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_2 = "22222222-2222-4222-8222-222222222222";

describe("activity constants and validation", () => {
  it("exposes the exact 18 canonical ActivityLog action types", () => {
    expect(ACTIVITY_ACTIONS).toHaveLength(18);
    expect(new Set(ACTIVITY_ACTIONS).size).toBe(18);
    expect(ACTIVITY_ACTIONS).toEqual([
      "team_created",
      "member_added",
      "member_role_updated",
      "member_removed",
      "ownership_transferred",
      "member_departed",
      "project_created",
      "project_updated",
      "project_deleted",
      "task_created",
      "task_updated",
      "task_status_changed",
      "task_assigned",
      "task_reassigned",
      "task_deleted",
      "comment_created",
      "comment_updated",
      "comment_deleted",
    ]);
  });

  it("round-trips opaque base64url pagination cursors deterministically", () => {
    const createdAt = new Date("2026-11-25T10:15:30.123Z");
    const encoded = encodeActivityCursor({ createdAt, id: VALID_UUID_1 });
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");

    const decoded = decodeActivityCursor(encoded);
    expect(decoded).toEqual({
      createdAt,
      id: VALID_UUID_1,
    });
  });

  it("rejects malformed, tampered, or non-UUID cursors", () => {
    expect(decodeActivityCursor("")).toBeNull();
    expect(decodeActivityCursor("not-valid-base64-json")).toBeNull();

    const badId = Buffer.from(
      JSON.stringify({ createdAt: "2026-11-25T10:15:30.123Z", id: "bad-id" }),
      "utf8",
    ).toString("base64url");
    expect(decodeActivityCursor(badId)).toBeNull();

    const badDate = Buffer.from(
      JSON.stringify({ createdAt: "not-a-date", id: VALID_UUID_1 }),
      "utf8",
    ).toString("base64url");
    expect(decodeActivityCursor(badDate)).toBeNull();
  });

  it("validates query filters, default limit, and max limit bounds", () => {
    const defaults = activityFeedQuerySchema.parse({});
    expect(defaults).toEqual({
      limit: ACTIVITY_FEED_DEFAULT_LIMIT,
    });
    expect(ACTIVITY_FEED_DEFAULT_LIMIT).toBe(20);
    expect(ACTIVITY_FEED_MAX_LIMIT).toBe(50);

    const cursor = encodeActivityCursor({
      createdAt: "2026-11-25T10:00:00.000Z",
      id: VALID_UUID_1,
    });

    const parsed = activityFeedQuerySchema.parse({
      limit: 10,
      cursor,
      projectId: ` ${VALID_UUID_1} `,
      taskId: VALID_UUID_2,
      action: "task_status_changed",
    });

    expect(parsed.limit).toBe(10);
    expect(parsed.projectId).toBe(VALID_UUID_1);
    expect(parsed.taskId).toBe(VALID_UUID_2);
    expect(parsed.action).toBe("task_status_changed");
    expect(parsed.cursor).toEqual({
      createdAt: new Date("2026-11-25T10:00:00.000Z"),
      id: VALID_UUID_1,
    });

    expect(activityFeedQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(activityFeedQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(activityFeedQuerySchema.safeParse({ projectId: "bad" }).success).toBe(false);
    expect(activityFeedQuerySchema.safeParse({ cursor: "invalid" }).success).toBe(false);
    expect(activityFeedQuerySchema.safeParse({ action: "unknown_action" }).success).toBe(false);
    expect(isValidUuid(VALID_UUID_1)).toBe(true);
    expect(isValidUuid("not-a-uuid")).toBe(false);
  });

  it("parses URL searchParams safely per-field without discarding valid filters when one param is invalid", () => {
    const validCursor = encodeActivityCursor({
      createdAt: "2026-11-25T10:00:00.000Z",
      id: VALID_UUID_2,
    });

    const fromRecord = parseActivitySearchParams({
      action: "task_status_changed",
      projectId: VALID_UUID_1,
      limit: "15",
      cursor: "corrupt-cursor",
    });

    expect(fromRecord).toEqual({
      action: "task_status_changed",
      projectId: VALID_UUID_1,
      taskId: undefined,
      limit: 15,
      cursor: undefined,
    });

    const fromUrlParams = parseActivitySearchParams(
      new URLSearchParams({
        action: "not_an_action",
        projectId: "bad-uuid",
        taskId: VALID_UUID_2,
        limit: "999",
        cursor: validCursor,
      }),
    );

    expect(fromUrlParams).toEqual({
      action: undefined,
      projectId: undefined,
      taskId: VALID_UUID_2,
      limit: ACTIVITY_FEED_DEFAULT_LIMIT,
      cursor: {
        createdAt: new Date("2026-11-25T10:00:00.000Z"),
        id: VALID_UUID_2,
      },
    });
  });

  it("builds clean filter URLs and parses project detail tabs safely", () => {
    expect(
      buildActivityQueryUrl("/teams/t1/activity", "?cursor=abc&action=old", {
        action: "task_created",
        projectId: VALID_UUID_1,
      }),
    ).toBe(`/teams/t1/activity?action=task_created&projectId=${VALID_UUID_1}`);

    expect(
      buildActivityQueryUrl("/teams/t1/activity", "?action=task_created&cursor=abc", {}),
    ).toBe("/teams/t1/activity");

    expect(parseProjectDetailTab(undefined)).toBe("tasks");
    expect(parseProjectDetailTab({ tab: "activity" })).toBe("activity");
    expect(parseProjectDetailTab({ tab: "tasks" })).toBe("tasks");
    expect(parseProjectDetailTab({ tab: "unknown" })).toBe("tasks");
  });
});
