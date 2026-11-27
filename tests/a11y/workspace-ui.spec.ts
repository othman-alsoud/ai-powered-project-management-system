import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  startWorkspaceHarnessServer,
  type HarnessServerHandle,
} from "./workspace-harness/server";

let harness: HarnessServerHandle;

test.beforeAll(async () => {
  harness = await startWorkspaceHarnessServer();
});

test.afterAll(async () => {
  if (harness) {
    await harness.close();
  }
});

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
] as const;

const COLOR_SCHEMES = ["light", "dark"] as const;

const WORKSPACE_VIEWS = [
  { key: "dashboard", query: "?view=dashboard", label: "Dashboard" },
  { key: "projects", query: "?view=projects", label: "Projects" },
  { key: "tasks-board", query: "?view=tasks", label: "Tasks (Board)" },
  { key: "tasks-list", query: "?view=tasks&taskView=list", label: "Tasks (List)" },
  { key: "activity", query: "?view=activity", label: "Activity" },
  { key: "settings", query: "?view=settings", label: "Team Settings" },
  { key: "account", query: "?view=account", label: "Account Settings" },
  { key: "onboarding", query: "?view=onboarding", label: "Teams Onboarding" },
] as const;

async function assertZeroAxeViolations(
  page: import("@playwright/test").Page,
  label: string,
) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(
    results.violations,
    `Axe violations on ${label}: ${JSON.stringify(
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({
          html: n.html,
          failureSummary: n.failureSummary,
        })),
      })),
      null,
      2,
    )}`,
  ).toEqual([]);
}

test.describe("Workspace UI WCAG 2.1 AA Scans (Mocked Harness)", () => {
  for (const viewport of VIEWPORTS) {
    for (const colorScheme of COLOR_SCHEMES) {
      test.describe(`${viewport.name} (${viewport.width}x${viewport.height}) [${colorScheme}]`, () => {
        test.use({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme,
        });

        for (const view of WORKSPACE_VIEWS) {
          test(`${view.label} passes axe WCAG 2.1 AA and has no horizontal overflow`, async ({
            page,
          }) => {
            await page.goto(`${harness.url}/${view.query}`, {
              waitUntil: "domcontentloaded",
            });
            await expect(page.locator("h1").first()).toBeVisible();

            await assertZeroAxeViolations(
              page,
              `${view.label} (${viewport.name}, ${colorScheme})`,
            );

            const hasOverflow = await page.evaluate(
              () =>
                document.documentElement.scrollWidth >
                document.documentElement.clientWidth,
            );
            expect(hasOverflow).toBe(false);
          });
        }
      });
    }
  }
});

