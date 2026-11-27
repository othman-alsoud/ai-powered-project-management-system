# Requirements Specification

**Document Purpose**: Detail the functional and non-functional requirements, user roles, authentication specs, querying criteria, and boundary conditions for the system.  
**Last Updated**: 2026-11-18  
**Authoritative Status**: Approved Product Requirements  

---

## 1. User Roles & Capabilities

The system defines three team-scoped roles. A user's permissions are evaluated strictly within the context of the active team.

| Role | Workspace Scope | Capabilities |
| :--- | :--- | :--- |
| **OWNER** | Single active user per team | Full administrative control: manage team settings, delete team, transfer ownership, manage all projects, tasks, member roles; delete any comment. |
| **MANAGER** | Multi-user per team | Operational leadership: create/update/delete projects and tasks, assign tasks, delete any comment. Cannot delete team, transfer ownership, manage team membership/roles, or edit another user's comment. |
| **MEMBER** | Multi-user per team | Standard contributor: view team projects and tasks, update the status of tasks assigned to them, add comments, edit and delete own comments. Cannot create, edit, assign, or delete tasks, modify team settings, member roles, or delete/edit others' comments. |

---

## 2. Authentication Requirements (Better Auth)

- **REQ-AUTH-01 (Email/Password)**: Users can sign up and sign in using a unique email address and secure password. *(Installed & configured via Better Auth credentials plugin)*.
- **REQ-AUTH-02 (Google OAuth)**: Users can register and authenticate via Google OAuth. Accounts with matching emails must link securely per Better Auth account linking rules. *(Approved Planned — to be configured in `src/lib/auth.ts` during Phase 1)*.
- **REQ-AUTH-03 (Session Persistence)**: Authenticated sessions are tracked via database-backed session tokens stored in secure, `HttpOnly`, `SameSite=Lax` cookies.
- **REQ-AUTH-04 (UUID Identity)**: All user, session, account, and verification identifiers must use standard RFC 4122 UUIDs (`@db.Uuid`).
- **REQ-AUTH-05 (User Profile)**: Users can update their display name and profile avatar URL, and view their registered email.
- **REQ-AUTH-06 (Password Reset)**: Users can initiate and complete password reset workflows securely.

---

## 3. Team & Multi-Tenancy Requirements

- **REQ-TEAM-01 (Creation)**: Any authenticated user can create a new team, automatically becoming its `OWNER`.
- **REQ-TEAM-02 (Active Team Context)**: The system persists the user's `lastActiveTeamId` as a navigation preference to restore workspace context across sessions. **Crucial Rule**: `lastActiveTeamId` is strictly a navigation aid and must *never* be treated as an authorization mechanism.
- **REQ-TEAM-03 (Isolation)**: All project management data (projects, tasks, comments, activity logs) must be strictly partitioned by `teamId`. Users cannot read or write data belonging to a team where they do not hold active membership.
- **REQ-TEAM-04 (Membership Management)**: Team `OWNER` can add registered users to the team, update member roles (`MANAGER` or `MEMBER`), and remove non-owner members. *(Aligned with `BUSINESS_RULES.md` §1 OWNER-only membership authority.)*
- **REQ-TEAM-05 (Ownership Transfer)**: The current Owner can transfer ownership to an existing active team member. The previous owner retains `MANAGER` or `MEMBER` status.

---

## 4. Project Management Requirements

- **REQ-PROJ-01 (Project Lifecycle)**: Projects progress through defined statuses: `PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`.
- **REQ-PROJ-02 (Metadata)**: Each project requires a name, optional description, status, optional start date, and optional target end date.
- **REQ-PROJ-03 (Audit Association)**: Every project records `createdById` and `updatedById`.
- **REQ-PROJ-04 (Deletion)**: Soft deletion (`deletedAt`) hides projects from standard views while retaining historical association.
- **REQ-PROJ-05 (Date Ordering Invariant)**: When both a start date and an end date exist for a project, the end date must not precede the start date (`endDate >= startDate`). This rule must be enforced at both the application level (Zod schema) and the database level (PostgreSQL `CHECK` constraint).

---

## 5. Task Management Requirements

