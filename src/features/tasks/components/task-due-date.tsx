import { CalendarDays, AlertCircle } from "lucide-react";
import {
  formatUtcDateLabel,
  parseUtcDateInput,
} from "@/features/projects/date-utils";
import { isTaskOverdue, type TaskStatusValue } from "../validation";

interface TaskDueDateProps {
  dueDate: Date | string | null | undefined;
  status: TaskStatusValue;
  referenceDate?: Date;
  className?: string;
}

export function TaskDueDate({
  dueDate,
  status,
  referenceDate,
  className = "",
}: TaskDueDateProps) {
  const normalizedDueDate =
    typeof dueDate === "string" ? parseUtcDateInput(dueDate) : dueDate;
  const formatted = formatUtcDateLabel(normalizedDueDate);
  if (!formatted) {
    return (
      <span
        className={`text-xs text-slate-600 dark:text-slate-400 ${className}`.trim()}
      >
        No due date
      </span>
    );
  }

  const overdue = isTaskOverdue(dueDate, status, referenceDate);

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-xs ${
        overdue
          ? "font-medium text-rose-600 dark:text-rose-400"
          : "text-slate-600 dark:text-slate-300"
      } ${className}`.trim()}
    >
      {overdue ? (
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
      )}
      <span>{formatted}</span>
      {overdue ? <span className="sr-only sm:not-sr-only">· Overdue</span> : null}
    </span>
  );
}
