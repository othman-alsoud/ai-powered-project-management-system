import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("../actions", () => ({
  getTaskCommentsAction: vi.fn(),
  createCommentAction: vi.fn(),
  updateCommentAction: vi.fn(),
  deleteCommentAction: vi.fn(),
}));

import {
  CommentItem,
  canDeleteComment,
  canEditComment,
} from "../components/comment-item";
import { CommentCompose } from "../components/comment-compose";
import {
  CommentThread,
  submitCommentWithLock,
} from "../components/comment-thread";
import type { CommentItemSummary } from "../server";
import { COMMENT_THREAD_LIMIT } from "../validation";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TASK_ID = "44444444-4444-4444-8444-444444444444";
const AUTHOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_MEMBER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MANAGER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OWNER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const ownComment: CommentItemSummary = {
  id: "55555555-5555-4555-8555-555555555551",
  teamId: TEAM_ID,
  taskId: TASK_ID,
  userId: AUTHOR_ID,
  content: "First task update from author",
  createdAt: "2026-11-25T10:00:00.000Z",
  updatedAt: "2026-11-25T10:15:00.000Z",
  isEdited: true,
  author: { id: AUTHOR_ID, name: "Alice Author" },
};

const anonymizedComment: CommentItemSummary = {
  id: "55555555-5555-4555-8555-555555555552",
  teamId: TEAM_ID,
  taskId: TASK_ID,
  userId: null,
  content: "Archived historical note",
  createdAt: "2026-11-25T11:00:00.000Z",
  updatedAt: "2026-11-25T11:00:00.000Z",
  isEdited: false,
  author: { id: null, name: "Deleted User" },
};

