import { useEffect, useRef } from "react";

// Accessible-modal helper: moves focus into the dialog on open, traps Tab,
// closes on Escape, locks body scroll, and restores focus to the opener on
// close. Keeps the historical modal visuals unchanged.
//
// This is the shared extraction of the proven pattern that already shipped in
// Revenue.jsx (useModalA11y). Reused by bare module modals (Admissions, Settings,
// Help) so every dialog behaves identically. Overlays that go through
// useOverlayDismiss (CalendarModal, Help TicketDetailsModal, ChatPanel, …) keep
// using that hook — do not mix the two on one overlay.
//
// Usage:
//   const { panelRef, onKeyDown } = useModalA11y(onClose);
//   <div className="fixed inset-0 …">                     // backdrop
//     <div ref={panelRef} role="dialog" aria-modal="true"
//          aria-labelledby={headingId} tabIndex={-1} onKeyDown={onKeyDown}>
//       <h2 id={headingId}>Title</h2> …
//     </div>
//   </div>
const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useModalA11y(onClose) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE_SELECTOR);
    (first || panel)?.focus?.();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, []);

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onCloseRef.current?.();
      return;
    }
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = panel.querySelectorAll(FOCUSABLE_SELECTOR);
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return { panelRef, onKeyDown };
}

export default useModalA11y;
