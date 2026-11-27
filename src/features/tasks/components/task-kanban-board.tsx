"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { TeamRole } from "@/generated/prisma/client";
import {
  canUserMoveTask,
  groupTasksByStatus,
  makeKanbanTabDroppableId,
  resolveDragDropTargetStatus,
} from "../board-utils";
import type { TaskSummary } from "../server";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_VALUES,
  type TaskStatusValue,
} from "../validation";
import { TaskKanbanCardView } from "./task-kanban-card";
import { TaskKanbanColumn } from "./task-kanban-column";

const MOBILE_TAB_DOT_STYLES: Record<TaskStatusValue, string> = {
  TODO: "bg-slate-400 dark:bg-slate-500",
  IN_PROGRESS: "bg-sky-600 dark:bg-sky-400",
  IN_REVIEW: "bg-violet-600 dark:bg-violet-400",
  DONE: "bg-emerald-600 dark:bg-emerald-400",
};

/**
 * Filters out hidden (0x0) droppables from inactive CSS breakpoints before
 * matching pointerWithin (for direct tab/column hits) with closestCorners fallback.
 */
export const kanbanCollisionDetection: CollisionDetection = (args) => {
  const visibleContainers = args.droppableContainers.filter((container) => {
    const rect = args.droppableRects.get(container.id) ?? container.rect.current;
    return Boolean(rect && rect.width > 0 && rect.height > 0);
  });

  if (visibleContainers.length === 0) {
    return [];
  }

  const visibleArgs = {
    ...args,
    droppableContainers: visibleContainers,
  };

  if (args.pointerCoordinates) {
    const pointerHits = pointerWithin(visibleArgs);
    if (pointerHits.length > 0) {
      return pointerHits;
    }

    const { x, y } = args.pointerCoordinates;
    return closestCorners({
      ...visibleArgs,
      collisionRect: {
        top: y,
        bottom: y,
        left: x,
        right: x,
        width: 0,
        height: 0,
      },
    });
  }

  return closestCorners(visibleArgs);
};

export function handleKanbanDragEnd(params: {
  activeId: string | number | null | undefined;
  overId: string | number | null | undefined;
  tasks: readonly TaskSummary[];
  currentUserId: string;
  currentUserRole: TeamRole;
  pendingTaskIds: readonly string[];
  onMoveTaskStatus: (task: TaskSummary, nextStatus: TaskStatusValue) => void;
}): boolean {
  const {
    activeId,
    overId,
    tasks,
    currentUserId,
    currentUserRole,
    pendingTaskIds,
    onMoveTaskStatus,
  } = params;

  if (!activeId || !overId) {
    return false;
  }

  const taskId = String(activeId);
  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    return false;
  }

  if (pendingTaskIds.includes(task.id)) {
    return false;
  }

  if (!canUserMoveTask(task, currentUserId, currentUserRole)) {
    return false;
  }

  const nextStatus = resolveDragDropTargetStatus(overId, tasks);
  if (!nextStatus || nextStatus === task.status) {
    return false;
  }

  onMoveTaskStatus(task, nextStatus);
  return true;
}

interface MobileStatusTabProps {
  status: TaskStatusValue;
  count: number;
  isSelected: boolean;
  isDraggingTask: boolean;
  onSelect: (status: TaskStatusValue) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}

