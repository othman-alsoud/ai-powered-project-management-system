# Business Rules & Invariants

**Document Purpose**: Define the authoritative domain logic, authorization matrix, lifecycle policies, and structural invariants governing the application.  
**Last Updated**: 2026-11-18  
**Authoritative Status**: Approved Business Logic  

---

## 1. Team Ownership & Membership Invariants

- **BR-TEAM-01 (Single Owner Invariant)**: Each team must have **exactly one** user with the `OWNER` role at all times. A team cannot exist without an owner, and cannot have multiple owners.
- **BR-TEAM-02 (Owner Membership Link)**: `team.ownerId` must point to a user who is also present in `team_member` for that `teamId` with `role = 'OWNER'`.
- **BR-TEAM-03 (Owner Departure Lock)**: An owner **cannot** voluntarily leave a team, be removed by managers, or delete/anonymize their account while they remain the designated owner of that team. To leave or delete an account, the owner must either:
  1. Explicitly transfer ownership to an existing active member, OR
  2. Permanently delete the team.
- **BR-TEAM-04 (Atomic Ownership Transfer)**: Ownership transfer must execute inside a single transaction that simultaneously:
  - Updates `team.ownerId` to the recipient.
  - Updates recipient's `team_member.role` to `OWNER`.
  - Updates original owner's `team_member.role` to `MANAGER` (or `MEMBER`).

---

## 2. Role Permissions Matrix

The permissions table below is authoritative across all Server Actions and UI permissions gates:

| Action | OWNER | MANAGER | MEMBER |
| :--- | :---: | :---: | :---: |
| **Delete Team** | ✅ | ❌ | ❌ |
| **Transfer Ownership** | ✅ | ❌ | ❌ |
| **Update Team Settings** (Name, Description) | ✅ | ✅ | ❌ |
| **Add New Members** | ✅ | ✅ | ❌ |
| **Change Member Role** (`MANAGER` <-> `MEMBER`) | ✅ | ✅ (cannot change Owner) | ❌ |
| **Remove Member** | ✅ | ✅ (cannot remove Owner) | ❌ |
| **Create Project** | ✅ | ✅ | ❌ |
| **Edit Any Project** | ✅ | ✅ | ❌ |
| **Delete Project** (Soft Delete) | ✅ | ✅ | ❌ |
| **Create Task** | ✅ | ✅ | ✅ |
| **Edit Any Task** | ✅ | ✅ | ✅ |
| **Delete Task** (Soft Delete) | ✅ | ✅ | ❌ |
| **Assign Task to Team Member** | ✅ | ✅ | ✅ |
| **Post Comment** | ✅ | ✅ | ✅ |
| **Edit Own Comment** | ✅ | ✅ | ✅ |
| **Delete Any Comment (Moderation)** | ✅ | ✅ | ❌ |
| **Edit Another User's Comment** | ❌ | ❌ | ❌ |
| **View Activity Logs** | ✅ | ✅ | ✅ |

---

## 3. Team Consistency & Entity Scoping

- **BR-SCOPE-01 (Strict Tenant Scoping)**: Projects, tasks, comments, and activity logs belong exclusively to a single `teamId`.
- **BR-SCOPE-02 (Assignee Consistency)**: A task can **only** be assigned to a user who possesses an active `team_member` record matching the task's `teamId`. Cross-team task assignment is physically rejected by composite foreign key constraints.
- **BR-SCOPE-03 (Hierarchical Integrity)**:
  - A task's `teamId` must strictly match its parent project's `teamId`.
  - A comment's `teamId` must strictly match its parent task's `teamId`.
- **BR-SCOPE-04 (Project Date Ordering)**: When both a start date and an end date are provided for a project, the end date must be on or after the start date (`endDate >= startDate`). This is enforced via Zod schema validation in Server Actions and backed by a database-level `CHECK` constraint.

---

## 4. Deletion, Anonymization & Historical Audit Retention

- **BR-DEL-01 (Entity Soft Deletion)**: Teams, projects, tasks, and comments utilize soft deletion via a nullable `deletedAt` timestamp. Hard deletion is prohibited in standard application flows.
- **BR-DEL-02 (User Account Deletion via Anonymization)**:
  - In accordance with privacy and data integrity requirements, user account deletion is executed as an **anonymization lifecycle**, *not* a raw database row deletion (`DELETE FROM "user"` is blocked by `onDelete: Restrict` on authored projects and tasks).
  - **Anonymization Actions**:
    1. Scrub personal identifiers: `name` is replaced with `"Deleted User"`, `image` is set to `null`.
    2. Scrub communication identifiers: `email` is replaced with an anonymous non-routable tombstone (e.g., `deleted_<uuid>@deleted.local`) to release the original email for re-registration.
    3. Invalidate credentials & access: clear hashed password, revoke all active Better Auth `Session` records, and remove linked OAuth `Account` records.
    4. Mark lifecycle: set `deletedAt = now()`.
  - **Preservation of History**: The internal `User.id` (UUID) remains in the database. All historical projects (`createdById`), tasks (`createdById`), comments, and activity logs remain completely intact and linked, preserving team auditability without displaying personal data.
  - **Prerequisite**: An `OWNER` cannot be anonymized or deleted while owning a team (per BR-TEAM-03).
  - *Pending Technical Validation*: The exact Better Auth OAuth account unlinking sequence and session purge hooks will be validated during Phase 1 implementation.
- **BR-DEL-03 (Cascade Hiding)**: Soft-deleting a project automatically hides all nested tasks and comments from active UI queries.

---

## 5. User Context & Navigation Preference

- **BR-CTX-01 (Navigation Preference Only)**: `user.lastActiveTeamId` is strictly a user convenience pointer to re-open the last visited team workspace upon login. **It must never be used as an authorization credential**. All authorization checks must inspect active `TeamMember` records for the specific `teamId` being operated on.
- **BR-CTX-02 (Context Cleanup)**: If a user is removed from their current active team, the system resets `lastActiveTeamId` to another active team or `null`.

---

## 6. Activity Log Immutability

- **BR-AUDIT-01 (Append-Only Logs)**: Activity logs are strictly append-only. No user role (including OWNER) can modify, edit, or delete an `ActivityLog` entry.

---

## 7. Open Questions & Pending Decisions

> [!WARNING]
> The following items are explicitly recorded as unresolved pending technical/product alignment:
> - **Open Question 1 (Invitation Workflow)**: Whether team member additions in the MVP require email verification tokens or direct user addition by existing registered email.
> - **Open Question 2 (Task Drag-and-Drop Order)**: Whether Kanban board columns require a dedicated integer `order` index per task or sort deterministically by priority and creation date in the MVP.
> - **Open Question 3 (Soft-Delete Project Name Re-use)**: Whether soft-deleted projects or teams allow name re-use within the same team scope (requiring a partial unique index).
> - **Open Question 4 (Member Task Self-Deletion)**: Whether a standard `MEMBER` should be permitted to soft-delete tasks they personally created if no progress has started (`TODO` status). Currently restricted to `OWNER` and `MANAGER`.
