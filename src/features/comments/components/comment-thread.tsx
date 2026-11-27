"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeamRole } from "@/generated/prisma/client";
import {
  createCommentAction,
  deleteCommentAction,
  getTaskCommentsAction,
  updateCommentAction,
} from "../actions";
import type { CommentThreadResult } from "../server";
import { COMMENT_THREAD_LIMIT } from "../validation";
import { CommentCompose } from "./comment-compose";
import { CommentItem } from "./comment-item";

export async function submitCommentWithLock<T>(
  lockRef: { current: boolean },
  operation: () => Promise<T>,
): Promise<{ skipped: true } | { skipped: false; result: T }> {
  if (lockRef.current) {
    return { skipped: true };
  }
  lockRef.current = true;
  try {
    const result = await operation();
    return { skipped: false, result };
  } finally {
    lockRef.current = false;
  }
}

interface CommentThreadProps {
  teamId: string;
  taskId: string;
  currentUserId: string;
  currentUserRole: TeamRole;
  initialThread?: CommentThreadResult | null;
  onMutated?: (message: string) => void;
  onBusyChange?: (isBusy: boolean) => void;
}

export function CommentThread({
  teamId,
  taskId,
  currentUserId,
  currentUserRole,
  initialThread,
  onMutated,
  onBusyChange,
}: CommentThreadProps) {
  const hasInitialThread = initialThread !== undefined && initialThread !== null;

  const [thread, setThread] = useState<CommentThreadResult | null>(
    hasInitialThread ? initialThread : null,
  );
  const [isLoading, setIsLoading] = useState(!hasInitialThread);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [mutatingCommentId, setMutatingCommentId] = useState<string | null>(
    null,
  );
  const [editError, setEditError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadSeqRef = useRef(0);
  const mutationLockRef = useRef(false);

  const isAnyMutating = isCreating || mutatingCommentId !== null;

  useEffect(() => {
    onBusyChange?.(isAnyMutating);
  }, [isAnyMutating, onBusyChange]);

  const fetchComments = useCallback(async () => {
    const requestSeq = ++loadSeqRef.current;
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await getTaskCommentsAction(teamId, { taskId });
      if (requestSeq !== loadSeqRef.current) return;

      if (!response.success) {
        setLoadError(response.error);
        return;
      }

      setThread(response.data);
    } catch {
      if (requestSeq !== loadSeqRef.current) return;
      setLoadError("Unable to load comments right now. Please try again.");
    } finally {
      if (requestSeq === loadSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [teamId, taskId]);

  useEffect(() => {
    if (hasInitialThread) {
      return;
    }

    let cancelled = false;
    const requestSeq = ++loadSeqRef.current;

    void getTaskCommentsAction(teamId, { taskId })
      .then((response) => {
        if (cancelled || requestSeq !== loadSeqRef.current) return;
        if (!response.success) {
          setLoadError(response.error);
        } else {
          setLoadError(null);
          setThread(response.data);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled || requestSeq !== loadSeqRef.current) return;
        setLoadError("Unable to load comments right now. Please try again.");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      // Invalidate any in-flight request when unmounting or changing task
      loadSeqRef.current += 1;
    };
  }, [teamId, taskId, hasInitialThread]);

  async function handleCreateComment(content: string): Promise<boolean> {
    setCreateError(null);
    setActionError(null);

    const outcome = await submitCommentWithLock(mutationLockRef, async () => {
      setIsCreating(true);
      try {
        return await createCommentAction(teamId, { taskId, content });
      } finally {
        setIsCreating(false);
      }
    });

    if (outcome.skipped) return false;
    const response = outcome.result;

    if (!response.success) {
      setCreateError(response.fieldErrors?.content?.[0] ?? response.error);
      return false;
    }

    await fetchComments();
    onMutated?.("Comment posted.");
    return true;
  }

  async function handleSaveEdit(commentId: string, nextContent: string) {
    setEditError(null);
    setActionError(null);

    const outcome = await submitCommentWithLock(mutationLockRef, async () => {
      setMutatingCommentId(commentId);
      try {
        return await updateCommentAction(teamId, {
          commentId,
          taskId,
          content: nextContent,
        });
      } finally {
        setMutatingCommentId(null);
      }
    });

    if (outcome.skipped) return;
    const response = outcome.result;

    if (!response.success) {
      setEditError(response.fieldErrors?.content?.[0] ?? response.error);
      return;
    }

    setEditingCommentId(null);
    if (!response.data.noOp) {
      await fetchComments();
    }
    onMutated?.(
      response.data.noOp ? "Comment unchanged." : "Comment updated.",
    );
  }

  async function handleConfirmDelete(commentId: string) {
    setActionError(null);

    const outcome = await submitCommentWithLock(mutationLockRef, async () => {
      setMutatingCommentId(commentId);
      try {
        return await deleteCommentAction(teamId, { commentId, taskId });
      } finally {
        setMutatingCommentId(null);
      }
    });

    if (outcome.skipped) return;
    const response = outcome.result;

    if (!response.success) {
      setActionError(response.error);
      return;
    }

    setConfirmDeleteId(null);
    await fetchComments();
    onMutated?.("Comment deleted.");
  }

  const commentCount = thread?.totalCount ?? thread?.comments.length ?? 0;

  return (
    <section
      aria-label="Task comments"
      className="flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800 pt-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare
            className="h-4 w-4 text-slate-500 dark:text-slate-400"
            aria-hidden="true"
          />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            {`Comments (${commentCount})`}
          </h3>
        </div>
        {!isLoading && thread ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isAnyMutating}
            aria-label="Refresh comments"
            onClick={() => void fetchComments()}
            className="min-h-[44px] min-w-[44px] md:min-h-[28px] md:min-w-[28px] px-2 text-xs text-slate-600 dark:text-slate-400"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs text-rose-700 dark:text-rose-300"
        >
          {actionError}
        </div>
      ) : null}

      {isLoading && !thread ? (
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 px-4 py-5 text-center text-xs text-slate-600 dark:text-slate-400"
        >
          Loading comments…
        </div>
      ) : loadError && !thread ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        >
          <p className="text-xs text-rose-700 dark:text-rose-300">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchComments()}
            className="min-h-[44px] sm:min-h-[32px] shrink-0"
          >
            Retry
          </Button>
        </div>
      ) : thread && thread.comments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 px-4 py-5 text-center text-xs text-slate-600 dark:text-slate-400">
          No comments yet. Be the first to comment.
        </div>
      ) : thread ? (
        <>
          {loadError ? (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2"
            >
              <span>{loadError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void fetchComments()}
                className="min-h-[36px] sm:min-h-[28px]"
              >
                Retry
              </Button>
            </div>
          ) : null}

          {thread.isCapped ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-1.5">
              {`Showing the newest ${thread.limit ?? COMMENT_THREAD_LIMIT} of ${thread.totalCount} comments.`}
            </p>
          ) : null}

          <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-0.5">
            {thread.comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                isEditing={editingCommentId === comment.id}
                isConfirmingDelete={confirmDeleteId === comment.id}
                isMutating={mutatingCommentId === comment.id || isCreating}
                editError={editingCommentId === comment.id ? editError : null}
                onStartEdit={() => {
                  setConfirmDeleteId(null);
                  setEditError(null);
                  setActionError(null);
                  setEditingCommentId(comment.id);
                }}
                onCancelEdit={() => {
                  setEditingCommentId(null);
                  setEditError(null);
                }}
                onSaveEdit={(nextContent) =>
                  handleSaveEdit(comment.id, nextContent)
                }
                onStartDelete={() => {
                  setEditingCommentId(null);
                  setEditError(null);
                  setActionError(null);
                  setConfirmDeleteId(comment.id);
                }}
                onCancelDelete={() => setConfirmDeleteId(null)}
                onConfirmDelete={() => handleConfirmDelete(comment.id)}
              />
            ))}
          </div>
        </>
      ) : null}

      <div className="pt-1">
        <CommentCompose
          isSubmitting={isCreating}
          serverError={createError}
          onSubmit={handleCreateComment}
        />
      </div>
    </section>
  );
}