- **REQ-TASK-01 (Task Attributes)**: Tasks must capture title, description, status (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`), priority (`LOW`, `MEDIUM`, `HIGH`, default: `MEDIUM`), optional due date, optional assignee, and creator/updater IDs.
- **REQ-TASK-02 (Assignee Constraint)**: A task can only be assigned to a user who is an active member of the project's parent team.
- **REQ-TASK-03 (Project Scoping)**: Every task belongs to exactly one non-deleted project within the same team (regardless of project status such as `COMPLETED` or `CANCELLED`).
- **REQ-TASK-04 (Permissions & Status Transitions)**: `OWNER` and `MANAGER` can create, edit, assign/reassign/unassign, change status on any team task, and soft-delete tasks. `MEMBER` can update the status of tasks currently assigned to them (`assignedToId === user.id`), and cannot create, edit details, assign/unassign, or soft-delete tasks.

---

## 6. Search, Filtering, Pagination, and Sorting

- **REQ-QRY-01 (Task Filtering)**: Users can filter tasks by:
  - Status (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`)
  - Priority (`LOW`, `MEDIUM`, `HIGH`)
  - Assignee (specific team member or unassigned)
  - Due date (UTC calendar boundaries: `overdue` before today's UTC midnight excluding `DONE`, `today` within today's UTC calendar day, `this_week` from today's UTC midnight through Sunday `23:59:59.999 UTC` of the current Monday–Sunday week)
- **REQ-QRY-02 (Search)**: Keyword text search across task titles and project names.
- **REQ-QRY-03 (Pagination)**: Paginated retrieval for task lists (25/page offset pagination), activity logs (keyset cursor pagination ordered by `(createdAt, id)` descending, default limit `20`, maximum limit `50`), and notification feeds to ensure consistent sub-second query performance.
- **REQ-QRY-04 (Sorting)**: Users can sort task lists (List view) by Due date (`asc`/`desc`), Priority (`HIGH` → `MEDIUM` → `LOW` or reverse), Creation date (`createdAt` `asc`/`desc`), and Title (alphabetical), and can sort project lists by Target end date (`endDate` `asc`/`desc`), Creation date (`createdAt` `asc`/`desc`), and Name (alphabetical) — since projects do not have a priority field. Kanban Board columns maintain deterministic priority/due-date/creation ordering. All sorting queries must remain strictly scoped to the authorized team.

---

## 7. Comments & Activity Logging

- **REQ-COM-01 (Comment Threads)**: Team members can post comments on any non-deleted task within their active team. Active task comments load chronologically (`createdAt asc`, capped at 200 per task in MVP).
- **REQ-COM-02 (Authorship & Moderation Permissions)**:
  - Comment authors can edit and delete their own comments.
  - Team `OWNER` and `MANAGER` can delete any comment (for moderation).
  - Team `OWNER` and `MANAGER` **cannot** edit another user's comment (preserving authorial integrity).
  - Standard `MEMBER` users cannot edit or delete comments authored by other users.
- **REQ-LOG-01 (Activity Logging)**: Key mutation events automatically generate immutable `ActivityLog` records referencing `teamId`, `actorId`, and target entities across 18 canonical action types:
  - **Team & Membership**: `team_created`, `member_added`, `member_role_updated`, `member_removed`, `ownership_transferred`, `member_departed`.
  - **Projects**: `project_created`, `project_updated`, `project_deleted`.
  - **Tasks**: `task_created`, `task_updated`, `task_status_changed`, `task_assigned`, `task_reassigned`, `task_deleted`.
  - **Comments**: `comment_created`, `comment_updated`, `comment_deleted`.
  - **Non-PII Metadata Policy**: Activity logs store only non-sensitive entity identifiers and structural metadata (`taskId`, `taskTitle`, `commentId`, role/status transitions, target user IDs resolved safely at read time), excluding user emails (e.g., `addedUserEmail`) and comment text/snippets. Raw `metadata` JSON is never exposed directly to client DTOs.
  - **Deleted-Resource Visibility**: Activity associated with soft-deleted projects (including `project_deleted`) is hidden. `task_deleted` remains visible when its parent project is active, and `comment_deleted` remains visible when its parent task and project are active; all other activity associated with soft-deleted tasks or comments is hidden.
  - **Timeline Views**: Authenticated team members can browse the chronological team feed at `/teams/[teamId]/activity` (with URL-synchronized Action Type and Project filters and keyset `Load more` pagination) and the project-scoped feed via the `Activity` tab at `/teams/[teamId]/projects/[projectId]?tab=activity`.

---

## 8. In-App Notifications & Dashboard

- **REQ-DASH-01 (Team Dashboard)**: Provide dashboard statistics for all team members (active projects, upcoming deadlines, task breakdown by status/priority, recent activity).
- **REQ-NOTIF-01 (Trigger Events)**: In-app notifications are dispatched atomically inside the mutation transaction across four canonical types (`task_assigned`, `task_status_changed`, `project_completed`, `project_cancelled`) with self-action suppression (`recipientUserId !== actorId`), active-user & active-membership enforcement, duplicate/no-op suppression, and PII-free content:
  - **Task Assigned (`task_assigned`)**: Dispatched when a task is created with an assignee or updated with a new non-null assignee. When both assignee and status change in the same `updateTaskAction` operation, only `task_assigned` is dispatched to the new assignee (no separate `task_status_changed` notification, and none to the previous assignee).
  - **Task Status Changed (`task_status_changed`)**: Dispatched when an assigned task transitions to a different `TaskStatus` (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`) by another active team member.
  - **Project Completed / Cancelled (`project_completed`, `project_cancelled`)**: Dispatched on every actual status transition of a project into `COMPLETED` or `CANCELLED` (including after reopening) to every distinct active, non-deleted `TeamMember` currently assigned to at least one non-deleted task in that project (including `DONE` tasks), excluding the actor. Project creators without assigned tasks in that project are not notified.
- **REQ-NOTIF-02 (Delivery & Read State)**: Notifications are **account-wide** across all active teams for the authenticated `userId` and render via the `WorkspaceSidebar` Notification Bell & Popover (desktop/tablet footer and mobile top bar sharing one state/polling lifecycle):
  - **Badge & Popover**: Unread badge shows exact count (`1–9`) or `9+` (`10+`). Popover supports `All | Unread` filtering, idempotent single and bulk mark-as-read actions, and `(createdAt, id)` keyset `Load more` pagination.
  - **Polling**: 30-second visible-tab polling and `visibilitychange` revalidation via Server Actions (no WebSockets in MVP).
  - **Access Revalidation & Sanitization**: Stored `teamId`/`projectId`/`taskId` values are never trusted as authorization proof. Revoked team memberships or soft-deleted projects/tasks remain dismissible via mark-as-read with sanitized unavailable text (`href: null`, `isAccessible: false`) and never expose protected titles, actors, or stale avatars. Valid clicks re-verify live access server-side before cross-team navigation.

---

## 9. Non-Functional Requirements

- **NFR-SEC-01 (Tenant Boundary Verification)**: Every Server Action and Route Handler must independently verify that the caller is an active member of the requested `teamId` before executing database queries.
- **NFR-SEC-02 (Input Validation)**: All input payloads must be parsed and sanitized with strict runtime schemas using **Zod** *(Approved Planned — to be installed during Phase 1)*.
- **NFR-PERF-01 (Response Times)**: Server-side rendered views and server action mutations must complete within 200ms under standard database latency.
- **NFR-A11Y-01 (Accessibility)**: All interactive UI components must comply with WCAG 2.1 AA contrast, keyboard navigation, focus management, ARIA, and reduced-motion standards *(implemented & verified with `jsx-a11y`, Vitest, and Playwright + `@axe-core/playwright` in Milestone 4.2; manual screen-reader pass documented for final human sign-off)*.

---

## 10. Open Questions & Pending Decisions

> [!WARNING]
> The following items are explicitly recorded as unresolved pending technical/product alignment:
> - **Open Question 1 (Invitation Workflow)**: Whether team member additions in the MVP require email verification tokens or direct user addition by existing registered email.
> - **Open Question 2 (Task Drag-and-Drop Order)**: **Resolved (Milestone 2.3)** — Columns sort deterministically by priority (`HIGH` → `MEDIUM` → `LOW`), earliest non-null `dueDate` (nulls last), `createdAt` descending, then `id` ascending without a schema `order` column.
> - **Open Question 3 (Soft-Delete Project Name Re-use)**: Whether soft-deleted projects or teams allow name re-use within the same team scope (requiring a partial unique index).
> - **Open Question 4 (Member Task Self-Deletion)**: Whether a standard `MEMBER` should be permitted to soft-delete tasks they personally created if no progress has started (`TODO` status). Currently restricted to `OWNER` and `MANAGER`.
