<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AI Agent Operating Guidelines

**Project**: AI-Powered Project Management System  
**Frameworks**: Superpowers (`obra/superpowers`) & UI UX Pro Max (`nextlevelbuilder/ui-ux-pro-max-skill`)  
**Core Authority**: `docs/` directory  

---

## 1. Persistent Context & Source of Truth

The documentation inside `docs/` is the **authoritative persistent context** for this project. Chat history is ephemeral; `docs/` is permanent.

Every agent working on this repository **MUST** read the relevant documentation before taking action or writing code:

| Task Type | Mandatory Documents to Read First |
| :--- | :--- |
| **All Tasks (General Orientation)** | [PROJECT_OVERVIEW.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/PROJECT_OVERVIEW.md), [AI_WORKFLOW.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/AI_WORKFLOW.md) |
| **Data Models, Schema & Migrations** | [DATABASE_DESIGN.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/DATABASE_DESIGN.md), [BUSINESS_RULES.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/BUSINESS_RULES.md) |
| **Backend, Auth & Server Actions** | [ARCHITECTURE.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/ARCHITECTURE.md), [REQUIREMENTS.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/REQUIREMENTS.md), [BUSINESS_RULES.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/BUSINESS_RULES.md) |
| **Frontend, UI & Styling** | [ARCHITECTURE.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/ARCHITECTURE.md), `docs/DESIGN_GUIDELINES.md` *(Stage B.4)*, [REQUIREMENTS.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/REQUIREMENTS.md) |
| **Planning, Phasing & Milestones** | [DEVELOPMENT_ROADMAP.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/DEVELOPMENT_ROADMAP.md) |

---

## 2. Core Agent Rules

1. **Pre-Read Required**: Do not assume you know the project from prior prompts or generic templates. Read the specified `docs/` files first.
2. **Conflict Identification**: If user instructions conflict with approved documentation, pause immediately, highlight the conflict, and request clarification. Never silently override approved architectural or business rules.
3. **Approved vs. Open Questions**: Treat approved decisions as binding. Items labeled `Open Question` or `Pending Decision` in `docs/` must not be implemented until explicitly resolved by the user.
4. **Implementation Plans for Substantial Tasks**: Use Superpowers `writing-plans` to generate detailed, step-by-step plans before authoring non-trivial code.
5. **Strict Test-Driven Development (TDD)**: Follow the Superpowers Iron Law: *No production code without a failing test first*.
6. **Evidence-Based Completion**: Use Superpowers `verification-before-completion`. Never claim a task or bugfix is complete without executing commands and presenting verifiable test logs.
7. **No Redundant Tools**: Do not invent custom skills or duplicate agents for capabilities already provided by Superpowers, UI UX Pro Max, or Prisma.
8. **Collaboration Rules**: Consult [AI_WORKFLOW.md](file:///c:/Users/Rc-2026/Desktop/ai-powered-project-management-system/docs/AI_WORKFLOW.md) for detailed role delegation and handoff protocols.
