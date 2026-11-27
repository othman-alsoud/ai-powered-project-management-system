import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

import { TaskStatusBadge } from "../components/task-status-badge";
import { TaskPriorityBadge } from "../components/task-priority-badge";
import { TaskDueDate } from "../components/task-due-date";
import {
  TasksManager,
  buildTasksQueryUrl,
  buildTasksViewUrl,
  clearTaskToastTimer,
  executeOptimisticTaskStatusMove,
  scheduleTaskToastTimer,
} from "../components/tasks-manager";
import { TasksFilterToolbar } from "../components/tasks-filter-toolbar";
import { parseTaskQueryParams } from "../validation";
import {
  TaskFormDialog,
  attemptCloseTaskFormDialog,
} from "../components/task-form-dialog";
import {
  DeleteTaskDialog,
  attemptCloseDeleteTaskDialog,
} from "../components/delete-task-dialog";
import { TaskDetailDialog } from "../components/task-detail-dialog";
import type {
  TaskSummary,
  TeamTaskAssigneeOption,
  TeamTaskProjectOption,
} from "../server";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const USER_MANAGER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_MEMBER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_OTHER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const projects: TeamTaskProjectOption[] = [
  { id: PROJECT_ID, name: "Core Platform", status: "ACTIVE" },
];

const members: TeamTaskAssigneeOption[] = [
  {
    id: USER_MANAGER_ID,
    name: "Morgan Manager",
    email: "morgan@example.com",
    role: "MANAGER",
  },
  {
    id: USER_MEMBER_ID,
    name: "Mia Member",
    email: "mia@example.com",
    role: "MEMBER",
  },
];

const sampleTasks: TaskSummary[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title: "Assigned Member Task",
    description: "Work on task endpoints",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueDate: new Date("2026-11-20T00:00:00.000Z"),
    assignedToId: USER_MEMBER_ID,
    createdById: USER_MANAGER_ID,
    updatedById: USER_MANAGER_ID,
    createdAt: new Date("2026-11-18T00:00:00.000Z"),
    updatedAt: new Date("2026-11-19T00:00:00.000Z"),
    project: { id: PROJECT_ID, name: "Core Platform", status: "ACTIVE" },
    assignee: { id: USER_MEMBER_ID, name: "Mia Member", image: null },
    createdBy: { id: USER_MANAGER_ID, name: "Morgan Manager" },
    updatedBy: { id: USER_MANAGER_ID, name: "Morgan Manager" },
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title: "Teammate Completed Task",
    description: null,
    status: "DONE",
    priority: "LOW",
    dueDate: new Date("2026-11-20T00:00:00.000Z"),
    assignedToId: USER_OTHER_ID,
    createdById: USER_MANAGER_ID,
    updatedById: USER_MANAGER_ID,
    createdAt: new Date("2026-11-17T00:00:00.000Z"),
    updatedAt: new Date("2026-11-18T00:00:00.000Z"),
    project: { id: PROJECT_ID, name: "Core Platform", status: "ACTIVE" },
    assignee: { id: USER_OTHER_ID, name: "Owen Other", image: null },
    createdBy: { id: USER_MANAGER_ID, name: "Morgan Manager" },
    updatedBy: { id: USER_MANAGER_ID, name: "Morgan Manager" },
  },
];

