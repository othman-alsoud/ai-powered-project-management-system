"use client";

import { useRef, useState } from "react";
import { addMemberAction } from "@/features/teams/actions";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { X, UserPlus } from "lucide-react";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  onMemberAdded?: () => void;
}

export function AddMemberDialog({
  open,
  onOpenChange,
  teamId,
  onMemberAdded,
}: AddMemberDialogProps) {
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MANAGER" | "MEMBER">("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (isSubmitting) return;
    setEmail("");
    setRole("MEMBER");
    setError(null);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    const result = await addMemberAction({
      teamId,
      email: trimmedEmail,
      role,
    });
    setIsSubmitting(false);

    if (result.success) {
      handleClose();
      if (onMemberAdded) {
        onMemberAdded();
      }
    } else {
      setError(result.error || "Failed to add member.");
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={handleClose}
      labelledBy="add-member-dialog-title"
      disableClose={isSubmitting}
      initialFocusRef={emailInputRef}
      variant="bottom-sheet"
      panelClassName="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto"
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60">
              <UserPlus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="add-member-dialog-title"
                className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100"
              >
                Add Team Member
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Add an existing registered user to this workspace.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="inline-flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 transition-colors cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="member-email-input"
              className="text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Email Address <span aria-hidden="true" className="text-red-600">*</span>
            </label>
            <input
              ref={emailInputRef}
              id="member-email-input"
              type="email"
              required
              aria-required="true"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "add-member-error" : undefined}
              className="h-11 sm:h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:border-teal-700 transition-all disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="member-role-select"
              className="text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Role
            </label>
            <select
              id="member-role-select"
              value={role}
              onChange={(e) => setRole(e.target.value as "MANAGER" | "MEMBER")}
              disabled={isSubmitting}
              className="h-11 sm:h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:border-teal-700 transition-all disabled:opacity-50"
            >
              <option value="MEMBER">Member (Standard access)</option>
              <option value="MANAGER">Manager (Can manage projects &amp; tasks)</option>
            </select>
          </div>

          {error && (
            <div
              id="add-member-error"
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="min-h-[44px] sm:min-h-0"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={isSubmitting || !email.trim()}
              className="min-h-[44px] sm:min-h-0"
            >
              Add Member
            </Button>
          </div>
        </form>
      </div>
    </ModalDialog>
  );
}
