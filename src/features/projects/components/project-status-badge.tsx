import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { ProjectStatus } from "../server";

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; variant: NonNullable<BadgeProps["variant"]> }
> = {
  PLANNING: { label: "Planning", variant: "slate" },
  ACTIVE: { label: "Active", variant: "teal" },
  ON_HOLD: { label: "On Hold", variant: "amber" },
  COMPLETED: { label: "Completed", variant: "emerald" },
  CANCELLED: { label: "Cancelled", variant: "rose" },
};

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  size?: "sm" | "md";
}

export function ProjectStatusBadge({
  status,
  size = "sm",
}: ProjectStatusBadgeProps) {
  const meta = PROJECT_STATUS_META[status];

  return (
    <Badge variant={meta.variant} size={size} dot>
      {meta.label}
    </Badge>
  );
}
