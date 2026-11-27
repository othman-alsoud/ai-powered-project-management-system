import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  ModalDialog,
  trapFocusOnKeyDown,
} from "@/components/ui/modal-dialog";

describe("ModalDialog accessibility primitive (Task 2)", () => {
  it("renders nothing when closed and renders ARIA dialog attributes when open", () => {
    const closedHtml = renderToString(
      <ModalDialog open={false} onClose={() => {}} labelledBy="dlg-title">
        <h2 id="dlg-title">Hidden</h2>
      </ModalDialog>,
    );
    expect(closedHtml).toBe("");

    const openHtml = renderToString(
      <ModalDialog open={true} onClose={() => {}} labelledBy="dlg-title">
        <h2 id="dlg-title">Create Item</h2>
        <button type="button">Cancel</button>
      </ModalDialog>,
    );
    expect(openHtml).toContain('role="dialog"');
    expect(openHtml).toContain('aria-modal="true"');
    expect(openHtml).toContain('aria-labelledby="dlg-title"');
    expect(openHtml).toContain("Create Item");
  });

  it("cycles Tab and Shift+Tab within focusable elements", () => {
    const first = { focus: vi.fn() } as unknown as HTMLElement;
    const middle = { focus: vi.fn() } as unknown as HTMLElement;
    const last = { focus: vi.fn() } as unknown as HTMLElement;
    const focusables = [first, middle, last];

    // Forward Tab from last -> wraps to first
    const tabForward = {
      key: "Tab",
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
    trapFocusOnKeyDown(tabForward, focusables, last);
    expect(tabForward.preventDefault).toHaveBeenCalledTimes(1);
    expect(first.focus).toHaveBeenCalledTimes(1);

    // Shift+Tab from first -> wraps to last
    const tabBackward = {
      key: "Tab",
      shiftKey: true,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
    trapFocusOnKeyDown(tabBackward, focusables, first);
    expect(tabBackward.preventDefault).toHaveBeenCalledTimes(1);
    expect(last.focus).toHaveBeenCalledTimes(1);
  });
});
