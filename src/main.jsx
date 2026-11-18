import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { Capacitor } from '@capacitor/core';
import { primeMobilePush } from './lib/mobilePush';

// Flag the native app runtime BEFORE first paint so Android-only UI (the
// `native:` Tailwind variant) applies inside the Capacitor WebView but never
// in a web browser. This is the real native runtime, not a width heuristic,
// and setting it pre-render avoids any web->app layout flash.
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native');
}

// Capture a cold-start notification tap as early as possible (native Android/
// iOS only; a complete no-op in a desktop browser). The buffered target is
// applied after the user is authenticated. See src/lib/mobilePush.js.
primeMobilePush();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Dismiss the native-only inline boot splash (index.html) once React has painted
// its first frame, handing off to the app (BrandSplash / login / dashboard) with
// no white flash. No-op on web, where the splash was never shown.
(function dismissBootSplash() {
  const el = document.getElementById('bispun-splash');
  if (!el) return;
  const hide = () => {
    el.classList.add('bispun-splash-hide');
    const done = () => el.remove();
    el.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 400); // fallback if transitionend doesn't fire
  };
  requestAnimationFrame(() => requestAnimationFrame(hide));
})();
