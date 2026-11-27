import type { TaskStatusValue } from "@/features/tasks/validation";
import type { NotificationType } from "./constants";

export interface NotificationRecordData {
  userId: string;
  actorId: string | null;
  teamId: string | null;
  projectId: string | null;
  taskId: string | null;
  type: NotificationType;
  title: string;
  message: string | null;
}

export interface NotificationCreateTx {
  notification: {
    create: (args: { data: NotificationRecordData }) => Promise<unknown>;
  };
}

export interface NotificationCreateManyTx {
  notification: {
    createMany: (args: { data: NotificationRecordData[] }) => Promise<unknown>;
  };
}

export interface NotifyTaskAssignedParams {
  teamId: string;
  actorId: string;
  projectId: string;
  taskId: string;
  recipientUserId: string | null | undefined;
  taskTitle: string;
}

export interface NotifyTaskStatusChangedParams {
  teamId: string;
  actorId: string;
  projectId: string;
  taskId: string;
  recipientUserId: string | null | undefined;
  taskTitle: string;
  previousStatus: TaskStatusValue;
  newStatus: TaskStatusValue;
}

export interface NotifyProjectTerminalStatusParams {
  teamId: string;
  actorId: string;
  projectId: string;
  projectName: string;
  status: "COMPLETED" | "CANCELLED";
  recipientUserIds: string[];
}

export type NotificationFilter = "all" | "unread";

export interface NotificationCursor {
  createdAt: Date;
  id: string;
}

export interface NotificationActorDTO {
  name: string;
  image: string | null;
  isDeleted: boolean;
}

export interface NotificationTeamDTO {
  id: string;
  name: string;
}

export interface NotificationItemDTO {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  actor: NotificationActorDTO;
  team: NotificationTeamDTO | null;
  href: string | null;
  isAccessible: boolean;
}

export interface NotificationsPageDTO {
  items: NotificationItemDTO[];
  unreadCount: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface OpenNotificationResult {
  id: string;
  readAt: string;
  unreadCount: number;
  href: string | null;
  isAccessible: boolean;
  unavailableReason?: string;
}
