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
| **MANAGER** | Multi-user per team | Operational leadership: add members, assign/update member roles (except OWNER), create/update/delete projects and tasks, delete any comment. Cannot delete team, transfer ownership, or edit another user's comment. |
| **MEMBER** | Multi-user per team | Standard contributor: view team projects and tasks, create and update tasks, update task status, self-assign or assign tasks to teammates, add comments, edit and delete own comments. Cannot modify team settings, member roles, or delete/edit others' comments. |

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
- **REQ-TEAM-04 (Membership Management)**: Owners and Managers can add users to the team and assign them `MANAGER` or `MEMBER` roles.
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
- **REQ-TASK-03 (Project Scoping)**: Every task belongs to exactly one project within the same team.
- **REQ-TASK-04 (Status Transitions)**: Members can update task status and priority during regular workflow progression.

---

## 6. Search, Filtering, Pagination, and Sorting

- **REQ-QRY-01 (Task Filtering)**: Users can filter tasks by:
  - Status (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`)
  - Priority (`LOW`, `MEDIUM`, `HIGH`)
  - Assignee (specific team member or unassigned)
  - Due date (overdue, due today, due this week)
- **REQ-QRY-02 (Search)**: Keyword text search across task titles and project names.
- **REQ-QRY-03 (Pagination)**: Paginated retrieval for task lists, activity logs, and notification feeds to ensure consistent sub-second query performance.
- **REQ-QRY-04 (Sorting)**: Users can sort project and task lists by:
  - Due date (ascending / descending)
  - Priority (HIGH -> MEDIUM -> LOW or reverse)
  - Creation date (`createdAt` ascending / descending)
  - Title (alphabetical)
  - All sorting queries must remain strictly scoped to the authorized team.

---

## 7. Comments & Activity Logging

- **REQ-COM-01 (Comment Threads)**: Team members can post comments on any task within their active team.
- **REQ-COM-02 (Authorship & Moderation Permissions)**:
  - Comment authors can edit and delete their own comments.
  - Team `OWNER` and `MANAGER` can delete any comment (for moderation).
  - Team `OWNER` and `MANAGER` **cannot** edit another user's comment (preserving authorial integrity).
  - Standard `MEMBER` users cannot edit or delete comments authored by other users.
- **REQ-LOG-01 (Activity Logging)**: Key mutation events (project creation, task state changes, assignee changes) automatically generate immutable `ActivityLog` records referencing `teamId`, `actorId`, and target entities.

---

## 8. In-App Notifications & Dashboard

- **REQ-DASH-01 (Team Dashboard)**: Provide dashboard statistics for all team members (active projects, upcoming deadlines, task breakdown by status/priority, recent activity).
- **REQ-NOTIF-01 (Trigger Events)**: In-app notifications are dispatched when:
  - A user is assigned to a task.
  - A task assigned to the user changes status.
  - A project assigned to the user is completed or cancelled.
- **REQ-NOTIF-02 (Delivery & Read State)**: Notifications support read/unread states with unread badges in the navigation shell. Real-time delivery (WebSockets) is **not** required in the MVP (standard polling/HTTP revalidation is utilized).

---

## 9. Non-Functional Requirements

- **NFR-SEC-01 (Tenant Boundary Verification)**: Every Server Action and Route Handler must independently verify that the caller is an active member of the requested `teamId` before executing database queries.
- **NFR-SEC-02 (Input Validation)**: All input payloads must be parsed and sanitized with strict runtime schemas using **Zod** *(Approved Planned — to be installed during Phase 1)*.
- **NFR-PERF-01 (Response Times)**: Server-side rendered views and server action mutations must complete within 200ms under standard database latency.
- **NFR-A11Y-01 (Accessibility)**: All interactive UI components must comply with WCAG 2.1 AA contrast and keyboard accessibility standards.

---

## 10. Open Questions & Pending Decisions

> [!WARNING]
> The following items are explicitly recorded as unresolved pending technical/product alignment:
> - **Open Question 1 (Invitation Workflow)**: Whether team member additions in the MVP require email verification tokens or direct user addition by existing registered email.
> - **Open Question 2 (Task Drag-and-Drop Order)**: Whether Kanban board columns require a dedicated integer `order` index per task or sort deterministically by priority and creation date in the MVP.
> - **Open Question 3 (Soft-Delete Project Name Re-use)**: Whether soft-deleted projects or teams allow name re-use within the same team scope (requiring a partial unique index).
> - **Open Question 4 (Member Task Self-Deletion)**: Whether a standard `MEMBER` should be permitted to soft-delete tasks they personally created if no progress has started (`TODO` status). Currently restricted to `OWNER` and `MANAGER`.
