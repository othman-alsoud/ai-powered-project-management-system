import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  TASK_PRIORITY_LABELS,
  type TaskPriorityValue,
} from "../validation";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const PRIORITY_VARIANT_MAP: Record<TaskPriorityValue, BadgeVariant> = {
  LOW: "slate",
  MEDIUM: "amber",
  HIGH: "rose",
};

interface TaskPriorityBadgeProps {
  priority: TaskPriorityValue;
  size?: "sm" | "md";
  className?: string;
}

export function TaskPriorityBadge({
  priority,
  size = "sm",
  className,
}: TaskPriorityBadgeProps) {
  return (
    <Badge
      variant={PRIORITY_VARIANT_MAP[priority]}
      size={size}
      className={className}
    >
      {TASK_PRIORITY_LABELS[priority]}
    </Badge>
  );
}
