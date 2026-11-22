# Design Guidelines

**Document Purpose**: Translate the officially approved Hybrid design direction into actionable, consistent implementation rules for every developer and agent working on the UI.  
**Last Updated**: 2026-11-18  
**Authoritative Status**: **Approved Design System — Stage B.4**  
**Depends On**: `docs/DESIGN_DIRECTIONS.md` (approved Hybrid direction), `docs/ARCHITECTURE.md`, `docs/REQUIREMENTS.md`

> [!IMPORTANT]
> This document is the single source of truth for all UI implementation decisions. If a component, page, or layout choice is not explicitly covered here, raise it as an `Open Question` before implementing.

---

## Table of Contents

1. [Design Philosophy & Principles](#1-design-philosophy--principles)
2. [Color System](#2-color-system)
3. [Typography System](#3-typography-system)
4. [Spacing Scale & Layout Grid](#4-spacing-scale--layout-grid)
5. [Responsive Breakpoints & Behavior](#5-responsive-breakpoints--behavior)
6. [Navigation & Sidebar](#6-navigation--sidebar)
7. [Dashboard Layout Rules](#7-dashboard-layout-rules)
8. [Project & Task Management UI Patterns](#8-project--task-management-ui-patterns)
9. [Kanban Board & Task Card Rules](#9-kanban-board--task-card-rules)
10. [Tables](#10-tables)
11. [Forms & Inputs](#11-forms--inputs)
12. [Buttons](#12-buttons)
13. [Badges & Tags](#13-badges--tags)
14. [Dialogs & Modals](#14-dialogs--modals)
15. [Dropdowns & Selects](#15-dropdowns--selects)
16. [Feedback States](#16-feedback-states)
17. [Status & Priority Visual Indicators](#17-status--priority-visual-indicators)
18. [Accessibility Requirements](#18-accessibility-requirements)
19. [Loading, Empty, Error, Success & Disabled States](#19-loading-empty-error-success--disabled-states)
20. [Light / Dark Mode Behavior](#20-light--dark-mode-behavior)
21. [Next.js & Tailwind CSS 4 Implementation Rules](#21-nextjs--tailwind-css-4-implementation-rules)

---

## 1. Design Philosophy & Principles

### Approved Design Direction

**Hybrid: Precision Swiss + Nordic Ergonomic**

The interface is built on two complementary layers:

| Layer | Source | Purpose |
| :--- | :--- | :--- |
| **Structural Foundation** | Precision Swiss (Direction 1) | Strict layout grid, information hierarchy, data density, hairline borders, tight spacing |
| **Palette & Ergonomic Refinements** | Nordic Ergonomic (Direction 2) | Muted calming palette, comfortable whitespace, teal accent, fatigue-free surfaces |

### Core Principles

1. **Content Is the Interface**  
   Design chrome must recede completely. Task progression, project timelines, and backlog items are the sole visual focus. No decorative gradients, no heavy shadows, no blurred glassmorphism.

2. **High Signal-to-Noise Ratio**  
   Every rendered element must carry information or enable an action. Ornamental elements that do not aid comprehension are disallowed.

3. **Ergonomic Comfort at Scale**  
   The palette and spacing are calibrated for 8+ hour continuous work sessions. Dark mode uses deep slate (`#0B1120`), not pure black. Light mode uses off-white (`#F8FAFC`), not pure white.

4. **Mathematical Precision**  
   All spacing, sizing, and layout values must derive from the 4px/8px base grid. Arbitrary pixel values (`padding: 11px`) are banned.

5. **Responsive-First**  
   Every component is designed mobile-first and adapted upward. No desktop-only fixed widths. No `min-w-[1200px]` on root containers.

6. **Accessibility Is Non-Negotiable**  
   WCAG 2.1 AA is the minimum floor. WCAG 2.1 AAA is the target for core body text and tabular data. Status and priority indicators always pair color with a non-color signal (icon + text label).

7. **Precision Over Decoration**  
   - Border radius: `6px`–`8px` (compact, not bubbly)
   - Borders: `1px` hairline (not `2px`+ heavy frames)
   - Shadows: subtle separation only (not ambient elevation stacks)
   - Transitions: `150ms ease-out` maximum for interactive elements

---

## 2. Color System

### 2.1 Semantic Token Architecture

All color values must be referenced through semantic CSS custom property tokens, not raw HEX values in component markup. Tokens are defined once in the global stylesheet using Tailwind CSS 4's `@theme` block and consumed as `var(--color-*)` or via Tailwind utility classes mapped to those variables.

### 2.2 Background & Surface Tokens

| Token | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| `--color-bg-canvas` | `#F8FAFC` (Slate 50) | `#0B1120` (Deep slate) | Root page background |
| `--color-bg-surface` | `#FFFFFF` | `#111C33` (Navy-tinted slate) | Cards, panels, sidebars |
| `--color-bg-elevated` | `#FFFFFF` | `#152238` (Elevated surface) | Dropdowns, dialogs, popovers |
| `--color-bg-muted` | `#F1F5F9` (Slate 100) | `#0F1A2E` | Muted section backgrounds, table row stripes |
| `--color-bg-hover` | `#F1F5F9` | `#1A2744` | Interactive element hover states |
| `--color-bg-selected` | `#E2E8F0` (Slate 200) | `#1E3058` | Selected rows, active items |
| `--color-bg-overlay` | `rgba(15,23,42,0.5)` | `rgba(0,0,0,0.6)` | Modal/dialog backdrops |

### 2.3 Border Tokens

| Token | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| `--color-border-subtle` | `#E2E8F0` (Slate 200) | `#1E293B` (Slate 800) | Card borders, panel dividers, table rules |
| `--color-border-default` | `#CBD5E1` (Slate 300) | `#334155` (Slate 700) | Input rings, section separators |
| `--color-border-strong` | `#94A3B8` (Slate 400) | `#475569` (Slate 600) | Focus states, active selection borders |
| `--color-border-destructive` | `#FCA5A5` (Red 300) | `#7F1D1D` (Red 900) | Error input ring |

### 2.4 Text Tokens

| Token | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| `--color-text-primary` | `#0F172A` (Slate 900) | `#F1F5F9` (Slate 100) | Body copy, page headings |
| `--color-text-secondary` | `#334155` (Slate 700) | `#CBD5E1` (Slate 300) | Section subtitles, field labels |
| `--color-text-muted` | `#64748B` (Slate 500) | `#94A3B8` (Slate 400) | Metadata, timestamps, helper text |
| `--color-text-disabled` | `#CBD5E1` (Slate 300) | `#334155` (Slate 700) | Disabled input text |
| `--color-text-on-accent` | `#FFFFFF` | `#042F2E` | Text rendered on teal accent backgrounds |
| `--color-text-destructive` | `#DC2626` (Red 600) | `#F87171` (Red 400) | Error messages, destructive action labels |
| `--color-text-link` | `#0D9488` (Teal 600) | `#14B8A6` (Teal 500) | Hyperlinks |

### 2.5 Accent Tokens

| Token | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| `--color-accent-primary` | `#0D9488` (Teal 600) | `#14B8A6` (Teal 500) | Primary interactive accent (focus rings, links, active states, CTA buttons) |
| `--color-accent-primary-hover` | `#0F766E` (Teal 700) | `#0D9488` (Teal 600) | Hover state for accent elements |
| `--color-accent-secondary` | `#10B981` (Emerald 500) | `#34D399` (Emerald 400) | Done/success accent, positive metrics |

### 2.6 Semantic Status Tokens

> [!IMPORTANT]
> Status colors alone are **never** sufficient. Every status must also display a text label and/or icon. See [Section 17](#17-status--priority-visual-indicators).

#### Task Status

| Status | Token Name | Light HEX | Dark HEX | Background (Light) | Background (Dark) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TODO` | `--color-status-todo` | `#64748B` | `#94A3B8` | `#F1F5F9` | `#1E293B` |
| `IN_PROGRESS` | `--color-status-in-progress` | `#0284C7` (Sky 600) | `#38BDF8` (Sky 400) | `#E0F2FE` | `#082F49` |
| `IN_REVIEW` | `--color-status-in-review` | `#8B5CF6` (Violet 500) | `#A78BFA` (Violet 400) | `#EDE9FE` | `#2E1065` |
| `DONE` | `--color-status-done` | `#059669` (Emerald 600) | `#34D399` (Emerald 400) | `#D1FAE5` | `#064E3B` |

#### Task Priority

| Priority | Token Name | Light HEX | Dark HEX | Background (Light) | Background (Dark) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `HIGH` | `--color-priority-high` | `#E11D48` (Rose 600) | `#FB7185` (Rose 400) | `#FFE4E6` | `#4C0519` |
| `MEDIUM` | `--color-priority-medium` | `#D97706` (Amber 600) | `#FCD34D` (Amber 300) | `#FEF3C7` | `#451A03` |
| `LOW` | `--color-priority-low` | `#64748B` (Slate 500) | `#94A3B8` (Slate 400) | `#F1F5F9` | `#1E293B` |

#### Destructive / Danger

| Token | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| `--color-destructive` | `#DC2626` (Red 600) | `#EF4444` (Red 500) | Delete buttons, danger zones |
| `--color-destructive-bg` | `#FEF2F2` | `#450A0A` | Destructive confirmation backgrounds |

### 2.7 Tailwind CSS 4 Token Declaration

Tokens are declared in the global stylesheet (e.g., `src/app/globals.css`) using the `@theme` directive. Component classes reference them via `bg-[--color-bg-canvas]` or through mapped Tailwind aliases:

```css
@theme {
  --color-bg-canvas: #F8FAFC;
  --color-bg-surface: #FFFFFF;
  --color-border-subtle: #E2E8F0;
  --color-text-primary: #0F172A;
  --color-accent-primary: #0D9488;
  /* ... all tokens */
}

.dark {
  --color-bg-canvas: #0B1120;
  --color-bg-surface: #111C33;
  --color-border-subtle: #1E293B;
  --color-text-primary: #F1F5F9;
  --color-accent-primary: #14B8A6;
  /* ... dark overrides */
}
```

> [!NOTE]
> Tailwind CSS 4 uses `@theme` and CSS custom properties. The legacy `tailwind.config.js` `theme.extend.colors` pattern is **not used** in this project.

---

## 3. Typography System

### 3.1 Font Families

| Role | Family | Usage |
| :--- | :--- | :--- |
| **UI / Heading / Body** | `Inter` (preferred) or `Plus Jakarta Sans` | All page text, navigation, labels, headings, body copy |
| **Monospace** | `JetBrains Mono` (preferred) or `Geist Mono` | Task IDs (`TASK-042`), timestamps, code snippets, metric counters |

Fonts are loaded via Next.js `next/font/google` for automatic optimization, subsetting, and self-hosting.

### 3.2 Type Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **H1 / Page Title** | `20px` (`text-xl`) | `600` (semibold) | `1.4` | `tracking-tight` | Page and section titles (e.g., "My Projects") |
| **H2 / Section Header** | `15px`–`16px` (`text-sm`/`text-base`) | `500` (medium) | `1.4` | `tracking-tight` | Panel headings, widget labels (e.g., "Team Activity") |
| **H3 / Subsection** | `13px`–`14px` (`text-sm`) | `500` (medium) | `1.4` | `normal` | Table column labels, card section titles |
| **Body / Default** | `13px`–`14px` (`text-sm`) | `400` (normal) | `1.6` (`leading-relaxed`) | `normal` | Paragraph text, descriptions, comments |
| **Small / Helper** | `12px` (`text-xs`) | `400` (normal) | `1.5` | `normal` | Helper text, field hints, tooltip copy |
| **Micro / Mono Meta** | `11px`–`12px` (`text-xs`) | `400`–`500` | `1.4` | `tracking-wide` | Task IDs, timestamps, badge labels (use monospace family) |
| **Button** | `13px`–`14px` (`text-sm`) | `500` (medium) | `1` | `normal` | Button labels |

### 3.3 Typography Rules

- **Never use `font-bold` (`700`) for UI labels** — semibold (`600`) is the maximum weight for the majority of text. Bold (`700`) is reserved for critical emphasis inside body text only.
- **Maximum line width**: `65ch` for paragraph copy to maintain readability.
- **Text truncation**: Use `truncate` (single-line) or `line-clamp-2` (task titles in cards) — never allow uncontrolled overflow.
- **Monospace for identifiers**: Any rendered database identifier, task code, or timestamp must use the monospace font family.
- **No italic UI text**: Italic (`font-italic`) is reserved for inline user-generated quotations only.

---

## 4. Spacing Scale & Layout Grid

### 4.1 Base Grid

All spacing is derived from a **4px base unit** (`--spacing-unit: 4px`). All padding, margin, gap, and size values must be multiples of 4px.

| Tailwind Class | px Value | rem Value | Usage |
| :--- | :--- | :--- | :--- |
| `p-0.5` | 2px | 0.125rem | Hairline insets (icon padding) |
| `p-1` | 4px | 0.25rem | Tight icon padding, badge insets |
| `p-2` | 8px | 0.5rem | Compact list item padding, chip padding |
| `p-3` | 12px | 0.75rem | Table cell padding, form field insets |
| `p-4` | 16px | 1rem | Card body padding (default) |
| `p-5` | 20px | 1.25rem | Card body padding (comfortable) |
| `p-6` | 24px | 1.5rem | Section padding, dashboard panel insets |
| `p-8` | 32px | 2rem | Page-level horizontal padding |
| `p-10` | 40px | 2.5rem | Major section vertical separation |
| `p-12` | 48px | 3rem | Full-bleed section padding |

### 4.2 Layout Grid

| Context | Desktop | Tablet | Mobile |
| :--- | :--- | :--- | :--- |
| **Page content max-width** | `1440px` (centered, `mx-auto`) | Full width | Full width |
| **Horizontal page padding** | `px-8` (32px) | `px-6` (24px) | `px-4` (16px) |
| **Sidebar width (expanded)** | `240px` (fixed) | `240px` (overlay) or `60px` (rail) | Hidden (drawer) |
| **Sidebar width (collapsed)** | `60px` (icon rail) | `0` (closed overlay) | `0` |
| **Main content area** | `calc(100vw - 240px)` | `100%` | `100%` |
| **Dashboard metrics row gap** | `gap-4` (16px) | `gap-4` (16px) | `gap-3` (12px) |
| **Card border radius** | `rounded-lg` (8px) | `rounded-lg` (8px) | `rounded-lg` (8px) |
| **Component border radius** | `rounded-md` (6px) | `rounded-md` (6px) | `rounded-md` (6px) |

### 4.3 Spacing Rules

- **No arbitrary spacing values**: `p-[11px]`, `mt-[7px]` are banned. Use the nearest 4px increment.
- **Consistent component insets**: Cards use `p-4` (compact) or `p-5` (comfortable). Do not mix within the same view.
- **Breathing room between sections**: Use `gap-6` (24px) between dashboard sections, `gap-4` (16px) between list items, `gap-2` (8px) between inline elements.
- **Hairline separators**: Use `border-b` with `border-[--color-border-subtle]` and `h-px` dividers — never margin-only separation for visual regions.

---

## 5. Responsive Breakpoints & Behavior

### 5.1 Approved Breakpoints

| Breakpoint | Min Width | Tailwind Prefix | Viewport |
| :--- | :--- | :--- | :--- |
| **Mobile** | `< 768px` | (default / no prefix) | Phone portrait/landscape |
| **Tablet** | `≥ 768px` | `md:` | Tablet portrait/landscape |
| **Desktop** | `≥ 1024px` | `lg:` | Laptop and large displays |
| **Wide Desktop** | `≥ 1280px` | `xl:` | Optional enhancements only |

> [!NOTE]
> `sm:` (640px) may be used for minor layout adjustments but `md:` and `lg:` are the two primary layout thresholds. `xl:` is for optional refinements (e.g., wider max-content column).

### 5.2 Mobile-First Implementation Rule

Write default styles for mobile, then override at `md:` and `lg:`. Never write desktop styles first and try to override downward.

```html
<!-- Correct: mobile-first -->
<div class="flex flex-col gap-3 md:grid md:grid-cols-2 lg:grid-cols-4">

<!-- Wrong: desktop-first override attempt -->
<div class="grid grid-cols-4 max-md:grid-cols-1">
```

### 5.3 Overflow Rules

| Rule | Detail |
| :--- | :--- |
| `overflow-x-hidden` on root | Applied to `<html>` or `<body>` — prevents unintended horizontal window scrolling |
| Kanban container scroll | `overflow-x-auto` on the Kanban wrapper element only — intentional horizontal scroll is approved inside this container |
| Table scroll container | Wrap in `<div class="overflow-x-auto">` — do not apply scroll to `<table>` itself |
| No page-level `overflow-x: scroll` | Horizontal window scroll must never appear for any page except inside explicitly scoped scroll containers |

### 5.4 Viewport-Specific Behavior Table

| Feature | Mobile (`< 768px`) | Tablet (`768px–1023px`) | Desktop (`≥ 1024px`) |
| :--- | :--- | :--- | :--- |
| **Sidebar** | Hidden; slide-out drawer (top trigger or hamburger icon) | Collapsible rail (60px) or overlay drawer | Persistent expanded (240px); collapsible to 60px rail |
| **Dashboard metrics** | Single column stacked | 2×2 grid | 4-column row |
| **Task list** | Card-per-row (transformed) | Table with horizontal scroll | Full-width table |
| **Kanban board** | Tabbed single-column (`[Todo][In Progress][In Review][Done]`) | Horizontal scroll (2–3 columns visible + snap) | Full multi-column layout |
| **Navigation** | Bottom bar or slide-out header drawer | Rail or hidden drawer toggle | Persistent sidebar |
| **Dialogs** | Full-screen bottom sheet | Centered modal | Centered modal |
| **Touch targets** | Minimum `44×44px` | Minimum `44×44px` | Minimum `36×36px` (cursor-based) |

---

## 6. Navigation & Sidebar

### 6.1 Sidebar Anatomy (Desktop)

```
┌──────────────────────────┐  ← 240px
│ [Team Logo / Name]       │  ← Team switcher: team name + role badge (OWNER/MANAGER/MEMBER)
│ ▼ Acme Corp  · OWNER    │
├──────────────────────────┤
│                          │
│ ○ Dashboard              │  ← /teams/[teamId]
│ ○ Projects               │  ← /teams/[teamId]/projects
│ ○ Tasks                  │  ← /teams/[teamId]/tasks
│ ○ Members     (Owner)   │  ← /teams/[teamId]/settings/members
│                          │
├──────────────────────────┤
│ ○ Settings               │  ← /teams/[teamId]/settings
├──────────────────────────┤
│                          │
│ [User Avatar + Name]     │  ← User menu (account settings, theme toggle, sign out)
└──────────────────────────┘
```

### 6.2 Sidebar States

| State | Appearance |
| :--- | :--- |
| **Expanded (default)** | 240px; icons + labels; active item has `bg-[--color-bg-hover]` solid background pill |
| **Collapsed (icon rail)** | 60px; icons only; tooltip on hover shows label; triggered by toggle button |
| **Active nav item** | Solid muted background (`bg-[--color-bg-hover]`), `font-medium` label, NO colored left border or underline |
| **Hover nav item** | `bg-[--color-bg-hover]` on `transition-colors duration-100` |

### 6.3 Team Switcher

- Displayed at the top of the sidebar.
- Shows current team name and the authenticated user's role badge.
- Clicking opens a popover/dropdown listing all teams the user belongs to + "Create new team" action.
- Route changes on team switch navigate to `/teams/[newTeamId]/` (the team dashboard).
- **Authorization note**: Team switching changes the viewed team. `lastActiveTeamId` is a navigation preference only and is never used for access control.

### 6.4 Tablet Navigation

- Sidebar collapses to a **60px icon rail** by default.
- A toggle button (hamburger / chevron) opens an **overlay drawer** (240px wide) on top of the page content.
- The overlay drawer has a backdrop. Clicking outside the drawer or pressing `Escape` closes it.
- Rail icons display a tooltip on hover via `title` attribute or Radix `Tooltip`.

### 6.5 Mobile Navigation

- The sidebar is fully hidden by default.
- Navigation is exposed via:
  - **Option A** (preferred): A fixed bottom navigation bar with 4–5 primary destinations (icons + short labels).
  - **Option B**: A top header bar with a hamburger icon that opens a full-height slide-out drawer from the left.
- Both options must include the team switcher within the navigation surface.
- Bottom navigation items must meet the 44×44px touch target requirement.

> [!NOTE]
> The choice between Option A and Option B for mobile navigation is an **Open Question** to be resolved before the mobile navigation component is implemented. The preference leans toward Option A (bottom bar) for thumb-zone accessibility on phones.

### 6.6 Sidebar Styling Rules

- Background: `bg-[--color-bg-surface]`
- Right edge: `border-r border-[--color-border-subtle]`
- No ambient shadow on the sidebar itself — border is the separator
- Font size for nav labels: `text-sm` (13px–14px), `font-medium` for active, `font-normal` for inactive
- Icon size: `16px`–`18px`, visually aligned with label text baseline

---

## 7. Dashboard Layout Rules

### 7.1 Desktop Dashboard Structure

```
┌──────────────────────────────────────────────────────────┐
│ H1: Dashboard / [Team Name]              [+ New Task]    │  ← Page header
├─────────────┬────────────┬────────────┬──────────────────┤
│ Active      │ My Tasks   │ In Review  │ Due This Week    │  ← Metrics row (4 stat widgets)
│ Projects    │            │            │                  │
│    3        │    8       │    4       │    2             │
├─────────────────────────────┬────────────────────────────┤
│                             │                            │
│  Prioritized Task Stream    │  Team Activity Log         │  ← Main two-column section
│  (65% width)                │  (35% width)               │
│                             │                            │
│  [table / task list]        │  [activity timeline]       │
│                             │                            │
└─────────────────────────────┴────────────────────────────┘
```

### 7.2 Dashboard Metrics Row

- **4 stat widgets** in a row (`grid-cols-4` on desktop).
- Widgets are separated by `border-r border-[--color-border-subtle]` (or rendered as one panel with internal dividers), **not** as 4 individually boxed cards.
- Each widget shows: a numeric count (H1 scale, `font-semibold`), a short label below (`text-xs text-[--color-text-muted]`), and optionally a small trend indicator.
- No heavy card shadows. No progress rings. Flat, information-first presentation.
- Reflows to `grid-cols-2` on tablet and `grid-cols-1` on mobile.

### 7.3 Prioritized Task Stream (Left Panel)

- Dense table or high-density list view.
- Columns: **Status dot** | **Title** | **Project badge** | **Priority badge** | **Due date** | **Assignee avatar**
- Items sorted by: overdue first → due soonest → by priority.
- Overdue due dates render in `--color-priority-high` text.
- Table rows have `hover:bg-[--color-bg-hover]` on `transition-colors duration-100`.

### 7.4 Team Activity Log (Right Panel)

- Compact chronological timeline of recent state changes.
- Each entry: **Avatar** (20px) + **User name** + **action verb** (e.g., "moved TASK-042 to Done") + **relative timestamp** (e.g., "2h ago").
- Relative timestamps use the monospace font family.
- Maximum visible entries: 20 (with "View all activity" link at the bottom).

### 7.5 Dashboard Layout on Tablet

- Metrics: `grid-cols-2`, 2×2 arrangement.
- Task Stream and Activity Log: stack vertically (`flex-col`), Activity Log below Task Stream.
- Full panel widths at `100%`.

### 7.6 Dashboard Layout on Mobile

- Metrics: `grid-cols-1` (single column stacked).
- Task Stream: rendered as a card-per-task list (not a horizontal table).
- Activity Log: collapsed behind a "Recent Activity" expandable toggle or placed below the task list.
- `+ New Task` floating action button (FAB) anchored to bottom-right on mobile (`fixed bottom-6 right-4`).

---

## 8. Project & Task Management UI Patterns

### 8.1 Project List Page (`/teams/[teamId]/projects`)

**Desktop**: Full-width table with columns:
- **Name** (truncated to 1 line, `font-medium`) | **Status badge** | **Tasks count** | **Due date** | **Created by** | **Actions** (⋯ menu)

**Mobile**: Card-per-project list. Each card shows: project name, status badge, task count pill, due date.

**Empty state**: See [Section 19](#19-loading-empty-error-success--disabled-states).

### 8.2 Project Detail Page (`/teams/[teamId]/projects/[projectId]`)

- Header: Project name (H1), status badge, description (truncated, expandable), due date, owner avatar.
- Sub-navigation tabs: **Tasks** | **Activity** (additional tabs may be added in later phases).
- Tasks tab defaults to Kanban board view on desktop, with a list/table view toggle.
- On mobile, tasks tab defaults to tabbed single-column Kanban.

### 8.3 Task Detail Dialog/Page

- Opens as a right-side panel (drawer/sheet) on desktop and tablet.
- Opens as a full-screen sheet on mobile.
- Contents: Task title (editable inline), Status select, Priority select, Assignee select, Due date, Description (Markdown — **Pending Validation**: rich text editor choice is an Open Question), Comments thread, Activity log.
- Assignee options must only list active members of the same team.

### 8.4 Task Creation

- Triggered from: `+ New Task` button on dashboard FAB, Kanban `+` column trigger, project task list `+ Add task`.
- Opens a dialog (see [Section 14](#14-dialogs--modals)) with fields: Title (required), Status (defaults to `TODO`), Priority (defaults to `MEDIUM`), Project (required), Assignee (optional), Due date (optional), Description (optional).
- On mobile, opens as a full-screen bottom sheet.

### 8.5 Project Date Validation Rules (Approved)

- Project `startDate` must be before `endDate`.
- Task `dueDate` must be validated on input (no server-only silent failure).
- If `endDate` is not set, there is no due-date upper bound on tasks.
- These rules must be enforced in both client-side validation (Zod schema) and Server Action validation.

### 8.6 URL Routing Pattern (Approved)

| Page | URL |
| :--- | :--- |
| Team dashboard | `/teams/[teamId]` |
| Project list | `/teams/[teamId]/projects` |
| Project detail | `/teams/[teamId]/projects/[projectId]` |
| Task board | `/teams/[teamId]/tasks` |
| Team settings | `/teams/[teamId]/settings` |
| Team members | `/teams/[teamId]/settings/members` |

**Rule**: `[teamId]` is always the team's UUID. Slug-based routing is not used.

---

## 9. Kanban Board & Task Card Rules

### 9.1 Kanban Board Structure (Desktop)

- **4 fixed columns**: `TODO` | `IN_PROGRESS` | `IN_REVIEW` | `DONE`
- Columns are displayed horizontally, full viewport width, inside an `overflow-x-auto` scroll container.
- Each column is a minimum `280px` wide, no maximum (stretches to fill).
- Column gap: `gap-4` (16px).

### 9.2 Column Header

```
[ ● ] TODO   8   [+]
```

- **Status dot** (8px circle, semantic color — see Section 17) + **status label** (uppercase, `text-xs font-medium text-[--color-text-muted]`) + **count** (monospace) + **+ trigger** (adds a new task in this column's status).
- Column header background: transparent (canvas shows through).
- Column header border-bottom: `border-b border-[--color-border-subtle]`.
- **Non-color indicator**: The status label text (`TODO`, `IN_PROGRESS`, etc.) is always present — the dot alone is not sufficient.

### 9.3 Column Body

- Background: transparent — canvas `--color-bg-canvas` shows through.
- Inner padding: `p-3` (12px).
- Task cards are stacked vertically with `gap-2` (8px) between them.
- Columns have a minimum height (`min-h-[400px]`) to provide a visible drop target when empty.

### 9.4 Task Card Structure

```
┌────────────────────────────────────┐
│ TASK-042  · ▲ HIGH                 │  ← Mono ID + Priority icon+label
│                                    │
│ Implement user authentication      │  ← Task title (2-line clamp, font-medium)
│ system with Better Auth            │
│                                    │
│ [Auth] · Jun 15 · [Avatar]        │  ← Project badge · Due date · Assignee avatar
└────────────────────────────────────┘
```

**Task card anatomy**:
- **Line 1**: Task code (`TASK-042`) in monospace (`text-xs font-mono text-[--color-text-muted]`) + priority icon and text label (see [Section 17](#17-status--priority-visual-indicators)).
- **Line 2–3**: Task title, `font-medium text-sm`, `line-clamp-2`.
- **Line 4**: Project badge pill + due date (red if overdue) + assignee avatar (20px circle). Items separated by `·` or `gap-2`.

**Task card styling**:
- Background: `bg-[--color-bg-surface]`
- Border: `border border-[--color-border-subtle]`
- Border radius: `rounded-md` (6px)
- Padding: `p-3` (12px)
- Hover border: `hover:border-[--color-border-default]`
- Transition: `transition-colors duration-100`
- **No vertical translation or shadow jump on hover**: `hover:shadow-sm` (subtle, not `shadow-md`)
- Cursor: `cursor-grab` during drag, `cursor-grabbing` during active drag

### 9.5 Drag and Drop

- Drag-and-drop for task reordering within and between columns.
- Implementation: Client Component (`"use client"`) using an approved DnD library (**Pending Validation**: library choice — `@dnd-kit/core` or similar — is an Open Question for Phase 1).
- During drag, the original card slot shows a placeholder with `border-dashed border-2 border-[--color-border-default]` and transparent background.
- Dropping into a new column triggers a Server Action to update task status.

### 9.6 Kanban on Tablet

- Columns visible: 2–3 (depending on column width and viewport).
- Horizontal scroll with `scroll-snap-type: x mandatory` and `scroll-snap-align: start` on each column.
- Column minimum width: `280px`.
- Visible column count indicator at the top (`← Todo | In Progress →`) or scroll dots.

### 9.7 Kanban on Mobile

- **Tabbed single-column view**: 4 tabs rendered as a full-width tab bar at the top of the board section.
- Active tab label: `IN_PROGRESS` with status dot and count.
- Each tab shows only the tasks for that status column in a card list.
- Swipe gesture support between tabs is an enhancement — **Pending Validation** (depends on the interaction library chosen).
- Task cards retain the same anatomy as desktop.
- `+ Add task` FAB fixed to bottom-right (`fixed bottom-6 right-4`).

---

## 10. Tables

### 10.1 Table Structure Rules

- Use `<table>` with semantic `<thead>`, `<tbody>`, `<th>`, `<td>` elements.
- Full-width: `w-full table-auto` (or `table-fixed` for defined column widths).
- Wrap in `<div class="overflow-x-auto rounded-lg border border-[--color-border-subtle]">` for horizontal scroll containment.

### 10.2 Table Styling

| Element | Style |
| :--- | :--- |
| Header row (`<thead>`) | `bg-[--color-bg-muted]`, `border-b border-[--color-border-subtle]` |
| Header cell (`<th>`) | `text-xs font-medium text-[--color-text-muted] uppercase tracking-wide px-4 py-3 text-left` |
| Body row (`<tr>`) | `border-b border-[--color-border-subtle] hover:bg-[--color-bg-hover] transition-colors duration-100` |
| Body cell (`<td>`) | `text-sm text-[--color-text-primary] px-4 py-3` |
| Last body row | No `border-b` (remove border on last row of group) |

### 10.3 Column Sort

- Sortable columns show a sort icon (`↑↓`) in the `<th>`.
- Active sort direction is indicated by a solid arrow icon (up or down) + slightly bolder `<th>` text color.
- Sort state is not color-coded — icon direction is the sole indicator.

### 10.4 Table on Mobile

- Wide desktop tables transform into **card-per-row** layout on mobile.
- Each card renders the most critical fields: primary identifier, status badge, priority badge, due date.
- Secondary fields (created date, assignee email, etc.) are hidden on mobile or placed inside a collapsible "More details" section.
- Implementation: Use CSS `@media` (via Tailwind `hidden md:table` / `md:hidden`) to conditionally show table vs. card layout.

### 10.5 Pagination

- Server-side pagination. Page size: 25 rows (desktop), 10 rows (mobile).
- Pagination control: `< Previous  Page 1 of 4  Next >` — text-based, not icon-only.
- Current page number rendered in `font-semibold`.
- Pagination placed below the table, right-aligned on desktop, centered on mobile.

### 10.6 Table Empty State

- When a table has zero rows, render an empty state inside the table body spanning all columns. See [Section 19.2](#192-empty-state).

---

## 11. Forms & Inputs

### 11.1 Input Styling

| State | Style |
| :--- | :--- |
| **Default** | `border border-[--color-border-default] bg-[--color-bg-surface] text-sm text-[--color-text-primary] rounded-md px-3 py-2 placeholder:text-[--color-text-muted]` |
| **Focus** | `outline-none ring-2 ring-[--color-accent-primary] ring-offset-0 border-transparent` |
| **Error** | `border-[--color-border-destructive] ring-2 ring-[--color-destructive]/20` |
| **Disabled** | `bg-[--color-bg-muted] text-[--color-text-disabled] cursor-not-allowed opacity-60` |
| **Read-only** | `bg-[--color-bg-muted] cursor-default` |

- Input height: minimum `36px` on desktop, `44px` on mobile (touch target).
- Full-width by default (`w-full`).
- Border radius: `rounded-md` (6px).

### 11.2 Field Labels

- Position: **above** the input field (never floating placeholder labels).
- Style: `text-sm font-medium text-[--color-text-secondary] mb-1`.
- Required field marker: `<span aria-hidden="true" class="text-[--color-priority-high]"> *</span>` after the label text. Required is also indicated in the `<input required>` attribute.
- Helper text: `text-xs text-[--color-text-muted] mt-1`.
- Error text: `text-xs text-[--color-text-destructive] mt-1` (replaces helper text when in error state).

### 11.3 Textarea

- Same styling rules as `<input>`.
- Minimum height: `80px` (3 rows).
- `resize-y` only (no horizontal resizing).

### 11.4 Select / Combobox

- Styled to match text inputs.
- Use Radix UI `Select` or `Combobox` primitives for accessible keyboard navigation.
- Dropdown appearance: see [Section 15](#15-dropdowns--selects).
- Searchable selects (e.g., assignee picker): include an inline search input at the top of the dropdown.

### 11.5 Form Layout

- Form fields stacked vertically (`flex flex-col gap-4`) by default.
- Multi-column forms (2-column) only on desktop (`lg:grid lg:grid-cols-2 lg:gap-6`) where field pairs are semantically related (e.g., Start Date / End Date).
- Submit and cancel buttons right-aligned inside a `flex justify-end gap-3` footer row.

### 11.6 Validation Rules

- Client-side validation using Zod schemas (Approved Planned — to be installed in Phase 1).
- Validation on submit only (not on every keystroke) unless a field has `blur`-triggered validation for pre-confirmation (e.g., password strength).
- Field errors display immediately below the relevant field (not in a top-of-form banner).
- If multiple fields fail, all errors are shown simultaneously.

---

## 12. Buttons

### 12.1 Button Variants

| Variant | Usage | Light | Dark |
| :--- | :--- | :--- | :--- |
| **Primary** | Main CTA (create, save, submit) | `bg-[--color-accent-primary] text-white hover:bg-[--color-accent-primary-hover]` | Same (teal token maps to dark value) |
| **Secondary / Outline** | Secondary actions | `border border-[--color-border-default] bg-transparent text-[--color-text-primary] hover:bg-[--color-bg-hover]` | Same |
| **Ghost** | Tertiary actions, icon buttons in toolbars | `bg-transparent text-[--color-text-secondary] hover:bg-[--color-bg-hover]` | Same |
| **Destructive** | Delete, remove, danger zone | `bg-[--color-destructive] text-white hover:bg-red-700` | Same |
| **Destructive Outline** | Destructive confirmation (secondary) | `border border-[--color-destructive] text-[--color-destructive] hover:bg-[--color-destructive-bg]` | Same |

### 12.2 Button Sizes

| Size | Height | Padding | Font | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Small (`sm`)** | `32px` | `px-3 py-1.5` | `text-sm` | Table row actions, badge actions |
| **Default** | `36px` | `px-4 py-2` | `text-sm font-medium` | Standard buttons |
| **Large (`lg`)** | `44px` | `px-6 py-2.5` | `text-base font-medium` | Mobile primary actions, prominent CTAs |
| **Icon only** | `36px × 36px` | `p-2` | — | Toolbar icon buttons (must have `aria-label`) |

### 12.3 Button Styling Rules

- Border radius: `rounded-md` (6px) for all button sizes.
- Transition: `transition-colors duration-150`.
- Focus ring: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-2`.
- Disabled: `disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none`.
- Loading state: Replace label with a spinner icon + "Loading…" text (not just a spinner alone — text is required for screen readers).
- **No icon-only buttons without accessible labels**: Every icon button must have `aria-label`.

### 12.4 Button Groups

- Related actions in a row: `flex gap-2`.
- Destructive action must always be separated from primary action by sufficient visual distance (gap or spacer) to prevent accidental clicks.
- Confirm / Cancel order: **Cancel first (left), Confirm second (right)** in dialogs.

---

## 13. Badges & Tags

### 13.1 Badge Anatomy

Badges (also called pills or tags) are inline, non-interactive labels.

**Base style**: `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium`

### 13.2 Badge Variants

| Variant | Background | Text | Usage |
| :--- | :--- | :--- | :--- |
| **Default / Neutral** | `bg-[--color-bg-muted]` | `text-[--color-text-secondary]` | Project name, generic labels |
| **Status — TODO** | `bg-[--color-status-todo]/15` | `text-[--color-status-todo]` | Task status indicator |
| **Status — IN_PROGRESS** | `bg-[--color-status-in-progress]/15` | `text-[--color-status-in-progress]` | Task status indicator |
| **Status — IN_REVIEW** | `bg-[--color-status-in-review]/15` | `text-[--color-status-in-review]` | Task status indicator |
| **Status — DONE** | `bg-[--color-status-done]/15` | `text-[--color-status-done]` | Task status indicator |
| **Priority — HIGH** | `bg-[--color-priority-high]/10` | `text-[--color-priority-high]` | Task priority |
| **Priority — MEDIUM** | `bg-[--color-priority-medium]/10` | `text-[--color-priority-medium]` | Task priority |
| **Priority — LOW** | `bg-[--color-priority-low]/10` | `text-[--color-priority-low]` | Task priority |
| **Role — OWNER** | `bg-[--color-bg-muted]` | `text-[--color-text-secondary]` | Team member role |
| **Role — MANAGER** | `bg-[--color-bg-muted]` | `text-[--color-text-secondary]` | Team member role |
| **Role — MEMBER** | `bg-[--color-bg-muted]` | `text-[--color-text-muted]` | Team member role |

### 13.3 Badge Rules

- **Never color-only**: Status and priority badges always include a text label (never just a colored dot alone without adjacent text).
- Role badges: rendered adjacent to user names in the sidebar team switcher, member lists, and task assignee dropdowns.
- Project badge on task cards: neutral default variant with the project name truncated to 1 line.
- Badge border radius: `rounded-full` (fully rounded pill).

---

## 14. Dialogs & Modals

### 14.1 Dialog Anatomy

```
┌─────────────────────────────────────────┐
│ Dialog Title                        [×] │  ← Header: title (H2 scale) + close button
├─────────────────────────────────────────┤
│                                         │
│  Dialog body content (form, confirm     │  ← Scrollable body
│  message, details)                      │
│                                         │
├─────────────────────────────────────────┤
│                   [Cancel]  [Confirm]   │  ← Footer: cancel left, confirm right
└─────────────────────────────────────────┘
```

### 14.2 Dialog Sizes

| Size | Max Width | Usage |
| :--- | :--- | :--- |
| **Small** | `max-w-md` (448px) | Confirmation dialogs, simple 1–3 field forms |
| **Default** | `max-w-lg` (512px) | Standard create/edit forms |
| **Large** | `max-w-2xl` (672px) | Task detail dialog with comments and activity |
| **Full-screen (mobile)** | `h-full w-full` | All dialogs on mobile viewports |

### 14.3 Dialog Styling

- Background: `bg-[--color-bg-elevated]`.
- Border: `border border-[--color-border-subtle]`.
- Border radius: `rounded-lg` (8px) on desktop; `rounded-t-lg` on mobile bottom sheet.
- Backdrop: `bg-[--color-bg-overlay]` with `backdrop-blur-none` (no blur on the backdrop — Precision Swiss rule).
- Transition: `animate-in fade-in-0 zoom-in-95 duration-150` on open; `animate-out fade-out-0 zoom-out-95 duration-100` on close.
- Scrollable body: `overflow-y-auto max-h-[80vh]` for the dialog content area.

### 14.4 Dialog Accessibility

- Use Radix UI `Dialog` primitive for correct `aria-modal`, `role="dialog"`, focus trap, and `Escape` key handling.
- Initial focus moves to the first interactive element inside the dialog on open.
- Closing via: `Escape` key, clicking the `×` button, or clicking the backdrop.
- Destructive dialogs: focus must land on **Cancel** (not the destructive confirm button) on open.

### 14.5 Mobile Dialog

- On mobile (`< 768px`): Dialog renders as a **bottom sheet** that slides up from the bottom.
- Uses `fixed bottom-0 left-0 right-0 w-full rounded-t-lg`.
- Handle indicator: `w-10 h-1 bg-[--color-border-default] rounded-full mx-auto mt-3 mb-4`.
- Max height: `max-h-[90vh] overflow-y-auto`.

---

## 15. Dropdowns & Selects

### 15.1 Dropdown Menu (Contextual)

Used for `⋯` (more options) menus on task cards, table rows, project headers.

- Trigger: ghost icon button with `aria-haspopup="menu"` and `aria-expanded`.
- Dropdown panel: `bg-[--color-bg-elevated] border border-[--color-border-subtle] rounded-lg shadow-sm`.
- Shadow: `shadow-sm` only (subtle elevation, not heavy shadow).
- Minimum width: `180px`.
- Item height: `36px` minimum (`44px` on mobile).
- Item style: `flex items-center gap-2 px-3 py-2 text-sm text-[--color-text-primary] hover:bg-[--color-bg-hover] cursor-pointer rounded-md`.
- Destructive item: `text-[--color-text-destructive] hover:bg-[--color-destructive-bg]`.
- Separator: `border-t border-[--color-border-subtle] my-1`.
- Use Radix UI `DropdownMenu` for accessibility (keyboard navigation, `Escape` to close, `role="menuitem"`).

### 15.2 Select / Combobox

Used for Status, Priority, Assignee, Project selection fields.

- Trigger: styled like a text input (see [Section 11.1](#111-input-styling)) with a trailing chevron icon.
- Options panel: same styling as dropdown menu panel above.
- Searchable selects: add `<input type="text" placeholder="Search…">` as the first item inside the panel.
- Selected option: shown with a checkmark icon (`✓`) to the left.
- Use Radix UI `Select` or a Combobox primitive.

---

## 16. Feedback States

### 16.1 Toast Notifications

- In-app transient feedback for actions (task created, comment posted, error occurred).
- Position: **top-right** on desktop; **bottom-center** on mobile.
- Variants:
  - **Success**: `border-l-4 border-[--color-status-done]` + check icon.
  - **Error**: `border-l-4 border-[--color-destructive]` + X icon.
  - **Info**: `border-l-4 border-[--color-status-in-progress]` + info icon.
  - **Warning**: `border-l-4 border-[--color-priority-medium]` + warning triangle icon.
- Background: `bg-[--color-bg-elevated]`.
- Border: `border border-[--color-border-subtle]`.
- Auto-dismiss: 4 seconds for success/info; 8 seconds for error/warning (error must also offer a manual dismiss).
- Must include a close `×` button for manual dismissal.
- Toasts must include both an icon and a text message (not icon-only).

### 16.2 Inline Form Errors

Covered in [Section 11.2](#112-field-labels).

### 16.3 Notification Bell (In-App Notifications)

- Bell icon in the sidebar footer (or top bar on mobile).
- Unread count badge: `bg-[--color-priority-high] text-white rounded-full text-xs` positioned at top-right of bell icon. Badge shows count or `9+` for 10+.
- Clicking opens a popover/dropdown panel.
- Notifications fetched via polling (no WebSockets in MVP).
- Notification items: `avatar + actor name + action description + relative timestamp`.

---

## 17. Status & Priority Visual Indicators

> [!IMPORTANT]
> **Color alone is never the sole indicator of status or priority.** WCAG 1.4.1 (Use of Color) requires that all information conveyed by color also be available through another visual channel.

### 17.1 Task Status Indicators

Every status indicator must include **at minimum** a colored dot **and** a text label. Icon-only or color-only displays are disallowed.

| Status | Icon | Dot Color | Text Label | Full Display Example |
| :--- | :--- | :--- | :--- | :--- |
| `TODO` | `○` (empty circle) | `--color-status-todo` (Slate) | "Todo" | `○ Todo` |
| `IN_PROGRESS` | `◔` (quarter-fill circle) | `--color-status-in-progress` (Sky Blue) | "In Progress" | `◔ In Progress` |
| `IN_REVIEW` | `◑` (half-fill circle) | `--color-status-in-review` (Violet) | "In Review" | `◑ In Review` |
| `DONE` | `●` (filled circle) or `✓` | `--color-status-done` (Emerald) | "Done" | `✓ Done` |

**Compact display** (Kanban column header, task card corner): colored dot (`8px`, `rounded-full`) + abbreviated text `IN_PROGRESS → "In Progress"`.

**Badge display** (table cell, filter pill): Status badge with soft background — see [Section 13.2](#132-badge-variants).

**Select/Dropdown display** (status picker): Icon + full text label in each option.

### 17.2 Task Priority Indicators

| Priority | Icon | Color | Text Label | Full Display Example |
| :--- | :--- | :--- | :--- | :--- |
| `HIGH` | `▲` (up triangle) | `--color-priority-high` (Rose) | "High" | `▲ High` |
| `MEDIUM` | `—` (dash) | `--color-priority-medium` (Amber) | "Medium" | `— Medium` |
| `LOW` | `▽` (down triangle outline) | `--color-priority-low` (Slate) | "Low" | `▽ Low` |

**Compact display** (task card top-right): Priority icon + text label in `text-xs font-medium` using the semantic color token.

**Badge display**: Priority badge with soft background — see [Section 13.2](#132-badge-variants).

### 17.3 Project Status Indicators

Projects have their own status values (`PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `ARCHIVED`). These follow the same principle: icon + text label + semantic color. Specific color tokens for project statuses are **Pending Validation** (to be defined during Phase 1 schema implementation alongside `docs/DATABASE_DESIGN.md`).

### 17.4 Overdue Indicator

- Due dates that are past the current date render in `text-[--color-priority-high]` (red).
- **Non-color indicator**: An exclamation triangle icon (`⚠`) prepended to the date text.
- Example: `⚠ Jun 10` (overdue) vs `Jun 15` (not overdue).

---

## 18. Accessibility Requirements

### 18.1 Contrast Requirements

| Use Case | Minimum Ratio | Target |
| :--- | :--- | :--- |
| Body text on background | 4.5:1 (WCAG AA) | 7:1 (WCAG AAA) |
| Large text (18px+ or 14px bold) | 3:1 (WCAG AA) | 4.5:1 |
| UI component borders (input, button) | 3:1 against adjacent background | — |
| Inactive/disabled text | No minimum (WCAG exception for disabled) | Strive for 3:1 |
| Status color dots | Must also have text label (see Section 17) | — |

> [!NOTE]
> All color token pairs must be verified with a contrast checker before implementation. Tokens defined in Section 2 are designed to meet these ratios, but must be validated during Phase 1 implementation.

### 18.2 Keyboard Navigation

- **All interactive elements** (buttons, links, inputs, selects, tabs, Kanban cards) must be reachable via `Tab` key in logical DOM order.
- **Tab order** must follow the visual reading order (top-to-bottom, left-to-right).
- Skip navigation link: `<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-2">Skip to main content</a>` placed as the first element in `<body>`.
- Dialogs: focus must be trapped inside while open.
- Escape key: closes dialogs, dropdowns, and popovers.
- Kanban drag-and-drop: must support keyboard-based move (activate with Space/Enter, arrow keys to move between columns, confirm with Enter, cancel with Escape). Implementation depends on DnD library choice — **Pending Validation**.

### 18.3 Focus Visibility

All interactive elements must display a visible focus ring:

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-2
```

- Ring width: minimum 3px (ring-2 = 2px; use `ring-[3px]` for WCAG 2.2 compliance at the AAA target).
- Ring color: `--color-accent-primary` (teal) in both light and dark modes.
- `focus-visible` (not `focus`): only show ring when navigating by keyboard, not on mouse click.
- Ring must be visible against all background colors — `ring-offset-2` provides separation from the element border.

### 18.4 Touch Targets

- **Minimum 44×44px** for all interactive elements on mobile and tablet (WCAG 2.5.5).
- Applies to: buttons, nav items, table row actions, Kanban card drag handles, dialog close buttons.
- On desktop (cursor-based), minimum is relaxed to `36px` for compact UI elements.
- Icon buttons must include visible label text or `aria-label`.

### 18.5 Screen Reader Requirements

- All images: `alt` attribute (empty `alt=""` for purely decorative images).
- All icon-only buttons: `aria-label`.
- Status indicators: include visible text label (Section 17) — do not rely on color-coded icons alone.
- Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the dialog title.
- Live regions: Toast notifications must use `role="status"` (for success/info) or `role="alert"` (for errors) for screen reader announcement.
- Loading states: Use `aria-busy="true"` on the container being updated and `aria-live="polite"` for completion announcements.
- Form errors: Use `aria-describedby` to link error messages to their fields. Use `aria-invalid="true"` on errored inputs.
- Notification count badge: Use `aria-label="X unread notifications"` on the bell button — do not rely on the visual badge number alone.

### 18.6 Semantic HTML

- Use semantic elements: `<nav>`, `<main>`, `<aside>`, `<section>`, `<article>`, `<header>`, `<footer>`.
- Do not use `<div>` where a semantic element is appropriate.
- Heading hierarchy: `<h1>` once per page (page title), `<h2>` for major sections, `<h3>` for subsections. Do not skip levels.
- Tables: use `<th scope="col">` / `<th scope="row">` for proper header association.
- Lists: use `<ul>` / `<ol>` for navigation lists and menu items (not `<div>` stacks).

### 18.7 Reduced Motion

Respect the `prefers-reduced-motion` media query:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Apply via Tailwind: `motion-reduce:transition-none motion-reduce:animate-none` on animated elements.

---

## 19. Loading, Empty, Error, Success & Disabled States

### 19.1 Loading State

| Context | Approach |
| :--- | :--- |
| **Page / route level** | Next.js `loading.tsx` with skeleton UI (not spinner) |
| **Data table / list** | Skeleton rows: `animate-pulse bg-[--color-bg-muted] rounded h-4 w-full` |
| **Kanban board** | Skeleton cards per column (3–4 placeholder cards per column) |
| **Button (submitting)** | Spinner icon (`animate-spin`) + "Loading…" text + `disabled` attribute |
| **Inline widget** | Small spinner or skeleton inline |

**Skeleton rules**: Skeletons must have the same height and rough layout as the content they replace. No generic "Loading…" text as the sole page-level indicator.

### 19.2 Empty State

Each empty state must include:
1. An **illustrative icon or small pictogram** (not a full-page illustration — keep it compact and professional).
2. A **heading** (`text-sm font-medium text-[--color-text-secondary]`): e.g., "No tasks yet".
3. A **description** (`text-xs text-[--color-text-muted]`): e.g., "Create a task to get started."
4. An **action button** (Primary variant) when the user can resolve the empty state: e.g., `+ Create Task`.

**Empty state container**: `flex flex-col items-center justify-center gap-3 py-16 text-center`.

### 19.3 Error State

| Error Type | Approach |
| :--- | :--- |
| **Page-level / Route error** | Next.js `error.tsx` with error boundary: title, description, "Try again" button |
| **Server Action failure** | Toast (error variant) + inline field errors if applicable |
| **Network / fetch failure** | Inline error state inside the failed component with a "Retry" button |
| **Not found (404)** | Next.js `not-found.tsx`: "Page not found" + link back to dashboard |

**Error state text**: Always explain what went wrong in plain language. Never show raw error codes or stack traces to end users.

### 19.4 Success State

- **Transient actions** (create, update, delete): Toast (success variant) auto-dismissed after 4 seconds.
- **Multi-step forms**: "Step 3 of 3 — Complete" progress and a success confirmation screen before redirecting.
- **Inline confirmation**: For critical destructive actions (team deletion), a final confirmation step — not just a toast.

### 19.5 Disabled State

- Disabled interactive elements: `opacity-50 cursor-not-allowed pointer-events-none`.
- Disabled inputs: `bg-[--color-bg-muted] text-[--color-text-disabled]`.
- If an element is disabled due to insufficient permissions, include a tooltip explaining why (`aria-describedby` pointing to a hidden explanation element, or `title` attribute).
- Disabled buttons must retain their shape and size — do not shrink or move them.

---

## 20. Light / Dark Mode Behavior

### 20.1 Mode Switching

- Light and dark mode are supported from day one.
- Mode is stored in user preferences (database field) and falls back to `prefers-color-scheme` system preference if not set.
- Mode is applied by toggling the `dark` class on `<html>` (Tailwind CSS 4 dark mode via `class` strategy).
- Mode toggle: rendered in the user menu at the bottom of the sidebar. Options: Light / Dark / System.
- No Flash of Unstyled Content (FOUC): mode class must be set server-side from the session/cookie before the page hydrates.

### 20.2 Color Token Behavior

- All component styles reference CSS custom property tokens (Section 2).
- Dark mode tokens are declared under `.dark { ... }` in `globals.css`.
- No component should contain hardcoded HEX values. All colors come from `var(--color-*)` or Tailwind aliases mapped to those variables.
- Status and priority semantic tokens retain their approximate hue family in dark mode but are lightened for contrast on dark surfaces (see Section 2.6).

### 20.3 Dark Mode Surface Hierarchy

| Level | Dark HEX | Purpose |
| :--- | :--- | :--- |
| Canvas (deepest) | `#0B1120` | Root page background |
| Surface | `#111C33` | Cards, panels, sidebar |
| Elevated | `#152238` | Dropdowns, dialogs (above surface) |
| Overlay | `#1A2744` | Hover states on surface-level items |

Surfaces must maintain clear visual separation in dark mode without relying on shadows — use the progressive elevation palette above.

### 20.4 Image & Icon Behavior in Dark Mode

- SVG icons: use `currentColor` so they inherit text color tokens automatically.
- Photographs / screenshots embedded in the app (e.g., user avatars): no dark mode filtering applied.
- Logo / wordmark: provide separate dark mode variant if necessary (`dark:hidden` / `dark:block` pattern).

---

## 21. Next.js & Tailwind CSS 4 Implementation Rules

### 21.1 Installed Versions

| Tool | Version | Status |
| :--- | :--- | :--- |
| Next.js | 16.4.6 (App Router) | ✅ Installed |
| React | 19 | ✅ Installed |
| TypeScript | Latest | ✅ Installed |
| Tailwind CSS | 4.3.3 | ✅ Installed |
| Zod | — | ⏳ Approved Planned (Phase 1) |

### 21.2 Tailwind CSS 4 Rules

**Tailwind CSS 4 uses `@theme` and CSS variables, not `tailwind.config.js`.**

```css
/* globals.css — correct Tailwind 4 token declaration */
@import "tailwindcss";

@theme {
  --color-bg-canvas: #F8FAFC;
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --radius-md: 6px;
  --radius-lg: 8px;
}
```

- Do **not** create or reference a `tailwind.config.js` with `theme.extend.colors` for design token colors.
- Use `bg-[--color-bg-canvas]`, `text-[--color-text-primary]` for inline variable references.
- Tailwind utilities (`text-sm`, `font-medium`, `rounded-md`) continue to work as before.
- Custom utilities that don't map to Tailwind classes use `@layer utilities { ... }` in `globals.css`.

### 21.3 Next.js App Router Rules

- **Server Components by default**: All `page.tsx`, `layout.tsx` are RSC. Data fetching happens directly in RSC via Prisma.
- **Client Components (`"use client"`)**: Only for interactive leaf islands (forms with local state, dialogs, Kanban DnD, tabs, dropdowns).
- **No `useEffect` for data fetching**: All data fetching is RSC-side. Client components receive data as props.
- **Server Actions**: All mutations use `"use server"` functions in `src/features/<feature>/actions.ts`. Always return `ActionResult<T>` (see `docs/ARCHITECTURE.md` Section 6).
- **`revalidatePath`**: Called inside every mutating Server Action after a successful database write.
- **Route Handlers**: Only for `src/app/api/auth/[...all]/route.ts` (Better Auth). Not for general data APIs.

### 21.4 Component Architecture Rules

- **Shared UI primitives**: Built on Radix UI primitives. Located in `src/components/ui/`.
- **Feature components**: Located in `src/features/<feature>/components/`.
- **Layout components**: Located in `src/components/layout/` (sidebar, shell, header).
- **No prop drilling beyond 2 levels**: Extract to Context or colocate fetching higher if props need to travel more than 2 component levels.
- **No barrel files (`index.ts`)** that re-export everything from a directory — import directly from the source file.

### 21.5 Styling Rules

- **Tailwind utility classes are the primary styling mechanism**. No inline `style={{}}` for spacing, color, or layout — use Tailwind classes.
- Inline `style={{}}` is permitted only for truly dynamic values that cannot be expressed as a fixed Tailwind class (e.g., dynamic width based on a data value like `style={{ width: \`${percent}%\` }}`).
- **No CSS modules**: Project uses Tailwind exclusively for component styling.
- **Class merging**: Use `cn()` utility (wrapping `clsx` + `tailwind-merge`) for conditional class composition. Never string concatenate class names.
- **`clsx` pattern**:
  ```typescript
  import { cn } from "@/lib/utils";
  <button className={cn("base-classes", isActive && "active-classes", className)} />
  ```

### 21.6 Font Loading

```typescript
// src/app/layout.tsx
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
```

Apply `inter.variable` and `jetbrainsMono.variable` to `<html>` in the root layout.

### 21.7 Dark Mode Class Strategy

In `globals.css`:
```css
@import "tailwindcss";
/* Tailwind 4: dark mode via class on <html> */
```

In Tailwind config equivalent (via CSS `@theme`), no explicit `darkMode: 'class'` config key — Tailwind CSS 4 applies dark variants when the `.dark` class is present on `<html>` by default.

The root layout must set the `dark` class server-side from the user's stored theme preference:

```typescript
// src/app/layout.tsx
<html lang="en" className={cn(inter.variable, jetbrainsMono.variable, theme === "dark" && "dark")}>
```

### 21.8 Accessibility Implementation

- Use Radix UI primitives for all complex interactive components: `Dialog`, `DropdownMenu`, `Select`, `Tabs`, `Tooltip`, `Popover`, `AlertDialog`.
- Do not build custom accessible dialog, tooltip, or dropdown implementations from scratch.
- All Radix primitives must be styled using the design tokens defined in this document.

---

## Appendix A: Design Token Quick Reference

### Light Mode Tokens

| Purpose | Token | HEX |
| :--- | :--- | :--- |
| Page background | `--color-bg-canvas` | `#F8FAFC` |
| Card / panel background | `--color-bg-surface` | `#FFFFFF` |
| Muted background | `--color-bg-muted` | `#F1F5F9` |
| Hover background | `--color-bg-hover` | `#F1F5F9` |
| Subtle border | `--color-border-subtle` | `#E2E8F0` |
| Default border | `--color-border-default` | `#CBD5E1` |
| Primary text | `--color-text-primary` | `#0F172A` |
| Muted text | `--color-text-muted` | `#64748B` |
| Accent (teal) | `--color-accent-primary` | `#0D9488` |
| Accent hover | `--color-accent-primary-hover` | `#0F766E` |
| Destructive | `--color-destructive` | `#DC2626` |
| Status: Done | `--color-status-done` | `#059669` |
| Priority: High | `--color-priority-high` | `#E11D48` |

### Dark Mode Tokens

| Purpose | Token | HEX |
| :--- | :--- | :--- |
| Page background | `--color-bg-canvas` | `#0B1120` |
| Card / panel background | `--color-bg-surface` | `#111C33` |
| Elevated (dialogs) | `--color-bg-elevated` | `#152238` |
| Hover background | `--color-bg-hover` | `#1A2744` |
| Subtle border | `--color-border-subtle` | `#1E293B` |
| Default border | `--color-border-default` | `#334155` |
| Primary text | `--color-text-primary` | `#F1F5F9` |
| Muted text | `--color-text-muted` | `#94A3B8` |
| Accent (teal) | `--color-accent-primary` | `#14B8A6` |
| Destructive | `--color-destructive` | `#EF4444` |
| Status: Done | `--color-status-done` | `#34D399` |
| Priority: High | `--color-priority-high` | `#FB7185` |

---

## Appendix B: Open Questions & Pending Decisions

The following items in this document require resolution before the relevant components are implemented in Phase 1:

| # | Section | Topic | Decision Needed |
| :--- | :--- | :--- | :--- |
| 1 | §6.5 | Mobile navigation pattern | Bottom bar (Option A) vs. top header + slide-out drawer (Option B) |
| 2 | §8.3 | Task description editor | Plain `<textarea>` vs. lightweight rich text editor (e.g., Tiptap). Must evaluate bundle size impact |
| 3 | §9.5 | Kanban DnD library | `@dnd-kit/core` vs. `react-beautiful-dnd` vs. native HTML5 DnD |
| 4 | §9.7 | Mobile Kanban swipe | Whether swipe gesture between status tabs is implemented in Phase 1 or deferred |
| 5 | §17.3 | Project status color tokens | To be defined during Phase 1 schema implementation |
| 6 | §18.1 | Contrast validation | All token pairs must be verified with a contrast checker tool during Phase 1 |

---

*Document status: Stage B.4 Complete — Pending human review and approval before Stage B.5 begins.*
