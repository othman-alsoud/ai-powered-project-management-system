import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetActionUser,
  mockRevalidatePath,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetActionUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/features/auth/server", () => ({
  getActionUser: mockGetActionUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}));

import {
  createTaskAction,
  deleteTaskAction,
  updateTaskAction,
  updateTaskStatusAction,
} from "../actions";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_A_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_B_ID = "33333333-3333-4333-8333-333333333333";
const USER_CALLER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_OTHER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_THIRD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TASK_ID = "44444444-4444-4444-8444-444444444444";

interface TxHarnessOptions {
  team?: { id: string; deletedAt: Date | null } | null;
  projects?: Record<string, { id: string; deletedAt: Date | null }>;
  users?: Record<string, { id: string; deletedAt: Date | null }>;
  memberships?: Record<string, { role: "OWNER" | "MANAGER" | "MEMBER" }>;
  preTask?: {
    id: string;
    projectId: string;
    assignedToId: string | null;
  } | null;
  lockedTask?: {
    id: string;
    teamId: string;
    projectId: string;
    title: string;
    description: string | null;
    status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
    priority: "LOW" | "MEDIUM" | "HIGH";
    dueDate: Date | null;
    assignedToId: string | null;
    deletedAt: Date | null;
  } | null;
  lockedTaskExistsInSql?: boolean;
  onTaskUpdate?: (args: Record<string, unknown>) => unknown;
  onTaskCreate?: (args: Record<string, unknown>) => unknown;
}

function createTxHarness(opts: TxHarnessOptions = {}) {
  const lockCalls: Array<{ sql: string; values: unknown[] }> = [];
  const projectsMap = opts.projects ?? {
    [PROJECT_A_ID]: { id: PROJECT_A_ID, deletedAt: null },
    [PROJECT_B_ID]: { id: PROJECT_B_ID, deletedAt: null },
  };
  const usersMap = opts.users ?? {
    [USER_CALLER_ID]: { id: USER_CALLER_ID, deletedAt: null },
    [USER_OTHER_ID]: { id: USER_OTHER_ID, deletedAt: null },
    [USER_THIRD_ID]: { id: USER_THIRD_ID, deletedAt: null },
  };
  const membershipsMap = opts.memberships ?? {
    [USER_CALLER_ID]: { role: "MANAGER" },
    [USER_OTHER_ID]: { role: "MEMBER" },
    [USER_THIRD_ID]: { role: "MEMBER" },
  };

  let findTaskCallCount = 0;

  const tx = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?").replace(/\s+/g, " ").trim();
      lockCalls.push({ sql, values });

      if (sql.includes('FROM "team"')) {
        if (opts.team === null) return [];
        return [opts.team ?? { id: TEAM_ID, deletedAt: null }];
      }

      if (sql.includes('FROM "project"')) {
        const pid = String(values[0]);
        const tid = String(values[1]);
        if (tid !== TEAM_ID) return [];
        const proj = projectsMap[pid];
        return proj ? [proj] : [];
      }

      if (sql.includes('FROM "user"')) {
        const uid = String(values[0]);
        const userRow = usersMap[uid];
        return userRow ? [userRow] : [];
      }

      if (sql.includes('FROM "task"')) {
        if (opts.lockedTaskExistsInSql === false) return [];
        return [{ id: TASK_ID }];
      }

      return [];
    }),
    teamMember: {
      findUnique: vi.fn(async ({ where }: { where: { teamId_userId: { teamId: string; userId: string } } }) => {
        if (where.teamId_userId.teamId !== TEAM_ID) return null;
        return membershipsMap[where.teamId_userId.userId] ?? null;
      }),
    },
    task: {
      findFirst: vi.fn(async () => {
        findTaskCallCount += 1;
        if (findTaskCallCount === 1) {
          return opts.preTask ?? {
            id: TASK_ID,
            projectId: PROJECT_A_ID,
            assignedToId: USER_OTHER_ID,
          };
        }
        return opts.lockedTask === undefined
          ? {
              id: TASK_ID,
              teamId: TEAM_ID,
              projectId: PROJECT_A_ID,
              title: "Original title",
              description: "Original description",
              status: "TODO",
              priority: "MEDIUM",
              dueDate: new Date("2026-12-10T00:00:00.000Z"),
              assignedToId: USER_OTHER_ID,
              deletedAt: null,
            }
          : opts.lockedTask;
      }),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        if (opts.onTaskCreate) return opts.onTaskCreate(args);
        return {
          id: TASK_ID,
          projectId: args.data.projectId,
          title: args.data.title,
          status: args.data.status,
          priority: args.data.priority,
          dueDate: args.data.dueDate ?? null,
          assignedToId: args.data.assignedToId ?? null,
        };
      }),
      update: vi.fn(async (args: Record<string, unknown>) => {
        if (opts.onTaskUpdate) return opts.onTaskUpdate(args);
        return {
          id: TASK_ID,
          projectId: PROJECT_A_ID,
          status: "IN_PROGRESS",
        };
      }),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => usersMap[where.id] ?? null),
    },
    activityLog: {
      create: vi.fn(async () => ({ id: "log-1" })),
    },
    notification: {
      create: vi.fn(async () => ({ id: "notif-1" })),
    },
  };

  mockTransaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) =>
    callback(tx),
  );

  return { tx, lockCalls };
}

