"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMMENT_MAX_LENGTH } from "../validation";

interface CommentComposeProps {
  isSubmitting: boolean;
  serverError: string | null;
  onSubmit: (content: string) => Promise<boolean>;
}

export function CommentCompose({
  isSubmitting,
  serverError,
  onSubmit,
}: CommentComposeProps) {
  const [content, setContent] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const trimmedLength = content.trim().length;
  const displayedError = validationError ?? serverError;
  const isOverLimit = trimmedLength > COMMENT_MAX_LENGTH;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    if (trimmedLength === 0) {
      setValidationError("Comment cannot be empty");
      return;
    }

    if (isOverLimit) {
      setValidationError(
        `Comment must be at most ${COMMENT_MAX_LENGTH} characters`,
      );
      return;
    }

    setValidationError(null);
    const ok = await onSubmit(content);
    if (ok) {
      setContent("");
      setValidationError(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label
        htmlFor="task-comment-compose"
        className="text-xs font-medium text-slate-700 dark:text-slate-200"
      >
        Add a comment
      </label>
      <textarea
        id="task-comment-compose"
        name="commentContent"
        rows={3}
        value={content}
        disabled={isSubmitting}
        placeholder="Write a comment for your team…"
        onChange={(event) => {
          setContent(event.target.value);
          if (validationError) setValidationError(null);
        }}
        aria-invalid={displayedError ? "true" : undefined}
        aria-describedby={
          displayedError
            ? "task-comment-compose-error"
            : "task-comment-compose-hint"
        }
        className="w-full min-h-[80px] resize-y rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 disabled:opacity-60"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {displayedError ? (
            <p
              id="task-comment-compose-error"
              role="alert"
              className="text-xs text-rose-600 dark:text-rose-400"
            >
              {displayedError}
            </p>
          ) : trimmedLength >= 1600 || isOverLimit ? (
            <p
              id="task-comment-compose-hint"
              className={`text-[11px] tabular-nums ${
                isOverLimit
                  ? "text-rose-600 dark:text-rose-400 font-medium"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {trimmedLength}/{COMMENT_MAX_LENGTH} characters
            </p>
          ) : (
            <span
              id="task-comment-compose-hint"
              className="text-[11px] text-slate-600 dark:text-slate-400"
            >
              Max {COMMENT_MAX_LENGTH} characters
            </span>
          )}
        </div>

        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || trimmedLength === 0}
          className="min-h-[44px] sm:min-h-[36px] shrink-0"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />
              <span>Posting…</span>
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              <span>Post Comment</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
