import Link from "next/link";
import { ArrowLeft, Mail, ShieldCheck, User as UserIcon } from "lucide-react";
import { requireAuthPage } from "@/features/auth/server";
import { getAccountDeletionEligibility } from "@/features/auth/account-server";
import { DeleteAccountSection } from "@/features/auth/components/delete-account-section";
import { TeamContextSync } from "@/features/teams/components/team-context-sync";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const instant = false;

export default async function AccountPage() {
  const user = await requireAuthPage("/sign-in");
  const eligibility = await getAccountDeletionEligibility(user.id);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <TeamContextSync currentUserId={user.id} />

      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo size="sm" href="/teams" />
          <Link
            href="/teams"
            className="inline-flex min-h-[44px] md:min-h-0 items-center gap-1.5 rounded-md px-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Workspaces</span>
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8"
      >
        {/* Page Header */}
        <div className="flex flex-col gap-2 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Account
            </span>
            <span aria-hidden="true" className="text-xs text-slate-500 dark:text-slate-400">/</span>
            <Badge variant="teal" size="sm">
              Active
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Account Settings
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Review your account identity and manage permanent account deletion.
          </p>
        </div>

        {/* Account Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle as="h2">Profile Summary</CardTitle>
            <CardDescription>
              Your registered account identity and connected sign-in methods.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-3.5">
              <UserIcon className="h-4 w-4 text-slate-600 dark:text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Name
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {user.name}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-3.5">
              <Mail className="h-4 w-4 text-slate-600 dark:text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Email
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-3.5">
              <ShieldCheck className="h-4 w-4 text-slate-600 dark:text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Sign-in Method
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {eligibility.authProviders.length > 0 ? (
                    eligibility.authProviders.map((provider) => (
                      <Badge key={provider} variant="slate" size="sm">
                        {provider}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="slate" size="sm">
                      Standard Account
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone / Account Deletion */}
        <DeleteAccountSection userId={user.id} eligibility={eligibility} />
      </main>
    </div>
  );
}
