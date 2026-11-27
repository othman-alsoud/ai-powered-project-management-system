"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterX, History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ActionResult } from "@/features/teams/actions";
import { getTeamActivityAction } from "../actions";
import { ACTIVITY_ACTIONS, ACTIVITY_FEED_DEFAULT_LIMIT } from "../constants";
import { ACTIVITY_ACTION_LABELS } from "../formatters";
import type {
  ActivityAction,
  ActivityFeedPage,
  ActivityLogItemDTO,
} from "../types";
import { buildActivityQueryUrl } from "../validation";
import { ActivityItem } from "./activity-item";

export function mergeActivityItems(
  existing: ActivityLogItemDTO[],
  incoming: ActivityLogItemDTO[],
): ActivityLogItemDTO[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((item) => item.id));
  const appended: ActivityLogItemDTO[] = [];
  for (const item of incoming) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      appended.push(item);
    }
  }
  return appended.length > 0 ? [...existing, ...appended] : existing;
}

export async function executeActivityLoadMore(params: {
  seqRef: { current: number };
  fetchPage: () => Promise<ActionResult<ActivityFeedPage>>;
  onSuccess: (page: ActivityFeedPage) => void;
  onError: (message: string) => void;
  onFinally?: () => void;
}): Promise<void> {
  const requestSeq = params.seqRef.current;
  try {
    const result = await params.fetchPage();
    if (requestSeq !== params.seqRef.current) {
      return;
    }

    if (!result.success) {
      params.onError(result.error);
      return;
    }

    params.onSuccess(result.data);
  } catch {
    if (requestSeq !== params.seqRef.current) {
      return;
    }
    params.onError("Unable to load team activity. Please try again.");
  } finally {
    if (requestSeq === params.seqRef.current) {
      params.onFinally?.();
    }
  }
}

export interface ActivityProjectOption {
  id: string;
  name: string;
}

interface ActivityTimelineProps {
  teamId: string;
  initialPage: ActivityFeedPage;
  initialAction?: ActivityAction;
  initialProjectId?: string;
  initialLimit?: number;
  scopedProjectId?: string;
  projects?: ActivityProjectOption[];
}

