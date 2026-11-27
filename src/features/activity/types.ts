import type {
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  TeamRole,
} from "@/generated/prisma/client";
import type { ACTIVITY_ACTIONS } from "./constants";

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface ActivityActorSummary {
  id: string | null;
  name: string;
  image: string | null;
  isDeleted: boolean;
}

export interface ActivityTargetUserSummary {
  id: string | null;
  name: string;
  isDeleted: boolean;
}

export interface ActivityEntityRef {
  id: string;
  label: string;
  isDeleted: boolean;
}

export interface ActivityDetailsDTO {
  teamName?: string;
  role?: TeamRole;
  previousRole?: TeamRole;
  newRole?: TeamRole;
  reason?: string;
  targetUser?: ActivityTargetUserSummary;
  previousOwner?: ActivityTargetUserSummary;
  newOwner?: ActivityTargetUserSummary;
  projectName?: string;
  projectStatus?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  changedFields?: string[];
  previousProjectStatus?: ProjectStatus;
  newProjectStatus?: ProjectStatus;
  taskTitle?: string;
  taskStatus?: TaskStatus;
  taskPriority?: TaskPriority;
  dueDate?: string | null;
  previousTaskStatus?: TaskStatus;
  newTaskStatus?: TaskStatus;
  assignee?: ActivityTargetUserSummary | null;
  previousAssignee?: ActivityTargetUserSummary | null;
  newAssignee?: ActivityTargetUserSummary | null;
  previousProjectId?: string;
  newProjectId?: string;
  deletedByRole?: TeamRole;
  isSelfDelete?: boolean;
}

export interface ActivityLogItemDTO {
  id: string;
  teamId: string;
  action: ActivityAction;
  createdAt: string;
  actor: ActivityActorSummary;
  project: ActivityEntityRef | null;
  task: ActivityEntityRef | null;
  commentId: string | null;
  details: ActivityDetailsDTO;
}

export interface ActivityFeedPage {
  items: ActivityLogItemDTO[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ActivityCursor {
  createdAt: Date;
  id: string;
}

export interface ActivityFeedQueryOptions {
  limit: number;
  cursor?: ActivityCursor;
  projectId?: string;
  taskId?: string;
  action?: ActivityAction;
}
