import { describe, expect, it, vi } from "vitest";
import { recordActivityLog, recordActivityLogs } from "../writer";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TARGET_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "44444444-4444-4444-8444-444444444444";
const COMMENT_ID = "55555555-5555-4555-8555-555555555555";

describe("activity writer", () => {
  it("writes member_added without email PII via tx.activityLog.create", async () => {
    const create = vi.fn(async () => ({ id: "log-1" }));
    const tx = { activityLog: { create } };

    await recordActivityLog(tx, {
      teamId: TEAM_ID,
      actorId: ACTOR_ID,
      action: "member_added",
      metadata: {
        addedUserId: TARGET_USER_ID,
        role: "MEMBER",
      },
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: {
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        action: "member_added",
        metadata: {
          addedUserId: TARGET_USER_ID,
          role: "MEMBER",
        },
      },
    });
    expect(JSON.stringify(create.mock.calls[0])).not.toContain("@");
  });

  it("writes project, task, and comment ActivityLog entries with proper entity FKs", async () => {
    const create = vi.fn(async () => ({ id: "log-1" }));
    const tx = { activityLog: { create } };

    await recordActivityLog(tx, {
      teamId: TEAM_ID,
      actorId: ACTOR_ID,
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      commentId: COMMENT_ID,
      action: "comment_created",
      metadata: {
        taskId: TASK_ID,
        taskTitle: "Implement foundation",
        commentId: COMMENT_ID,
      },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        commentId: COMMENT_ID,
        action: "comment_created",
        metadata: {
          taskId: TASK_ID,
          taskTitle: "Implement foundation",
          commentId: COMMENT_ID,
        },
      },
    });
  });

  it("writes batched entries via tx.activityLog.createMany and skips empty batches", async () => {
    const createMany = vi.fn(async () => ({ count: 2 }));
    const tx = { activityLog: { createMany } };

    await recordActivityLogs(tx, []);
    expect(createMany).not.toHaveBeenCalled();

    await recordActivityLogs(tx, [
      {
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        action: "member_departed",
        metadata: { reason: "account_deleted", previousRole: "MEMBER" },
      },
      {
        teamId: "33333333-3333-4333-8333-333333333333",
        actorId: ACTOR_ID,
        action: "member_departed",
        metadata: { reason: "account_deleted", previousRole: "MANAGER" },
      },
    ]);

    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          teamId: TEAM_ID,
          actorId: ACTOR_ID,
          action: "member_departed",
          metadata: { reason: "account_deleted", previousRole: "MEMBER" },
        },
        {
          teamId: "33333333-3333-4333-8333-333333333333",
          actorId: ACTOR_ID,
          action: "member_departed",
          metadata: { reason: "account_deleted", previousRole: "MANAGER" },
        },
      ],
    });
  });
});
