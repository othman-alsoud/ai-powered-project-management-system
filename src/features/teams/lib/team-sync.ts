import { z } from "zod";

export const TEAM_SYNC_CHANNEL_NAME = "pm-team-context-sync";
export const TEAM_SYNC_STORAGE_KEY = "pm-team-context-sync-event";
const TAB_ID_STORAGE_KEY = "pm-team-sync-tab-id";
const MAX_SEEN_EVENT_IDS = 100;

export const teamSyncEventTypeSchema = z.enum([
  "TEAM_SWITCHED",
  "TEAM_CREATED",
  "MEMBERSHIP_CHANGED",
  "AUTH_SIGNED_OUT",
]);

export type TeamSyncEventType = z.infer<typeof teamSyncEventTypeSchema>;

export const teamSyncEventSchema = z.object({
  eventId: z.string().min(1),
  type: teamSyncEventTypeSchema,
  sourceTabId: z.string().min(1),
  userId: z.string().min(1),
  teamId: z.string().min(1).optional(),
  timestamp: z.number().finite().nonnegative(),
});

export type TeamSyncEvent = z.infer<typeof teamSyncEventSchema>;

let memoryTabId: string | null = null;

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Returns a stable ephemeral identifier for the current browser tab.
 */
export function getTabId(): string {
  if (memoryTabId) {
    return memoryTabId;
  }

  try {
    if (typeof sessionStorage !== "undefined") {
      const existing = sessionStorage.getItem(TAB_ID_STORAGE_KEY);
      if (existing) {
        memoryTabId = existing;
        return existing;
      }
      const created = generateUuid();
      sessionStorage.setItem(TAB_ID_STORAGE_KEY, created);
      memoryTabId = created;
      return created;
    }
  } catch {
    // Fallback when sessionStorage is restricted (e.g., private mode)
  }

  memoryTabId = generateUuid();
  return memoryTabId;
}

/**
 * Resets the cached in-memory tab ID (intended for unit tests).
 */
export function resetTabIdForTests(): void {
  memoryTabId = null;
}

/**
 * Bounded FIFO set of seen event IDs for deduplicating events across transports.
 */
export function createSeenEventTracker(maxSize: number = MAX_SEEN_EVENT_IDS) {
  const seen = new Set<string>();

  return {
    hasSeen(eventId: string): boolean {
      return seen.has(eventId);
    },
    markSeen(eventId: string): boolean {
      if (seen.has(eventId)) {
        return false;
      }
      if (seen.size >= maxSize) {
        const oldest = seen.values().next().value;
        if (oldest !== undefined) {
          seen.delete(oldest);
        }
      }
      seen.add(eventId);
      return true;
    },
  };
}

/**
 * Safely parses and validates an incoming cross-tab sync payload.
 * Returns null for malformed JSON or invalid event shapes.
 */
export function parseTeamSyncEvent(raw: unknown): TeamSyncEvent | null {
  let candidate: unknown = raw;

  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  const parsed = teamSyncEventSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * Broadcasts a synchronization signal across same-origin browser tabs
 * using BroadcastChannel and localStorage fallback.
 */
export function publishTeamSyncEvent(
  input: {
    type: TeamSyncEventType;
    userId: string;
    teamId?: string;
  },
  overrideTabId?: string
): TeamSyncEvent | null {
  const envelope: TeamSyncEvent = {
    eventId: generateUuid(),
    type: input.type,
    sourceTabId: overrideTabId ?? getTabId(),
    userId: input.userId,
    ...(input.teamId ? { teamId: input.teamId } : {}),
    timestamp: Date.now(),
  };

  const validated = teamSyncEventSchema.safeParse(envelope);
  if (!validated.success) {
    return null;
  }

  const payload = validated.data;

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(TEAM_SYNC_CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
    }
  } catch {
    // Ignore BroadcastChannel errors in restricted environments
  }

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(TEAM_SYNC_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // Ignore localStorage quota/privacy errors
  }

  return payload;
}

/**
 * Subscribes to cross-tab synchronization signals via BroadcastChannel and
 * window storage events, applying sourceTabId, userId, and eventId deduplication.
 */
export function subscribeTeamSyncEvents(
  handler: (event: TeamSyncEvent) => void,
  options?: {
    currentUserId?: string;
    tabId?: string;
  }
): () => void {
  const currentTabId = options?.tabId ?? getTabId();
  const tracker = createSeenEventTracker();

  const processRawPayload = (raw: unknown) => {
    const parsed = parseTeamSyncEvent(raw);
    if (!parsed) return;
    if (parsed.sourceTabId === currentTabId) return;
    if (
      options?.currentUserId &&
      parsed.type !== "AUTH_SIGNED_OUT" &&
      parsed.userId !== options.currentUserId
    ) {
      return;
    }
    if (!tracker.markSeen(parsed.eventId)) return;

    handler(parsed);
  };

  let channel: BroadcastChannel | null = null;
  const onChannelMessage = (event: MessageEvent) => {
    processRawPayload(event.data);
  };

  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(TEAM_SYNC_CHANNEL_NAME);
      channel.addEventListener("message", onChannelMessage);
    }
  } catch {
    channel = null;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== TEAM_SYNC_STORAGE_KEY || !event.newValue) return;
    processRawPayload(event.newValue);
  };

  try {
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
    }
  } catch {
    // Ignore window access errors in non-DOM contexts
  }

  return () => {
    try {
      if (channel) {
        channel.removeEventListener("message", onChannelMessage);
        channel.close();
      }
    } catch {
      // Ignore cleanup errors
    }

    try {
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
    } catch {
      // Ignore cleanup errors
    }
  };
}
