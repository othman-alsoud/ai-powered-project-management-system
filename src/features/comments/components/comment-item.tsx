"use client";

import { useState } from "react";
import { Pencil, Trash2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeamRole } from "@/generated/prisma/client";
import type { CommentItemSummary } from "../server";
import {
  COMMENT_MAX_LENGTH,
  formatUtcCommentTimestamp,
} from "../validation";

export function canEditComment(
  comment: Pick<CommentItemSummary, "userId">,
  currentUserId: string,
): boolean {
  return Boolean(comment.userId && comment.userId === currentUserId);
}

export function canDeleteComment(
  comment: Pick<CommentItemSummary, "userId">,
  currentUserId: string,
  currentUserRole: TeamRole,
): boolean {
  if (canEditComment(comment, currentUserId)) {
    return true;
  }
  return currentUserRole === "OWNER" || currentUserRole === "MANAGER";
}

interface CommentItemProps {
  comment: CommentItemSummary;
  currentUserId: string;
  currentUserRole: TeamRole;
  isEditing: boolean;
  isConfirmingDelete: boolean;
  isMutating: boolean;
  editError: string | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (nextContent: string) => Promise<void> | void;
  onStartDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void> | void;
}

export function CommentItem({
  comment,
  currentUserId,
  currentUserRole,
  isEditing,
  isConfirmingDelete,
  isMutating,
  editError,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
}: CommentItemProps) {
  const [draftContent, setDraftContent] = useState(comment.content);
  const [localError, setLocalError] = useState<string | null>(null);

  const allowEdit = canEditComment(comment, currentUserId);
  const allowDelete = canDeleteComment(comment, currentUserId, currentUserRole);
  const displayedEditError = editError ?? localError;
  const trimmedDraft = draftContent.trim();
  const timestampLabel = formatUtcCommentTimestamp(comment.createdAt);

  function handleBeginEdit() {
    setDraftContent(comment.content);
    setLocalError(null);
    onStartEdit();
  }

  function handleCancelEditClick() {
    setDraftContent(comment.content);
    setLocalError(null);
    onCancelEdit();
  }

  function handleSaveSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isMutating) return;

    if (trimmedDraft.length === 0) {
      setLocalError("Comment cannot be empty");
      return;
    }
    if (trimmedDraft.length > COMMENT_MAX_LENGTH) {
      setLocalError(
        `Comment must be at most ${COMMENT_MAX_LENGTH} characters`,
      );
      return;
    }

    setLocalError(null);
    void onSaveEdit(draftContent);
  }

  return (
    <article
      aria-label={`Comment by ${comment.author.name}`}
      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3.5 flex flex-col gap-2.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
            <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 break-words">
            {comment.author.name}
          </span>
          <span className="text-[11px] text-slate-600 dark:text-slate-400">
            {timestampLabel}
          </span>
          {comment.isEdited ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
              Edited
            </span>
          ) : null}
        </div>

        {(allowEdit || allowDelete) && !isEditing && !isConfirmingDelete ? (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {allowEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isMutating}
                aria-label="Edit comment"
                onClick={handleBeginEdit}
                className="min-h-[44px] sm:min-h-[30px] px-2.5 text-xs text-slate-600 dark:text-slate-300"
              >
                <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                <span>Edit</span>
              </Button>
            ) : null}
            {allowDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isMutating}
                aria-label="Delete comment"
                onClick={onStartDelete}
                className="min-h-[44px] sm:min-h-[30px] px-2.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                <span>Delete</span>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isEditing ? (
        <form onSubmit={handleSaveSubmit} className="flex flex-col gap-2">
          <label
            htmlFor={`edit-comment-${comment.id}`}
            className="text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            Edit comment
          </label>
          <textarea
            id={`edit-comment-${comment.id}`}
            value={draftContent}
            disabled={isMutating}
            rows={3}
            onChange={(event) => {
              setDraftContent(event.target.value);
              if (localError) setLocalError(null);
            }}
            aria-invalid={displayedEditError ? "true" : undefined}
            aria-describedby={
              displayedEditError
                ? `edit-comment-error-${comment.id}`
                : `edit-comment-hint-${comment.id}`
            }
            className="w-full min-h-[80px] resize-y rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {displayedEditError ? (
              <p
                id={`edit-comment-error-${comment.id}`}
                role="alert"
                className="text-xs text-rose-600 dark:text-rose-400"
              >
                {displayedEditError}
              </p>
            ) : (
              <span
                id={`edit-comment-hint-${comment.id}`}
                className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums"
              >
                {trimmedDraft.length}/{COMMENT_MAX_LENGTH}
              </span>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isMutating}
                onClick={handleCancelEditClick}
                className="min-h-[44px] sm:min-h-[32px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isMutating || trimmedDraft.length === 0}
                className="min-h-[44px] sm:min-h-[32px]"
              >
                {isMutating ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
          {comment.content}
        </p>
      )}

      {isConfirmingDelete ? (
        <div
          role="region"
          aria-label="Delete comment confirmation"
          className="rounded-md border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        >
          <p className="text-xs text-rose-800 dark:text-rose-200">
            Delete this comment? This cannot be undone.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isMutating}
              onClick={onCancelDelete}
              className="min-h-[44px] sm:min-h-[32px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isMutating}
              aria-label="Confirm delete comment"
              onClick={() => void onConfirmDelete()}
              className="min-h-[44px] sm:min-h-[32px]"
            >
              {isMutating ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
