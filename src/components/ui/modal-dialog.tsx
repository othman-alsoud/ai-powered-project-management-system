"use client";

import * as React from "react";

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Returns visible, keyboard-focusable elements inside a container in DOM order.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
  return candidates.filter((el) => {
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    const style =
      typeof window !== "undefined" ? window.getComputedStyle(el) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) {
      return false;
    }
    return true;
  });
}

/**
 * Cycles Tab and Shift+Tab within the provided list of focusable elements.
 */
export function trapFocusOnKeyDown(
  event: KeyboardEvent,
  focusables: readonly HTMLElement[],
  activeElement: Element | null,
  fallbackContainer?: HTMLElement | null,
): void {
  if (event.key !== "Tab") return;

  if (focusables.length === 0) {
    if (fallbackContainer) {
      event.preventDefault();
      fallbackContainer.focus();
    }
    return;
  }

  const first = focusables[0]!;
  const last = focusables[focusables.length - 1]!;
  const currentIndex = activeElement
    ? focusables.indexOf(activeElement as HTMLElement)
    : -1;

  if (event.shiftKey) {
    if (currentIndex <= 0) {
      event.preventDefault();
      last.focus();
    }
  } else if (currentIndex === -1 || currentIndex >= focusables.length - 1) {
    event.preventDefault();
    first.focus();
  }
}

export interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  ariaLabel?: string;
  disableClose?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  variant?: "center" | "bottom-sheet" | "drawer-left";
  wrapperClassName?: string;
  panelClassName?: string;
  children: React.ReactNode;
}

/**
 * Accessible modal dialog and drawer container implementing WCAG 2.1 AA
 * focus management: initial focus, Tab/Shift+Tab trapping, Escape handling,
 * backdrop dismissal, and focus restoration to the triggering control.
 */
export function ModalDialog({
  open,
  onClose,
  labelledBy,
  ariaLabel,
  disableClose = false,
  initialFocusRef,
  variant = "center",
  wrapperClassName = "",
  panelClassName = "",
  children,
}: ModalDialogProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  const disableCloseRef = React.useRef(disableClose);

  React.useEffect(() => {
    onCloseRef.current = onClose;
    disableCloseRef.current = disableClose;
  }, [onClose, disableClose]);

  React.useEffect(() => {
    if (!open || typeof document === "undefined") return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusInitial = () => {
      const panel = panelRef.current;
      if (!panel) return;

      const preferred = initialFocusRef?.current;
      if (preferred && panel.contains(preferred)) {
        preferred.focus();
        return;
      }

      const focusables = getFocusableElements(panel);
      if (focusables.length > 0) {
        focusables[0]!.focus();
      } else {
        panel.focus();
      }
    };

    const rafId =
      typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame(focusInitial)
        : null;
    if (rafId === null) {
      focusInitial();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!disableCloseRef.current) {
          event.preventDefault();
          event.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (event.key === "Tab" && panelRef.current) {
        const focusables = getFocusableElements(panelRef.current);
        trapFocusOnKeyDown(
          event,
          focusables,
          document.activeElement,
          panelRef.current,
        );
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      if (rafId !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(rafId);
      }
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;

      const prev = previousFocusRef.current;
      if (prev && prev.isConnected) {
        prev.focus();
      }
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  const wrapperLayout =
    variant === "drawer-left"
      ? "fixed inset-0 z-50 flex"
      : variant === "bottom-sheet"
        ? "fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        : "fixed inset-0 z-50 flex items-center justify-center p-4";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={!labelledBy ? ariaLabel : undefined}
      className={`${wrapperLayout} ${wrapperClassName}`.trim()}
    >
      {/* Backdrop (DESIGN_GUIDELINES.md §14.3: no blur) */}
      <div
        className="fixed inset-0 bg-slate-950/55 transition-opacity duration-150"
        onClick={() => {
          if (!disableClose) {
            onClose();
          }
        }}
        aria-hidden="true"
      />

      {/* Dialog Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative z-10 focus:outline-none ${panelClassName}`.trim()}
      >
        {children}
      </div>
    </div>
  );
}
