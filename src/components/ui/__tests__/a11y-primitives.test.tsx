import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import * as fs from "node:fs";
import * as path from "node:path";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

import RootLayout from "@/app/layout";
import Home from "@/app/page";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";

describe("Accessibility Primitives (Task 1)", () => {
  it("renders skip-to-main-content link in RootLayout and #main-content in Home", () => {
    const layoutHtml = renderToString(
      <RootLayout>
        <div />
      </RootLayout>,
    );
    expect(layoutHtml).toContain('href="#main-content"');
    expect(layoutHtml).toContain("Skip to main content");

    const homeHtml = renderToString(<Home />);
    expect(homeHtml).toContain('id="main-content"');
    expect(homeHtml).not.toContain("bg-teal-600");
  });

  it("includes prefers-reduced-motion rules in globals.css", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "src/app/globals.css"),
      "utf-8",
    );
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("renders accessible Button contrast, busy state, and responsive icon target sizing", () => {
    const primaryHtml = renderToString(<Button>Save</Button>);
    expect(primaryHtml).toContain("bg-teal-700");
    expect(primaryHtml).not.toContain("bg-teal-600");
    expect(primaryHtml).not.toContain("focus-visible:ring-teal-500 ");

    const loadingHtml = renderToString(<Button isLoading>Saving</Button>);
    expect(loadingHtml).toContain('aria-busy="true"');
    expect(loadingHtml).toContain('aria-hidden="true"');

    const iconHtml = renderToString(
      <Button size="icon" aria-label="Edit">
        <span>E</span>
      </Button>,
    );
    expect(iconHtml).toContain("h-11 w-11");
  });

  it("supports semantic heading level prop on CardTitle", () => {
    const h2Html = renderToString(<CardTitle as="h2">Profile Summary</CardTitle>);
    expect(h2Html).toMatch(/^<h2\b/);
    const defaultHtml = renderToString(<CardTitle>Default</CardTitle>);
    expect(defaultHtml).toMatch(/^<h3\b/);
  });
});
