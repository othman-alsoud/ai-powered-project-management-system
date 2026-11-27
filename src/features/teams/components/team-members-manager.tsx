"use client";

import { useState } from "react";
import type { TeamMemberSummary, TeamRole } from "@/features/teams/server";
import { publishTeamSyncEvent } from "@/features/teams/lib/team-sync";
import { TeamMembersList } from "./team-members-list";
import { AddMemberDialog } from "./add-member-dialog";
import { TransferOwnershipDialog } from "./transfer-ownership-dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, Shuffle } from "lucide-react";

interface TeamMembersManagerProps {
  teamId: string;
  initialMembers: TeamMemberSummary[];
  currentUserRole: TeamRole;
  currentUserId: string;
}

export function TeamMembersManager({
  teamId,
  initialMembers,
  currentUserRole,
  currentUserId,
}: TeamMembersManagerProps) {
  const [members, setMembers] = useState<TeamMemberSummary[]>(initialMembers);
  const [prevInitialMembers, setPrevInitialMembers] = useState<TeamMemberSummary[]>(initialMembers);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);

  const isOwner = currentUserRole === "OWNER";

  // Sync members with fresh RSC props revalidated by member Server Actions
  if (prevInitialMembers !== initialMembers) {
    setPrevInitialMembers(initialMembers);
    setMembers(initialMembers);
  }

  const refreshMembers = () => {
    publishTeamSyncEvent({
      type: "MEMBERSHIP_CHANGED",
      userId: currentUserId,
      teamId,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Workspace Roster ({members.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isOwner
              ? "You have full owner permissions to manage members, assign roles, and transfer ownership."
              : "Active workspace members and their assigned roles."}
          </p>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTransferDialogOpen(true)}
              leftIcon={<Shuffle className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />}
            >
              Transfer Ownership
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setAddMemberDialogOpen(true)}
              leftIcon={<UserPlus className="h-3.5 w-3.5" />}
            >
              Add Member
            </Button>
          </div>
        )}
      </div>

      {/* Members List Table */}
      <TeamMembersList
        teamId={teamId}
        members={members}
        currentUserRole={currentUserRole}
        currentUserId={currentUserId}
        onMemberUpdated={refreshMembers}
      />

      {/* Add Member Dialog */}
      <AddMemberDialog
        open={addMemberDialogOpen}
        onOpenChange={setAddMemberDialogOpen}
        teamId={teamId}
        onMemberAdded={refreshMembers}
      />

      {/* Transfer Ownership Dialog */}
      <TransferOwnershipDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        teamId={teamId}
        members={members}
        currentUserId={currentUserId}
        onOwnershipTransferred={refreshMembers}
      />
    </div>
  );
}
