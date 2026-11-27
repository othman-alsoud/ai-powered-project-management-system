import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
] as const;

const COLOR_SCHEMES = ["light", "dark"] as const;

const PUBLIC_ROUTES = [
  { path: "/", title: "Landing" },
  { path: "/sign-in", title: "Sign In" },
  { path: "/sign-up", title: "Sign Up" },
  { path: "/forgot-password", title: "Forgot Password" },
  { path: "/reset-password?token=test-token", title: "Reset Password" },
  { path: "/verify-email", title: "Verify Email (Missing Token)" },
] as const;

test.describe("WCAG 2.1 AA Automated Accessibility Audit", () => {
  for (const viewport of VIEWPORTS) {
    for (const colorScheme of COLOR_SCHEMES) {
      test.describe(`${viewport.name} (${viewport.width}x${viewport.height}) [${colorScheme}]`, () => {
        test.use({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme,
        });

        for (const route of PUBLIC_ROUTES) {
          test(`${route.title} (${route.path}) has 0 axe WCAG 2.1 AA violations and no horizontal overflow`, async ({
            page,
          }) => {
            await page.goto(route.path, { waitUntil: "networkidle" });

            // Wait for any initial Suspense fallback to resolve to main content heading
            await expect(page.locator("h1").first()).toBeVisible();

            const results = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
              .analyze();

            expect(
              results.violations,
              `Axe violations on ${route.path} (${viewport.name}, ${colorScheme}): ${JSON.stringify(
                results.violations.map((v) => ({
                  id: v.id,
                  impact: v.impact,
                  description: v.description,
                  nodes: v.nodes.map((n) => n.html),
                })),
                null,
                2,
              )}`,
            ).toEqual([]);

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

  test("unauthenticated access to /teams redirects to /sign-in cleanly", async ({
    page,
  }) => {
    await page.goto("/teams", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Welcome back",
    );
  });

  test("skip link works via keyboard and reaches #main-content", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/sign-in", { waitUntil: "networkidle" });

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });

  test("keyboard-only sign-in form interaction toggles password visibility and announces validation errors", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/sign-in", { waitUntil: "networkidle" });

    const passwordInput = page.locator("#password");
    const toggleBtn = page.getByRole("button", { name: "Show password" });

    await expect(passwordInput).toHaveAttribute("type", "password");
    await toggleBtn.focus();
    await page.keyboard.press("Enter");

    await expect(passwordInput).toHaveAttribute("type", "text");
    await expect(
      page.getByRole("button", { name: "Hide password" }),
    ).toHaveAttribute("aria-pressed", "true");

    const submitBtn = page.getByRole("button", { name: "Sign in to Workspace" });
    await submitBtn.focus();
    await page.keyboard.press("Enter");

    await expect(page.locator("#email-error")).toBeVisible();
    await expect(page.locator("#email-error")).toHaveAttribute("role", "alert");
    await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#password-error")).toBeVisible();
    await expect(page.locator("#password")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("mobile password toggle and key controls meet >= 44x44px touch target requirement", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/sign-in", { waitUntil: "networkidle" });

    const toggleBox = await page
      .getByRole("button", { name: "Show password" })
      .boundingBox();
    expect(toggleBox).not.toBeNull();
    expect(toggleBox!.width).toBeGreaterThanOrEqual(44);
    expect(toggleBox!.height).toBeGreaterThanOrEqual(44);
  });

  test("prefers-reduced-motion disables animations and transitions", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/sign-in", { waitUntil: "networkidle" });

    const durations = await page.evaluate(() => {
      const btn = document.querySelector("button[type='submit']");
      if (!btn) return null;
      const styles = window.getComputedStyle(btn);
      return {
        animationDuration: styles.animationDuration,
        transitionDuration: styles.transitionDuration,
      };
    });

    expect(durations).not.toBeNull();
    expect(parseFloat(durations!.animationDuration)).toBeLessThanOrEqual(0.01);
    expect(parseFloat(durations!.transitionDuration)).toBeLessThanOrEqual(0.01);
  });
});
