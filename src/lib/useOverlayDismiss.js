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

    return () => {
      unregister();
      if (focusTimer) window.clearTimeout(focusTimer);
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
