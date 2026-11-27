import { describe, expect, it } from "vitest";
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
  notificationIdSchema,
  notificationsQuerySchema,
} from "../validation";

const VALID_ID = "11111111-1111-4111-8111-111111111111";

describe("notifications validation", () => {
  it("encodes and decodes valid (createdAt, id) pagination cursors", () => {
    const createdAt = new Date("2026-11-26T04:00:00.000Z");
    const encoded = encodeNotificationCursor({ createdAt, id: VALID_ID });

    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = decodeNotificationCursor(encoded);
    expect(decoded).toEqual({
      createdAt,
      id: VALID_ID,
    });
  });

  it("rejects malformed, tampered, or empty cursors safely", () => {
    expect(decodeNotificationCursor("")).toBeNull();
    expect(decodeNotificationCursor("   ")).toBeNull();
    expect(decodeNotificationCursor("not-valid-base64!")).toBeNull();

    const invalidUuidCursor = Buffer.from(
      JSON.stringify({
        createdAt: "2026-11-26T04:00:00.000Z",
        id: "not-a-uuid",
      }),
      "utf8",
    ).toString("base64url");
    expect(decodeNotificationCursor(invalidUuidCursor)).toBeNull();

    const invalidDateCursor = Buffer.from(
      JSON.stringify({
        createdAt: "not-a-date",
        id: VALID_ID,
      }),
      "utf8",
    ).toString("base64url");
    expect(decodeNotificationCursor(invalidDateCursor)).toBeNull();
  });

  it("parses notificationsQuerySchema defaults, filter values, and bounds", () => {
    const defaults = notificationsQuerySchema.parse({});
    expect(defaults).toEqual({
      limit: 15,
      filter: "all",
    });

    const cursor = encodeNotificationCursor({
      createdAt: "2026-11-26T04:00:00.000Z",
      id: VALID_ID,
    });
    const custom = notificationsQuerySchema.parse({
      limit: 25,
      filter: "unread",
      cursor,
    });
    expect(custom.limit).toBe(25);
    expect(custom.filter).toBe("unread");
    expect(custom.cursor).toEqual({
      createdAt: new Date("2026-11-26T04:00:00.000Z"),
      id: VALID_ID,
    });

    expect(notificationsQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(notificationsQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(notificationsQuerySchema.safeParse({ filter: "starred" }).success).toBe(false);
    expect(notificationsQuerySchema.safeParse({ cursor: "tampered" }).success).toBe(false);
  });

  it("validates notificationIdSchema UUID format", () => {
    expect(
      notificationIdSchema.safeParse({ notificationId: VALID_ID }).success,
    ).toBe(true);
    expect(
      notificationIdSchema.safeParse({ notificationId: "bad-id" }).success,
    ).toBe(false);
    expect(notificationIdSchema.safeParse({}).success).toBe(false);
  });
});
