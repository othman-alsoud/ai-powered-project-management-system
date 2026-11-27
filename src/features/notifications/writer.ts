import { TASK_STATUS_LABELS } from "@/features/tasks/validation";
import type {
  NotificationCreateManyTx,
  NotificationCreateTx,
  NotificationRecordData,
  NotifyProjectTerminalStatusParams,
  NotifyTaskAssignedParams,
  NotifyTaskStatusChangedParams,
} from "./types";

function formatTaskTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : "Untitled task";
}

function formatProjectName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "Untitled project";
}

function isEligibleRecipient(
  recipientUserId: string | null | undefined,
  actorId: string,
): recipientUserId is string {
  return (
    typeof recipientUserId === "string" &&
    recipientUserId.length > 0 &&
    recipientUserId !== actorId
  );
}

/**
 * Creates a task_assigned Notification atomically inside the caller's transaction.
 * Suppresses self-notifications and null/empty recipients.
 */
export async function notifyTaskAssigned(
  tx: NotificationCreateTx,
  params: NotifyTaskAssignedParams,
): Promise<boolean> {
  if (!isEligibleRecipient(params.recipientUserId, params.actorId)) {
    return false;
  }

  const titleText = formatTaskTitle(params.taskTitle);

  await tx.notification.create({
    data: {
      userId: params.recipientUserId,
      actorId: params.actorId,
      teamId: params.teamId,
      projectId: params.projectId,
      taskId: params.taskId,
      type: "task_assigned",
      title: "Task assigned",
      message: `You were assigned to "${titleText}".`,
    },
  });

  return true;
}

/**
 * Creates a task_status_changed Notification atomically inside the caller's transaction.
 * Suppresses no-ops, unassigned tasks, and self-notifications.
 */
export async function notifyTaskStatusChanged(
  tx: NotificationCreateTx,
  params: NotifyTaskStatusChangedParams,
): Promise<boolean> {
  if (params.previousStatus === params.newStatus) {
    return false;
  }

  if (!isEligibleRecipient(params.recipientUserId, params.actorId)) {
    return false;
  }

  const titleText = formatTaskTitle(params.taskTitle);
  const previousLabel = TASK_STATUS_LABELS[params.previousStatus];
  const newLabel = TASK_STATUS_LABELS[params.newStatus];

  await tx.notification.create({
    data: {
      userId: params.recipientUserId,
      actorId: params.actorId,
      teamId: params.teamId,
      projectId: params.projectId,
      taskId: params.taskId,
      type: "task_status_changed",
      title: "Task status updated",
      message: `"${titleText}" moved from ${previousLabel} to ${newLabel}.`,
    },
  });

  return true;
}

/**
 * Batch-creates project_completed or project_cancelled Notifications inside the caller's
 * transaction. Deduplicates recipients and excludes the actor.
 */
export async function notifyProjectTerminalStatus(
  tx: NotificationCreateManyTx,
  params: NotifyProjectTerminalStatusParams,
): Promise<number> {
  const uniqueRecipients: string[] = [];
  const seen = new Set<string>();

  for (const userId of params.recipientUserIds) {
    if (isEligibleRecipient(userId, params.actorId) && !seen.has(userId)) {
      seen.add(userId);
      uniqueRecipients.push(userId);
    }
  }

  if (uniqueRecipients.length === 0) {
    return 0;
  }

  const projectNameText = formatProjectName(params.projectName);
  const isCompleted = params.status === "COMPLETED";
  const type = isCompleted ? "project_completed" : "project_cancelled";
  const title = isCompleted ? "Project completed" : "Project cancelled";
  const statusLabel = isCompleted ? "Completed" : "Cancelled";
  const message = `Project "${projectNameText}" was marked as ${statusLabel}.`;

  const records: NotificationRecordData[] = uniqueRecipients.map((userId) => ({
    userId,
    actorId: params.actorId,
    teamId: params.teamId,
    projectId: params.projectId,
    taskId: null,
    type,
    title,
    message,
  }));

  await tx.notification.createMany({ data: records });

  return records.length;
}
