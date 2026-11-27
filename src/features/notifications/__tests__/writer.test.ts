import { describe, expect, it, vi } from "vitest";
import {
  notifyProjectTerminalStatus,
  notifyTaskAssigned,
  notifyTaskStatusChanged,
} from "../writer";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_C_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("notification writer", () => {
  describe("notifyTaskAssigned", () => {
    it("creates a PII-free task_assigned notification for another team user", async () => {
      const create = vi.fn(async () => ({ id: "notif-1" }));
      const tx = { notification: { create } };

      const created = await notifyTaskAssigned(tx, {
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        recipientUserId: USER_B_ID,
        taskTitle: "  Design API contract  ",
      });

      expect(created).toBe(true);
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith({
        data: {
          userId: USER_B_ID,
          actorId: ACTOR_ID,
          teamId: TEAM_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          type: "task_assigned",
          title: "Task assigned",
          message: 'You were assigned to "Design API contract".',
        },
      });
    });

    it("suppresses self-notification and null/empty recipients", async () => {
      const create = vi.fn(async () => ({ id: "notif-1" }));
      const tx = { notification: { create } };

      expect(
        await notifyTaskAssigned(tx, {
          teamId: TEAM_ID,
          actorId: ACTOR_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          recipientUserId: ACTOR_ID,
          taskTitle: "Self task",
        }),
      ).toBe(false);

      expect(
        await notifyTaskAssigned(tx, {
          teamId: TEAM_ID,
          actorId: ACTOR_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          recipientUserId: null,
          taskTitle: "Unassigned task",
        }),
      ).toBe(false);

      expect(create).not.toHaveBeenCalled();
    });
  });

  describe("notifyTaskStatusChanged", () => {
    it("creates task_status_changed notification using verified TaskStatus enum labels (IN_REVIEW)", async () => {
      const create = vi.fn(async () => ({ id: "notif-2" }));
      const tx = { notification: { create } };

      const created = await notifyTaskStatusChanged(tx, {
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        recipientUserId: USER_B_ID,
        taskTitle: "Review PR",
        previousStatus: "IN_PROGRESS",
        newStatus: "IN_REVIEW",
      });

      expect(created).toBe(true);
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith({
        data: {
          userId: USER_B_ID,
          actorId: ACTOR_ID,
          teamId: TEAM_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          type: "task_status_changed",
          title: "Task status updated",
          message: '"Review PR" moved from In Progress to In Review.',
        },
      });
    });

    it("suppresses notification on self-action, unassigned task, or unchanged status (no-op)", async () => {
      const create = vi.fn(async () => ({ id: "notif-2" }));
      const tx = { notification: { create } };

      expect(
        await notifyTaskStatusChanged(tx, {
          teamId: TEAM_ID,
          actorId: ACTOR_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          recipientUserId: ACTOR_ID,
          taskTitle: "Own task",
          previousStatus: "TODO",
          newStatus: "DONE",
        }),
      ).toBe(false);

      expect(
        await notifyTaskStatusChanged(tx, {
          teamId: TEAM_ID,
          actorId: ACTOR_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          recipientUserId: null,
          taskTitle: "Unassigned",
          previousStatus: "TODO",
          newStatus: "IN_PROGRESS",
        }),
      ).toBe(false);

      expect(
        await notifyTaskStatusChanged(tx, {
          teamId: TEAM_ID,
          actorId: ACTOR_ID,
          projectId: PROJECT_ID,
          taskId: TASK_ID,
          recipientUserId: USER_B_ID,
          taskTitle: "Same status",
          previousStatus: "DONE",
          newStatus: "DONE",
        }),
      ).toBe(false);

      expect(create).not.toHaveBeenCalled();
    });
  });

  describe("notifyProjectTerminalStatus", () => {
    it("deduplicates recipients, excludes actor, and batches createMany for COMPLETED", async () => {
      const createMany = vi.fn(async () => ({ count: 2 }));
      const tx = { notification: { createMany } };

      const count = await notifyProjectTerminalStatus(tx, {
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        projectId: PROJECT_ID,
        projectName: "  Platform Launch  ",
        status: "COMPLETED",
        recipientUserIds: [USER_B_ID, ACTOR_ID, USER_C_ID, USER_B_ID, ""],
      });

      expect(count).toBe(2);
      expect(createMany).toHaveBeenCalledTimes(1);
      expect(createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: USER_B_ID,
            actorId: ACTOR_ID,
            teamId: TEAM_ID,
            projectId: PROJECT_ID,
            taskId: null,
            type: "project_completed",
            title: "Project completed",
            message: 'Project "Platform Launch" was marked as Completed.',
          },
          {
            userId: USER_C_ID,
            actorId: ACTOR_ID,
            teamId: TEAM_ID,
            projectId: PROJECT_ID,
            taskId: null,
            type: "project_completed",
            title: "Project completed",
            message: 'Project "Platform Launch" was marked as Completed.',
          },
        ],
      });
    });

    it("formats project_cancelled notifications and skips createMany when no eligible recipients remain", async () => {
      const createMany = vi.fn(async () => ({ count: 1 }));
      const tx = { notification: { createMany } };

      const skipped = await notifyProjectTerminalStatus(tx, {
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        projectId: PROJECT_ID,
        projectName: "Alpha",
        status: "CANCELLED",
        recipientUserIds: [ACTOR_ID],
      });
      expect(skipped).toBe(0);
      expect(createMany).not.toHaveBeenCalled();

      const sent = await notifyProjectTerminalStatus(tx, {
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        projectId: PROJECT_ID,
        projectName: "Alpha",
        status: "CANCELLED",
        recipientUserIds: [USER_B_ID],
      });
      expect(sent).toBe(1);
      expect(createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: USER_B_ID,
            actorId: ACTOR_ID,
            teamId: TEAM_ID,
            projectId: PROJECT_ID,
            taskId: null,
            type: "project_cancelled",
            title: "Project cancelled",
            message: 'Project "Alpha" was marked as Cancelled.',
          },
        ],
      });
    });
  });
});
