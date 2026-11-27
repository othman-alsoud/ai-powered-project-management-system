import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
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

import { TaskFormDialog } from "../components/task-form-dialog";
import { TaskKanbanCardView } from "../components/task-kanban-card";
import { TaskKanbanColumn } from "../components/task-kanban-column";
import {
  TaskKanbanBoard,
  handleKanbanDragEnd,
} from "../components/task-kanban-board";
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

const boardTasks: TaskSummary[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title: "Member Assigned Task",
    description: "Work on Kanban card interactions",
    status: "TODO",
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
    title: "Teammate In Review Task",
    description: null,
    status: "IN_REVIEW",
    priority: "MEDIUM",
    dueDate: null,
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
  {
    id: "55555555-5555-4555-8555-555555555555",
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title: "Unassigned Completed Task",
    description: null,
    status: "DONE",
    priority: "LOW",
    dueDate: new Date("2026-11-15T00:00:00.000Z"),
    assignedToId: null,
    createdById: USER_MANAGER_ID,
    updatedById: null,
    createdAt: new Date("2026-11-14T00:00:00.000Z"),
    updatedAt: new Date("2026-11-15T00:00:00.000Z"),
    project: { id: PROJECT_ID, name: "Core Platform", status: "ACTIVE" },
    assignee: null,
    createdBy: { id: USER_MANAGER_ID, name: "Morgan Manager" },
    updatedBy: null,
  },
];

