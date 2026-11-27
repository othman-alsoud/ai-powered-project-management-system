"use client";

import { useRef, useState } from "react";
import type { TeamMemberSummary, TeamRole } from "@/features/teams/server";
import { updateMemberRoleAction, removeMemberAction } from "@/features/teams/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { AlertTriangle, Clock, X } from "lucide-react";

interface TeamMembersListProps {
  teamId: string;
  members: TeamMemberSummary[];
  currentUserRole: TeamRole;
  currentUserId: string;
  onMemberUpdated?: () => void;
}

const ROLE_BADGE_VARIANTS: Record<TeamRole, "teal" | "blue" | "slate"> = {
  OWNER: "teal",
  MANAGER: "blue",
  MEMBER: "slate",
};

export function TeamMembersList({
  teamId,
  members,
  currentUserRole,
  currentUserId,
  onMemberUpdated,
}: TeamMembersListProps) {
  const cancelRemoveRef = useRef<HTMLButtonElement>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<TeamMemberSummary | null>(null);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const [isRemoving, setIsRemoving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isOwner = currentUserRole === "OWNER";
  const canManage = isOwner;

  const handleRoleChange = async (memberId: string, newRole: "MANAGER" | "MEMBER") => {
    setIsUpdating((prev) => ({ ...prev, [memberId]: true }));
    setError(null);

    const result = await updateMemberRoleAction({
      teamId,
      userId: memberId,
      role: newRole,
    });

    setIsUpdating((prev) => ({ ...prev, [memberId]: false }));

    if (result.success) {
      setSuccess("Member role updated successfully.");
      setTimeout(() => setSuccess(null), 3000);
      if (onMemberUpdated) {
        onMemberUpdated();
      }
    } else {
      setError(result.error || "Failed to update role.");
    }
  };

  const executeRemove = async (memberId: string) => {
    setIsRemoving((prev) => ({ ...prev, [memberId]: true }));
    setError(null);

    const result = await removeMemberAction({
      teamId,
      userId: memberId,
    });

    setIsRemoving((prev) => ({ ...prev, [memberId]: false }));

    if (result.success) {
      setConfirmRemoveMember(null);
      setSuccess("Member removed successfully.");
      setTimeout(() => setSuccess(null), 3000);
      if (onMemberUpdated) {
        onMemberUpdated();
      }
    } else {
      setConfirmRemoveMember(null);
      setError(result.error || "Failed to remove member.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
        >
          {success}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th
                  scope="col"
                  className="px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                >
                  Member
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                >
                  Role
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                >
                  Joined
                </th>
                {canManage && (
                  <th
                    scope="col"
                    className="px-5 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {members.map((member) => {
                const isCurrentUser = member.userId === currentUserId;
                const isOwnerMember = member.role === "OWNER";
                const canEditRole = canManage && !isOwnerMember && !isCurrentUser;
                const canRemove = canManage && !isOwnerMember && !isCurrentUser;

                return (
                  <tr
                    key={member.userId}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors duration-100"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700 border border-teal-200/60 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/60"
                        >
                          {member.name ? member.name.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {member.name}
                            {isCurrentUser && (
                              <span className="ml-1.5 text-xs text-slate-600 dark:text-slate-400">
                                (You)
                              </span>
                            )}
                          </p>
                          {isOwnerMember && (
                            <p className="text-[10px] text-teal-700 dark:text-teal-400 font-medium">
                              Workspace Owner
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {member.email}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      {canEditRole ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(
                              member.userId,
                              e.target.value as "MANAGER" | "MEMBER"
                            )
                          }
                          disabled={isUpdating[member.userId]}
                          aria-label={`Change role for ${member.name}`}
                          className="h-11 md:h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-700 dark:focus:ring-teal-400 cursor-pointer disabled:opacity-50"
                        >
                          <option value="MEMBER">Member</option>
                          <option value="MANAGER">Manager</option>
                        </select>
                      ) : (
                        <Badge variant={ROLE_BADGE_VARIANTS[member.role]} size="sm">
                          {member.role}
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {new Date(member.joinedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </td>
                    {canManage && (
                      <td className="px-5 py-3.5 text-right">
                        {canRemove &&
                        !isUpdating[member.userId] &&
                        !isRemoving[member.userId] ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmRemoveMember(member)}
                            aria-label={`Remove ${member.name}`}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 text-xs min-h-[44px] md:min-h-[28px] md:h-7 px-2.5"
                          >
                            Remove
                          </Button>
                        ) : isRemoving[member.userId] ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            aria-label={`Removing ${member.name}`}
                            className="opacity-50 min-h-[44px] md:min-h-[28px] md:h-7 px-2.5"
                          >
                            <Clock className="h-3 w-3 animate-spin" aria-hidden="true" />
                          </Button>
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirmRemoveMember && (
        <ModalDialog
          open={true}
          onClose={() => {
            if (!isRemoving[confirmRemoveMember.userId]) {
              setConfirmRemoveMember(null);
            }
          }}
          labelledBy="remove-member-dialog-title"
          disableClose={Boolean(isRemoving[confirmRemoveMember.userId])}
          initialFocusRef={cancelRemoveRef}
          variant="bottom-sheet"
          wrapperClassName="z-50 p-0 sm:p-4"
          panelClassName="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-900/60">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="remove-member-dialog-title"
                    className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100"
                  >
                    Remove Team Member
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Revoke access to this workspace.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmRemoveMember(null)}
                disabled={Boolean(isRemoving[confirmRemoveMember.userId])}
                aria-label="Close dialog"
                className="inline-flex min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] items-center justify-center rounded-lg p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to remove{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {confirmRemoveMember.name}
              </span>{" "}
              ({confirmRemoveMember.email}) from the team? They will immediately lose
              access to team projects and tasks.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                ref={cancelRemoveRef}
                type="button"
                variant="outline"
                onClick={() => setConfirmRemoveMember(null)}
                disabled={Boolean(isRemoving[confirmRemoveMember.userId])}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => executeRemove(confirmRemoveMember.userId)}
                isLoading={Boolean(isRemoving[confirmRemoveMember.userId])}
              >
                Remove Member
              </Button>
            </div>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}
