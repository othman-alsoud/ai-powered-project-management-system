import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

import { ProjectStatusBadge } from "../components/project-status-badge";
import {
  ProjectsManager,
  buildProjectsQueryUrl,
  scheduleToastTimer,
  clearToastTimer,
} from "../components/projects-manager";
import { ProjectFormDialog } from "../components/project-form-dialog";
import {
  DeleteProjectDialog,
  attemptCloseDeleteDialog,
} from "../components/delete-project-dialog";
import { ProjectDetailActions } from "../components/project-detail-actions";
import type { ProjectSummary } from "../server";

const teamId = "550e8400-e29b-41d4-a716-446655440001";

const mockProjects: ProjectSummary[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440010",
    teamId,
    name: "Core Auth Migration",
    description: "Migrate legacy sessions",
    status: "ACTIVE",
    startDate: new Date("2026-12-01T00:00:00.000Z"),
    endDate: new Date("2026-12-15T00:00:00.000Z"),
    createdAt: new Date("2026-11-20T00:00:00.000Z"),
    updatedAt: new Date("2026-11-21T00:00:00.000Z"),
    taskCount: 3,
    createdBy: { id: "user-1", name: "Alice Owner", image: null },
    updatedBy: null,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440011",
    teamId,
    name: "Legacy Cleanup",
    description: null,
    status: "CANCELLED",
    startDate: null,
    endDate: new Date("2026-11-24T00:00:00.000Z"),
    createdAt: new Date("2026-11-18T00:00:00.000Z"),
    updatedAt: new Date("2026-11-19T00:00:00.000Z"),
    taskCount: 0,
    createdBy: { id: "user-deleted", name: "Deleted User", image: null },
    updatedBy: null,
  },
];

