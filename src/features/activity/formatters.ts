import type { BadgeProps } from "@/components/ui/badge";
import type {
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  TeamRole,
} from "@/generated/prisma/client";
import { DELETED_USER_DISPLAY_NAME } from "./constants";
import type { ActivityAction, ActivityLogItemDTO } from "./types";

const ROLE_LABELS: Record<TeamRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  MEMBER: "Member",
};

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  team_created: "Team created",
  member_added: "Member added",
  member_role_updated: "Member role updated",
  member_removed: "Member removed",
  ownership_transferred: "Ownership transferred",
  member_departed: "Member departed",
  project_created: "Project created",
  project_updated: "Project updated",
  project_deleted: "Project deleted",
  task_created: "Task created",
  task_updated: "Task updated",
  task_status_changed: "Task status changed",
  task_assigned: "Task assigned",
  task_reassigned: "Task reassigned",
  task_deleted: "Task deleted",
  comment_created: "Comment added",
  comment_updated: "Comment edited",
  comment_deleted: "Comment deleted",
};

const UTC_ACTIVITY_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
  timeZoneName: "short",
});

/**
 * Formats an activity timestamp strictly in UTC for deterministic SSR & hydration.
 */
export function formatUtcActivityTimestamp(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return UTC_ACTIVITY_TIMESTAMP_FORMATTER.format(date);
}

export interface FormattedActivityEntry {
  summary: string;
  badgeLabel: string;
  badgeVariant: NonNullable<BadgeProps["variant"]>;
  detailNote?: string;
  projectHref: string | null;
  taskHref: string | null;
}

function userLabel(name: string | undefined): string {
  return name && name.trim().length > 0 ? name : DELETED_USER_DISPLAY_NAME;
}

function formatRoleLabel(role: TeamRole | undefined): string {
  return role ? ROLE_LABELS[role] : "Member";
}

function formatProjectStatusLabel(status: ProjectStatus | undefined): string {
  return status ? PROJECT_STATUS_LABELS[status] : "Unknown";
}

function formatTaskStatusLabel(status: TaskStatus | undefined): string {
  return status ? TASK_STATUS_LABELS[status] : "Unknown";
}

function formatChangedFieldsList(fields: string[] | undefined): string | undefined {
  if (!fields || fields.length === 0) return undefined;
  const labels: Record<string, string> = {
    name: "name",
    description: "description",
    status: "status",
    startDate: "start date",
    endDate: "target end date",
    title: "title",
    priority: "priority",
    dueDate: "due date",
    assignedToId: "assignee",
    projectId: "project",
  };
  return fields.map((f) => labels[f] ?? f).join(", ");
}

/**
 * Converts a sanitized ActivityLogItemDTO into deterministic human-readable text,
 * badge styling, and safe navigation links (never linking to deleted entities).
 */
