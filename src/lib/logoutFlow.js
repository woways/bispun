// Framework-agnostic logout sequencing — unit-testable without React/Capacitor.
//
// WHY CONCURRENT: the device-token unregister goes through the Capacitor push
// plugin, which can HANG on Android (observed: no request ever dispatched, and
// a "PushNotifications.then() is not implemented on android" console error). If
// it runs *before* the server logout (sequentially), a hang blocks
// /api/client/auth/logout from ever being sent, so the server session is never
// revoked — a silent "local-only" logout. We therefore dispatch unregisterPush()
// and serverLogout() INDEPENDENTLY and concurrently; one can never block the
// other from being initiated.
//
// Guarantees:
//  1. Both authenticated cleanup calls are INITIATED immediately, while the auth
//     token is still present (serverLogout() invokes its request synchronously,
//     so its Authorization header is captured before the token is cleared).
//  2. The local token is ALWAYS cleared exactly once — success, failure, OR
//     timeout/hang — so no later request can act authenticated and a stale
//     in-flight response cannot restore the signed-in state.
//  3. Navigation happens within `timeoutMs` no matter what (even if unregister
//     hangs forever), so the UI never sticks on "Signing out…". navigate() is
//     called exactly once, after the token is cleared, so late background
//     cleanup cannot cause a navigation race.
//
// NOTE: a dispatched request is not guaranteed to fully complete if the UI
// navigates first; however `serverLogout` is given its own bounded retry and,
// because it is dispatched immediately (not gated behind the push plugin), it
// reaches the backend in the normal case. True guaranteed revocation would
// require a server-side mechanism (see the report).
export async function performLogout({
  unregisterPush,
  serverLogout,
  clearToken,
  navigate,
  onError = () => {},
  timeoutMs = 2500,
  setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
}) {
  // Device-token unregister — best-effort, isolated. Started synchronously so it
  // runs concurrently with (never before/blocking) the server logout.
  const unregisterDone = (async () => {
    try {
      await unregisterPush();
    } catch (error) {
      onError("unregister", error);
    }
  })();

  // Server logout — the security-critical call. Invoked synchronously here so its
  // request (and Authorization header) is dispatched immediately while the token
  // is still present, independent of the push plugin. One bounded retry.
  const serverLogoutDone = (async () => {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await serverLogout();
        return;
      } catch (error) {
        if (attempt === 2) onError("logout", error);
      }
    }
  })();

  const allSettled = Promise.allSettled([unregisterDone, serverLogoutDone]);

  // Clear the local token exactly once — guaranteed (success, failure, timeout).
  let cleared = false;
  const clearOnce = () => {
    if (cleared) return;
    cleared = true;
    try {
      clearToken();
    } catch (error) {
      onError("clearToken", error);
    }
  };
  allSettled.finally(clearOnce);

  // Navigate within the bound regardless (covers a hung unregister); clear the
  // token before leaving so nothing can restore authenticated state.
  await Promise.race([
    allSettled,
    new Promise((resolve) => setTimeoutFn(resolve, timeoutMs)),
  ]);
  clearOnce();
  navigate();
}
