# Application Architecture

**Document Purpose**: Define the technical architecture, component responsibilities, feature modularization, data mutation patterns, and security guardrails for the application.  
**Last Updated**: 2026-11-18  
**Authoritative Status**: Approved Architecture  

---

## 1. High-Level Architectural Pattern

The application is structured as a full-stack **Next.js 16 (App Router)** system utilizing **React 19 Server Components (RSC)** for deterministic server-rendered UI, **Server Actions** for all internal mutations, and **Prisma ORM 7** with `@prisma/adapter-pg` connecting to **Neon Serverless PostgreSQL**.

```mermaid
flowchart TD
    Browser["Client Browser (Interactive Islands)"]
    
    subgraph NextServer ["Next.js 16 App Router (Node.js Runtime)"]
        RSC["Server Components (Data Fetching / Layouts)"]
        SA["Server Actions (Mutations & Validation)"]
        API["Route Handlers (/api/auth/* for Better Auth)"]
        AuthLayer["Better Auth Session Validation"]
        ZodLayer["Zod Schema Validation & RBAC Guard (Planned)"]
    end

    subgraph DataLayer ["Data Access & Persistence"]
        Prisma["Prisma Client (Driver Adapter: @prisma/adapter-pg)"]
        Neon["Neon PostgreSQL (Pooled Runtime / Direct Migration)"]
    end

    Browser -->|HTTP GET (HTML / RSC Payload)| RSC
    Browser -->|Form Submissions / State Changes| SA
    Browser -->|Auth Handshakes / OAuth Callbacks| API

    RSC --> AuthLayer
    SA --> AuthLayer
    SA --> ZodLayer
    ZodLayer --> Prisma
    RSC --> Prisma
    API --> AuthLayer
    AuthLayer --> Prisma
    Prisma --> Neon
```

---

## 2. Feature-Based Directory Structure & URL Routing

To maintain modularity and avoid spaghetti code, all domain logic is organized by feature inside `src/features/`.

### Approved URL Route Pattern
All team-scoped views strictly adhere to the approved URL convention:  
`/teams/[teamId]/...`  
*(Dynamic route parameters use the team's UUID `teamId` rather than a slug to eliminate naming collisions and redundant lookups).*

```
src/
├── app/                        # Next.js App Router routing shell
│   ├── (auth)/                 # Auth route group (login, register)
│   ├── (dashboard)/            # Authenticated workspace route group
│   │   ├── teams/
│   │   │   └── [teamId]/       # Approved URL structure: /teams/[teamId]/...
│   │   │       ├── projects/   # Project views (/teams/[teamId]/projects)
│   │   │       ├── tasks/      # Task boards and backlogs (/teams/[teamId]/tasks)
│   │   │       ├── activity/   # Team activity timeline (/teams/[teamId]/activity)
│   │   │       ├── settings/   # Team settings & members (/teams/[teamId]/settings)
│   │   │       └── page.tsx    # Team dashboard summary (/teams/[teamId])
│   ├── api/                    # Route handlers (reserved for Better Auth & external integrations)
│   │   └── auth/[...all]/      # Better Auth API endpoints
│   ├── layout.tsx              # Root HTML shell
│   └── page.tsx                # Marketing landing / redirect
├── features/                   # Modular domain logic
│   ├── auth/                   # Auth components, forms, session helpers
│   ├── teams/                  # Team context, membership, switching logic
│   ├── projects/               # Project queries, server actions, components
│   ├── tasks/                  # Task board, filters, server actions, dialogs
│   ├── comments/               # Comment thread components and actions
│   ├── notifications/          # Notification dispatch writer (M3.3) & account-wide notifications center (validation, server, actions, formatters, bell/popover UI - M3.4)
│   └── activity/               # Activity log foundation (constants, types, validation, writer, server, actions, formatters) & timeline UI (M3.2)
├── components/                 # Shared, generic UI components (buttons, dialogs, inputs)
├── lib/                        # Core infrastructure singletons
│   ├── prisma.ts               # PrismaClient instance with @prisma/adapter-pg (Installed)
│   ├── auth.ts                 # Better Auth instance and config (Installed)
│   └── utils.ts                # Tailwind merge and common formatters
└── generated/
    └── prisma/                 # Prisma 7 generated client output
```

---

## 3. Server Components vs. Client Components

- **Server Components by Default**: All layout and page files must remain React Server Components to fetch data directly from Prisma on the server, avoiding client-side waterfalls and keeping database credentials secure. Shared per-request auth/membership checks (`getAuthenticatedUser`, `requireTeamMember`, `getTeamById`, `getUserTeams`) use React `cache()` strictly for request-scoped deduplication across layout, page, and server helpers.
- **Client Components (`"use client"`)**: Used strictly as leaf interactive islands:
  - Form dialogs and inputs requiring local state or optimistic UI
  - Interactive status dropdowns and tabs
  - Kanban drag-and-drop containers
  - Confirmation modals and interactive filters

---

## 4. Server Actions vs. Route Handlers

- **Server Actions**: The primary mechanism for **all application mutations** (create/edit/delete projects, tasks, comments, memberships).
  - Co-located within `src/features/<feature>/actions.ts`.
  - Always execute within authenticated context.
  - Call `revalidatePath` to trigger immediate RSC cache invalidation (clients rely on the revalidated Server Action RSC response rather than firing duplicate `router.refresh()` round trips).
- **Route Handlers (`src/app/api/...`)**: Reserved strictly for:
  - Better Auth endpoints (`/api/auth/[...all]`) handling OAuth redirects, session tokens, and credentials callbacks.
  - Future external webhooks if needed.
- **Shared Business Logic**: Both Server Actions and Route Handlers must reuse shared domain validation and query helpers located in `src/features/`.

---

## 5. Security & Authorization Guard Pattern

Every Server Action must execute the following sequential pipeline before touching the database:

```typescript
export async function updateTaskStatus(input: unknown) {
  // 1. Session Authentication
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");

  // 2. Schema Validation via Zod (Approved Planned for Phase 1)
  const parsed = updateTaskSchema.parse(input);

  // 3. Team Membership & RBAC Verification
  // NOTE: Never rely on user.lastActiveTeamId for authorization!
  // Always query team_member with the explicitly targeted teamId.
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: parsed.teamId, userId: session.user.id } },
  });
  if (!membership) throw new Error("Forbidden: Not a member of this team");

  // 4. Role-Specific Permission Check (if restricted)
  // ... execute Prisma query with composite [id, teamId] filter
}
```

---

## 6. Error Handling Strategy

- Server Actions return a standardized result envelope rather than unhandled promise rejections:
  ```typescript
  export type ActionResult<T> =
    | { success: true; data: T }
    | { success: false; error: string; fieldErrors?: Record<string, string[]> };
  ```
- Boundary errors are caught by Next.js `error.tsx` error boundaries at route segment levels.

---

## 7. Testing Strategy (Superpowers TDD)

- In accordance with the **Superpowers workflow**:
  - **The Iron Law**: No production code is authored without a failing test first.
  - Unit tests verify pure validation schemas (`schemas.ts`) and authorization policies.
  - Integration tests verify Server Actions, database queries, and role checks against test database fixtures.
  - Automated tests must explicitly assert cross-team data isolation and negative authorization cases.
  - Subagent review and code verification occur before branches are merged.