describe("Task UI Components", () => {
  describe("TaskStatusBadge & TaskPriorityBadge", () => {
    it("renders visible labels for all TaskStatus and TaskPriority values and violet styling for IN_REVIEW", () => {
      expect(renderToString(<TaskStatusBadge status="TODO" />)).toContain("To Do");
      expect(renderToString(<TaskStatusBadge status="IN_PROGRESS" />)).toContain(
        "In Progress",
      );
      const inReviewHtml = renderToString(<TaskStatusBadge status="IN_REVIEW" />);
      expect(inReviewHtml).toContain("In Review");
      expect(inReviewHtml).toContain("violet");
      expect(renderToString(<TaskStatusBadge status="DONE" />)).toContain("Done");

      expect(renderToString(<TaskPriorityBadge priority="LOW" />)).toContain("Low");
      expect(renderToString(<TaskPriorityBadge priority="MEDIUM" />)).toContain(
        "Medium",
      );
      expect(renderToString(<TaskPriorityBadge priority="HIGH" />)).toContain("High");
    });
  });

  describe("TaskDueDate", () => {
    it("marks past incomplete dates as Overdue and excludes DONE tasks", () => {
      const ref = new Date("2026-11-24T12:00:00.000Z");
      const overdueHtml = renderToString(
        <TaskDueDate
          dueDate={new Date("2026-11-20T00:00:00.000Z")}
          status="TODO"
          referenceDate={ref}
        />,
      );
      expect(overdueHtml).toContain("Nov 20, 2026");
      expect(overdueHtml).toContain("Overdue");

      const doneHtml = renderToString(
        <TaskDueDate
          dueDate={new Date("2026-11-20T00:00:00.000Z")}
          status="DONE"
          referenceDate={ref}
        />,
      );
      expect(doneHtml).toContain("Nov 20, 2026");
      expect(doneHtml).not.toContain("Overdue");

      const noneHtml = renderToString(<TaskDueDate dueDate={null} status="TODO" />);
      expect(noneHtml).toContain("No due date");
    });
  });

  describe("TasksManager", () => {
    it("defaults to Board view with Board/List toggle and respects MANAGER controls", () => {
      const html = renderToString(
        <TasksManager
          teamId={TEAM_ID}
          tasks={sampleTasks}
          projects={projects}
          members={members}
          currentUserId={USER_MANAGER_ID}
          currentUserRole="MANAGER"
          referenceDateIso="2026-11-24T12:00:00.000Z"
        />,
      );

      expect(html).toContain('aria-label="Task view mode"');
      expect(html).toContain('aria-pressed="true"');
      expect(html).toContain("Create task in To Do");
      expect(html).toContain("Assigned Member Task");
      expect(html).toContain("New Task");
    });

    it("renders New Task, Edit, and Delete controls for MANAGER/OWNER in List view", () => {
      const html = renderToString(
        <TasksManager
          teamId={TEAM_ID}
          tasks={sampleTasks}
          projects={projects}
          members={members}
          currentUserId={USER_MANAGER_ID}
          currentUserRole="MANAGER"
          initialView="list"
          referenceDateIso="2026-11-24T12:00:00.000Z"
        />,
      );

      expect(html).toContain("New Task");
      expect(html).toContain("Assigned Member Task");
      expect(html).toContain("Teammate Completed Task");
      expect(html).toContain("Mia Member");
      expect(html).toContain("Edit task Assigned Member Task");
      expect(html).toContain("Delete task Assigned Member Task");
    });

    it("hides management buttons for MEMBER and allows status selector ONLY on assigned tasks", () => {
      const html = renderToString(
        <TasksManager
          teamId={TEAM_ID}
          tasks={sampleTasks}
          projects={projects}
          members={members}
          currentUserId={USER_MEMBER_ID}
          currentUserRole="MEMBER"
          initialView="list"
          referenceDateIso="2026-11-24T12:00:00.000Z"
        />,
      );

      expect(html).not.toContain("New Task");
      expect(html).not.toContain("Edit task Assigned Member Task");
      expect(html).not.toContain("Delete task Assigned Member Task");
      expect(html).toContain("Change status for Assigned Member Task");
      expect(html).not.toContain("Change status for Teammate Completed Task");
    });

    it("renders List empty state and empty Board columns cleanly", () => {
      const listHtml = renderToString(
        <TasksManager
          teamId={TEAM_ID}
          tasks={[]}
          projects={projects}
          members={members}
          currentUserId={USER_MANAGER_ID}
          currentUserRole="OWNER"
          initialView="list"
        />,
      );

      expect(listHtml).toContain("No tasks yet");
      expect(listHtml).toContain("Create Task");

      const boardHtml = renderToString(
        <TasksManager
          teamId={TEAM_ID}
          tasks={[]}
          projects={projects}
          members={members}
          currentUserId={USER_MANAGER_ID}
          currentUserRole="OWNER"
          initialView="board"
        />,
      );

      expect(boardHtml).toContain("No tasks in");
      expect(boardHtml).toContain("Create task in To Do");
    });

    it("builds preserved URL view query strings cleanly", () => {
      expect(buildTasksViewUrl("/teams/t1/tasks", "", "list")).toBe(
        "/teams/t1/tasks?view=list",
      );
      expect(buildTasksViewUrl("/teams/t1/tasks", "?foo=bar&view=list", "board")).toBe(
        "/teams/t1/tasks?foo=bar&view=board",
      );
    });

    it("performs optimistic status update, rolls back on server failure, and prevents duplicate pending moves", async () => {
      let currentTasks = [...sampleTasks];
      let pendingIds: string[] = [];
      const setTasks = (updater: (prev: TaskSummary[]) => TaskSummary[]) => {
        currentTasks = updater(currentTasks);
      };
      const setPending = (updater: (prev: string[]) => string[]) => {
        pendingIds = updater(pendingIds);
      };
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const onRefresh = vi.fn();

      // 1. Success case updates optimistically then keeps new status
      const okAction = vi.fn(async () => ({
        success: true as const,
        data: { id: sampleTasks[0]!.id, status: "DONE" as const, noOp: false },
      }));
      await executeOptimisticTaskStatusMove({
        teamId: TEAM_ID,
        task: sampleTasks[0]!,
        nextStatus: "DONE",
        pendingTaskIds: pendingIds,
        setTasks,
        setPendingTaskIds: setPending,
        updateStatus: okAction,
        onSuccess,
        onError,
        onRefresh,
      });

      expect(currentTasks[0]?.status).toBe("DONE");
      expect(pendingIds).toEqual([]);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onRefresh).toHaveBeenCalledTimes(1);

      // 2. Duplicate while pending is ignored
      const dupAction = vi.fn();
      await executeOptimisticTaskStatusMove({
        teamId: TEAM_ID,
        task: sampleTasks[0]!,
        nextStatus: "TODO",
        pendingTaskIds: [sampleTasks[0]!.id],
        setTasks,
        setPendingTaskIds: setPending,
        updateStatus: dupAction,
        onSuccess,
        onError,
        onRefresh,
      });
      expect(dupAction).not.toHaveBeenCalled();

      // 3. Server rejection rolls back to previous status & reconciles
      currentTasks = [...sampleTasks];
      onSuccess.mockClear();
      onError.mockClear();
      onRefresh.mockClear();

      const failAction = vi.fn(async () => ({
        success: false as const,
        error: "Members can only update the status of tasks assigned to them.",
      }));
      await executeOptimisticTaskStatusMove({
        teamId: TEAM_ID,
        task: sampleTasks[0]!,
        nextStatus: "DONE",
        pendingTaskIds: [],
        setTasks,
        setPendingTaskIds: setPending,
        updateStatus: failAction,
        onSuccess,
        onError,
        onRefresh,
      });

      expect(currentTasks[0]?.status).toBe("IN_PROGRESS");
      expect(pendingIds).toEqual([]);
      expect(onError).toHaveBeenCalledWith(
        "Members can only update the status of tasks assigned to them.",
      );
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("renders search, 4 task filters (no project filter), List-only sort controls, pagination, and filtered empty state", () => {
      const listQuery = parseTaskQueryParams({
        view: "list",
        q: "Auth",
        status: "IN_REVIEW",
        priority: "HIGH",
        assignee: "unassigned",
        due: "overdue",
        sort: "dueDate",
        dir: "asc",
        page: "2",
      });

      const toolbarHtml = renderToString(
        <TasksFilterToolbar
          query={listQuery}
          members={members}
          onQueryChange={vi.fn()}
          onClearFilters={vi.fn()}
        />,
      );
      expect(toolbarHtml).toContain("Search tasks or projects");
      expect(toolbarHtml).toContain('aria-label="Filter by status"');
      expect(toolbarHtml).toContain('aria-label="Filter by priority"');
      expect(toolbarHtml).toContain('aria-label="Filter by assignee"');
      expect(toolbarHtml).toContain('aria-label="Filter by due date"');
      expect(toolbarHtml).not.toContain("Filter by project");
      expect(toolbarHtml).toContain('aria-label="Sort tasks by"');
      expect(toolbarHtml).toContain("Clear filters");

      const boardQuery = parseTaskQueryParams({
        view: "board",
        q: "Auth",
      });
      const boardToolbarHtml = renderToString(
        <TasksFilterToolbar
          query={boardQuery}
          members={members}
          onQueryChange={vi.fn()}
          onClearFilters={vi.fn()}
        />,
      );
      expect(boardToolbarHtml).not.toContain('aria-label="Sort tasks by"');

      const filteredEmptyListHtml = renderToString(
        <TasksManager
          teamId={TEAM_ID}
          tasks={[]}
          projects={projects}
          members={members}
          currentUserId={USER_MANAGER_ID}
          currentUserRole="OWNER"
          initialView="list"
          query={listQuery}
          totalCount={0}
          totalPages={1}
        />,
      );
      expect(filteredEmptyListHtml).toContain("No matching tasks");
      expect(filteredEmptyListHtml).toContain("Clear filters");

      const paginatedListHtml = renderToString(
        <TasksManager
          teamId={TEAM_ID}
          tasks={sampleTasks}
          projects={projects}
          members={members}
          currentUserId={USER_MANAGER_ID}
          currentUserRole="OWNER"
          initialView="list"
          query={parseTaskQueryParams({ view: "list", sort: "dueDate", page: "2" })}
          totalCount={60}
          totalPages={3}
        />,
      );
      expect(paginatedListHtml).toContain("Showing 26–50 of 60 tasks");
      expect(paginatedListHtml).toContain('aria-label="Task list pagination"');
      expect(paginatedListHtml).toContain(">2</span>");
      expect(paginatedListHtml).toContain("Previous");
      expect(paginatedListHtml).toContain("Next");

      // Board view must NEVER include page= in URL, and resets page on filter change
      expect(
        buildTasksQueryUrl(
          "/teams/t1/tasks",
          "?view=list&page=3&q=old",
          {
            ...listQuery,
            view: "board",
            page: 3,
          },
        ),
      ).toBe("/teams/t1/tasks?view=board&q=Auth&status=IN_REVIEW&priority=HIGH&assignee=unassigned&due=overdue");
      expect(
        buildTasksQueryUrl(
          "/teams/t1/tasks",
          "?view=list&page=3",
          {
            ...listQuery,
            view: "list",
            page: 2,
          },
        ),
      ).toContain("page=2");
    });
  });

  describe("Dialogs & Timer helpers", () => {
    it("renders TaskFormDialog, DeleteTaskDialog, and TaskDetailDialog cleanly", () => {
      const formHtml = renderToString(
        <TaskFormDialog
          isOpen
          mode="edit"
          teamId={TEAM_ID}
          task={sampleTasks[0]}
          projects={projects}
          members={members}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      );
      expect(formHtml).toContain("Edit Task");
      expect(formHtml).toContain("Assigned Member Task");
      expect(formHtml).toContain("2026-11-20");

      const deleteHtml = renderToString(
        <DeleteTaskDialog
          isOpen
          teamId={TEAM_ID}
          task={sampleTasks[0] ?? null}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      );
      expect(deleteHtml).toContain("Delete Task");
      expect(deleteHtml).toContain("Assigned Member Task");

      const detailHtml = renderToString(
        <TaskDetailDialog
          isOpen
          teamId={TEAM_ID}
          task={sampleTasks[0] ?? null}
          currentUserId={USER_MEMBER_ID}
          currentUserRole="MEMBER"
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onStatusChanged={vi.fn()}
          onCommentMutated={vi.fn()}
        />,
      );
      expect(detailHtml).toContain("Assigned Member Task");
      expect(detailHtml).toContain("Work on task endpoints");
      expect(detailHtml).toContain("Core Platform");
      expect(detailHtml).not.toContain("Edit Task");
      expect(detailHtml).toContain("max-w-2xl");
      expect(detailHtml).toContain('aria-label="Task comments"');
      expect(detailHtml).toContain("Loading comments");

      const detailWithCommentsHtml = renderToString(
        <TaskDetailDialog
          isOpen
          teamId={TEAM_ID}
          task={sampleTasks[0] ?? null}
          currentUserId={USER_MEMBER_ID}
          currentUserRole="MEMBER"
          initialCommentsThread={{
            comments: [
              {
                id: "55555555-5555-4555-8555-555555555551",
                teamId: TEAM_ID,
                taskId: sampleTasks[0]!.id,
                userId: USER_MEMBER_ID,
                content: "Rendered comment inside detail dialog",
                createdAt: "2026-11-25T10:00:00.000Z",
                updatedAt: "2026-11-25T10:00:00.000Z",
                isEdited: false,
                author: { id: USER_MEMBER_ID, name: "Mia Member" },
              },
            ],
            totalCount: 1,
            isCapped: false,
            limit: 200,
          }}
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onStatusChanged={vi.fn()}
          onCommentMutated={vi.fn()}
        />,
      );
      expect(detailWithCommentsHtml).toContain("Comments (1)");
      expect(detailWithCommentsHtml).toContain(
        "Rendered comment inside detail dialog",
      );
      expect(detailWithCommentsHtml).toContain("Edit comment");
    });

    it("guards dialog close helpers while submitting", () => {
      const onClose = vi.fn();
      expect(attemptCloseTaskFormDialog(true, onClose)).toBe(false);
      expect(onClose).not.toHaveBeenCalled();
      expect(attemptCloseTaskFormDialog(false, onClose)).toBe(true);
      expect(onClose).toHaveBeenCalledTimes(1);

      const onDeleteClose = vi.fn();
      expect(attemptCloseDeleteTaskDialog(true, onDeleteClose)).toBe(false);
      expect(onDeleteClose).not.toHaveBeenCalled();
      expect(attemptCloseDeleteTaskDialog(false, onDeleteClose)).toBe(true);
      expect(onDeleteClose).toHaveBeenCalledTimes(1);
    });

    it("schedules and clears toast timers safely", () => {
      vi.useFakeTimers();
      const cb = vi.fn();
      const ref: { current: ReturnType<typeof setTimeout> | null } = {
        current: null,
      };
      scheduleTaskToastTimer(ref, cb, 1000);
      vi.advanceTimersByTime(500);
      clearTaskToastTimer(ref);
      vi.advanceTimersByTime(1000);
      expect(cb).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