function MobileStatusTab({
  status,
  count,
  isSelected,
  isDraggingTask,
  onSelect,
  onKeyDown,
  buttonRef,
}: MobileStatusTabProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: makeKanbanTabDroppableId(status),
    data: { status },
  });

  return (
    <button
      ref={(el) => {
        setNodeRef(el);
        buttonRef?.(el);
      }}
      id={`kanban-tab-${status}`}
      type="button"
      role="tab"
      aria-selected={isSelected}
      aria-controls={`kanban-panel-${status}`}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => onSelect(status)}
      onKeyDown={onKeyDown}
      className={`min-w-0 w-full min-h-[44px] flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 ${
        isOver
          ? "border-teal-700 bg-teal-100/80 dark:bg-teal-900/60 text-teal-900 dark:text-teal-100 ring-2 ring-teal-700/30"
          : isSelected
            ? "border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 ring-1 ring-teal-700/20"
            : isDraggingTask
              ? "border-dashed border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
      }`}
    >
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full shrink-0 ${MOBILE_TAB_DOT_STYLES[status]}`}
        />
        <span className="truncate">{TASK_STATUS_LABELS[status]}</span>
      </span>
      <span className="font-mono text-[11px] tabular-nums shrink-0">
        {count}
      </span>
    </button>
  );
}

interface TaskKanbanBoardProps {
  tasks: TaskSummary[];
  currentUserId: string;
  currentUserRole: TeamRole;
  canManageTasks: boolean;
  hasProjects: boolean;
  scopedProject?: boolean;
  pendingTaskIds: readonly string[];
  referenceDate?: Date;
  onSelectTask: (task: TaskSummary) => void;
  onMoveTaskStatus: (task: TaskSummary, nextStatus: TaskStatusValue) => void;
  onQuickCreate: (status: TaskStatusValue) => void;
}

export function TaskKanbanBoard({
  tasks,
  currentUserId,
  currentUserRole,
  canManageTasks,
  hasProjects,
  scopedProject = false,
  pendingTaskIds,
  referenceDate,
  onSelectTask,
  onMoveTaskStatus,
  onQuickCreate,
}: TaskKanbanBoardProps) {
  const dndContextId = useId();
  const [activeMobileStatus, setActiveMobileStatus] =
    useState<TaskStatusValue>("TODO");
  const [activeDragTaskId, setActiveDragTaskId] = useState<string | null>(null);
  const mobileTabRefs = useRef<Partial<Record<TaskStatusValue, HTMLButtonElement | null>>>({});

  function handleMobileTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % TASK_STATUS_VALUES.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex =
        (index - 1 + TASK_STATUS_VALUES.length) % TASK_STATUS_VALUES.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TASK_STATUS_VALUES.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const nextStatus = TASK_STATUS_VALUES[nextIndex]!;
      setActiveMobileStatus(nextStatus);
      mobileTabRefs.current[nextStatus]?.focus();
    }
  }

  const grouped = useMemo(() => groupTasksByStatus(tasks), [tasks]);
  const activeDragTask = useMemo(
    () => tasks.find((item) => item.id === activeDragTaskId) ?? null,
    [tasks, activeDragTaskId],
  );

  // Use MouseSensor + TouchSensor + KeyboardSensor separately so PointerSensor
  // does not race TouchSensor on mobile browsers.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveDragTaskId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragTaskId(null);

    const scheduleMove = (task: TaskSummary, nextStatus: TaskStatusValue) => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => onMoveTaskStatus(task, nextStatus));
      } else {
        onMoveTaskStatus(task, nextStatus);
      }
    };

    handleKanbanDragEnd({
      activeId: event.active.id,
      overId: event.over?.id,
      tasks,
      currentUserId,
      currentUserRole,
      pendingTaskIds,
      onMoveTaskStatus: scheduleMove,
    });
  }

  function handleDragCancel() {
    setActiveDragTaskId(null);
  }

  function getTaskTitleForAnnouncement(id: string | number): string {
    const task = tasks.find((item) => item.id === String(id));
    return task ? task.title : "task";
  }

  function getOverLabelForAnnouncement(id: string | number | undefined): string {
    const target = resolveDragDropTargetStatus(id, tasks);
    return target ? TASK_STATUS_LABELS[target] : "column";
  }

  return (
    <DndContext
      id={dndContextId}
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        announcements: {
          onDragStart({ active }) {
            return `Picked up ${getTaskTitleForAnnouncement(active.id)}.`;
          },
          onDragOver({ active, over }) {
            if (!over) return undefined;
            return `${getTaskTitleForAnnouncement(active.id)} is over ${getOverLabelForAnnouncement(over.id)}.`;
          },
          onDragEnd({ active, over }) {
            if (!over) {
              return `Dropped ${getTaskTitleForAnnouncement(active.id)}.`;
            }
            return `Moved ${getTaskTitleForAnnouncement(active.id)} to ${getOverLabelForAnnouncement(over.id)}.`;
          },
          onDragCancel({ active }) {
            return `Cancelled moving ${getTaskTitleForAnnouncement(active.id)}.`;
          },
        },
      }}
    >
      {/* Mobile (<768px): 4 Droppable Status Tabs + Single Column Panel */}
      <div className="md:hidden flex flex-col gap-3 w-full min-w-0">
        <div
          role="tablist"
          aria-label="Task status columns"
          className="grid grid-cols-2 gap-2 w-full min-w-0"
        >
          {TASK_STATUS_VALUES.map((status, index) => (
            <MobileStatusTab
              key={status}
              status={status}
              count={grouped[status].length}
              isSelected={activeMobileStatus === status}
              isDraggingTask={activeDragTask !== null}
              onSelect={setActiveMobileStatus}
              onKeyDown={(e) => handleMobileTabKeyDown(e, index)}
              buttonRef={(el) => {
                mobileTabRefs.current[status] = el;
              }}
            />
          ))}
        </div>

        <div
          id={`kanban-panel-${activeMobileStatus}`}
          role="tabpanel"
          aria-labelledby={`kanban-tab-${activeMobileStatus}`}
          className="min-w-0 w-full"
        >
          <TaskKanbanColumn
            status={activeMobileStatus}
            tasks={grouped[activeMobileStatus]}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            canManageTasks={canManageTasks}
            hasProjects={hasProjects}
            scopedProject={scopedProject}
            pendingTaskIds={pendingTaskIds}
            referenceDate={referenceDate}
            onSelectTask={onSelectTask}
            onMoveTaskStatus={onMoveTaskStatus}
            onQuickCreate={onQuickCreate}
          />
        </div>
      </div>

      {/* Tablet (768px-1023px): Snap horizontal scroll | Desktop (>=1024px): 4 Side-by-Side Columns */}
      <div className="hidden md:block overflow-x-auto pb-2 snap-x snap-mandatory lg:overflow-x-visible">
        <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-4 lg:grid-flow-row lg:grid-cols-4 lg:auto-cols-auto">
          {TASK_STATUS_VALUES.map((status) => (
            <TaskKanbanColumn
              key={status}
              status={status}
              tasks={grouped[status]}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              canManageTasks={canManageTasks}
              hasProjects={hasProjects}
              scopedProject={scopedProject}
              pendingTaskIds={pendingTaskIds}
              referenceDate={referenceDate}
              onSelectTask={onSelectTask}
              onMoveTaskStatus={onMoveTaskStatus}
              onQuickCreate={onQuickCreate}
            />
          ))}
        </div>
      </div>

      <DragOverlay zIndex={50}>
        {activeDragTask ? (
          <div className="max-w-[calc(100vw-2rem)]">
            <TaskKanbanCardView
              task={activeDragTask}
              canMove
              isPending={false}
              isOverlay
              scopedProject={scopedProject}
              referenceDate={referenceDate}
              onSelectTask={() => {}}
              onMoveTaskStatus={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
