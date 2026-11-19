import { useId } from "react";
import { useModalA11y } from "../lib/useModalA11y";

// Shared accessible modal shell. Renders the backdrop + panel and applies the
// proven useModalA11y behavior (focus into the dialog on open, Tab trap, Escape
// to close, body scroll-lock, focus restore on close) plus the dialog semantics
// (role=dialog, aria-modal, aria-labelledby). Visuals are supplied by the caller
// via backdropClassName/panelClassName so existing modal styling is unchanged.
//
// This is the single reusable extraction of the pattern that previously lived as
// local copies in Settings (A11yDialog) and Admissions (ModalShell). Use it for
// bare module modals. Overlays that already go through useOverlayDismiss
// (CalendarModal, Help TicketDetailsModal, ChatPanel) keep using that hook — do
// not mix the two on one overlay.
//
// Usage (children is a render-prop that receives the heading id to put on the
// dialog's title element so aria-labelledby resolves):
//   <A11yDialog onClose={close} backdropClassName="fixed inset-0 …" panelClassName="…">
//     {(headingId) => (<><h2 id={headingId}>Title</h2> …</>)}
//   </A11yDialog>
export default function A11yDialog({
  onClose,
  backdropClassName,
  panelClassName,
  children,
}) {
  const { panelRef, onKeyDown } = useModalA11y(onClose);
  const headingId = useId();
  return (
    <div className={backdropClassName}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={panelClassName}
      >
        {typeof children === "function" ? children(headingId) : children}
      </div>
    </div>
  );
}