describe("Comment UI Components", () => {
  it("enforces permission helpers matching REQ-COM-02", () => {
    // Author can edit and delete own comment
    expect(canEditComment(ownComment, AUTHOR_ID)).toBe(true);
    expect(canDeleteComment(ownComment, AUTHOR_ID, "MEMBER")).toBe(true);

    // OWNER and MANAGER can delete another user's comment, NEVER edit it
    expect(canEditComment(ownComment, OWNER_ID)).toBe(false);
    expect(canEditComment(ownComment, MANAGER_ID)).toBe(false);
    expect(canDeleteComment(ownComment, OWNER_ID, "OWNER")).toBe(true);
    expect(canDeleteComment(ownComment, MANAGER_ID, "MANAGER")).toBe(true);

    // Other MEMBER cannot edit or delete
    expect(canEditComment(ownComment, OTHER_MEMBER_ID)).toBe(false);
    expect(canDeleteComment(ownComment, OTHER_MEMBER_ID, "MEMBER")).toBe(false);

    // Anonymized comment (userId = null) cannot be edited by anyone, but can be moderated
    expect(canEditComment(anonymizedComment, AUTHOR_ID)).toBe(false);
    expect(canDeleteComment(anonymizedComment, MANAGER_ID, "MANAGER")).toBe(true);
    expect(canDeleteComment(anonymizedComment, OTHER_MEMBER_ID, "MEMBER")).toBe(
      false,
    );
  });

  it("renders CommentItem controls strictly by role/ownership and shows Edited + Deleted User labels", () => {
    const authorHtml = renderToString(
      <CommentItem
        comment={ownComment}
        currentUserId={AUTHOR_ID}
        currentUserRole="MEMBER"
        isEditing={false}
        isConfirmingDelete={false}
        isMutating={false}
        editError={null}
        onStartEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveEdit={vi.fn()}
        onStartDelete={vi.fn()}
        onCancelDelete={vi.fn()}
        onConfirmDelete={vi.fn()}
      />,
    );
    expect(authorHtml).toContain("Alice Author");
    expect(authorHtml).toContain("Edited");
    expect(authorHtml).toContain("First task update from author");
    expect(authorHtml).toContain("Edit comment");
    expect(authorHtml).toContain("Delete comment");

    const managerHtml = renderToString(
      <CommentItem
        comment={ownComment}
        currentUserId={MANAGER_ID}
        currentUserRole="MANAGER"
        isEditing={false}
        isConfirmingDelete={false}
        isMutating={false}
        editError={null}
        onStartEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveEdit={vi.fn()}
        onStartDelete={vi.fn()}
        onCancelDelete={vi.fn()}
        onConfirmDelete={vi.fn()}
      />,
    );
    expect(managerHtml).not.toContain("Edit comment");
    expect(managerHtml).toContain("Delete comment");

    const otherMemberHtml = renderToString(
      <CommentItem
        comment={anonymizedComment}
        currentUserId={OTHER_MEMBER_ID}
        currentUserRole="MEMBER"
        isEditing={false}
        isConfirmingDelete={false}
        isMutating={false}
        editError={null}
        onStartEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveEdit={vi.fn()}
        onStartDelete={vi.fn()}
        onCancelDelete={vi.fn()}
        onConfirmDelete={vi.fn()}
      />,
    );
    expect(otherMemberHtml).toContain("Deleted User");
    expect(otherMemberHtml).not.toContain("Edit comment");
    expect(otherMemberHtml).not.toContain("Delete comment");
  });

  it("renders CommentItem inline edit and delete confirmation states", () => {
    const editingHtml = renderToString(
      <CommentItem
        comment={ownComment}
        currentUserId={AUTHOR_ID}
        currentUserRole="MEMBER"
        isEditing
        isConfirmingDelete={false}
        isMutating={false}
        editError="Comment cannot be empty"
        onStartEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveEdit={vi.fn()}
        onStartDelete={vi.fn()}
        onCancelDelete={vi.fn()}
        onConfirmDelete={vi.fn()}
      />,
    );
    expect(editingHtml).toContain("Save");
    expect(editingHtml).toContain("Cancel");
    expect(editingHtml).toContain("Comment cannot be empty");

    const confirmHtml = renderToString(
      <CommentItem
        comment={ownComment}
        currentUserId={MANAGER_ID}
        currentUserRole="MANAGER"
        isEditing={false}
        isConfirmingDelete
        isMutating={false}
        editError={null}
        onStartEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveEdit={vi.fn()}
        onStartDelete={vi.fn()}
        onCancelDelete={vi.fn()}
        onConfirmDelete={vi.fn()}
      />,
    );
    expect(confirmHtml).toContain("Delete this comment?");
    expect(confirmHtml).toContain("Confirm delete comment");
  });

  it("renders CommentCompose with label, textarea, and disabled submit when empty", () => {
    const html = renderToString(
      <CommentCompose
        isSubmitting={false}
        serverError={null}
        onSubmit={vi.fn(async () => true)}
      />,
    );
    expect(html).toContain("Add a comment");
    expect(html).toContain("Post Comment");
    expect(html).toContain("disabled");
  });

  it("renders CommentThread loading, empty, populated, and capped states", () => {
    const loadingHtml = renderToString(
      <CommentThread
        teamId={TEAM_ID}
        taskId={TASK_ID}
        currentUserId={AUTHOR_ID}
        currentUserRole="MEMBER"
      />,
    );
    expect(loadingHtml).toContain("Loading comments");
    expect(loadingHtml).toContain('aria-busy="true"');

    const emptyHtml = renderToString(
      <CommentThread
        teamId={TEAM_ID}
        taskId={TASK_ID}
        currentUserId={AUTHOR_ID}
        currentUserRole="MEMBER"
        initialThread={{
          comments: [],
          totalCount: 0,
          isCapped: false,
          limit: COMMENT_THREAD_LIMIT,
        }}
      />,
    );
    expect(emptyHtml).toContain("No comments yet");

    const cappedHtml = renderToString(
      <CommentThread
        teamId={TEAM_ID}
        taskId={TASK_ID}
        currentUserId={AUTHOR_ID}
        currentUserRole="MEMBER"
        initialThread={{
          comments: [ownComment, anonymizedComment],
          totalCount: 215,
          isCapped: true,
          limit: COMMENT_THREAD_LIMIT,
        }}
      />,
    );
      expect(cappedHtml).toContain("Comments (215)");
      expect(cappedHtml).toContain("Showing the newest 200 of 215 comments.");
      expect(cappedHtml).not.toContain("Showing the first 200");
      expect(cappedHtml).toContain("First task update from author");
      expect(cappedHtml).toContain("Archived historical note");
  });

  it("prevents duplicate concurrent comment submissions via lock helper", async () => {
    const lockRef = { current: true };
    const action = vi.fn();
    const skipped = await submitCommentWithLock(lockRef, action);
    expect(skipped).toEqual({ skipped: true });
    expect(action).not.toHaveBeenCalled();

    lockRef.current = false;
    action.mockResolvedValueOnce({ success: true });
    const executed = await submitCommentWithLock(lockRef, action);
    expect(executed).toEqual({ skipped: false, result: { success: true } });
    expect(action).toHaveBeenCalledTimes(1);
    expect(lockRef.current).toBe(false);
  });
});
