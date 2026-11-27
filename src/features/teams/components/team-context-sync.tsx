"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  resolveActiveTeamContextAction,
  type ActiveTeamContextResolution,
} from "../actions";
import type { TeamRole } from "../server";
import {
  subscribeTeamSyncEvents,
  type TeamSyncEventType,
} from "../lib/team-sync";

const VISIBILITY_THROTTLE_MS = 5000;

export interface ReconcileParams {
  currentUserId: string;
  currentTeamId?: string;
  currentRole?: TeamRole;
  triggerType: TeamSyncEventType | "VISIBILITY";
  eventTeamId?: string;
  seqRef: { current: number };
  resolveAction: (currentTeamId?: string) => Promise<ActiveTeamContextResolution>;
  navigate: (path: string) => void;
  refresh: () => void;
}

/**
 * Reconciles the current browser tab against the database-authoritative
 * active team context returned by the server.
 * Discards stale responses using a monotonic sequence ref and never redirects
 * on temporary network/database errors.
 */
export async function reconcileActiveTeamContext({
  currentUserId,
  currentTeamId,
  currentRole,
  triggerType,
  eventTeamId,
  seqRef,
  resolveAction,
  navigate,
  refresh,
}: ReconcileParams): Promise<void> {
  const requestSeq = ++seqRef.current;

  let resolution: ActiveTeamContextResolution;
  try {
    resolution = await resolveAction(currentTeamId);
  } catch {
    // Temporary network/transport failure: keep user on current page
    return;
  }

  // Discard delayed responses superseded by a newer reconciliation request
  if (requestSeq !== seqRef.current) {
    return;
  }

  switch (resolution.status) {
    case "ERROR":
      // Temporary server/DB failure: do NOT redirect
      return;

    case "UNAUTHENTICATED":
      navigate("/sign-in");
      refresh();
      return;

    case "NO_TEAMS":
      if (currentTeamId) {
        navigate("/teams");
        refresh();
      } else if (resolution.userId !== currentUserId) {
        refresh();
      }
      return;

    case "SWITCH_REQUIRED":
      navigate(`/teams/${resolution.activeTeamId}`);
      refresh();
      return;

    case "VALID": {
      const userChanged = resolution.userId !== currentUserId;
      const roleChanged =
        currentRole !== undefined && resolution.role !== currentRole;
      const relevantMembershipChange =
        triggerType === "MEMBERSHIP_CHANGED" &&
        (!eventTeamId || eventTeamId === currentTeamId);

      if (userChanged || roleChanged || relevantMembershipChange) {
        refresh();
      }
      return;
    }
  }
}

interface TeamContextSyncProps {
  currentTeamId?: string;
  currentRole?: TeamRole;
  currentUserId: string;
}

export function TeamContextSync({
  currentTeamId,
  currentRole,
  currentUserId,
}: TeamContextSyncProps) {
  const router = useRouter();
  const latestRequestSeqRef = useRef(0);
  const lastVisibilityCheckRef = useRef(0);

  useEffect(() => {
    const runReconciliation = (
      triggerType: TeamSyncEventType | "VISIBILITY",
      eventTeamId?: string
    ) => {
      void reconcileActiveTeamContext({
        currentUserId,
        currentTeamId,
        currentRole,
        triggerType,
        eventTeamId,
        seqRef: latestRequestSeqRef,
        resolveAction: resolveActiveTeamContextAction,
        navigate: (path) => router.push(path),
        refresh: () => router.refresh(),
      });
    };

    const unsubscribe = subscribeTeamSyncEvents(
      (event) => {
        runReconciliation(event.type, event.teamId);
      },
      { currentUserId }
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      const now = Date.now();
      if (now - lastVisibilityCheckRef.current < VISIBILITY_THROTTLE_MS) {
        return;
      }
      lastVisibilityCheckRef.current = now;
      runReconciliation("VISIBILITY");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentTeamId, currentRole, currentUserId, router]);

  return null;
}
