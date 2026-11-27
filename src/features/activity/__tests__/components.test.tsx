import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

const { mockPush, mockRefresh, mockGetTeamActivityAction } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockGetTeamActivityAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => "/teams/11111111-1111-4111-8111-111111111111/activity",
  useSearchParams: () => new URLSearchParams(),
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

vi.mock("../actions", () => ({
  getTeamActivityAction: mockGetTeamActivityAction,
}));

import { ActivityItem } from "../components/activity-item";
import {
  ActivityTimeline,
  executeActivityLoadMore,
  mergeActivityItems,
} from "../components/activity-timeline";
import type { ActivityFeedPage, ActivityLogItemDTO } from "../types";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "44444444-4444-4444-8444-444444444444";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const activeTaskItem: ActivityLogItemDTO = {
  id: "99999999-9999-4999-8999-999999999991",
  teamId: TEAM_ID,
  action: "task_status_changed",
  createdAt: "2026-11-25T10:00:00.000Z",
  actor: {
    id: ACTOR_ID,
    name: "Alice Owner",
    image: null,
    isDeleted: false,
  },
  project: {
    id: PROJECT_ID,
    label: "Core API",
    isDeleted: false,
  },
  task: {
    id: TASK_ID,
    label: "Ship M3.2",
    isDeleted: false,
  },
  commentId: null,
  details: {
    taskTitle: "Ship M3.2",
    previousTaskStatus: "TODO",
    newTaskStatus: "IN_PROGRESS",
  },
};

const deletedActorAndTaskItem: ActivityLogItemDTO = {
  id: "99999999-9999-4999-8999-999999999992",
  teamId: TEAM_ID,
  action: "task_deleted",
  createdAt: "2026-11-25T09:00:00.000Z",
  actor: {
    id: null,
    name: "Deleted User",
    image: null,
    isDeleted: true,
  },
  project: {
    id: PROJECT_ID,
    label: "Core API",
    isDeleted: false,
  },
  task: {
    id: TASK_ID,
    label: "Legacy Task",
    isDeleted: true,
  },
  commentId: null,
  details: {
    taskTitle: "Legacy Task",
    previousAssignee: { id: null, name: "Deleted User", isDeleted: true },
  },
};

describe("Activity UI Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders ActivityItem with actor, summary, safe links for active resources, UTC timestamp, and Deleted User handling", () => {
    const activeHtml = renderToString(
      <ActivityItem item={activeTaskItem} />,
    );
    expect(activeHtml).toContain("Alice Owner");
    expect(activeHtml).toContain('moved task &quot;Ship M3.2&quot; from To Do to In Progress');
    expect(activeHtml).toContain(`href="/teams/${TEAM_ID}/projects/${PROJECT_ID}"`);
    expect(activeHtml).not.toContain("/tasks?q=");
    expect(activeHtml).toContain("Nov 25, 2026, 10:00 UTC");

    const deletedHtml = renderToString(
      <ActivityItem item={deletedActorAndTaskItem} hideProjectBadge />,
    );
    expect(deletedHtml).toContain("Deleted User");
    expect(deletedHtml).toContain("Legacy Task (deleted)");
    expect(deletedHtml).not.toContain(`href="/teams/${TEAM_ID}/tasks`);
  });

  it("renders empty, Load more, and pagination-end states accurately in ActivityTimeline", () => {
    const emptyPage: ActivityFeedPage = {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
    const emptyHtml = renderToString(
      <ActivityTimeline
        teamId={TEAM_ID}
        initialPage={emptyPage}
        projects={[{ id: PROJECT_ID, name: "Core API" }]}
      />,
    );
    expect(emptyHtml).toContain("No team activity yet");
    expect(emptyHtml).toContain('id="activity-action-filter"');
    expect(emptyHtml).toContain('id="activity-project-filter"');

    const paginatedPage: ActivityFeedPage = {
      items: [activeTaskItem],
      nextCursor: "cursor-1",
      hasMore: true,
    };
    const moreHtml = renderToString(
      <ActivityTimeline
        teamId={TEAM_ID}
        initialPage={paginatedPage}
        projects={[{ id: PROJECT_ID, name: "Core API" }]}
      />,
    );
    expect(moreHtml).toContain("Load more");
    expect(moreHtml).not.toContain("reached the end");

    const endPage: ActivityFeedPage = {
      items: [activeTaskItem, deletedActorAndTaskItem],
      nextCursor: null,
      hasMore: false,
    };
    const endHtml = renderToString(
      <ActivityTimeline
        teamId={TEAM_ID}
        initialPage={endPage}
        scopedProjectId={PROJECT_ID}
      />,
    );
    expect(endHtml).not.toContain("Load more");
    expect(endHtml).toContain("reached the end");
    expect(endHtml).not.toContain('id="activity-project-filter"');
  });

  it("merges paginated items without duplicates and ignores stale load-more responses", async () => {
    const merged = mergeActivityItems(
      [activeTaskItem],
      [activeTaskItem, deletedActorAndTaskItem],
    );
    expect(merged.map((i) => i.id)).toEqual([
      activeTaskItem.id,
      deletedActorAndTaskItem.id,
    ]);

    const seqRef = { current: 1 };
    let resolveSlow!: (val: { success: true; data: ActivityFeedPage }) => void;
    const slowPromise = new Promise<{ success: true; data: ActivityFeedPage }>(
      (resolve) => {
        resolveSlow = resolve;
      },
    );

    const onSuccess = vi.fn();
    const onError = vi.fn();

    const pending = executeActivityLoadMore({
      seqRef,
      fetchPage: () => slowPromise,
      onSuccess,
      onError,
    });

    // Simulate filter change incrementing sequence counter while slow request is in flight
    seqRef.current += 1;
    resolveSlow({
      success: true,
      data: { items: [deletedActorAndTaskItem], nextCursor: null, hasMore: false },
    });

    await pending;
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
