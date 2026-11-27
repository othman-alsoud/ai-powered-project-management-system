export const ACTIVITY_ACTIONS = [
  "team_created",
  "member_added",
  "member_role_updated",
  "member_removed",
  "ownership_transferred",
  "member_departed",
  "project_created",
  "project_updated",
  "project_deleted",
  "task_created",
  "task_updated",
  "task_status_changed",
  "task_assigned",
  "task_reassigned",
  "task_deleted",
  "comment_created",
  "comment_updated",
  "comment_deleted",
] as const;

export const ACTIVITY_FEED_DEFAULT_LIMIT = 20;
export const ACTIVITY_FEED_MAX_LIMIT = 50;

export const DELETED_USER_DISPLAY_NAME = "Deleted User";
