"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import type { TeamRole } from "@/generated/prisma/client";
import type { UserTeamSummary } from "../server";
import { switchTeamAction } from "../actions";
import { CreateTeamModal } from "./create-team-modal";

interface TeamSwitcherProps {
  currentTeam: {
    id: string;
    name: string;
  };
  currentRole: TeamRole;
  userTeams: UserTeamSummary[];
  isCollapsed?: boolean;
}

export function TeamSwitcher({
  currentTeam,
  currentRole,
  userTeams,
  isCollapsed = false,
}: TeamSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleSelectTeam(teamId: string) {
    if (teamId === currentTeam.id) {
      setIsOpen(false);
      return;
    }

    setIsOpen(false);
    await switchTeamAction(teamId);
    router.push(`/teams/${teamId}`);
    router.refresh();
  }

  const roleBadgeColors: Record<TeamRole, string> = {
    OWNER: "bg-[--color-accent-primary]/15 text-[--color-accent-primary] border-[--color-accent-primary]/30",
    MANAGER: "bg-[--color-accent-secondary]/15 text-[--color-accent-secondary] border-[--color-accent-secondary]/30",
    MEMBER: "bg-[--color-bg-hover] text-[--color-text-secondary] border-[--color-border-subtle]",
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Switcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-[--color-bg-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] ${
          isCollapsed ? "justify-center" : "justify-between"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Team Initials Icon */}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[--color-accent-primary] text-xs font-semibold text-[--color-text-on-accent]">
            {currentTeam.name.charAt(0).toUpperCase()}
          </div>

          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-[--color-text-primary]">
                  {currentTeam.name}
                </span>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.2 text-[10px] font-medium uppercase tracking-wider ${roleBadgeColors[currentRole]}`}
                >
                  {currentRole}
                </span>
              </div>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <svg
            className={`h-4 w-4 shrink-0 text-[--color-text-muted] transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Teams"
          className="absolute left-0 top-full z-40 mt-1 w-64 rounded-lg border border-[--color-border-subtle] bg-[--color-bg-surface] py-1 shadow-lg"
        >
          <div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-[--color-text-muted]">
            Teams
          </div>

          <div className="max-h-56 overflow-y-auto py-0.5">
            {userTeams.map((t) => {
              const isSelected = t.id === currentTeam.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectTeam(t.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-[--color-bg-hover] ${
                    isSelected ? "bg-[--color-bg-hover] font-medium" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[--color-accent-primary]/20 text-[10px] font-bold text-[--color-accent-primary]">
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate text-[--color-text-primary]">{t.name}</span>
                  </div>

                  <span
                    className={`ml-2 shrink-0 rounded border px-1.5 py-0.2 text-[9px] font-medium uppercase tracking-wider ${roleBadgeColors[t.role]}`}
                  >
                    {t.role}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-[--color-border-subtle] mt-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsModalOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[--color-accent-primary] transition-colors hover:bg-[--color-bg-hover]"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Create new team</span>
            </button>
          </div>
        </div>
      )}

      {/* Creation Dialog */}
      <CreateTeamModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