describe("Project UI Components", () => {
  describe("ProjectStatusBadge", () => {
    it("renders visible text labels for all 5 ProjectStatus values", () => {
      expect(renderToString(<ProjectStatusBadge status="PLANNING" />)).toContain("Planning");
      expect(renderToString(<ProjectStatusBadge status="ACTIVE" />)).toContain("Active");
      expect(renderToString(<ProjectStatusBadge status="ON_HOLD" />)).toContain("On Hold");
      expect(renderToString(<ProjectStatusBadge status="COMPLETED" />)).toContain("Completed");
      expect(renderToString(<ProjectStatusBadge status="CANCELLED" />)).toContain("Cancelled");
    });
  });

  describe("ProjectsManager", () => {
    it("renders desktop table, mobile cards, UTC dates, anonymized author, and management buttons for MANAGER/OWNER", () => {
      const html = renderToString(
        <ProjectsManager
          teamId={teamId}
          projects={mockProjects}
          currentUserRole="MANAGER"
        />
      );

      expect(html).toContain("New Project");
      expect(html).toContain("Core Auth Migration");
      expect(html).toContain(`/teams/${teamId}/projects/${mockProjects[0]!.id}`);
      expect(html).toContain("Dec 1, 2026");
      expect(html).toContain("Dec 15, 2026");
      expect(html).toContain("Nov 24, 2026");
      expect(html).toContain("Deleted User");
      expect(html).toContain("Edit");
      expect(html).toContain("Delete");
    });

    it("hides management controls for MEMBER read-only users", () => {
      const html = renderToString(
        <ProjectsManager
          teamId={teamId}
          projects={mockProjects}
          currentUserRole="MEMBER"
        />
      );

      expect(html).toContain("Core Auth Migration");
      expect(html).not.toContain("New Project");
      expect(html).not.toContain("Edit project");
      expect(html).not.toContain("Delete project");
    });

    it("renders role-appropriate empty states when no projects exist", () => {
      const managerHtml = renderToString(
        <ProjectsManager teamId={teamId} projects={[]} currentUserRole="OWNER" />
      );
      expect(managerHtml).toContain("No projects yet");
      expect(managerHtml).toContain("Create Project");

      const memberHtml = renderToString(
        <ProjectsManager teamId={teamId} projects={[]} currentUserRole="MEMBER" />
      );
      expect(memberHtml).toContain("No projects yet");
      expect(memberHtml).not.toContain("Create Project");
    });
  });

  describe("ProjectFormDialog", () => {
    it("renders Create mode with Cancel first and Create Project second", () => {
      const html = renderToString(
        <ProjectFormDialog
          open={true}
          onOpenChange={vi.fn()}
          teamId={teamId}
          mode="create"
        />
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain("Create Project");
      expect(html).toContain("Project name");
      expect(html.indexOf("Cancel")).toBeLessThan(html.lastIndexOf("Create Project"));
    });

    it("renders Edit mode pre-populated with UTC YYYY-MM-DD dates and status", () => {
      const html = renderToString(
        <ProjectFormDialog
          open={true}
          onOpenChange={vi.fn()}
          teamId={teamId}
          mode="edit"
          project={mockProjects[0]}
        />
      );

      expect(html).toContain("Edit Project");
      expect(html).toContain("Core Auth Migration");
      expect(html).toContain("2026-12-01");
      expect(html).toContain("2026-12-15");
      expect(html).toContain("Save Changes");
    });
  });

  describe("DeleteProjectDialog & ProjectDetailActions", () => {
    it("renders DeleteProjectDialog with Cancel before Delete Project", () => {
      const html = renderToString(
        <DeleteProjectDialog
          open={true}
          onOpenChange={vi.fn()}
          teamId={teamId}
          project={mockProjects[0]!}
        />
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain("Core Auth Migration");
      expect(html.indexOf("Cancel")).toBeLessThan(html.lastIndexOf("Delete Project"));
    });

    it("renders ProjectDetailActions for OWNER/MANAGER and nothing for MEMBER", () => {
      const ownerHtml = renderToString(
        <ProjectDetailActions
          teamId={teamId}
          project={mockProjects[0]!}
          currentUserRole="OWNER"
        />
      );
      expect(ownerHtml).toContain("Change project status");
      expect(ownerHtml).toContain("Edit");
      expect(ownerHtml).toContain("Delete");

      const memberHtml = renderToString(
        <ProjectDetailActions
          teamId={teamId}
          project={mockProjects[0]!}
          currentUserRole="MEMBER"
        />
      );
      expect(memberHtml).toBe("");
    });

    it("DeleteProjectDialog close helper clears error state on close/Escape unless submitting, and returns empty markup when closed", () => {
      const clearError = vi.fn();
      const onOpenChange = vi.fn();

      expect(attemptCloseDeleteDialog(true, clearError, onOpenChange)).toBe(false);
      expect(clearError).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();

      expect(attemptCloseDeleteDialog(false, clearError, onOpenChange)).toBe(true);
      expect(clearError).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);

      expect(
        renderToString(
          <DeleteProjectDialog
            open={false}
            onOpenChange={vi.fn()}
            teamId={teamId}
            project={mockProjects[0]!}
          />
        )
      ).toBe("");
    });

    it("toast timer helper cancels earlier timeout so older timers never dismiss newer messages, and cleans up on unmount", () => {
      vi.useFakeTimers();
      try {
        const timeoutRef: { current: ReturnType<typeof setTimeout> | null } = {
          current: null,
        };
        let currentMsg: string | null = null;
        const setMsg = (msg: string | null) => {
          currentMsg = msg;
        };

        scheduleToastTimer(timeoutRef, setMsg, "First toast", 4000);
        expect(currentMsg).toBe("First toast");

        vi.advanceTimersByTime(2500);
        scheduleToastTimer(timeoutRef, setMsg, "Second toast", 4000);
        expect(currentMsg).toBe("Second toast");

        // At t=4000ms (1500ms after second toast), old timer must NOT dismiss second toast
        vi.advanceTimersByTime(1500);
        expect(currentMsg).toBe("Second toast");

        // At t=6500ms (4000ms after second toast), second toast dismisses cleanly
        vi.advanceTimersByTime(2500);
        expect(currentMsg).toBeNull();

        // Unmount cleanup cancels active timeout
        scheduleToastTimer(timeoutRef, setMsg, "Pending toast", 4000);
        clearToastTimer(timeoutRef);
        expect(timeoutRef.current).toBeNull();
        vi.advanceTimersByTime(5000);
        expect(currentMsg).toBe("Pending toast");
      } finally {
        vi.useRealTimers();
      }
    });

    it("renders sort controls for projects and builds project sort URLs cleanly", () => {
      const html = renderToString(
        <ProjectsManager
          teamId={teamId}
          projects={mockProjects}
          currentUserRole="MEMBER"
          query={{ sort: "name", dir: "asc" }}
        />,
      );

      expect(html).toContain('aria-label="Sort projects by"');
      expect(html).toContain("Asc");
      expect(html).toContain("Ascending — toggle project sort direction");
      expect(
        buildProjectsQueryUrl("/teams/t1/projects", "", {
          sort: "endDate",
          dir: "asc",
        }),
      ).toBe("/teams/t1/projects?sort=endDate&dir=asc");
    });
  });
});
