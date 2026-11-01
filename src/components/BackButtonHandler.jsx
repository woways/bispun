import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { runTopBackInterceptor } from "../lib/backStack";
import { runModuleBack } from "../lib/moduleBack";

// Screens where "back" should exit the app, not navigate to a previous screen.
const ROOT_PATHS = ["/app", "/admin", "/login", "/admin/login"];

export default function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  // Escape key shares ONE dismissal path with the hardware back button: it
  // closes the top-most open overlay (drawer / sheet / modal) if any. Runs on
  // every platform (web + device). It yields to a more specific handler that
  // already consumed the key (e.defaultPrevented), e.g. the composer's
  // @mention escape, so it never double-dismisses.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (runTopBackInterceptor()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    // Only runs on a real device (Android). On web/desktop it does nothing.
    if (!Capacitor.isNativePlatform()) return;

    let handle;
    CapApp.addListener("backButton", ({ canGoBack }) => {
      // An open overlay (drawer / bottom sheet / modal) consumes back FIRST, so
      // back never exits the app while something is open. LIFO: top closes first.
      if (runTopBackInterceptor()) return;

      // Next, walk back through visited CRM modules (module switches are React
      // state, not route history). Returns true only when it handled the back;
      // at the root module (empty history) it returns false so we fall through
      // to the exit logic below.
      if (runModuleBack()) return;

      const atRoot = ROOT_PATHS.includes(location.pathname);

      if (!atRoot && canGoBack) {
        navigate(-1); // go to the previous screen
      } else {
        CapApp.exitApp(); // only exit when at a root screen
      }
    }).then((h) => (handle = h));

    return () => {
      if (handle) handle.remove();
    };
  }, [navigate, location]);

  return null; // shows nothing, just listens
}
