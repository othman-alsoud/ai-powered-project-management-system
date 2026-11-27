import type {
  Prisma,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  TeamRole,
} from "@/generated/prisma/client";
import type { ActivityAction } from "./types";

export type ActivityWriteEntry =
  | {
      teamId: string;
      actorId: string | null;
      action: "team_created";
      metadata: { teamName: string };
    }
  | {
      teamId: string;
      actorId: string | null;
      action: "member_added";
      metadata: {
        addedUserId: string;
        role: TeamRole;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      action: "member_role_updated";
      metadata: {
        targetUserId: string;
        previousRole: TeamRole;
        newRole: TeamRole;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      action: "member_removed";
      metadata: {
        removedUserId: string;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      action: "ownership_transferred";
      metadata: {
        previousOwnerId: string;
        newOwnerId: string;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      action: "member_departed";
      metadata: {
        reason: "account_deleted";
        previousRole: TeamRole;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      projectId: string;
      action: "project_created";
      metadata: {
        projectName: string;
        status: ProjectStatus;
        startDate: string | null;
        endDate: string | null;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      projectId: string;
      action: "project_updated";
      metadata: {
        projectName: string;
        changedFields: string[];
        previousStatus?: ProjectStatus;
        newStatus?: ProjectStatus;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      projectId: string;
      action: "project_deleted";
      metadata: {
        projectName: string;
        previousStatus: ProjectStatus;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      projectId: string;
      taskId: string;
      action: "task_created";
      metadata: {
        title: string;
        status: TaskStatus;
        priority: TaskPriority;
        assignedToId: string | null;
        dueDate: string | null;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      projectId: string;
      taskId: string;
      action: "task_updated";
      metadata: {
        title: string;
        changedFields: string[];
        previousStatus?: TaskStatus;
        newStatus?: TaskStatus;
        previousAssigneeId?: string | null;
        newAssigneeId?: string | null;
        previousProjectId?: string;
        newProjectId?: string;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      projectId: string;
      taskId: string;
      action: "task_status_changed";
      metadata: {
        title: string;
        previousStatus: TaskStatus;
        newStatus: TaskStatus;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      projectId: string;
      taskId: string;
      action: "task_assigned";
      metadata: {
        title: string;
        assigneeId: string;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      projectId: string;
      taskId: string;
      action: "task_reassigned";
      metadata: {
        title: string;
        previousAssigneeId: string;
        newAssigneeId: string;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      projectId: string;
      taskId: string;
      action: "task_deleted";
      metadata: {
        title: string;
        previousAssigneeId: string | null;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      projectId: string;
      taskId: string;
      commentId: string;
      action: "comment_created";
      metadata: {
        taskId: string;
        taskTitle: string;
        commentId: string;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      projectId: string;
      taskId: string;
      commentId: string;
      action: "comment_updated";
      metadata: {
        taskId: string;
        taskTitle: string;
        commentId: string;
      };
    }
  | {
      teamId: string;
      actorId: string | null;
      projectId: string;
      taskId: string;
      commentId: string;
      action: "comment_deleted";
      metadata: {
        taskId: string;
        taskTitle: string;
        commentId: string;
        deletedByRole: TeamRole;
        isSelfDelete: boolean;
      };
    };

export interface ActivityLogRecordData {
  teamId: string;
  actorId: string | null;
  projectId?: string;
  taskId?: string;
  commentId?: string;
  action: ActivityAction;
  metadata: Prisma.InputJsonValue;
}

export interface ActivityLogCreateTx {
  activityLog: {
    create: (args: { data: ActivityLogRecordData }) => Promise<unknown>;
  };
}

export interface ActivityLogCreateManyTx {
  activityLog: {
    createMany: (args: { data: ActivityLogRecordData[] }) => Promise<unknown>;
  };
}

function toActivityLogRecordData(
  entry: ActivityWriteEntry,
): ActivityLogRecordData {
  const data: ActivityLogRecordData = {
    teamId: entry.teamId,
    actorId: entry.actorId,
    action: entry.action,
    metadata: entry.metadata as Prisma.InputJsonValue,
  };

  if ("projectId" in entry && entry.projectId !== undefined) {
    data.projectId = entry.projectId;
  }
  if ("taskId" in entry && entry.taskId !== undefined) {
    data.taskId = entry.taskId;
  }
  if ("commentId" in entry && entry.commentId !== undefined) {
    data.commentId = entry.commentId;
  }

  return data;
}

/**
 * Appends a single immutable ActivityLog record using the caller's transaction client.
 */
export async function recordActivityLog(
  tx: ActivityLogCreateTx,
  entry: ActivityWriteEntry,
): Promise<void> {
  await tx.activityLog.create({
    data: toActivityLogRecordData(entry),
  });
}

/**
 * Appends multiple immutable ActivityLog records using createMany inside the caller's transaction.
 */
export async function recordActivityLogs(
  tx: ActivityLogCreateManyTx,
  entries: ActivityWriteEntry[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  await tx.activityLog.createMany({
    data: entries.map(toActivityLogRecordData),
  });
}