export function ActivityTimeline({
  teamId,
  initialPage,
  initialAction,
  initialProjectId,
  initialLimit = ACTIVITY_FEED_DEFAULT_LIMIT,
  scopedProjectId,
  projects = [],
}: ActivityTimelineProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<ActivityLogItemDTO[]>(initialPage.items);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialPage.nextCursor,
  );
  const [hasMore, setHasMore] = useState<boolean>(initialPage.hasMore);
  const [activeAction, setActiveAction] = useState<ActivityAction | undefined>(
    initialAction,
  );
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(
    scopedProjectId ?? initialProjectId,
  );

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFiltering, startFilterTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastFailedOp, setLastFailedOp] = useState<
    "loadMore" | "refresh" | null
  >(null);

  const loadSeqRef = useRef(0);
  const prevServerPropsRef = useRef({
    initialPage,
    initialAction,
    initialProjectId,
    scopedProjectId,
  });

  // Synchronize new Server Component props with client state on URL/navigation changes
  useEffect(() => {
    const prev = prevServerPropsRef.current;
    if (
      prev.initialPage === initialPage &&
      prev.initialAction === initialAction &&
      prev.initialProjectId === initialProjectId &&
      prev.scopedProjectId === scopedProjectId
    ) {
      return;
    }

    prevServerPropsRef.current = {
      initialPage,
      initialAction,
      initialProjectId,
      scopedProjectId,
    };

    loadSeqRef.current += 1;
    setItems(initialPage.items);
    setNextCursor(initialPage.nextCursor);
    setHasMore(initialPage.hasMore);
    setActiveAction(initialAction);
    setActiveProjectId(scopedProjectId ?? initialProjectId);
    setIsLoadingMore(false);
    setIsRefreshing(false);
    setError(null);
    setLastFailedOp(null);
  }, [initialPage, initialAction, initialProjectId, scopedProjectId]);

  const effectiveProjectId = scopedProjectId ?? activeProjectId;
  const isBusy = isLoadingMore || isRefreshing || isFiltering;
  const hasFilters = Boolean(
    activeAction || (!scopedProjectId && activeProjectId),
  );

  async function fetchFreshForFilters(
    nextAction: ActivityAction | undefined,
    nextProjectId: string | undefined,
  ) {
    loadSeqRef.current += 1;
    setError(null);
    setLastFailedOp(null);
    setIsRefreshing(true);

    await executeActivityLoadMore({
      seqRef: loadSeqRef,
      fetchPage: () =>
        getTeamActivityAction(teamId, {
          limit: initialLimit,
          action: nextAction,
          projectId: scopedProjectId ?? nextProjectId,
        }),
      onSuccess: (page) => {
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
      },
      onError: (msg) => {
        setError(msg);
        setLastFailedOp("refresh");
      },
      onFinally: () => {
        setIsRefreshing(false);
      },
    });
  }

  function handleFilterChange(
    nextAction: ActivityAction | undefined,
    nextProjectId: string | undefined,
  ) {
    setError(null);
    setLastFailedOp(null);
    setActiveAction(nextAction);
    if (!scopedProjectId) {
      setActiveProjectId(nextProjectId);
    }

    const nextUrl = buildActivityQueryUrl(
      pathname,
      searchParams?.toString() ?? "",
      {
        action: nextAction,
        projectId: scopedProjectId ? undefined : nextProjectId,
        tab: scopedProjectId ? "activity" : undefined,
      },
    );
    startFilterTransition(() => {
      router.push(nextUrl, { scroll: false });
    });
  }

  async function handleLoadMore() {
    if (!nextCursor || !hasMore || isBusy) {
      return;
    }

    loadSeqRef.current += 1;
    setIsLoadingMore(true);
    setError(null);
    setLastFailedOp(null);

    await executeActivityLoadMore({
      seqRef: loadSeqRef,
      fetchPage: () =>
        getTeamActivityAction(teamId, {
          limit: initialLimit,
          cursor: nextCursor,
          action: activeAction,
          projectId: effectiveProjectId,
        }),
      onSuccess: (page) => {
        setItems((prev) => mergeActivityItems(prev, page.items));
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
      },
      onError: (msg) => {
        setError(msg);
        setLastFailedOp("loadMore");
      },
      onFinally: () => {
        setIsLoadingMore(false);
      },
    });
  }

  function handleRetry() {
    if (lastFailedOp === "loadMore") {
      void handleLoadMore();
    } else {
      void fetchFreshForFilters(activeAction, activeProjectId);
    }
  }

  return (
    <section
      aria-label={scopedProjectId ? "Project activity timeline" : "Team activity timeline"}
      aria-busy={isBusy}
      className="flex flex-col gap-4"
    >
      {/* Toolbar: Filters & Refresh */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 flex-1">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="activity-action-filter"
                className="text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Action type
              </label>
              <select
                id="activity-action-filter"
                value={activeAction ?? ""}
                disabled={isFiltering}
                onChange={(event) => {
                  const val = event.target.value;
                  handleFilterChange(
                    val ? (val as ActivityAction) : undefined,
                    activeProjectId,
                  );
                }}
                className="h-11 sm:h-9 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60"
              >
                <option value="">All actions</option>
                {ACTIVITY_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {ACTIVITY_ACTION_LABELS[action]}
                  </option>
                ))}
              </select>
            </div>

            {!scopedProjectId ? (
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="activity-project-filter"
                  className="text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Project
                </label>
                <select
                  id="activity-project-filter"
                  value={activeProjectId ?? ""}
                  disabled={isFiltering}
                  onChange={(event) => {
                    const val = event.target.value;
                    handleFilterChange(activeAction, val || undefined);
                  }}
                  className="h-11 sm:h-9 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60"
                >
                  <option value="">All projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {hasFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => handleFilterChange(undefined, undefined)}
                className="min-h-[44px] sm:min-h-[36px]"
                leftIcon={<FilterX className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Clear filters
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={isRefreshing}
              disabled={isBusy}
              onClick={() =>
                void fetchFreshForFilters(activeAction, activeProjectId)
              }
              className="min-h-[44px] sm:min-h-[36px]"
              leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Error Alert */}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        >
          <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={handleRetry}
            className="min-h-[44px] sm:min-h-[32px] shrink-0"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {/* Timeline Content */}
      {isFiltering && items.length === 0 ? (
        <Card
          className="p-4 flex flex-col gap-3"
          role="status"
          aria-busy="true"
          aria-label="Loading activity"
        >
          <span className="sr-only">Loading activity entries…</span>
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              aria-hidden="true"
              className="h-14 rounded-md bg-slate-100 dark:bg-slate-800/70 animate-pulse"
            />
          ))}
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-8 sm:p-12 flex flex-col items-center justify-center text-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400">
            <History className="h-6 w-6 text-teal-700 dark:text-teal-400" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {hasFilters
                ? "No matching activity"
                : scopedProjectId
                  ? "No project activity yet"
                  : "No team activity yet"}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm">
              {hasFilters
                ? "Try adjusting or clearing your activity filters."
                : "Actions such as project updates, task status changes, and comments will appear here chronologically."}
            </p>
          </div>
          {hasFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleFilterChange(undefined, undefined)}
              className="min-h-[44px] sm:min-h-[36px] mt-1"
            >
              Clear filters
            </Button>
          ) : null}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ol className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {items.map((item) => (
              <ActivityItem
                key={item.id}
                item={item}
                hideProjectBadge={Boolean(scopedProjectId)}
              />
            ))}
          </ol>

          {/* Pagination Footer */}
          <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {hasMore
                ? `Showing ${items.length} activity entries`
                : `Showing ${items.length} ${items.length === 1 ? "entry" : "entries"} — you've reached the end of the activity timeline.`}
            </p>

            {hasMore ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={isLoadingMore}
                disabled={isBusy}
                onClick={() => void handleLoadMore()}
                className="min-h-[44px] sm:min-h-[36px]"
              >
                {isLoadingMore ? "Loading..." : "Load more"}
              </Button>
            ) : null}
          </div>
        </Card>
      )}
    </section>
  );
}
