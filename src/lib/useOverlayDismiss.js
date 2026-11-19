// Shared overlay dismissal + focus management for modals, sheets and the mobile
// chat thread. Registering here routes BOTH the Android hardware back button and
// the Escape key (both consumed via backStack) to the overlay's close callback,
// and — when enabled — moves focus into the overlay on open and restores it to
// the previously-focused element on close.
//
// Desktop layout and workflows are unaffected; the only desktop-visible change is
// Escape-to-close, a pure keyboard-accessibility addition for dialogs.

import { useEffect, useRef } from "react";

import { pushBackInterceptor } from "./backStack";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useOverlayDismiss(open, onClose, options = {}) {
  const { containerRef, initialFocusRef, manageFocus = true } = options;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const unregister = pushBackInterceptor(() => onCloseRef.current?.());

    let restoreEl = manageFocus ? document.activeElement : null;
    let focusTimer = null;
    if (manageFocus) {
      focusTimer = window.setTimeout(() => {
        const target =
          initialFocusRef?.current ||
          containerRef?.current?.querySelector(FOCUSABLE) ||
          containerRef?.current;
        if (target && typeof target.focus === "function") {
          target.focus();
        }
      }, 0);
    }

    // F5: trap Tab / Shift+Tab inside the overlay so keyboard focus cannot escape
    // into the background app shell (WCAG 2.4.3 / 2.1.2). Mirrors the proven
    // in-repo useModalA11y trap (Revenue.jsx). Only active when we manage focus
    // and have a container to scope to; nested overlays (e.g. CalendarModal +
    // its event editor) already gate their own `open` mutually-exclusively, so
    // exactly one trap is live at a time.
    let handleTrap = null;
    if (manageFocus && containerRef) {
      handleTrap = (event) => {
        if (event.key !== "Tab") return;
        const container = containerRef.current;
        if (!container) return;
        const items = container.querySelectorAll(FOCUSABLE);
        if (!items.length) {
          event.preventDefault();
          if (typeof container.focus === "function") container.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (!container.contains(active)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
          return;
        }
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      };
      document.addEventListener("keydown", handleTrap, true);
    }

    return () => {
      unregister();
      if (focusTimer) window.clearTimeout(focusTimer);
      if (handleTrap) {
        document.removeEventListener("keydown", handleTrap, true);
      }
      if (
        manageFocus &&
        restoreEl &&
        typeof restoreEl.focus === "function" &&
        document.contains(restoreEl)
      ) {
        restoreEl.focus();
      }
      restoreEl = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
