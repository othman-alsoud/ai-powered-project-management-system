"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  History,
  Settings,
  ChevronLeft,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import type { TeamRole } from "@/generated/prisma/client";
import {
  NotificationBellTrigger,
  NotificationPopover,
  useNotificationCenter,
} from "@/features/notifications/components/notification-bell";
import { authClient } from "@/lib/auth-client";
import type { UserTeamSummary } from "../server";
import { publishTeamSyncEvent } from "../lib/team-sync";
import { TeamContextSync } from "./team-context-sync";
import { TeamSwitcher } from "./team-switcher";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { ModalDialog } from "@/components/ui/modal-dialog";

interface WorkspaceSidebarProps {
  currentTeam: {
    id: string;
    name: string;
  };
  currentRole: TeamRole;
  userTeams: UserTeamSummary[];
  initialUnreadNotificationsCount?: number;
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
  initialUnreadNotificationsCount = 0,
  currentUser,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const notificationCenter = useNotificationCenter(
    initialUnreadNotificationsCount,
  );

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Close mobile drawer on route change (React-recommended state adjustment during render)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsMobileOpen(false);
  }

  const navLinks: Array<{
    label: string;
    href: string;
    exact: boolean;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    {
      label: "Dashboard",
      href: `/teams/${currentTeam.id}`,
      exact: true,
      icon: <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      label: "Projects",
      href: `/teams/${currentTeam.id}/projects`,
      exact: false,
      icon: <FolderKanban className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      label: "Tasks",
      href: `/teams/${currentTeam.id}/tasks`,
      exact: false,
      icon: <CheckSquare className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      label: "Activity",
      href: `/teams/${currentTeam.id}/activity`,
      exact: false,
      icon: <History className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      label: "Settings",
      href: `/teams/${currentTeam.id}/settings`,
      exact: false,
      icon: <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
  ];

  async function handleSignOut() {
    await authClient.signOut();
    publishTeamSyncEvent({
      type: "AUTH_SIGNED_OUT",
      userId: currentUser.id,
    });
    router.push("/sign-in");
    router.refresh();
  }

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 select-none">
      {/* Top: Team Switcher & Nav items */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        {/* Team Switcher */}
        <div className="shrink-0">
          <TeamSwitcher
            currentTeam={currentTeam}
            currentRole={currentRole}
            userTeams={userTeams}
            currentUserId={currentUser.id}
            isCollapsed={isCollapsed}
          />
        </div>

        {/* Hairline Divider */}
        <div className="h-px w-full shrink-0 bg-slate-200 dark:bg-slate-800" />

        {/* Navigation list */}
        <nav
          aria-label="Team workspace navigation"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
        >
          {navLinks.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                aria-label={isCollapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                className={`group flex min-h-[44px] md:min-h-0 items-center gap-3 rounded-lg py-2 text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 ${
                  isActive
                    ? "bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-semibold border-l-2 border-teal-700 dark:border-teal-400 pl-2.5 pr-3 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 font-medium px-3"
                } ${isCollapsed ? "justify-center px-2" : "justify-between"}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`transition-colors ${
                      isActive
                        ? "text-teal-700 dark:text-teal-400"
                        : "text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200"
                    }`}
                  >
                    {item.icon}
                  </span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!isCollapsed && item.badge && (
                  <span className="rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:text-slate-400">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Notification Bell, Rail toggle button & User Menu */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-2">
        {/* Desktop/Tablet Notification Bell & Rail Toggle */}
        <div
          className={`hidden md:flex items-center gap-1.5 ${
            isCollapsed ? "flex-col" : "justify-between"
          }`}
        >
          <div className={isCollapsed ? "" : "flex-1 min-w-0"}>
            <NotificationBellTrigger
              unreadCount={notificationCenter.unreadCount}
              isOpen={notificationCenter.isOpen}
              popoverId={notificationCenter.popoverId}
              variant={isCollapsed ? "desktop-collapsed" : "desktop-expanded"}
              onClick={(e) =>
                notificationCenter.togglePopover(
                  isCollapsed ? "desktop-collapsed" : "desktop-expanded",
                  e.currentTarget,
                )
              }
            />
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
            className="rounded-md p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors hover:bg-slate-200/60 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer shrink-0"
          >
            <ChevronLeft
              className={`h-4 w-4 transition-transform duration-150 ${isCollapsed ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* User Card */}
        <div
          className={`flex items-center gap-2.5 rounded-lg p-1.5 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 hover:bg-white dark:hover:bg-slate-850 transition-colors ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          <Link
            href="/account"
            title="Account settings"
            aria-label={isCollapsed ? "Account settings" : undefined}
            className="flex min-h-[44px] md:min-h-0 items-center gap-2.5 min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400"
          >
            <div
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-950 text-xs font-semibold text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
            >
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1 truncate">
                <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {currentUser.name}
                  <span className="sr-only"> — Account settings</span>
                </p>
                <p className="truncate text-[10px] text-slate-600 dark:text-slate-400">
                  {currentUser.email}
                </p>
              </div>
            )}
          </Link>

          {!isCollapsed && (
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out of account"
              aria-label="Sign out"
              className="inline-flex min-h-[44px] min-w-[44px] md:min-h-[32px] md:min-w-[32px] items-center justify-center rounded-md p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 dark:focus-visible:ring-red-400 cursor-pointer shrink-0"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <TeamContextSync
        currentTeamId={currentTeam.id}
        currentRole={currentRole}
        currentUserId={currentUser.id}
      />
      {/* Mobile Top Header (< 768px) per Approved Decision 2 */}
      <header className="flex h-14 w-full items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 md:hidden z-30">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Open workspace menu"
            aria-expanded={isMobileOpen}
            aria-controls="mobile-workspace-drawer"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1.5 text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <Logo size="sm" showWordmark={false} href="" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
            {currentTeam.name}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <NotificationBellTrigger
            unreadCount={notificationCenter.unreadCount}
            isOpen={notificationCenter.isOpen}
            popoverId={notificationCenter.popoverId}
            variant="mobile"
            onClick={(e) =>
              notificationCenter.togglePopover("mobile", e.currentTarget)
            }
          />
          <Badge variant="teal" size="sm">
            {currentRole}
          </Badge>
        </div>
      </header>

      {/* Mobile Slide-out Drawer (< 768px) */}
      <ModalDialog
        open={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        ariaLabel="Mobile workspace menu"
        variant="drawer-left"
        wrapperClassName="z-50 md:hidden"
        panelClassName="w-60 h-full border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col bg-white dark:bg-slate-900 animate-in slide-in-from-left duration-200"
      >
        <div
          id="mobile-workspace-drawer"
          className="flex h-full flex-col"
        >
          <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Workspace
            </span>
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Close menu"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sidebarContent}
          </div>
        </div>
      </ModalDialog>

      {/* Desktop Persistent Sidebar (>= 768px) */}
      <aside
        className={`hidden md:flex md:h-full md:min-h-0 md:shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 transition-[width] duration-200 ease-in-out ${
          isCollapsed ? "w-[60px]" : "w-[240px]"
        }`}
      >
        {sidebarContent}
      </aside>

      {notificationCenter.isOpen && (
        <NotificationPopover
          id={notificationCenter.popoverId}
          popoverRef={notificationCenter.popoverRef}
          items={notificationCenter.items}
          unreadCount={notificationCenter.unreadCount}
          filter={notificationCenter.filter}
          hasMore={notificationCenter.hasMore}
          isLoading={notificationCenter.isLoading}
          isLoadingMore={notificationCenter.isLoadingMore}
          isMarkingAll={notificationCenter.isMarkingAll}
          pendingItemIds={notificationCenter.pendingItemIds}
          error={notificationCenter.error}
          unavailableNotice={notificationCenter.unavailableNotice}
          nowMs={notificationCenter.nowMs}
          placement={notificationCenter.placement}
          onClose={() => notificationCenter.closePopover(true)}
          onFilterChange={notificationCenter.changeFilter}
          onMarkAllRead={notificationCenter.markAllRead}
          onMarkRead={notificationCenter.markRead}
          onOpenItem={notificationCenter.openItem}
          onLoadMore={notificationCenter.loadMore}
          onRetry={notificationCenter.retry}
        />
      )}
    </>
  );
}
