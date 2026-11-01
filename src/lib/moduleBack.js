// A single-slot "module back" handler, distinct from the LIFO `backStack` used
// for overlays. The Android hardware-Back flow in BackButtonHandler is:
//   1. runTopBackInterceptor()  -> close the top overlay (drawer/sheet/modal)
//   2. runModuleBack()          -> walk back through visited CRM modules
//   3. atRoot ? exitApp() : navigate(-1)
// so module-back only runs when NO overlay is open, and the app only exits from
// the root screen (Dashboard with empty module history).
//
// Unlike `backStack` (a stack — many overlays can be open at once), there is ever
// only ONE module-navigation owner (the client portal shell), so this is a
// single slot: last-writer-wins. `runModuleBack()` returns true ONLY when the
// registered handler reports it actually handled the back action; otherwise it
// returns false so the caller falls through to its exit logic.

let handler = null;

// Register the module-back handler. Returns an unregister function that only
// clears the slot if it still holds THIS handler (safe under React StrictMode's
// dev double-invoke: register -> unregister -> register nets one live handler).
export function setModuleBackHandler(fn) {
  handler = typeof fn === "function" ? fn : null;
  const registered = handler;
  return () => {
    if (handler === registered) handler = null;
  };
}

// Run the module-back handler. Returns true only if it handled the back action.
export function runModuleBack() {
  if (!handler) return false;
  return handler() === true;
}

// Test-only: clear the slot between cases.
export function _resetModuleBackHandler() {
  handler = null;
}
