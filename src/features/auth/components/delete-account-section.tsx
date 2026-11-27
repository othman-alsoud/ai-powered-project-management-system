"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { publishTeamSyncEvent } from "@/features/teams/lib/team-sync";
import type { AccountDeletionEligibility } from "../account-server";
import { deleteAccountAction } from "../actions";
import { deleteAccountSchema } from "../validation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModalDialog } from "@/components/ui/modal-dialog";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  hasPasswordAccount: boolean;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  userId,
  hasPasswordAccount,
}: DeleteAccountDialogProps) {
  const router = useRouter();
  const isSubmittingRef = useRef(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    confirmationPhrase?: string;
    password?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (isSubmittingRef.current) return;
    setConfirmationPhrase("");
    setPassword("");
    setError(null);
    setFieldErrors({});
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    setError(null);
    setFieldErrors({});

    const parsed = deleteAccountSchema.safeParse({
      confirmationPhrase,
      ...(hasPasswordAccount ? { password } : {}),
    });

    if (!parsed.success) {
      const phraseIssue = parsed.error.issues.find((i) =>
        i.path.includes("confirmationPhrase")
      );
      setFieldErrors({
        confirmationPhrase: phraseIssue?.message,
      });
      return;
    }

    if (hasPasswordAccount && !password) {
      setFieldErrors({
        password: "Current password is required.",
      });
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await deleteAccountAction({
        confirmationPhrase: parsed.data.confirmationPhrase,
        ...(hasPasswordAccount ? { password } : {}),
      });

      if (!result.success) {
        setError(result.error);
        if (result.fieldErrors) {
          setFieldErrors({
            confirmationPhrase: result.fieldErrors.confirmationPhrase?.[0],
            password: result.fieldErrors.password?.[0],
          });
        }
        return;
      }

      // Clear client-side session state safely (DB sessions are already deleted)
      try {
        await authClient.signOut();
      } catch {
        // Ignore errors if session was already invalidated
      }

      publishTeamSyncEvent({
        type: "AUTH_SIGNED_OUT",
        userId,
      });

      router.push("/sign-in");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <ModalDialog
      open={open}
      onClose={handleClose}
      labelledBy="delete-account-dialog-title"
      disableClose={isSubmitting}
      initialFocusRef={cancelButtonRef}
      variant="bottom-sheet"
      panelClassName="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
    >
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-900/60">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="delete-account-dialog-title"
                className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100"
              >
                Confirm Account Deletion
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                This action is permanent and cannot be undone.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="inline-flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Warning Box */}
        <div className="rounded-lg border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              Your profile details will be anonymized to{" "}
              <strong>Deleted User</strong>, your email will be released, and all
              sessions and sign-in credentials will be permanently removed.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {hasPasswordAccount && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="delete-account-password"
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Current Password <span aria-hidden="true" className="text-red-600">*</span>
              </label>
              <input
                id="delete-account-password"
                type="password"
                autoComplete="current-password"
                required
                aria-required="true"
                placeholder="Enter your current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={
                  fieldErrors.password ? "delete-account-password-error" : undefined
                }
                className="h-11 sm:h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:border-red-600 transition-all disabled:opacity-50"
              />
              {fieldErrors.password && (
                <p
                  id="delete-account-password-error"
                  role="alert"
                  className="text-xs text-red-600 dark:text-red-400"
                >
                  {fieldErrors.password}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="delete-account-confirmation"
              className="text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Type <span className="font-mono font-semibold text-red-600 dark:text-red-400">DELETE</span> to confirm{" "}
              <span aria-hidden="true" className="text-red-600">*</span>
            </label>
            <input
              id="delete-account-confirmation"
              type="text"
              autoComplete="off"
              required
              aria-required="true"
              placeholder="DELETE"
              value={confirmationPhrase}
              onChange={(e) => setConfirmationPhrase(e.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.confirmationPhrase)}
              aria-describedby={
                fieldErrors.confirmationPhrase
                  ? "delete-account-confirmation-error"
                  : undefined
              }
              className="h-11 sm:h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:border-red-600 transition-all disabled:opacity-50"
            />
            {fieldErrors.confirmationPhrase && (
              <p
                id="delete-account-confirmation-error"
                role="alert"
                className="text-xs text-red-600 dark:text-red-400"
              >
                {fieldErrors.confirmationPhrase}
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {/* Cancel first (left), Destructive Confirm second (right) */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              ref={cancelButtonRef}
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
              variant="destructive"
              isLoading={isSubmitting}
              disabled={
                isSubmitting ||
                confirmationPhrase.trim() !== "DELETE" ||
                (hasPasswordAccount && password.length === 0)
              }
              className="min-h-[44px] sm:min-h-0"
            >
              Delete My Account
            </Button>
          </div>
        </form>
      </div>
    </ModalDialog>
  );
}

interface DeleteAccountSectionProps {
  userId: string;
  eligibility: AccountDeletionEligibility;
}

export function DeleteAccountSection({
  userId,
  eligibility,
}: DeleteAccountSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Card className="border-red-200/80 dark:border-red-900/60">
        <CardHeader className="border-red-100 dark:border-red-900/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
              <CardTitle as="h2">Danger Zone</CardTitle>
            </div>
            <Badge variant="rose" size="sm">
              Permanent Anonymization
            </Badge>
          </div>
          <CardDescription>
            Deleting your account permanently scrubs your personal details while
            retaining team project, task, comment, and audit log history under{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Deleted User
            </span>
            .
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {/* Eligibility Blockers Summary */}
          {eligibility.eligible ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Eligible for Account Deletion</p>
                <p className="text-emerald-700 dark:text-emerald-300/90">
                  You do not own any workspaces and have no active assigned tasks.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    Resolve the following requirements before deleting your account
                  </p>
                  <p className="text-amber-800/90 dark:text-amber-300/90">
                    Workspace ownership and active task responsibilities must be
                    handed off to keep team workflows intact.
                  </p>
                </div>
              </div>

              {eligibility.ownedTeams.length > 0 && (
                <div className="mt-1 space-y-2 border-t border-amber-200/70 dark:border-amber-800/50 pt-3">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    Owned Workspaces ({eligibility.ownedTeams.length})
                  </p>
                  <p className="text-amber-800/90 dark:text-amber-300/90">
                    Ownership must be transferred to another active member before
                    account deletion:
                  </p>
                  <ul className="space-y-2">
                    {eligibility.ownedTeams.map((team) => (
                      <li
                        key={team.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-amber-200/80 dark:border-amber-800/60 bg-white/80 dark:bg-slate-900/60 p-3"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {team.name}
                          </p>
                          {team.memberCount <= 1 ? (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                              You are the only member. Add another member before
                              transferring ownership.
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {team.memberCount} members &bull; Transfer ownership
                              in team settings
                            </p>
                          )}
                        </div>
                        <Link
                          href={`/teams/${team.id}/settings`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline shrink-0"
                        >
                          <span>Team Settings</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {eligibility.activeAssignedTaskCount > 0 && (
                <div className="mt-1 space-y-1 border-t border-amber-200/70 dark:border-amber-800/50 pt-3">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    Active Assigned Tasks ({eligibility.activeAssignedTaskCount})
                  </p>
                  <p className="text-amber-800/90 dark:text-amber-300/90">
                    You have {eligibility.activeAssignedTaskCount} active assigned{" "}
                    {eligibility.activeAssignedTaskCount === 1 ? "task" : "tasks"}{" "}
                    not marked Done. Reassign or complete them before deleting
                    your account.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
              <p className="font-medium text-slate-700 dark:text-slate-300">
                Permanently delete and anonymize this account
              </p>
              <p>
                All active sessions across devices will be terminated immediately.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="md"
              disabled={!eligibility.eligible}
              onClick={() => setDialogOpen(true)}
              leftIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              className="shrink-0"
            >
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeleteAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        userId={userId}
        hasPasswordAccount={eligibility.hasPasswordAccount}
      />
    </>
  );
}
