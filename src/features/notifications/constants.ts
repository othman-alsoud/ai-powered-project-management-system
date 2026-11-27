export const NOTIFICATION_TYPES = [
  "task_assigned",
  "task_status_changed",
  "project_completed",
  "project_cancelled",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATIONS_DEFAULT_LIMIT = 15;
export const NOTIFICATIONS_MAX_LIMIT = 50;
export const NOTIFICATIONS_POLL_INTERVAL_MS = 30_000;

export const DELETED_USER_DISPLAY_NAME = "Deleted User";
export const UNAVAILABLE_NOTIFICATION_TITLE = "Notification unavailable";
export const REVOKED_TEAM_NOTIFICATION_MESSAGE =
  "This notification is from a workspace you no longer have access to.";
export const DELETED_PROJECT_NOTIFICATION_MESSAGE =
  "The referenced project is no longer available.";
export const DELETED_TASK_NOTIFICATION_MESSAGE =
  "The referenced task is no longer available.";