describe("task server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActionUser.mockResolvedValue({
      id: USER_CALLER_ID,
      email: "caller@example.com",
    });
  });

  describe("createTaskAction", () => {
    it("rejects unauthenticated callers and malformed teamId before opening a transaction", async () => {
      mockGetActionUser.mockResolvedValueOnce(null);
      const unauth = await createTaskAction(TEAM_ID, {
        projectId: PROJECT_A_ID,
        title: "Test",
      });
      expect(unauth).toEqual({
        success: false,
        error: "You must be signed in to perform this action.",
      });
      expect(mockTransaction).not.toHaveBeenCalled();

      const badTeam = await createTaskAction("bad-team-id", {
        projectId: PROJECT_A_ID,
        title: "Test",
      });
      expect(badTeam).toEqual({ success: false, error: "Invalid team ID." });
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("locks team -> project(teamId) -> sorted deduplicated users (FOR NO KEY UPDATE) and logs task_created", async () => {
      const { tx, lockCalls } = createTxHarness({
        memberships: {
          [USER_CALLER_ID]: { role: "OWNER" },
          [USER_OTHER_ID]: { role: "MEMBER" },
        },
      });

      const result = await createTaskAction(TEAM_ID, {
        projectId: PROJECT_A_ID,
        title: "Build dashboard card",
        description: "  Card UI  ",
        priority: "HIGH",
        dueDate: "2026-12-20",
        assignedToId: USER_OTHER_ID,
      });

      expect(result).toEqual({ success: true, data: { id: TASK_ID } });
      expect(lockCalls.map((c) => c.sql)).toEqual([
        'SELECT id, "deletedAt" FROM "team" WHERE id = ?::uuid FOR NO KEY UPDATE',
        'SELECT id, "deletedAt" FROM "project" WHERE id = ?::uuid AND "teamId" = ?::uuid FOR NO KEY UPDATE',
        'SELECT id, "deletedAt" FROM "user" WHERE id = ?::uuid FOR NO KEY UPDATE',
        'SELECT id, "deletedAt" FROM "user" WHERE id = ?::uuid FOR NO KEY UPDATE',
      ]);
      expect(lockCalls[1]?.values).toEqual([PROJECT_A_ID, TEAM_ID]);
      expect(lockCalls[2]?.values).toEqual([USER_CALLER_ID]);
      expect(lockCalls[3]?.values).toEqual([USER_OTHER_ID]);

      expect(tx.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            teamId: TEAM_ID,
            projectId: PROJECT_A_ID,
            title: "Build dashboard card",
            description: "Card UI",
            status: "TODO",
            priority: "HIGH",
            assignedToId: USER_OTHER_ID,
            createdById: USER_CALLER_ID,
            updatedById: USER_CALLER_ID,
          }),
        }),
      );
      expect(tx.activityLog.create).toHaveBeenCalledWith({
        data: {
          teamId: TEAM_ID,
          actorId: USER_CALLER_ID,
          projectId: PROJECT_A_ID,
          taskId: TASK_ID,
          action: "task_created",
          metadata: {
            title: "Build dashboard card",
            status: "TODO",
            priority: "HIGH",
            assignedToId: USER_OTHER_ID,
            dueDate: "2026-12-20",
          },
        },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/teams/${TEAM_ID}/tasks`);
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/teams/${TEAM_ID}/projects/${PROJECT_A_ID}`,
      );
    });

    it("forbids MEMBER from creating tasks", async () => {
      const { tx } = createTxHarness({
        memberships: {
          [USER_CALLER_ID]: { role: "MEMBER" },
        },
      });

      const result = await createTaskAction(TEAM_ID, {
        projectId: PROJECT_A_ID,
        title: "Unauthorized",
      });

      expect(result).toEqual({
        success: false,
        error: "Only team owners and managers can manage tasks.",
      });
      expect(tx.task.create).not.toHaveBeenCalled();
      expect(tx.activityLog.create).not.toHaveBeenCalled();
    });

    it("rejects soft-deleted or cross-team project and non-member or deleted assignees", async () => {
      createTxHarness({
        projects: {
          [PROJECT_A_ID]: { id: PROJECT_A_ID, deletedAt: new Date() },
        },
      });
      const deletedProject = await createTaskAction(TEAM_ID, {
        projectId: PROJECT_A_ID,
        title: "Task",
      });
      expect(deletedProject).toEqual({ success: false, error: "Project not found." });

      createTxHarness({
        memberships: {
          [USER_CALLER_ID]: { role: "MANAGER" },
        },
      });
      const nonMemberAssignee = await createTaskAction(TEAM_ID, {
        projectId: PROJECT_A_ID,
        title: "Task",
        assignedToId: USER_OTHER_ID,
      });
      expect(nonMemberAssignee).toEqual({
        success: false,
        error: "Assignee must be an active member of this team.",
      });
    });

    it("rejects callers whose user row became soft-deleted before lock acquisition", async () => {
      const { tx } = createTxHarness({
        users: {
          [USER_CALLER_ID]: { id: USER_CALLER_ID, deletedAt: new Date() },
        },
      });

      const result = await createTaskAction(TEAM_ID, {
        projectId: PROJECT_A_ID,
        title: "Ghost call",
      });

      expect(result).toEqual({
        success: false,
        error: "Your account is no longer active.",
      });
      expect(tx.task.create).not.toHaveBeenCalled();
    });
  });

  describe("updateTaskAction", () => {
    it("locks team -> sorted projects -> sorted deduplicated users -> task before mutating", async () => {
      const { tx, lockCalls } = createTxHarness();

      const result = await updateTaskAction(TEAM_ID, {
        taskId: TASK_ID,
        projectId: PROJECT_B_ID,
        title: "Moved task",
        assignedToId: USER_THIRD_ID,
      });

      expect(result).toEqual({
        success: true,
        data: { id: TASK_ID, noOp: false },
      });

      expect(lockCalls.map((c) => c.sql)).toEqual([
        'SELECT id, "deletedAt" FROM "team" WHERE id = ?::uuid FOR NO KEY UPDATE',
        'SELECT id, "deletedAt" FROM "project" WHERE id = ?::uuid AND "teamId" = ?::uuid FOR NO KEY UPDATE',
        'SELECT id, "deletedAt" FROM "project" WHERE id = ?::uuid AND "teamId" = ?::uuid FOR NO KEY UPDATE',
        'SELECT id, "deletedAt" FROM "user" WHERE id = ?::uuid FOR NO KEY UPDATE',
        'SELECT id, "deletedAt" FROM "user" WHERE id = ?::uuid FOR NO KEY UPDATE',
        'SELECT id, "deletedAt" FROM "user" WHERE id = ?::uuid FOR NO KEY UPDATE',
        'SELECT id FROM "task" WHERE id = ?::uuid AND "teamId" = ?::uuid FOR NO KEY UPDATE',
      ]);
      expect(lockCalls[1]?.values).toEqual([PROJECT_A_ID, TEAM_ID]);
      expect(lockCalls[2]?.values).toEqual([PROJECT_B_ID, TEAM_ID]);
      expect(lockCalls[3]?.values).toEqual([USER_CALLER_ID]);
      expect(lockCalls[4]?.values).toEqual([USER_OTHER_ID]);
      expect(lockCalls[5]?.values).toEqual([USER_THIRD_ID]);
      expect(lockCalls[6]?.values).toEqual([TASK_ID, TEAM_ID]);

      expect(tx.activityLog.create).toHaveBeenCalledTimes(1);
      expect(tx.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: TEAM_ID,
          actorId: USER_CALLER_ID,
          projectId: PROJECT_B_ID,
          taskId: TASK_ID,
          action: "task_updated",
          metadata: expect.objectContaining({
            title: "Moved task",
            changedFields: expect.arrayContaining([
              "projectId",
              "title",
              "assignedToId",
            ]),
          }),
        }),
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/teams/${TEAM_ID}/projects/${PROJECT_A_ID}`,
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/teams/${TEAM_ID}/projects/${PROJECT_B_ID}`,
      );
    });

    it("suppresses DB update and ActivityLog on a no-op update", async () => {
      const { tx } = createTxHarness();

      const result = await updateTaskAction(TEAM_ID, {
        taskId: TASK_ID,
        title: "Original title",
        description: "Original description",
        status: "TODO",
        priority: "MEDIUM",
        dueDate: "2026-12-10",
        assignedToId: USER_OTHER_ID,
        projectId: PROJECT_A_ID,
      });

      expect(result).toEqual({
        success: true,
        data: { id: TASK_ID, noOp: true },
      });
      expect(tx.task.update).not.toHaveBeenCalled();
      expect(tx.activityLog.create).not.toHaveBeenCalled();
    });

    it("logs task_assigned when assigning previously unassigned task and task_reassigned when reassigning", async () => {
      const { tx: tx1 } = createTxHarness({
        preTask: { id: TASK_ID, projectId: PROJECT_A_ID, assignedToId: null },
        lockedTask: {
          id: TASK_ID,
          teamId: TEAM_ID,
          projectId: PROJECT_A_ID,
          title: "Unassigned task",
          description: null,
          status: "TODO",
          priority: "MEDIUM",
          dueDate: null,
          assignedToId: null,
          deletedAt: null,
        },
      });

      await updateTaskAction(TEAM_ID, {
        taskId: TASK_ID,
        assignedToId: USER_OTHER_ID,
      });

      expect(tx1.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "task_assigned",
          metadata: {
            title: "Unassigned task",
            assigneeId: USER_OTHER_ID,
          },
        }),
      });

      const { tx: tx2 } = createTxHarness();
      await updateTaskAction(TEAM_ID, {
        taskId: TASK_ID,
        assignedToId: USER_THIRD_ID,
      });

      expect(tx2.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "task_reassigned",
          metadata: {
            title: "Original title",
            previousAssigneeId: USER_OTHER_ID,
            newAssigneeId: USER_THIRD_ID,
          },
        }),
      });
    });

    it("forbids MEMBER from editing task details via updateTaskAction", async () => {
      const { tx } = createTxHarness({
        memberships: {
          [USER_CALLER_ID]: { role: "MEMBER" },
        },
        preTask: {
          id: TASK_ID,
          projectId: PROJECT_A_ID,
          assignedToId: USER_CALLER_ID,
        },
      });

      const result = await updateTaskAction(TEAM_ID, {
        taskId: TASK_ID,
        title: "Member edit attempt",
      });

      expect(result).toEqual({
        success: false,
        error: "Only team owners and managers can manage tasks.",
      });
      expect(tx.task.update).not.toHaveBeenCalled();
    });
  });

  describe("updateTaskStatusAction", () => {
    it("allows MEMBER to update status ONLY when assignedToId === user.id after locking task", async () => {
      const { tx, lockCalls } = createTxHarness({
        memberships: {
          [USER_CALLER_ID]: { role: "MEMBER" },
        },
        preTask: {
          id: TASK_ID,
          projectId: PROJECT_A_ID,
          assignedToId: USER_CALLER_ID,
        },
        lockedTask: {
          id: TASK_ID,
          teamId: TEAM_ID,
          projectId: PROJECT_A_ID,
          title: "Member task",
          description: null,
          status: "TODO",
          priority: "MEDIUM",
          dueDate: null,
          assignedToId: USER_CALLER_ID,
          deletedAt: null,
        },
      });

      const result = await updateTaskStatusAction(TEAM_ID, {
        taskId: TASK_ID,
        status: "IN_PROGRESS",
      });

      expect(result).toEqual({
        success: true,
        data: { id: TASK_ID, status: "IN_PROGRESS", noOp: false },
      });
      expect(lockCalls.map((c) => c.sql)).toEqual([
        'SELECT id, "deletedAt" FROM "team" WHERE id = ?::uuid FOR NO KEY UPDATE',
        'SELECT id, "deletedAt" FROM "project" WHERE id = ?::uuid AND "teamId" = ?::uuid FOR NO KEY UPDATE',
        'SELECT id, "deletedAt" FROM "user" WHERE id = ?::uuid FOR NO KEY UPDATE',
        'SELECT id FROM "task" WHERE id = ?::uuid AND "teamId" = ?::uuid FOR NO KEY UPDATE',
      ]);
      expect(tx.activityLog.create).toHaveBeenCalledWith({
        data: {
          teamId: TEAM_ID,
          actorId: USER_CALLER_ID,
          projectId: PROJECT_A_ID,
          taskId: TASK_ID,
          action: "task_status_changed",
          metadata: {
            title: "Member task",
            previousStatus: "TODO",
            newStatus: "IN_PROGRESS",
          },
        },
      });
    });

    it("rejects MEMBER when task is assigned to another user or unassigned concurrently", async () => {
      const { tx } = createTxHarness({
        memberships: {
          [USER_CALLER_ID]: { role: "MEMBER" },
        },
        preTask: {
          id: TASK_ID,
          projectId: PROJECT_A_ID,
          assignedToId: USER_CALLER_ID,
        },
        lockedTask: {
          id: TASK_ID,
          teamId: TEAM_ID,
          projectId: PROJECT_A_ID,
          title: "Member task",
          description: null,
          status: "TODO",
          priority: "MEDIUM",
          dueDate: null,
          assignedToId: null,
          deletedAt: null,
        },
      });

      const result = await updateTaskStatusAction(TEAM_ID, {
        taskId: TASK_ID,
        status: "DONE",
      });

      expect(result).toEqual({
        success: false,
        error: "Members can only update the status of tasks assigned to them.",
      });
      expect(tx.task.update).not.toHaveBeenCalled();
    });

    it("suppresses DB write and ActivityLog on no-op status change", async () => {
      const { tx } = createTxHarness();

      const result = await updateTaskStatusAction(TEAM_ID, {
        taskId: TASK_ID,
        status: "TODO",
      });

      expect(result).toEqual({
        success: true,
        data: { id: TASK_ID, status: "TODO", noOp: true },
      });
      expect(tx.task.update).not.toHaveBeenCalled();
      expect(tx.activityLog.create).not.toHaveBeenCalled();
    });
  });

  describe("deleteTaskAction", () => {
    it("soft-deletes task, clears assignedToId to null, records previousAssigneeId in ActivityLog, and never calls delete()", async () => {
      const { tx, lockCalls } = createTxHarness();

      const result = await deleteTaskAction(TEAM_ID, { taskId: TASK_ID });

      expect(result).toEqual({ success: true, data: { id: TASK_ID } });
      expect(lockCalls.map((c) => c.sql)).toEqual([
        'SELECT id, "deletedAt" FROM "team" WHERE id = ?::uuid FOR NO KEY UPDATE',
        'SELECT id, "deletedAt" FROM "project" WHERE id = ?::uuid AND "teamId" = ?::uuid FOR NO KEY UPDATE',
        'SELECT id, "deletedAt" FROM "user" WHERE id = ?::uuid FOR NO KEY UPDATE',
        'SELECT id, "deletedAt" FROM "user" WHERE id = ?::uuid FOR NO KEY UPDATE',
        'SELECT id FROM "task" WHERE id = ?::uuid AND "teamId" = ?::uuid FOR NO KEY UPDATE',
      ]);
      expect(tx.task.delete).not.toHaveBeenCalled();
      expect(tx.task.update).toHaveBeenCalledWith({
        where: { id: TASK_ID },
        data: {
          deletedAt: expect.any(Date),
          assignedToId: null,
          updatedById: USER_CALLER_ID,
        },
      });
      expect(tx.activityLog.create).toHaveBeenCalledWith({
        data: {
          teamId: TEAM_ID,
          actorId: USER_CALLER_ID,
          projectId: PROJECT_A_ID,
          taskId: TASK_ID,
          action: "task_deleted",
          metadata: {
            title: "Original title",
            previousAssigneeId: USER_OTHER_ID,
          },
        },
      });
    });

    it("sanitizes unexpected database errors", async () => {
      mockTransaction.mockRejectedValueOnce(new Error("deadlock detected at relation xyz"));

      const result = await deleteTaskAction(TEAM_ID, { taskId: TASK_ID });

      expect(result).toEqual({
        success: false,
        error: "Unable to complete task action. Please try again.",
      });
    });
  });

  describe("M3.3 notification dispatch", () => {
    it("createTaskAction notifies assignee on assignment and skips unassigned/self-assignment", async () => {
      const { tx: txAssigned } = createTxHarness();
      await createTaskAction(TEAM_ID, {
        projectId: PROJECT_A_ID,
        title: "Implement webhook",
        assignedToId: USER_OTHER_ID,
      });

      expect(txAssigned.notification.create).toHaveBeenCalledTimes(1);
      expect(txAssigned.notification.create).toHaveBeenCalledWith({
        data: {
          userId: USER_OTHER_ID,
          actorId: USER_CALLER_ID,
          teamId: TEAM_ID,
          projectId: PROJECT_A_ID,
          taskId: TASK_ID,
          type: "task_assigned",
          title: "Task assigned",
          message: 'You were assigned to "Implement webhook".',
        },
      });

      const { tx: txSelf } = createTxHarness();
      await createTaskAction(TEAM_ID, {
        projectId: PROJECT_A_ID,
        title: "Self task",
        assignedToId: USER_CALLER_ID,
      });
      expect(txSelf.notification.create).not.toHaveBeenCalled();

      const { tx: txUnassigned } = createTxHarness();
      await createTaskAction(TEAM_ID, {
        projectId: PROJECT_A_ID,
        title: "Backlog task",
        assignedToId: null,
      });
      expect(txUnassigned.notification.create).not.toHaveBeenCalled();
    });

    it("updateTaskAction notifies only new assignee on reassignment, skips unassignment, no-op, and self-assignment", async () => {
      const { tx: txReassign } = createTxHarness();
      await updateTaskAction(TEAM_ID, {
        taskId: TASK_ID,
        assignedToId: USER_THIRD_ID,
      });
      expect(txReassign.notification.create).toHaveBeenCalledTimes(1);
      expect(txReassign.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: USER_THIRD_ID,
          actorId: USER_CALLER_ID,
          taskId: TASK_ID,
          type: "task_assigned",
        }),
      });

      const { tx: txUnassign } = createTxHarness();
      await updateTaskAction(TEAM_ID, {
        taskId: TASK_ID,
        assignedToId: null,
      });
      expect(txUnassign.notification.create).not.toHaveBeenCalled();

      const { tx: txSelf } = createTxHarness();
      await updateTaskAction(TEAM_ID, {
        taskId: TASK_ID,
        assignedToId: USER_CALLER_ID,
      });
      expect(txSelf.notification.create).not.toHaveBeenCalled();

      const { tx: txNoOp } = createTxHarness();
      await updateTaskAction(TEAM_ID, {
        taskId: TASK_ID,
        title: "Original title",
      });
      expect(txNoOp.notification.create).not.toHaveBeenCalled();
    });

    it("updateTaskAction sends ONLY task_assigned (never task_status_changed or previous assignee notice) on combined assignee + status change", async () => {
      const { tx } = createTxHarness();

      const res = await updateTaskAction(TEAM_ID, {
        taskId: TASK_ID,
        assignedToId: USER_THIRD_ID,
        status: "IN_REVIEW",
      });

      expect(res).toEqual({
        success: true,
        data: { id: TASK_ID, noOp: false },
      });
      expect(tx.notification.create).toHaveBeenCalledTimes(1);
      expect(tx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: USER_THIRD_ID,
          actorId: USER_CALLER_ID,
          projectId: PROJECT_A_ID,
          taskId: TASK_ID,
          type: "task_assigned",
          title: "Task assigned",
          message: 'You were assigned to "Original title".',
        }),
      });
    });

    it("updateTaskAction notifies locked active assignee on status change, skips deleted/former/unlocked recipients, and never calls fallback user.findUnique", async () => {
      const { tx: txStatus } = createTxHarness();
      await updateTaskAction(TEAM_ID, {
        taskId: TASK_ID,
        status: "IN_REVIEW",
      });
      expect(txStatus.user.findUnique).not.toHaveBeenCalled();
      expect(txStatus.notification.create).toHaveBeenCalledTimes(1);
      expect(txStatus.notification.create).toHaveBeenCalledWith({
        data: {
          userId: USER_OTHER_ID,
          actorId: USER_CALLER_ID,
          teamId: TEAM_ID,
          projectId: PROJECT_A_ID,
          taskId: TASK_ID,
          type: "task_status_changed",
          title: "Task status updated",
          message: '"Original title" moved from To Do to In Review.',
        },
      });

      const { tx: txDeletedAssignee } = createTxHarness({
        users: {
          [USER_CALLER_ID]: { id: USER_CALLER_ID, deletedAt: null },
          [USER_OTHER_ID]: { id: USER_OTHER_ID, deletedAt: new Date() },
        },
      });
      const resDeleted = await updateTaskAction(TEAM_ID, {
        taskId: TASK_ID,
        status: "DONE",
      });
      expect(resDeleted.success).toBe(true);
      expect(txDeletedAssignee.user.findUnique).not.toHaveBeenCalled();
      expect(txDeletedAssignee.notification.create).not.toHaveBeenCalled();

      const { tx: txFormerMember } = createTxHarness({
        memberships: {
          [USER_CALLER_ID]: { role: "MANAGER" },
        },
      });
      const resFormer = await updateTaskAction(TEAM_ID, {
        taskId: TASK_ID,
        status: "DONE",
      });
      expect(resFormer.success).toBe(true);
      expect(txFormerMember.user.findUnique).not.toHaveBeenCalled();
      expect(txFormerMember.notification.create).not.toHaveBeenCalled();

      const { tx: txAbsentFromLockedUsers } = createTxHarness({
        preTask: {
          id: TASK_ID,
          projectId: PROJECT_A_ID,
          assignedToId: null,
        },
        lockedTask: {
          id: TASK_ID,
          teamId: TEAM_ID,
          projectId: PROJECT_A_ID,
          title: "Original title",
          description: "Original description",
          status: "TODO",
          priority: "MEDIUM",
          dueDate: new Date("2026-12-10T00:00:00.000Z"),
          assignedToId: USER_OTHER_ID,
          deletedAt: null,
        },
      });
      const resUnlocked = await updateTaskAction(TEAM_ID, {
        taskId: TASK_ID,
        status: "IN_REVIEW",
      });
      expect(resUnlocked.success).toBe(true);
      expect(txAbsentFromLockedUsers.user.findUnique).not.toHaveBeenCalled();
      expect(txAbsentFromLockedUsers.notification.create).not.toHaveBeenCalled();
    });

    it("updateTaskStatusAction notifies assignee when updated by another user, and skips self/no-op/unassigned", async () => {
      const { tx: txManager } = createTxHarness();
      const resManager = await updateTaskStatusAction(TEAM_ID, {
        taskId: TASK_ID,
        status: "IN_REVIEW",
      });
      expect(resManager.success).toBe(true);
      expect(txManager.notification.create).toHaveBeenCalledTimes(1);
      expect(txManager.notification.create).toHaveBeenCalledWith({
        data: {
          userId: USER_OTHER_ID,
          actorId: USER_CALLER_ID,
          teamId: TEAM_ID,
          projectId: PROJECT_A_ID,
          taskId: TASK_ID,
          type: "task_status_changed",
          title: "Task status updated",
          message: '"Original title" moved from To Do to In Review.',
        },
      });

      const { tx: txSelfMember } = createTxHarness({
        memberships: { [USER_CALLER_ID]: { role: "MEMBER" } },
        preTask: { id: TASK_ID, projectId: PROJECT_A_ID, assignedToId: USER_CALLER_ID },
        lockedTask: {
          id: TASK_ID,
          teamId: TEAM_ID,
          projectId: PROJECT_A_ID,
          title: "Member task",
          description: null,
          status: "TODO",
          priority: "MEDIUM",
          dueDate: null,
          assignedToId: USER_CALLER_ID,
          deletedAt: null,
        },
      });
      await updateTaskStatusAction(TEAM_ID, {
        taskId: TASK_ID,
        status: "DONE",
      });
      expect(txSelfMember.notification.create).not.toHaveBeenCalled();

      const { tx: txNoOp } = createTxHarness();
      await updateTaskStatusAction(TEAM_ID, {
        taskId: TASK_ID,
        status: "TODO",
      });
      expect(txNoOp.notification.create).not.toHaveBeenCalled();

      const { tx: txUnassigned } = createTxHarness({
        preTask: { id: TASK_ID, projectId: PROJECT_A_ID, assignedToId: null },
        lockedTask: {
          id: TASK_ID,
          teamId: TEAM_ID,
          projectId: PROJECT_A_ID,
          title: "Unassigned",
          description: null,
          status: "TODO",
          priority: "MEDIUM",
          dueDate: null,
          assignedToId: null,
          deletedAt: null,
        },
      });
      await updateTaskStatusAction(TEAM_ID, {
        taskId: TASK_ID,
        status: "IN_PROGRESS",
      });
      expect(txUnassigned.notification.create).not.toHaveBeenCalled();

      const { tx: txAbsentRecipient } = createTxHarness({
        preTask: { id: TASK_ID, projectId: PROJECT_A_ID, assignedToId: null },
        lockedTask: {
          id: TASK_ID,
          teamId: TEAM_ID,
          projectId: PROJECT_A_ID,
          title: "Unlocked assignee",
          description: null,
          status: "TODO",
          priority: "MEDIUM",
          dueDate: null,
          assignedToId: USER_OTHER_ID,
          deletedAt: null,
        },
      });
      const unlockedStatusRes = await updateTaskStatusAction(TEAM_ID, {
        taskId: TASK_ID,
        status: "IN_PROGRESS",
      });
      expect(unlockedStatusRes.success).toBe(true);
      expect(txAbsentRecipient.user.findUnique).not.toHaveBeenCalled();
      expect(txAbsentRecipient.notification.create).not.toHaveBeenCalled();
    });
  });
});
