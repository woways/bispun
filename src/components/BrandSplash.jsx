import bispunIcon from "../assets/bispun-icon.svg";

// Native-only branded startup splash: centered Bispun logo + three gently
// animated dots. Shown during the authenticated cold-start check (/auth/me) so
// the boot experience stays branded after the inline index.html splash hands off,
// instead of flashing the dashboard skeleton. Reduced-motion safe. The WEB keeps
// its existing DashboardLoadingScreen — callers render this only on `.native`.
export default function BrandSplash() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-[22px] bg-[#f6f7fb]"
      style={{ padding: "env(safe-area-inset-top) 24px env(safe-area-inset-bottom)" }}
    >
      <style>{`
        @keyframes bispunSplashDot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
          40% { transform: translateY(-7px); opacity: 1; }
        }
      `}</style>
      <img src={bispunIcon} alt="" className="h-24 w-24 object-contain" />
      <div className="flex gap-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[9px] w-[9px] rounded-full bg-indigo-600 motion-reduce:!animate-none"
            style={{ animation: "bispunSplashDot 1.1s ease-in-out infinite", animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
      <span className="sr-only">Loading Bispun…</span>
    </div>
  );
}
