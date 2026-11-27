import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  TASK_STATUS_LABELS,
  type TaskStatusValue,
} from "../validation";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const STATUS_VARIANT_MAP: Record<TaskStatusValue, BadgeVariant> = {
  TODO: "slate",
  IN_PROGRESS: "blue",
  IN_REVIEW: "purple",
  DONE: "emerald",
};

interface TaskStatusBadgeProps {
  status: TaskStatusValue;
  size?: "sm" | "md";
  className?: string;
}

export function TaskStatusBadge({
  status,
  size = "sm",
  className,
}: TaskStatusBadgeProps) {
  return (
    <Badge
      variant={STATUS_VARIANT_MAP[status]}
      size={size}
      dot
      className={className}
    >
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}
