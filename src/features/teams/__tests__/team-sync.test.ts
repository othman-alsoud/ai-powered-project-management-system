import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));
import {
  TEAM_SYNC_CHANNEL_NAME,
  TEAM_SYNC_STORAGE_KEY,
  createSeenEventTracker,
  parseTeamSyncEvent,
  publishTeamSyncEvent,
  subscribeTeamSyncEvents,
  resetTabIdForTests,
} from "../lib/team-sync";
import { reconcileActiveTeamContext } from "../components/team-context-sync";
import type { ActiveTeamContextResolution } from "../actions";

describe("team-sync cross-tab synchronization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetTabIdForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("parseTeamSyncEvent", () => {
    it("parses valid object and JSON string payloads with required envelope fields", () => {
      const validPayload = {
        eventId: "evt-1",
        type: "TEAM_SWITCHED" as const,
        sourceTabId: "tab-a",
        userId: "user-1",
        teamId: "550e8400-e29b-41d4-a716-446655440001",
        timestamp: 1700000000000,
      };

      expect(parseTeamSyncEvent(validPayload)).toEqual(validPayload);
      expect(parseTeamSyncEvent(JSON.stringify(validPayload))).toEqual(validPayload);
    });

    it("requires userId on MEMBERSHIP_CHANGED and AUTH_SIGNED_OUT events", () => {
      const missingUserMembership = {
        eventId: "evt-2",
        type: "MEMBERSHIP_CHANGED",
        sourceTabId: "tab-a",
        teamId: "team-1",
        timestamp: 1700000000000,
      };
      const missingUserSignOut = {
        eventId: "evt-3",
        type: "AUTH_SIGNED_OUT",
        sourceTabId: "tab-a",
        timestamp: 1700000000000,
      };

      expect(parseTeamSyncEvent(missingUserMembership)).toBeNull();
      expect(parseTeamSyncEvent(missingUserSignOut)).toBeNull();

      const validSignOut = { ...missingUserSignOut, userId: "user-1" };
      expect(parseTeamSyncEvent(validSignOut)).toEqual(validSignOut);
    });

    it("returns null safely for malformed JSON, unknown types, or missing fields", () => {
      expect(parseTeamSyncEvent("{invalid json")).toBeNull();
      expect(parseTeamSyncEvent(null)).toBeNull();
      expect(parseTeamSyncEvent({ type: "UNKNOWN_EVENT" })).toBeNull();
      expect(
        parseTeamSyncEvent({
          eventId: "",
          type: "TEAM_SWITCHED",
          sourceTabId: "tab-a",
          userId: "user-1",
          timestamp: 100,
        })
      ).toBeNull();
    });
  });

  describe("createSeenEventTracker (bounded eventId deduplication)", () => {
    it("deduplicates repeated eventIds regardless of timestamp", () => {
      const tracker = createSeenEventTracker(3);

      expect(tracker.markSeen("evt-1")).toBe(true);
      expect(tracker.markSeen("evt-1")).toBe(false);
      // Distinct eventId at the exact same millisecond is NOT dropped
      expect(tracker.markSeen("evt-2")).toBe(true);
      expect(tracker.markSeen("evt-3")).toBe(true);
      // Evicts oldest ("evt-1") when exceeding max capacity 3
      expect(tracker.markSeen("evt-4")).toBe(true);
      expect(tracker.markSeen("evt-1")).toBe(true);
    });
  });

  describe("publishTeamSyncEvent & subscribeTeamSyncEvents", () => {
    it("publishes complete envelope via BroadcastChannel and localStorage fallback, and deduplicates dual delivery", () => {
      const postedMessages: unknown[] = [];
      const listeners = new Set<(event: { data: unknown }) => void>();

      class MockBroadcastChannel {
        name: string;
        constructor(name: string) {
          this.name = name;
        }
        postMessage(msg: unknown) {
          postedMessages.push(msg);
          for (const listener of listeners) {
            listener({ data: msg });
          }
        }
        addEventListener(type: string, cb: (event: { data: unknown }) => void) {
          if (type === "message") listeners.add(cb);
        }
        removeEventListener(type: string, cb: (event: { data: unknown }) => void) {
          if (type === "message") listeners.delete(cb);
        }
        close() {}
      }

      const storageListeners = new Set<(event: StorageEvent) => void>();
      const storageMap = new Map<string, string>();
      const mockWindow = {
        addEventListener: (type: string, cb: (event: StorageEvent) => void) => {
          if (type === "storage") storageListeners.add(cb);
        },
        removeEventListener: (type: string, cb: (event: StorageEvent) => void) => {
          if (type === "storage") storageListeners.delete(cb);
        },
      };
      const mockLocalStorage = {
        setItem: (key: string, value: string) => {
          storageMap.set(key, value);
          for (const cb of storageListeners) {
            cb({ key, newValue: value } as StorageEvent);
          }
        },
      };

      vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
      vi.stubGlobal("window", mockWindow);
      vi.stubGlobal("localStorage", mockLocalStorage);

      const received: unknown[] = [];
      const unsubscribe = subscribeTeamSyncEvents(
        (evt) => received.push(evt),
        { currentUserId: "user-1", tabId: "tab-receiver" }
      );

      // Publish from a different tab
      const published = publishTeamSyncEvent(
        {
          type: "TEAM_SWITCHED",
          userId: "user-1",
          teamId: "team-2",
        },
        "tab-sender"
      );

      expect(published).not.toBeNull();
      expect(published?.eventId).toBeTruthy();
      expect(published?.sourceTabId).toBe("tab-sender");
      expect(published?.userId).toBe("user-1");
      expect(typeof published?.timestamp).toBe("number");
      expect(postedMessages).toHaveLength(1);
      expect(storageMap.has(TEAM_SYNC_STORAGE_KEY)).toBe(true);

      // Even though BOTH BroadcastChannel and storage fired, eventId deduplication ensures handler runs ONCE
      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(published);

      // Ignores events from the same tabId
      publishTeamSyncEvent(
        {
          type: "TEAM_CREATED",
          userId: "user-1",
          teamId: "team-3",
        },
        "tab-receiver"
      );
      expect(received).toHaveLength(1);

      // Ignores non-sign-out events for a different userId
      publishTeamSyncEvent(
        {
          type: "TEAM_SWITCHED",
          userId: "user-other",
          teamId: "team-99",
        },
        "tab-sender"
      );
      publishTeamSyncEvent(
        {
          type: "TEAM_CREATED",
          userId: "user-other",
          teamId: "team-100",
        },
        "tab-sender"
      );
      publishTeamSyncEvent(
        {
          type: "MEMBERSHIP_CHANGED",
          userId: "user-other",
          teamId: "team-100",
        },
        "tab-sender"
      );
      expect(received).toHaveLength(1);

      // Allows AUTH_SIGNED_OUT events through regardless of userId so receiving tab can verify its server session
      const crossUserSignOut = publishTeamSyncEvent(
        {
          type: "AUTH_SIGNED_OUT",
          userId: "user-other",
        },
        "tab-sender"
      );
      expect(received).toHaveLength(2);
      expect(received[1]).toEqual(crossUserSignOut);

      unsubscribe();
      expect(TEAM_SYNC_CHANNEL_NAME).toBe("pm-team-context-sync");
    });
  });

  describe("reconcileActiveTeamContext (DB-authoritative client reconciliation)", () => {
    it("navigates to new active team dashboard when SWITCH_REQUIRED is returned", async () => {
      const seqRef = { current: 0 };
      const navigate = vi.fn();
      const refresh = vi.fn();
      const resolveAction = vi.fn().mockResolvedValueOnce({
        status: "SWITCH_REQUIRED",
        activeTeamId: "team-2",
        role: "OWNER",
        userId: "user-1",
      } satisfies ActiveTeamContextResolution);

      await reconcileActiveTeamContext({
        currentUserId: "user-1",
        currentTeamId: "team-1",
        currentRole: "MEMBER",
        triggerType: "TEAM_SWITCHED",
        seqRef,
        resolveAction,
        navigate,
        refresh,
      });

      expect(resolveAction).toHaveBeenCalledWith("team-1");
      expect(navigate).toHaveBeenCalledWith("/teams/team-2");
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("discards stale delayed server responses using latestRequestSeqRef", async () => {
      const seqRef = { current: 0 };
      const navigate = vi.fn();
      const refresh = vi.fn();

      let resolveFirst!: (val: ActiveTeamContextResolution) => void;
      const firstPromise = new Promise<ActiveTeamContextResolution>((r) => {
        resolveFirst = r;
      });

      const secondPromise = Promise.resolve<ActiveTeamContextResolution>({
        status: "SWITCH_REQUIRED",
        activeTeamId: "team-3",
        role: "OWNER",
        userId: "user-1",
      });

      const resolveAction = vi
        .fn()
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise);

      const firstRun = reconcileActiveTeamContext({
        currentUserId: "user-1",
        currentTeamId: "team-1",
        triggerType: "TEAM_SWITCHED",
        seqRef,
        resolveAction,
        navigate,
        refresh,
      });

      const secondRun = reconcileActiveTeamContext({
        currentUserId: "user-1",
        currentTeamId: "team-1",
        triggerType: "TEAM_SWITCHED",
        seqRef,
        resolveAction,
        navigate,
        refresh,
      });

      await secondRun;
      // Now resolve the older delayed response pointing to team-2
      resolveFirst({
        status: "SWITCH_REQUIRED",
        activeTeamId: "team-2",
        role: "MEMBER",
        userId: "user-1",
      });
      await firstRun;

      // Only team-3 from the latest request should be navigated to
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith("/teams/team-3");
    });

    it("does NOT sign out or redirect on AUTH_SIGNED_OUT if server session is still valid", async () => {
      const seqRef = { current: 0 };
      const navigate = vi.fn();
      const refresh = vi.fn();
      const resolveAction = vi.fn().mockResolvedValueOnce({
        status: "VALID",
        activeTeamId: "team-1",
        role: "OWNER",
        userId: "user-1",
      } satisfies ActiveTeamContextResolution);

      await reconcileActiveTeamContext({
        currentUserId: "user-1",
        currentTeamId: "team-1",
        currentRole: "OWNER",
        triggerType: "AUTH_SIGNED_OUT",
        seqRef,
        resolveAction,
        navigate,
        refresh,
      });

      expect(navigate).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    });

    it("redirects to /sign-in on AUTH_SIGNED_OUT when Account A signs out while another tab has stale UI for Account B and server session is gone", async () => {
      const seqRef = { current: 0 };
      const navigate = vi.fn();
      const refresh = vi.fn();
      const resolveAction = vi.fn().mockResolvedValueOnce({
        status: "UNAUTHENTICATED",
      } satisfies ActiveTeamContextResolution);

      await reconcileActiveTeamContext({
        currentUserId: "user-B",
        currentTeamId: "team-1",
        currentRole: "MEMBER",
        triggerType: "AUTH_SIGNED_OUT",
        seqRef,
        resolveAction,
        navigate,
        refresh,
      });

      expect(navigate).toHaveBeenCalledWith("/sign-in");
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("refreshes UI without redirecting to sign-in when AUTH_SIGNED_OUT arrives or account switches and both users share the same team", async () => {
      const seqRef = { current: 0 };
      const navigate = vi.fn();
      const refresh = vi.fn();
      const resolveAction = vi.fn().mockResolvedValueOnce({
        status: "VALID",
        activeTeamId: "team-1",
        role: "MEMBER",
        userId: "user-A",
      } satisfies ActiveTeamContextResolution);

      await reconcileActiveTeamContext({
        currentUserId: "user-B",
        currentTeamId: "team-1",
        currentRole: "MEMBER",
        triggerType: "AUTH_SIGNED_OUT",
        seqRef,
        resolveAction,
        navigate,
        refresh,
      });

      // Still-valid session for user-A must NOT redirect to /sign-in, but MUST refresh stale user-B UI
      expect(navigate).not.toHaveBeenCalled();
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("handles account switching where the new user has NO_TEAMS (both on team workspace and on onboarding)", async () => {
      const seqRef = { current: 0 };
      const navigate = vi.fn();
      const refresh = vi.fn();
      const resolveAction = vi.fn().mockResolvedValue({
        status: "NO_TEAMS",
        userId: "user-A",
      } satisfies ActiveTeamContextResolution);

      // Case 1: Tab B was on onboarding for user-B; session switched to user-A (0 teams) -> must refresh onboarding UI
      await reconcileActiveTeamContext({
        currentUserId: "user-B",
        currentTeamId: undefined,
        triggerType: "VISIBILITY",
        seqRef,
        resolveAction,
        navigate,
        refresh,
      });
      expect(navigate).not.toHaveBeenCalled();
      expect(refresh).toHaveBeenCalledTimes(1);

      // Case 2: Tab B was on team-1 for user-B; session switched to user-A (0 teams) -> navigates to /teams and refreshes
      await reconcileActiveTeamContext({
        currentUserId: "user-B",
        currentTeamId: "team-1",
        triggerType: "VISIBILITY",
        seqRef,
        resolveAction,
        navigate,
        refresh,
      });
      expect(navigate).toHaveBeenCalledWith("/teams");
      expect(refresh).toHaveBeenCalledTimes(2);
    });

    it("does NOT redirect on temporary ERROR status or rejected network error", async () => {
      const seqRef = { current: 0 };
      const navigate = vi.fn();
      const refresh = vi.fn();
      const resolveAction = vi
        .fn()
        .mockResolvedValueOnce({
          status: "ERROR",
          message: "Temporary DB issue",
        } satisfies ActiveTeamContextResolution)
        .mockRejectedValueOnce(new Error("Network offline"));

      await reconcileActiveTeamContext({
        currentUserId: "user-1",
        currentTeamId: "team-1",
        triggerType: "VISIBILITY",
        seqRef,
        resolveAction,
        navigate,
        refresh,
      });

      await reconcileActiveTeamContext({
        currentUserId: "user-1",
        currentTeamId: "team-1",
        triggerType: "VISIBILITY",
        seqRef,
        resolveAction,
        navigate,
        refresh,
      });

      expect(navigate).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    });

    it("refreshes UI when MEMBERSHIP_CHANGED or role changed for current team", async () => {
      const seqRef = { current: 0 };
      const navigate = vi.fn();
      const refresh = vi.fn();
      const resolveAction = vi
        .fn()
        .mockResolvedValueOnce({
          status: "VALID",
          activeTeamId: "team-1",
          role: "MEMBER",
          userId: "user-1",
        } satisfies ActiveTeamContextResolution)
        .mockResolvedValueOnce({
          status: "VALID",
          activeTeamId: "team-1",
          role: "MANAGER",
          userId: "user-1",
        } satisfies ActiveTeamContextResolution);

      await reconcileActiveTeamContext({
        currentUserId: "user-1",
        currentTeamId: "team-1",
        currentRole: "MEMBER",
        triggerType: "MEMBERSHIP_CHANGED",
        eventTeamId: "team-1",
        seqRef,
        resolveAction,
        navigate,
        refresh,
      });

      await reconcileActiveTeamContext({
        currentUserId: "user-1",
        currentTeamId: "team-1",
        currentRole: "MEMBER",
        triggerType: "VISIBILITY",
        seqRef,
        resolveAction,
        navigate,
        refresh,
      });

      expect(navigate).not.toHaveBeenCalled();
      expect(refresh).toHaveBeenCalledTimes(2);
    });

    it("does NOT refresh or navigate on NO_TEAMS if userId matches and already on onboarding", async () => {
      const seqRef = { current: 0 };
      const navigate = vi.fn();
      const refresh = vi.fn();
      const resolveAction = vi.fn().mockResolvedValueOnce({
        status: "NO_TEAMS",
        userId: "user-1",
      } satisfies ActiveTeamContextResolution);

      await reconcileActiveTeamContext({
        currentUserId: "user-1",
        currentTeamId: undefined,
        triggerType: "VISIBILITY",
        seqRef,
        resolveAction,
        navigate,
        refresh,
      });
      expect(navigate).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    });
  });
});