export function formatActivityEntry(
  item: ActivityLogItemDTO,
): FormattedActivityEntry {
  const { action, details, project, task, teamId } = item;

  const activeProjectHref =
    project && !project.isDeleted
      ? `/teams/${teamId}/projects/${project.id}`
      : null;

  // Task references link to the active parent project detail page (Decision #4)
  // rather than unverified search queries or deleted task entities.
  const activeTaskHref =
    task && !task.isDeleted && activeProjectHref ? activeProjectHref : null;

  const projectName = details.projectName ?? project?.label ?? "project";
  const taskTitle = details.taskTitle ?? task?.label ?? "task";

  switch (action) {
    case "team_created":
      return {
        summary: `created team "${details.teamName ?? "Workspace"}"`,
        badgeLabel: "Workspace",
        badgeVariant: "teal",
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };

    case "member_added": {
      const targetName = userLabel(details.targetUser?.name);
      return {
        summary: `added ${targetName} as ${formatRoleLabel(details.role)}`,
        badgeLabel: "Member",
        badgeVariant: "teal",
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };
    }

    case "member_role_updated": {
      const targetName = userLabel(details.targetUser?.name);
      return {
        summary: `changed ${targetName}'s role from ${formatRoleLabel(details.previousRole)} to ${formatRoleLabel(details.newRole)}`,
        badgeLabel: "Role",
        badgeVariant: "purple",
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };
    }

    case "member_removed": {
      const targetName = userLabel(details.targetUser?.name);
      return {
        summary: `removed ${targetName} from the team`,
        badgeLabel: "Member",
        badgeVariant: "rose",
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };
    }

    case "ownership_transferred": {
      const nextOwner = userLabel(details.newOwner?.name);
      return {
        summary: `transferred team ownership to ${nextOwner}`,
        badgeLabel: "Ownership",
        badgeVariant: "amber",
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };
    }

    case "member_departed":
      return {
        summary: "left the team (account deleted)",
        badgeLabel: "Departure",
        badgeVariant: "slate",
        detailNote: details.previousRole
          ? `Previous role: ${formatRoleLabel(details.previousRole)}`
          : undefined,
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };

    case "project_created":
      return {
        summary: `created project "${projectName}"`,
        badgeLabel: "Project",
        badgeVariant: "blue",
        detailNote: details.projectStatus
          ? `Status: ${formatProjectStatusLabel(details.projectStatus)}`
          : undefined,
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };

    case "project_updated": {
      if (details.previousProjectStatus && details.newProjectStatus) {
        const extraFields = details.changedFields?.filter((f) => f !== "status");
        const formattedExtras = formatChangedFieldsList(extraFields);
        return {
          summary: `changed project "${projectName}" status from ${formatProjectStatusLabel(details.previousProjectStatus)} to ${formatProjectStatusLabel(details.newProjectStatus)}`,
          badgeLabel: "Project",
          badgeVariant: "blue",
          detailNote: formattedExtras ? `Also updated: ${formattedExtras}` : undefined,
          projectHref: activeProjectHref,
          taskHref: activeTaskHref,
        };
      }

      const fieldsNote = formatChangedFieldsList(details.changedFields);
      return {
        summary: `updated project "${projectName}"`,
        badgeLabel: "Project",
        badgeVariant: "blue",
        detailNote: fieldsNote ? `Updated: ${fieldsNote}` : undefined,
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };
    }

    case "project_deleted":
      return {
        summary: `deleted project "${projectName}"`,
        badgeLabel: "Project",
        badgeVariant: "rose",
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };

    case "task_created": {
      const notes: string[] = [];
      if (details.taskPriority) {
        notes.push(`Priority: ${TASK_PRIORITY_LABELS[details.taskPriority]}`);
      }
      if (details.assignee) {
        notes.push(`Assigned to ${userLabel(details.assignee.name)}`);
      }
      return {
        summary: `created task "${taskTitle}"`,
        badgeLabel: "Task",
        badgeVariant: "emerald",
        detailNote: notes.length > 0 ? notes.join(" · ") : undefined,
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };
    }

    case "task_updated": {
      const notes: string[] = [];
      const fieldsNote = formatChangedFieldsList(details.changedFields);
      if (fieldsNote) notes.push(`Updated: ${fieldsNote}`);
      if (details.previousTaskStatus && details.newTaskStatus) {
        notes.push(
          `Status: ${formatTaskStatusLabel(details.previousTaskStatus)} → ${formatTaskStatusLabel(details.newTaskStatus)}`,
        );
      }
      if (details.newAssignee === null && details.previousAssignee) {
        notes.push(`Unassigned from ${userLabel(details.previousAssignee.name)}`);
      } else if (details.newAssignee) {
        notes.push(`Assigned to ${userLabel(details.newAssignee.name)}`);
      }
      return {
        summary: `updated task "${taskTitle}"`,
        badgeLabel: "Task",
        badgeVariant: "slate",
        detailNote: notes.length > 0 ? notes.join(" · ") : undefined,
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };
    }

    case "task_status_changed":
      return {
        summary: `moved task "${taskTitle}" from ${formatTaskStatusLabel(details.previousTaskStatus)} to ${formatTaskStatusLabel(details.newTaskStatus)}`,
        badgeLabel: "Status",
        badgeVariant: details.newTaskStatus === "DONE" ? "emerald" : "blue",
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };

    case "task_assigned": {
      const assigneeName = userLabel(details.assignee?.name);
      return {
        summary: `assigned task "${taskTitle}" to ${assigneeName}`,
        badgeLabel: "Assigned",
        badgeVariant: "teal",
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };
    }

    case "task_reassigned": {
      const prevName = userLabel(details.previousAssignee?.name);
      const nextName = userLabel(details.newAssignee?.name);
      return {
        summary: `reassigned task "${taskTitle}" from ${prevName} to ${nextName}`,
        badgeLabel: "Reassigned",
        badgeVariant: "amber",
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };
    }

    case "task_deleted":
      return {
        summary: `deleted task "${taskTitle}"`,
        badgeLabel: "Task",
        badgeVariant: "rose",
        detailNote: details.previousAssignee
          ? `Previous assignee: ${userLabel(details.previousAssignee.name)}`
          : undefined,
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };

    case "comment_created":
      return {
        summary: `commented on task "${taskTitle}"`,
        badgeLabel: "Comment",
        badgeVariant: "purple",
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };

    case "comment_updated":
      return {
        summary: `edited a comment on task "${taskTitle}"`,
        badgeLabel: "Comment",
        badgeVariant: "slate",
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };

    case "comment_deleted": {
      const isModeration =
        details.isSelfDelete === false &&
        (details.deletedByRole === "OWNER" || details.deletedByRole === "MANAGER");
      return {
        summary: `deleted a comment on task "${taskTitle}"`,
        badgeLabel: "Comment",
        badgeVariant: "rose",
        detailNote: isModeration
          ? `Moderated by ${formatRoleLabel(details.deletedByRole)}`
          : undefined,
        projectHref: activeProjectHref,
        taskHref: activeTaskHref,
      };
    }
  }
}