describe("Kanban Board Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders TaskKanbanBoard with 4 columns, status labels, counts, mobile tabs, and quick-create buttons for MANAGER", () => {
    const html = renderToString(
      <TaskKanbanBoard
        tasks={boardTasks}
        currentUserId={USER_MANAGER_ID}
        currentUserRole="MANAGER"
        canManageTasks
        hasProjects
        pendingTaskIds={[]}
        referenceDate={new Date("2026-11-24T12:00:00.000Z")}
        onSelectTask={vi.fn()}
        onMoveTaskStatus={vi.fn()}
        onQuickCreate={vi.fn()}
      />,
    );

    expect(html).toContain("To Do");
    expect(html).toContain("In Progress");
    expect(html).toContain("In Review");
    expect(html).toContain("Done");
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain("Create task in To Do");
    expect(html).toContain("Create task in In Progress");
    expect(html).toContain("Create task in In Review");
    expect(html).toContain("Create task in Done");
    expect(html).toContain("Member Assigned Task");
    expect(html).toContain("Teammate In Review Task");
    expect(html).toContain("Core Platform");
    expect(html).toContain("Overdue");
    expect(html).not.toContain("TASK-042");
  });

  it("hides quick-create controls for MEMBER and exposes move/drag controls ONLY on tasks assigned to that MEMBER", () => {
    const html = renderToString(
      <TaskKanbanBoard
        tasks={boardTasks}
        currentUserId={USER_MEMBER_ID}
        currentUserRole="MEMBER"
        canManageTasks={false}
        hasProjects
        pendingTaskIds={[]}
        referenceDate={new Date("2026-11-24T12:00:00.000Z")}
        onSelectTask={vi.fn()}
        onMoveTaskStatus={vi.fn()}
        onQuickCreate={vi.fn()}
      />,
    );

    expect(html).not.toContain("Create task in To Do");
    expect(html).toContain("Drag task Member Assigned Task");
    expect(html).toContain("h-11 w-11 md:h-7 md:w-7");
    expect(html).toContain("Change status for Member Assigned Task");
    expect(html).not.toContain("Drag task Teammate In Review Task");
    expect(html).not.toContain("Change status for Teammate In Review Task");
    expect(html).not.toContain("Drag task Unassigned Completed Task");
  });

  it("omits project pill when scopedProjectId is true and renders empty column fallback cleanly", () => {
    const cardHtml = renderToString(
      <TaskKanbanCardView
        task={boardTasks[0]!}
        canMove
        isPending={false}
        scopedProject
        referenceDate={new Date("2026-11-24T12:00:00.000Z")}
        onSelectTask={vi.fn()}
        onMoveTaskStatus={vi.fn()}
      />,
    );

    expect(cardHtml).toContain("Member Assigned Task");
    expect(cardHtml).not.toContain("Core Platform");

    const emptyColHtml = renderToString(
      <TaskKanbanColumn
        status="IN_PROGRESS"
        tasks={[]}
        currentUserId={USER_MANAGER_ID}
        currentUserRole="OWNER"
        canManageTasks
        hasProjects
        pendingTaskIds={[]}
        onSelectTask={vi.fn()}
        onMoveTaskStatus={vi.fn()}
        onQuickCreate={vi.fn()}
      />,
    );

    expect(emptyColHtml).toContain("No tasks in In Progress");
  });

  it("pre-selects defaultStatus inside TaskFormDialog when quick-creating from a column", () => {
    const html = renderToString(
      <TaskFormDialog
        isOpen
        mode="create"
        teamId={TEAM_ID}
        projects={projects}
        members={members}
        defaultStatus="IN_REVIEW"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(html).toContain("Create Task");
    expect(html).toMatch(/<option value="IN_REVIEW" selected=""/);
  });

  it("handles drag-and-drop transitions, same-column no-ops, pending guards, and MEMBER authorization cleanly", () => {
    const onMoveTaskStatus = vi.fn();

    // Valid MANAGER move across mobile droppable tabs
    const movedViaTab = handleKanbanDragEnd({
      activeId: boardTasks[0]!.id,
      overId: "tab:IN_REVIEW",
      tasks: boardTasks,
      currentUserId: USER_MANAGER_ID,
      currentUserRole: "MANAGER",
      pendingTaskIds: [],
      onMoveTaskStatus,
    });
    expect(movedViaTab).toBe(true);
    expect(onMoveTaskStatus).toHaveBeenCalledWith(boardTasks[0], "IN_REVIEW");

    onMoveTaskStatus.mockClear();

    // Valid MANAGER move across columns
    const moved = handleKanbanDragEnd({
      activeId: boardTasks[0]!.id,
      overId: "column:IN_PROGRESS",
      tasks: boardTasks,
      currentUserId: USER_MANAGER_ID,
      currentUserRole: "MANAGER",
      pendingTaskIds: [],
      onMoveTaskStatus,
    });
    expect(moved).toBe(true);
    expect(onMoveTaskStatus).toHaveBeenCalledWith(boardTasks[0], "IN_PROGRESS");

    onMoveTaskStatus.mockClear();

    // Same-column drop is a no-op
    expect(
      handleKanbanDragEnd({
        activeId: boardTasks[0]!.id,
        overId: "column:TODO",
        tasks: boardTasks,
        currentUserId: USER_MANAGER_ID,
        currentUserRole: "MANAGER",
        pendingTaskIds: [],
        onMoveTaskStatus,
      }),
    ).toBe(false);
    expect(onMoveTaskStatus).not.toHaveBeenCalled();

    // Pending task blocks duplicate submission
    expect(
      handleKanbanDragEnd({
        activeId: boardTasks[0]!.id,
        overId: "column:DONE",
        tasks: boardTasks,
        currentUserId: USER_MANAGER_ID,
        currentUserRole: "MANAGER",
        pendingTaskIds: [boardTasks[0]!.id],
        onMoveTaskStatus,
      }),
    ).toBe(false);
    expect(onMoveTaskStatus).not.toHaveBeenCalled();

    // MEMBER cannot move teammate's task
    expect(
      handleKanbanDragEnd({
        activeId: boardTasks[1]!.id,
        overId: "column:DONE",
        tasks: boardTasks,
        currentUserId: USER_MEMBER_ID,
        currentUserRole: "MEMBER",
        pendingTaskIds: [],
        onMoveTaskStatus,
      }),
    ).toBe(false);
    expect(onMoveTaskStatus).not.toHaveBeenCalled();
  });
});