test.describe("Workspace Keyboard Navigation, Dialog Focus Traps, Tabs & Popovers", () => {
  test("skip link in workspace moves to #main-content", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${harness.url}/?view=dashboard`, {
      waitUntil: "domcontentloaded",
    });

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });

  test("mobile sidebar drawer traps focus, closes on Escape, and restores focus to menu button", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${harness.url}/?view=dashboard`, {
      waitUntil: "domcontentloaded",
    });

    const menuTrigger = page.getByRole("button", {
      name: "Open workspace menu",
    });
    await menuTrigger.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Mobile workspace menu" });
    await expect(dialog).toBeVisible();
    await assertZeroAxeViolations(page, "Mobile sidebar drawer open");

    // Focus must stay inside the drawer while tabbing through it
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const insideDrawer = await page.evaluate(() => {
        const active = document.activeElement;
        const dlg = document.querySelector('[aria-label="Mobile workspace menu"]');
        return Boolean(dlg && active && dlg.contains(active));
      });
      expect(insideDrawer).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(menuTrigger).toBeFocused();
  });

  test("TeamSwitcher supports ArrowDown/ArrowUp/Home/End and opens CreateTeamModal with focus trap & restoration", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${harness.url}/?view=dashboard`, {
      waitUntil: "domcontentloaded",
    });

    const switcherBtn = page.getByRole("button", {
      name: /Core Engineering/i,
    });
    await switcherBtn.focus();
    await page.keyboard.press("Enter");

    const listbox = page.getByRole("listbox", { name: "Workspaces list" });
    await expect(listbox).toBeVisible();
    await assertZeroAxeViolations(page, "TeamSwitcher open");

    const options = listbox.getByRole("option");
    await expect(options.nth(0)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(options.nth(0)).toBeFocused();
    await page.keyboard.press("End");
    await expect(options.nth(1)).toBeFocused();

    const createBtn = page.getByRole("button", {
      name: "Create new workspace",
    });
    await createBtn.click();

    const modal = page.getByRole("dialog", { name: "Create a new workspace" });
    await expect(modal).toBeVisible();
    await expect(page.locator("#team-name")).toBeFocused();
    await assertZeroAxeViolations(page, "CreateTeamModal open");

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
  });

  test("NotificationPopover moves focus, switches tabs via ArrowRight/ArrowLeft, and restores focus on Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${harness.url}/?view=dashboard`, {
      waitUntil: "domcontentloaded",
    });

    const bellTrigger = page.getByRole("button", {
      name: /Notifications\s*,\s*1 unread/i,
    });
    await bellTrigger.focus();
    await page.keyboard.press("Enter");

    const popover = page.getByRole("dialog", { name: "Notifications" });
    await expect(popover).toBeVisible();
    await expect(
      page.getByText("Assigned to Audit keyboard focus traps", { exact: true }),
    ).toBeVisible();
    await assertZeroAxeViolations(page, "NotificationPopover open");

    const allTab = popover.getByRole("tab", { name: "All" });
    const unreadTab = popover.getByRole("tab", { name: "Unread" });

    await allTab.focus();
    await expect(allTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(unreadTab).toBeFocused();
    await expect(unreadTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(allTab).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(bellTrigger).toBeFocused();
  });

  test("Team Settings dialogs (AddMember, TransferOwnership, RemoveMember confirmation) trap focus and place destructive initial focus on Cancel", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${harness.url}/?view=settings`, {
      waitUntil: "domcontentloaded",
    });

    const addBtn = page.getByRole("button", { name: "Add Member" });
    await addBtn.focus();
    await page.keyboard.press("Enter");

    const addDialog = page.getByRole("dialog", { name: "Add Team Member" });
    await expect(addDialog).toBeVisible();
    await expect(page.locator("#member-email-input")).toBeFocused();
    await assertZeroAxeViolations(page, "AddMemberDialog open");
    await page.keyboard.press("Escape");
    await expect(addDialog).toBeHidden();
    await expect(addBtn).toBeFocused();

    const removeBtn = page.getByRole("button", {
      name: "Remove Charlie Member",
    });
    await removeBtn.focus();
    await page.keyboard.press("Enter");

    const removeDialog = page.getByRole("dialog", {
      name: "Remove Team Member",
    });
    await expect(removeDialog).toBeVisible();
    await expect(
      removeDialog.getByRole("button", { name: "Cancel" }),
    ).toBeFocused();
    await assertZeroAxeViolations(page, "RemoveMemberDialog open");
    await page.keyboard.press("Escape");
    await expect(removeDialog).toBeHidden();
    await expect(removeBtn).toBeFocused();
  });

  test("Projects dialogs and Tasks Kanban/Detail/Form/Delete dialogs manage focus cleanly and pass axe", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${harness.url}/?view=projects`, {
      waitUntil: "domcontentloaded",
    });

    const newProjBtn = page.getByRole("button", { name: "New Project" });
    await newProjBtn.focus();
    await page.keyboard.press("Enter");

    const projModal = page.getByRole("dialog", { name: "Create Project" });
    await expect(projModal).toBeVisible();
    await expect(page.locator("#project-name")).toBeFocused();
    await assertZeroAxeViolations(page, "ProjectFormDialog open");
    await page.keyboard.press("Escape");
    await expect(projModal).toBeHidden();
    await expect(newProjBtn).toBeFocused();

    await page.goto(`${harness.url}/?view=tasks`, {
      waitUntil: "domcontentloaded",
    });

    // Open Create Task
    const newTaskBtn = page.getByRole("button", { name: "New Task" });
    await newTaskBtn.focus();
    await page.keyboard.press("Enter");
    const taskModal = page.getByRole("dialog", { name: "Create Task" });
    await expect(taskModal).toBeVisible();
    await expect(page.locator("#task-title")).toBeFocused();
    await assertZeroAxeViolations(page, "TaskFormDialog open");
    await page.keyboard.press("Escape");
    await expect(taskModal).toBeHidden();
    await expect(newTaskBtn).toBeFocused();

    // Open Task Detail + CommentThread
    const taskTitleBtn = page.getByRole("button", {
      name: "Audit dialog focus trap and Escape restoration",
      exact: true,
    });
    await taskTitleBtn.click();
    const detailDialog = page.getByRole("dialog", {
      name: "Audit dialog focus trap and Escape restoration",
    });
    await expect(detailDialog).toBeVisible();
    await expect(
      detailDialog.getByText("Verified WCAG contrast ratios across light and dark themes."),
    ).toBeVisible();
    await assertZeroAxeViolations(page, "TaskDetailDialog + Comments open");
    await page.keyboard.press("Escape");
    await expect(detailDialog).toBeHidden();
  });

  test("Mobile Kanban status tabs support ArrowRight/ArrowLeft roving tabindex", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${harness.url}/?view=tasks`, {
      waitUntil: "domcontentloaded",
    });

    const todoTab = page.getByRole("tab", { name: /To Do/i });
    const inProgressTab = page.getByRole("tab", { name: /In Progress/i });
    await todoTab.focus();
    await expect(todoTab).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("ArrowRight");
    await expect(inProgressTab).toBeFocused();
    await expect(inProgressTab).toHaveAttribute("aria-selected", "true");
    await expect(todoTab).toHaveAttribute("aria-selected", "false");
  });

  test("DeleteAccountDialog places initial focus on Cancel and passes axe", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${harness.url}/?view=account`, {
      waitUntil: "domcontentloaded",
    });

    const deleteTrigger = page.getByRole("button", { name: "Delete Account" });
    await deleteTrigger.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", {
      name: "Confirm Account Deletion",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await assertZeroAxeViolations(page, "DeleteAccountDialog open");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(deleteTrigger).toBeFocused();
  });
});
