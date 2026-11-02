// A tiny LIFO stack of "back interceptors" so the Android hardware back button
// and the Escape key share ONE dismissal path for overlays (drawer, bottom
// sheets, modals). Each overlay registers a close callback when it opens; the
// back handler runs the TOP one first (last-opened closes first) and consumes
// the event, so back never exits the app while an overlay is open.
//
// Pure module-level state — no React — so it is trivially unit-testable and can
// be shared between the global BackButtonHandler and any component.

const interceptors = [];

// Register a close callback. Returns an unregister function (call on close).
export function pushBackInterceptor(fn) {
  if (typeof fn !== "function") return () => {};
  interceptors.push(fn);
  return () => {
    const index = interceptors.indexOf(fn);
    if (index !== -1) interceptors.splice(index, 1);
  };
}

// Run the most-recently-registered interceptor. Returns true if one handled the
// back action (so the caller must NOT also navigate/exit), false if none exist.
export function runTopBackInterceptor() {
  const fn = interceptors[interceptors.length - 1];
  if (!fn) return false;
  fn();
  return true;
}

export function hasBackInterceptor() {
  return interceptors.length > 0;
}

// Test-only: clear the stack between cases.
export function _resetBackInterceptors() {
  interceptors.length = 0;
}
