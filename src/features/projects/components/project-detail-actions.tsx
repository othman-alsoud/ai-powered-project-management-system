"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { TeamRole } from "@/features/teams/server";
import { Button } from "@/components/ui/button";
import { updateProjectStatusAction } from "../actions";
import type { ProjectDetail, ProjectStatus } from "../server";
import { PROJECT_STATUSES } from "../validation";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { ProjectFormDialog } from "./project-form-dialog";
import { PROJECT_STATUS_META } from "./project-status-badge";

interface ProjectDetailActionsProps {
  teamId: string;
  project: ProjectDetail;
  currentUserRole: TeamRole;
}

export function ProjectDetailActions({
  teamId,
  project,
  currentUserRole,
}: ProjectDetailActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  if (currentUserRole !== "OWNER" && currentUserRole !== "MANAGER") {
    return null;
  }

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (newStatus === project.status || isUpdatingStatus) return;

    setFeedback(null);
    setIsUpdatingStatus(true);

    try {
      const result = await updateProjectStatusAction({
        teamId,
        projectId: project.id,
        status: newStatus,
      });

      if (!result.success) {
        setFeedback({ type: "error", text: result.error });
        return;
      }

      setFeedback({ type: "success", text: "Status updated." });
    } catch {
      setFeedback({ type: "error", text: "Failed to update project status." });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="flex flex-col items-stretch sm:items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Change project status"
          disabled={isUpdatingStatus}
          value={project.status}
          onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
          className="h-11 md:h-8 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400 disabled:opacity-50"
        >
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS_META[s].label}
            </option>
          ))}
        </select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditOpen(true)}
          leftIcon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          Edit
        </Button>

        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setDeleteOpen(true)}
          leftIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          Delete
        </Button>
      </div>

      {feedback && (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          className={
            feedback.type === "error"
              ? "text-xs text-red-600 dark:text-red-400"
              : "text-xs text-emerald-600 dark:text-emerald-400"
          }
        >
          {feedback.text}
        </p>
      )}

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        teamId={teamId}
        mode="edit"
        project={project}
        onSuccess={(text) => setFeedback({ type: "success", text })}
      />

      <DeleteProjectDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        teamId={teamId}
        project={project}
        redirectOnDelete={true}
      />
    </div>
  );
}
