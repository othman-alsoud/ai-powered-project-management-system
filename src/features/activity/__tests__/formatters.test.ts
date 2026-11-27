import { describe, expect, it } from "vitest";
import { ACTIVITY_ACTIONS } from "../constants";
import {
  ACTIVITY_ACTION_LABELS,
  formatActivityEntry,
  formatUtcActivityTimestamp,
} from "../formatters";
import type { ActivityAction, ActivityLogItemDTO } from "../types";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "44444444-4444-4444-8444-444444444444";
const COMMENT_ID = "55555555-5555-4555-8555-555555555555";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TARGET_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeItem(
  action: ActivityAction,
  overrides: Partial<ActivityLogItemDTO> = {},
): ActivityLogItemDTO {
  return {
    id: "99999999-9999-4999-8999-999999999999",
    teamId: TEAM_ID,
    action,
    createdAt: "2026-11-25T14:30:00.000Z",
    actor: {
      id: ACTOR_ID,
      name: "Alice Owner",
      image: null,
      isDeleted: false,
    },
    project: {
      id: PROJECT_ID,
      label: "Core Platform",
      isDeleted: false,
    },
    task: {
      id: TASK_ID,
      label: "Implement timeline",
      isDeleted: false,
    },
    commentId: null,
    details: {},
    ...overrides,
  };
}

describe("activity formatters", () => {
  it("defines human-readable labels for all 18 canonical action types", () => {
    for (const action of ACTIVITY_ACTIONS) {
      expect(ACTIVITY_ACTION_LABELS[action]).toBeTruthy();
    }
  });

  it("formats deterministic UTC timestamps matching comment timestamp format", () => {
    expect(formatUtcActivityTimestamp("2026-11-25T14:30:00.000Z")).toBe(
      "Nov 25, 2026, 14:30 UTC",
    );
    expect(formatUtcActivityTimestamp("invalid")).toBe("—");
    expect(formatUtcActivityTimestamp(null)).toBe("—");
  });

  it("formats all 18 action types cleanly with safe fallbacks and zero comment/PII leaks", () => {
    const samples: Array<[ActivityAction, Partial<ActivityLogItemDTO>, string]> = [
      ["team_created", { project: null, task: null, details: { teamName: "Core" } }, 'created team "Core"'],
      [
        "member_added",
        {
          project: null,
          task: null,
          details: {
            targetUser: { id: TARGET_ID, name: "Bob", isDeleted: false },
            role: "MANAGER",
          },
        },
        "added Bob as Manager",
      ],
      [
        "member_role_updated",
        {
          project: null,
          task: null,
          details: {
            targetUser: { id: TARGET_ID, name: "Bob", isDeleted: false },
            previousRole: "MEMBER",
            newRole: "MANAGER",
          },
        },
        "changed Bob's role from Member to Manager",
      ],
      [
        "member_removed",
        {
          project: null,
          task: null,
          details: { targetUser: { id: null, name: "Deleted User", isDeleted: true } },
        },
        "removed Deleted User from the team",
      ],
      [
        "ownership_transferred",
        {
          project: null,
          task: null,
          details: {
            previousOwner: { id: ACTOR_ID, name: "Alice Owner", isDeleted: false },
            newOwner: { id: TARGET_ID, name: "Bob", isDeleted: false },
          },
        },
        "transferred team ownership to Bob",
      ],
      ["member_departed", { project: null, task: null, details: { reason: "account_deleted", previousRole: "MEMBER" } }, "left the team"],
      ["project_created", { task: null, details: { projectName: "Core Platform", projectStatus: "ACTIVE" } }, 'created project "Core Platform"'],
      [
        "project_updated",
        {
          task: null,
          details: {
            projectName: "Core Platform",
            changedFields: ["status"],
            previousProjectStatus: "PLANNING",
            newProjectStatus: "ACTIVE",
          },
        },
        'changed project "Core Platform" status from Planning to Active',
      ],
      ["project_deleted", { task: null, project: { id: PROJECT_ID, label: "Core Platform", isDeleted: true }, details: { projectName: "Core Platform" } }, 'deleted project "Core Platform"'],
      ["task_created", { details: { taskTitle: "Implement timeline", taskPriority: "HIGH" } }, 'created task "Implement timeline"'],
      ["task_updated", { details: { taskTitle: "Implement timeline", changedFields: ["title", "dueDate"] } }, 'updated task "Implement timeline"'],
      [
        "task_status_changed",
        {
          details: {
            taskTitle: "Implement timeline",
            previousTaskStatus: "TODO",
            newTaskStatus: "IN_REVIEW",
          },
        },
        'moved task "Implement timeline" from To Do to In Review',
      ],
      [
        "task_assigned",
        {
          details: {
            taskTitle: "Implement timeline",
            assignee: { id: TARGET_ID, name: "Bob", isDeleted: false },
          },
        },
        'assigned task "Implement timeline" to Bob',
      ],
      [
        "task_reassigned",
        {
          details: {
            taskTitle: "Implement timeline",
            previousAssignee: { id: ACTOR_ID, name: "Alice", isDeleted: false },
            newAssignee: { id: null, name: "Deleted User", isDeleted: true },
          },
        },
        'reassigned task "Implement timeline" from Alice to Deleted User',
      ],
      [
        "task_deleted",
        {
          task: { id: TASK_ID, label: "Implement timeline", isDeleted: true },
          details: { taskTitle: "Implement timeline" },
        },
        'deleted task "Implement timeline"',
      ],
      ["comment_created", { commentId: COMMENT_ID, details: { taskTitle: "Implement timeline" } }, 'commented on task "Implement timeline"'],
      ["comment_updated", { commentId: COMMENT_ID, details: { taskTitle: "Implement timeline" } }, 'edited a comment on task "Implement timeline"'],
      [
        "comment_deleted",
        {
          commentId: COMMENT_ID,
          details: { taskTitle: "Implement timeline", deletedByRole: "OWNER", isSelfDelete: false },
        },
        'deleted a comment on task "Implement timeline"',
      ],
    ];

    for (const [action, overrides, expectedText] of samples) {
      const formatted = formatActivityEntry(makeItem(action, overrides));
      expect(formatted.summary).toContain(expectedText);
      expect(formatted.summary).not.toContain("undefined");
    }
  });

  it("links active task references to active parent project page and disables links for deleted resources", () => {
    const activeTask = formatActivityEntry(makeItem("task_status_changed"));
    expect(activeTask.projectHref).toBe(`/teams/${TEAM_ID}/projects/${PROJECT_ID}`);
    expect(activeTask.taskHref).toBe(`/teams/${TEAM_ID}/projects/${PROJECT_ID}`);

    const deletedTask = formatActivityEntry(
      makeItem("task_deleted", {
        task: { id: TASK_ID, label: "Old task", isDeleted: true },
      }),
    );
    expect(deletedTask.projectHref).toBe(`/teams/${TEAM_ID}/projects/${PROJECT_ID}`);
    expect(deletedTask.taskHref).toBeNull();

    const deletedProject = formatActivityEntry(
      makeItem("project_deleted", {
        project: { id: PROJECT_ID, label: "Old project", isDeleted: true },
        task: null,
      }),
    );
    expect(deletedProject.projectHref).toBeNull();
    expect(deletedProject.taskHref).toBeNull();
  });
});
