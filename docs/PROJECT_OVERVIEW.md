# Project Overview

**Document Purpose**: Define the high-level vision, target audience, core capabilities, technology stack, and scope boundaries for the AI-Powered Project Management System.  
**Last Updated**: 2026-11-18  
**Authoritative Status**: Approved Project Foundation  

---

## 1. Vision & Purpose

The **AI-Powered Project Management System** is a robust, team-centric project and issue tracking application designed for technical product and engineering teams. It emphasizes speed, high data density, strict tenant isolation, and clear operational hierarchies.

> [!NOTE]
> **Agentic Development Distinction**: While the project is titled "AI-Powered Project Management System", in the **MVP stage**, AI is utilized as the **engine of development** (via Superpowers engineering discipline and UI UX Pro Max design intelligence), **not** as an end-user facing product feature. End-user AI capabilities are scheduled for later phases.

---

## 2. Target Audience

1. **Engineering & Technical Teams**: Small to medium-sized teams needing deterministic task progression and issue tracking without unnecessary enterprise bloat.
2. **Project Managers & Tech Leads**: Users requiring workspace visibility, project status monitoring, team member assignment control, and audit trails.
3. **Individual Contributors**: Developers and designers needing clear task backlogs, focused status boards, contextual comments, and actionable in-app notifications.

---

## 3. Main Capabilities

- **Multi-Tenant Team Workspaces**: Complete data isolation between teams with dedicated membership registries.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions governed by three defined roles: `OWNER`, `MANAGER`, and `MEMBER`.
- **Project Lifecycle Management**: Structured project management across phases (`PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`).
- **Task Progression & Issue Tracking**: Prioritized tasks (`LOW`, `MEDIUM`, `HIGH`) tracked across lifecycles (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`), with assignees strictly constrained to active members of the same team.
- **Task Discussion Threads**: Threaded comments on tasks for tactical decisions and updates.
- **In-App Notification Center**: Consolidated updates for task assignments, status changes, and project transitions.
- **Audit Logging**: Comprehensive activity logs capturing actor, action, timestamp, and metadata across all core entities.
- **Non-Destructive Soft Deletions & Anonymization**: Historical audit retention with soft-deletion support (`deletedAt`) across teams, projects, tasks, and comments, paired with account anonymization upon user departure.

---

## 4. Technology Stack (Installed vs. Planned)

The project leverages modern full-stack web technologies with a strong preference for free-tier hosting and services (Vercel, Neon PostgreSQL free tier) wherever practical.

| Layer | Technology | Status / Version | Responsibility |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js | Installed (`16.4.6`, App Router, Turbopack) | Full-stack server components, server actions, route handlers |
| **UI Library** | React | Installed (`19.3.0`) | Declarative UI rendering |
| **Language** | TypeScript | Installed (`^5.0.0`) | End-to-end static type safety |
| **Styling** | Tailwind CSS | Installed (`4.3.3`) | Utility-first CSS engine with `@tailwindcss/turbopack` |
| **Database** | PostgreSQL | Planned (Neon Serverless Postgres) | Relational data persistence with connection pooling (free tier) |
| **ORM** | Prisma ORM | Installed (`^7.10.1`, `@prisma/adapter-pg`) | Client generation, type-safe queries, schema management |
| **Authentication** | Better Auth | Installed (`^1.7.25`) | Session management, email/password, UUID keys |
| **OAuth Providers** | Google OAuth | **Approved Planned** (not yet configured in `src/lib/auth.ts`) | Social authentication option |
| **Validation** | Zod | **Approved Planned** (to be installed in Phase 1) | Runtime schema validation for forms, Server Actions, and APIs |
| **Deployment** | Vercel | Planned | Cloud hosting and preview deployments (free tier) |
| **Dev Framework** | Superpowers | Installed (`v7.0.2`) | TDD workflow, brainstorming, plan execution, code review |
| **Design Intel** | UI UX Pro Max | Installed (`v2.4.1`) | Design systems, accessibility rules, UI style references |

---

## 5. MVP Scope & Explicit Exclusions

### In-Scope for MVP:
- Secure authentication via Email/Password and Google OAuth.
- Team creation, member addition, and role assignment (`OWNER`, `MANAGER`, `MEMBER`).
- Single-owner team invariant with explicit ownership transfer.
- Project creation, editing, status transitions, and timeline tracking.
- Task creation, editing, priority, due dates, and same-team assignee assignment.
- Task comments with author-controlled modification and manager/owner deletion.
- In-app notification center (unread/read state, standard polling/revalidation).
- Read-only team activity log.
- Soft-delete lifecycles for teams, projects, tasks, and comments.
- Account deletion via personal data anonymization.

### Explicitly Excluded from MVP (Deferred to Later Phases):
- **End-User AI Features**: No conversational AI assistants, generative summarization, or automated task breakdowns in the MVP.
- **Real-Time WebSockets**: No live multi-cursor presence or instant push streaming (polling and standard HTTP revalidation are used).
- **Live Chat / Direct Messaging**: No internal messaging system; communication is scoped to task comments.
- **File Attachments & Cloud Storage**: No binary/image uploads to S3/R2 (links/text only).
- **Advanced Calendar Functionality**: No complex multi-view interactive calendars or iCal sync in the MVP.
- **Advanced Reports & Exports**: No PDF generation, data export engines, or analytics exports in the MVP.
- **Payment & Subscription Billing**: No Stripe/LemonSqueezy integration or paid feature tiers.
- **Public / Anonymous Access**: No publicly viewable boards; authenticated membership is required.

---

## 6. Related Documents

- [REQUIREMENTS.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/REQUIREMENTS.md) — Detailed functional and non-functional specifications.
- [BUSINESS_RULES.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/BUSINESS_RULES.md) — Definitive business logic and permission rules.
- [ARCHITECTURE.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/ARCHITECTURE.md) — Technical application structure and data flow.
- [DEVELOPMENT_ROADMAP.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/DEVELOPMENT_ROADMAP.md) — Delivery milestones and implementation sequence.
