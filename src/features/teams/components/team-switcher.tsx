"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ChevronsUpDown, Check, Plus, Building2 } from "lucide-react";
import type { TeamRole } from "@/generated/prisma/client";
import type { UserTeamSummary } from "../server";
import { switchTeamAction } from "../actions";
import { publishTeamSyncEvent } from "../lib/team-sync";
import { CreateTeamModal } from "./create-team-modal";
import { Badge } from "@/components/ui/badge";

interface TeamSwitcherProps {
  currentTeam: {
    id: string;
    name: string;
  };
  currentRole: TeamRole;
  userTeams: UserTeamSummary[];
  currentUserId: string;
  isCollapsed?: boolean;
}

export function TeamSwitcher({
  currentTeam,
  currentRole,
  userTeams,
  currentUserId,
  isCollapsed = false,
}: TeamSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Close dropdown on outside click or escape, and focus selected/first option on open
  useEffect(() => {
    if (!isOpen) return;

    const selectedIdx = userTeams.findIndex((t) => t.id === currentTeam.id);
    const targetIdx = selectedIdx >= 0 ? selectedIdx : 0;
    optionRefs.current[targetIdx]?.focus();

    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, userTeams, currentTeam.id]);

  function handleOptionKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (userTeams.length === 0) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") {
      nextIndex = (index + 1) % userTeams.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = (index - 1 + userTeams.length) % userTeams.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = userTeams.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      optionRefs.current[nextIndex]?.focus();
    }
  }

  async function handleSelectTeam(teamId: string) {
    if (teamId === currentTeam.id) {
      setIsOpen(false);
      return;
    }

    setIsOpen(false);
    setSwitchError(null);

    const result = await switchTeamAction(teamId);
    if (!result.success) {
      setSwitchError(result.error);
      router.refresh();
      return;
    }

    publishTeamSyncEvent({
      type: "TEAM_SWITCHED",
      userId: currentUserId,
      teamId: result.data.teamId,
    });

    router.push(`/teams/${result.data.teamId}`);
  }

  const roleBadgeVariants: Record<TeamRole, "teal" | "blue" | "slate"> = {
    OWNER: "teal",
    MANAGER: "blue",
    MEMBER: "slate",
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Switcher Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? "team-switcher-popover" : undefined}
        aria-label={
          isCollapsed
            ? `Switch workspace (current: ${currentTeam.name})`
            : undefined
        }
        title={isCollapsed ? currentTeam.name : undefined}
        className={`flex min-h-[44px] md:min-h-0 w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-all duration-150 hover:bg-slate-100 dark:hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer ${
          isCollapsed ? "justify-center" : "justify-between"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Team Initials Icon */}
          <div
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-700 to-teal-800 text-xs font-bold text-white shadow-xs"
          >
            {currentTeam.name ? (
              currentTeam.name.charAt(0).toUpperCase()
            ) : (
              <Building2 className="h-4 w-4" aria-hidden="true" />
            )}
          </div>

          {!isCollapsed && (
            <div className="min-w-0 flex-1 truncate">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {currentTeam.name}
                </span>
                <Badge variant={roleBadgeVariants[currentRole]} size="sm">
                  {currentRole}
                </Badge>
              </div>
              <p className="truncate text-[11px] text-slate-600 dark:text-slate-400">
                Workspace
              </p>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <ChevronsUpDown
            className={`h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400 transition-transform duration-150 ${
              isOpen ? "text-slate-700 dark:text-slate-200" : ""
            }`}
            aria-hidden="true"
          />
        )}
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div
          id="team-switcher-popover"
          className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Menu Header */}
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Workspaces
            </p>
            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
              {userTeams.length} total
            </span>
          </div>

          {/* Teams List */}
          <div
            role="listbox"
            aria-label="Workspaces list"
            className="max-h-56 overflow-y-auto py-1"
          >
            {userTeams.map((t, index) => {
              const isSelected = t.id === currentTeam.id;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectTeam(t.id)}
                  onKeyDown={(e) => handleOptionKeyDown(e, index)}
                  className={`flex min-h-[44px] md:min-h-0 w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer ${
                    isSelected
                      ? "bg-teal-50/80 dark:bg-teal-950/60 font-semibold text-teal-900 dark:text-teal-200"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 font-normal"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      aria-hidden="true"
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                        isSelected
                          ? "bg-teal-700 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate text-xs">{t.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={roleBadgeVariants[t.role]} size="sm">
                      {t.role}
                    </Badge>
                    {isSelected && (
                      <Check
                        className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Create Team Trigger */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsModalOpen(true);
              }}
              className="flex min-h-[44px] md:min-h-0 w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-teal-700 dark:text-teal-400 transition-colors hover:bg-teal-50/60 dark:hover:bg-teal-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer"
            >
              <Plus
                className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400"
                aria-hidden="true"
              />
              <span>Create new workspace</span>
            </button>
          </div>
        </div>
      )}

      {switchError && !isCollapsed && (
        <p
          role="alert"
          className="mt-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
        >
          {switchError}
        </p>
      )}

      {/* Create Team Dialog */}
      <CreateTeamModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentUserId={currentUserId}
      />
    </div>
  );
}
