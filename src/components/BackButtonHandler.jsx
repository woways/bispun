import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

// Screens where "back" should exit the app, not navigate to a previous screen.
const ROOT_PATHS = ["/app", "/admin", "/login", "/admin/login"];

export default function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only runs on a real device (Android). On web/desktop it does nothing.
    if (!Capacitor.isNativePlatform()) return;

    let handle;
    CapApp.addListener("backButton", ({ canGoBack }) => {
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
