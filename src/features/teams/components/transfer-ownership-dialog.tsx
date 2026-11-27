"use client";

import { useRef, useState } from "react";
import { transferOwnershipAction } from "@/features/teams/actions";
import type { TeamMemberSummary } from "@/features/teams/server";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { AlertTriangle, X, Shuffle } from "lucide-react";

interface TransferOwnershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  members: TeamMemberSummary[];
  currentUserId: string;
  onOwnershipTransferred?: () => void;
}

export function TransferOwnershipDialog({
  open,
  onOpenChange,
  teamId,
  members,
  currentUserId,
  onOwnershipTransferred,
}: TransferOwnershipDialogProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out the current owner (cannot transfer to oneself)
  const eligibleMembers = members.filter((m) => m.userId !== currentUserId);

  const handleClose = () => {
    if (isSubmitting) return;
    setSelectedUserId("");
    setConfirmed(false);
    setError(null);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedUserId) {
      setError("Please select a team member to receive workspace ownership.");
      return;
    }

    if (!confirmed) {
      setError("Please check the confirmation box to proceed.");
      return;
    }

    setIsSubmitting(true);

    const result = await transferOwnershipAction({
      teamId,
      newOwnerUserId: selectedUserId,
    });

    setIsSubmitting(false);

    if (result.success) {
      handleClose();
      if (onOwnershipTransferred) {
        onOwnershipTransferred();
      }
    } else {
      setError(result.error || "Failed to transfer ownership.");
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={handleClose}
      labelledBy="transfer-ownership-dialog-title"
      disableClose={isSubmitting}
      initialFocusRef={eligibleMembers.length > 0 ? selectRef : undefined}
      variant="bottom-sheet"
      panelClassName="w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto"
    >
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
              <Shuffle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="transfer-ownership-dialog-title"
                className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100"
              >
                Transfer Ownership
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Assign another workspace member as the primary owner.
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

        {/* Warning Banner */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">Irreversible Action</p>
              <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
                Upon transfer, you will become a <strong>Manager</strong>. Only the new owner will be able to manage billing, transfer ownership again, or delete this team.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        {eligibleMembers.length === 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 text-center text-sm text-slate-600 dark:text-slate-300">
            There are no other active members in this team. Add team members before transferring ownership.
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={handleClose} className="min-h-[44px] sm:min-h-0">
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="new-owner-select"
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Select New Owner <span aria-hidden="true" className="text-red-600">*</span>
              </label>
              <select
                ref={selectRef}
                id="new-owner-select"
                required
                aria-required="true"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={isSubmitting}
                aria-invalid={Boolean(error && !selectedUserId)}
                aria-describedby={error ? "transfer-ownership-error" : undefined}
                className="h-11 sm:h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:border-teal-700 transition-all disabled:opacity-50"
              >
                <option value="">-- Choose a team member --</option>
                {eligibleMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} ({m.email}) — {m.role}
                  </option>
                ))}
              </select>
            </div>

            {/* Confirmation Checkbox */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                id="confirm-transfer"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 h-5 w-5 sm:h-4 sm:w-4 rounded border-slate-300 text-teal-700 focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-slate-700 dark:bg-slate-800 accent-teal-700 cursor-pointer shrink-0"
              />
              <label
                htmlFor="confirm-transfer"
                className="text-xs text-slate-600 dark:text-slate-300 select-none cursor-pointer leading-normal"
              >
                I understand that I am relinquishing workspace ownership and my role will be demoted to Manager.
              </label>
            </div>

            {/* Error Alert */}
            {error && (
              <div
                id="transfer-ownership-error"
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
              >
                {error}
              </div>
            )}

            {/* Action Buttons */}
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
                disabled={isSubmitting || !selectedUserId || !confirmed}
                className="min-h-[44px] sm:min-h-0"
              >
                Confirm Transfer
              </Button>
            </div>
          </form>
        )}
      </div>
    </ModalDialog>
  );
}
