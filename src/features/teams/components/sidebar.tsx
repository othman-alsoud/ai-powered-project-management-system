"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { TeamRole } from "@/generated/prisma/client";
import { authClient } from "@/lib/auth-client";
import type { UserTeamSummary } from "../server";
import { TeamSwitcher } from "./team-switcher";

interface WorkspaceSidebarProps {
  currentTeam: {
    id: string;
    name: string;
  };
  currentRole: TeamRole;
  userTeams: UserTeamSummary[];
  currentUser: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

export function WorkspaceSidebar({
  currentTeam,
  currentRole,
  userTeams,
  currentUser,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Close mobile drawer on route change (React-recommended state adjustment during render)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsMobileOpen(false);
  }

  // Handle escape to close mobile drawer
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsMobileOpen(false);
      }
    }
    if (isMobileOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen]);

  const navLinks = [
    {
      label: "Dashboard",
      href: `/teams/${currentTeam.id}`,
      exact: true,
      icon: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      ),
    },
    {
      label: "Projects",
      href: `/teams/${currentTeam.id}/projects`,
      exact: false,
      icon: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zM8 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H9a1 1 0 01-1-1V4zM15 3a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1h-2z" />
        </svg>
      ),
    },
    {
      label: "Tasks",
      href: `/teams/${currentTeam.id}/tasks`,
      exact: false,
      icon: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: "Settings",
      href: `/teams/${currentTeam.id}/settings`,
      exact: false,
      icon: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[--color-bg-surface]">
      {/* Top: Team Switcher & Nav items */}
      <div className="flex flex-col gap-4 p-3">
        {/* Team Switcher */}
        <TeamSwitcher
          currentTeam={currentTeam}
          currentRole={currentRole}
          userTeams={userTeams}
          isCollapsed={isCollapsed}
        />

        {/* Divider */}
        <hr className="border-[--color-border-subtle]" />

        {/* Navigation list */}
        <nav aria-label="Team workspace navigation" className="flex flex-col gap-1">
          {navLinks.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors duration-100 ${
                  isActive
                    ? "bg-[--color-bg-hover] font-medium text-[--color-text-primary]"
                    : "font-normal text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
                } ${isCollapsed ? "justify-center" : ""}`}
              >
                {item.icon}
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Rail toggle button & User Menu */}
      <div className="border-t border-[--color-border-subtle] p-3">
        {/* Desktop Rail Toggle */}
        <div className="hidden md:flex justify-end pb-2">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded p-1 text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
          >
            <svg
              className={`h-4 w-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* User Card */}
        <div
          className={`flex items-center gap-2.5 rounded-lg p-1.5 ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[--color-bg-hover] border border-[--color-border-subtle] text-xs font-semibold text-[--color-text-primary]">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1 truncate">
                <p className="truncate text-xs font-medium text-[--color-text-primary]">
                  {currentUser.name}
                </p>
                <p className="truncate text-[10px] text-[--color-text-muted]">
                  {currentUser.email}
                </p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="rounded p-1 text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-destructive]"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm11 4a1 1 0 10-2 0v2H7a1 1 0 100 2h5v2a1 1 0 102 0V7z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header (< 768px) per Approved Decision 2 */}
      <header className="flex h-14 w-full items-center justify-between border-b border-[--color-border-subtle] bg-[--color-bg-surface] px-4 md:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Open workspace menu"
            className="rounded p-1.5 text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <span className="font-semibold text-sm text-[--color-text-primary]">
            {currentTeam.name}
          </span>
        </div>
      </header>

      {/* Mobile Slide-out Drawer (< 768px) */}
      {isMobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile workspace menu"
          className="fixed inset-0 z-50 flex md:hidden"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />

          {/* 240px Drawer */}
          <div className="relative z-10 w-60 h-full border-r border-[--color-border-subtle] shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar (>= 768px) */}
      <aside
        className={`hidden md:flex flex-col border-r border-[--color-border-subtle] transition-[width] duration-150 ${
          isCollapsed ? "w-[60px]" : "w-[240px]"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
