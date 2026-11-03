import { cloneElement, lazy, Suspense, useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ClientLogin from "./ClientLogin";
import AdminLogin from "./AdminLogin";
import { apiRequest, classifyAuthError } from "./lib/api";
import BackButtonHandler from "./components/BackButtonHandler";

const ClientPortal = lazy(() => import("./ClientPortal"));
const SuperAdmin = lazy(() => import("./SuperAdmin"));
const PayPage = lazy(() => import("./PayPage"));
const SignupPage = lazy(() => import("./SignupPage"));

function SkeletonBlock({ className = "" }) {
  return (
    <div
      className={`relative overflow-hidden bg-slate-200/80 rounded-lg ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[skeletonShimmer_1.7s_infinite] motion-reduce:animate-none bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 9 }).map((_, index) => (
        <span
          key={index}
          className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse motion-reduce:animate-none"
          style={{
            animationDelay: `${index * 90}ms`,
          }}
        />
      ))}
    </div>
  );
}

function DashboardLoadingScreen({
  admin = false,
}) {
  const headingRef = useRef(null);
  useEffect(() => {
    // Keep focus oriented when this screen (re)mounts — e.g. after a Retry from
    // the error screen — so keyboard/SR users aren't stranded on <body> in silence.
    headingRef.current?.focus();
  }, []);

  return (
    <div
      className="min-h-screen bg-slate-100 overflow-hidden relative"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <style>{`
        @keyframes skeletonShimmer {
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes loadingFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-3px);
          }
        }

        .auth-loading-card {
          animation: loadingFloat 2.6s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .auth-loading-card {
            animation: none;
          }
        }
      `}</style>

      <div className="absolute inset-0" aria-hidden="true">
        <div className="flex min-h-screen">
          <aside
            className={`hidden md:flex w-[230px] flex-col border-r ${
              admin
                ? "bg-slate-950 border-slate-800"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="h-[72px] px-5 flex items-center border-b border-slate-200/10">
              <SkeletonBlock
                className={`h-8 w-28 ${
                  admin
                    ? "!bg-slate-800"
                    : ""
                }`}
              />
            </div>

            <div className="p-4 space-y-3">
              {Array.from({ length: 7 }).map((_, index) => (
                <div
                  key={index}
                  className={`h-10 rounded-lg px-3 flex items-center gap-3 ${
                    index === 0
                      ? admin
                        ? "bg-slate-900"
                        : "bg-slate-100"
                      : ""
                  }`}
                >
                  <SkeletonBlock
                    className={`w-5 h-5 ${
                      admin
                        ? "!bg-slate-800"
                        : ""
                    }`}
                  />

                  <SkeletonBlock
                    className={`h-3 ${
                      index % 2 === 0
                        ? "w-24"
                        : "w-20"
                    } ${
                      admin
                        ? "!bg-slate-800"
                        : ""
                    }`}
                  />
                </div>
              ))}
            </div>

            <div className="mt-auto p-4">
              <div
                className={`rounded-xl border p-3 ${
                  admin
                    ? "border-slate-800 bg-slate-900"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <SkeletonBlock
                  className={`h-8 w-8 rounded-full ${
                    admin
                      ? "!bg-slate-800"
                      : ""
                  }`}
                />

                <SkeletonBlock
                  className={`mt-3 h-3 w-24 ${
                    admin
                      ? "!bg-slate-800"
                      : ""
                  }`}
                />

                <SkeletonBlock
                  className={`mt-2 h-2.5 w-16 ${
                    admin
                      ? "!bg-slate-800"
                      : ""
                  }`}
                />
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0 bg-white">
            <header className="h-[72px] border-b border-slate-200 px-5 lg:px-8 flex items-center justify-between">
              <div>
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="mt-2 h-5 w-44" />
              </div>

              <div className="flex items-center gap-3">
                <SkeletonBlock className="hidden sm:block h-9 w-28" />
                <SkeletonBlock className="h-9 w-9 rounded-full" />
              </div>
            </header>

            <div className="p-5 lg:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="mt-3 h-8 w-56" />
                  <SkeletonBlock className="mt-3 h-3 w-80 max-w-[70vw]" />
                </div>

                <SkeletonBlock className="hidden lg:block h-10 w-28" />
              </div>

              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="border border-slate-200 bg-white rounded-xl p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <div className="flex-1">
                        <SkeletonBlock className="h-2.5 w-20" />
                        <SkeletonBlock className="mt-3 h-7 w-16" />
                      </div>

                      <SkeletonBlock className="w-9 h-9" />
                    </div>

                    <SkeletonBlock className="mt-5 h-2.5 w-28" />
                  </div>
                ))}
              </div>

              <div className="grid xl:grid-cols-[1.55fr_1fr] gap-4">
                <div className="border border-slate-200 rounded-xl p-5">
                  <div className="flex justify-between">
                    <div>
                      <SkeletonBlock className="h-3 w-28" />
                      <SkeletonBlock className="mt-2 h-2.5 w-44" />
                    </div>

                    <SkeletonBlock className="h-8 w-20" />
                  </div>

                  <div className="mt-8 h-64 flex items-end gap-3">
                    {[48, 66, 42, 78, 58, 88, 72, 92].map((height, index) => (
                      <SkeletonBlock
                        key={index}
                        className="flex-1 rounded-t-lg rounded-b-none"
                        style={{
                          height: `${height}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-5">
                  <SkeletonBlock className="h-3 w-32" />
                  <SkeletonBlock className="mt-2 h-2.5 w-40" />

                  <div className="mt-6 space-y-5">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3"
                      >
                        <SkeletonBlock className="h-9 w-9 rounded-full" />

                        <div className="flex-1">
                          <SkeletonBlock className="h-3 w-3/5" />
                          <SkeletonBlock className="mt-2 h-2.5 w-2/5" />
                        </div>

                        <SkeletonBlock className="h-5 w-14" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200">
                  <SkeletonBlock className="h-3 w-32" />
                </div>

                <div className="divide-y divide-slate-100">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="px-5 py-4 grid grid-cols-[1.5fr_1fr_1fr_90px] gap-4"
                    >
                      <SkeletonBlock className="h-3 w-4/5" />
                      <SkeletonBlock className="h-3 w-3/5" />
                      <SkeletonBlock className="h-3 w-2/3" />
                      <SkeletonBlock className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <div className="absolute inset-0 bg-white/72 backdrop-blur-[1px]" aria-hidden="true" />

      <div className="relative min-h-screen flex items-center justify-center p-6">
        <div className="auth-loading-card w-full max-w-[430px] bg-white border border-slate-200 rounded-2xl shadow-[0_24px_80px_rgba(15,23,42,0.16)] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <LoadingDots />
            </div>

            <div className="min-w-0">
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-[15px] font-bold tracking-tight text-slate-950 outline-none"
              >
                {admin
                  ? "Getting the control center ready."
                  : "Getting your workspace ready."}
              </h1>

              <div className="mt-1 text-xs leading-5 text-slate-500">
                {admin
                  ? "Checking platform access and loading the latest system data."
                  : "Loading your latest data securely."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Accessible full-screen status for the maintenance and "can't reach server"
// states. Renders a real <h1>, an appropriate live region (assertive for the
// error, polite for maintenance), moves focus to the heading on appearance, and
// updates the document title. Never auto-redirects — the error offers Retry.
function AuthMessageScreen({
  variant,
  title,
  message,
  onRetry,
  attempt = 0,
}) {
  const headingRef = useRef(null);
  const isError = variant === "error";

  useEffect(() => {
    if (headingRef.current) headingRef.current.focus();
    const previousTitle = document.title;
    document.title = `${title} — Bispun`;
    return () => {
      document.title = previousTitle;
    };
    // attempt is included so a repeated failure re-focuses and re-announces.
  }, [title, attempt]);

  return (
    <div
      className="min-h-screen bg-slate-950 flex items-center justify-center px-6"
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div className="w-full max-w-md text-center">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-bold text-white outline-none"
        >
          {title}
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          {message}
        </p>

        {isError && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

// Shared auth bootstrap: calls /auth/me, and distinguishes a real auth failure
// (401/403 -> unauthenticated) from a transient one (network/timeout/429/5xx),
// which it retries with bounded backoff before surfacing an explicit error
// state. This stops a cold Render/Neon start from falsely logging a user out.
const AUTH_MAX_RETRIES = 2;
const AUTH_BACKOFF_MS = [1000, 3000];
const AUTH_TIMEOUT_MS = 30000;

function useAuthBootstrap(path) {
  const [state, setState] = useState({
    status: "checking",
    session: null,
    message: "",
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let timer = null;

    setState({ status: "checking", session: null, message: "" });

    async function run(tryIndex) {
      try {
        const data = await apiRequest(path, { timeoutMs: AUTH_TIMEOUT_MS });
        if (active) setState({ status: "authenticated", session: data, message: "" });
      } catch (error) {
        if (!active) return;
        const kind = classifyAuthError(error);

        if (kind === "maintenance") {
          setState({
            status: "maintenance",
            session: null,
            message:
              error?.data?.message ||
              "Bispun is temporarily under maintenance.",
          });
          return;
        }

        if (kind === "unauthenticated") {
          setState({ status: "unauthenticated", session: null, message: "" });
          return;
        }

        // transient — retry with bounded backoff, then surface an error screen.
        if (tryIndex < AUTH_MAX_RETRIES) {
          timer = setTimeout(
            () => active && run(tryIndex + 1),
            AUTH_BACKOFF_MS[tryIndex] || 3000
          );
        } else {
          setState({ status: "error", session: null, message: "" });
        }
      }
    }

    run(0);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [path, attempt]);

  const retry = () => setAttempt((n) => n + 1);

  return { ...state, attempt, retry };
}

function ClientRoute({ children }) {
  const { status, session, message, attempt, retry } = useAuthBootstrap(
    "/api/client/auth/me"
  );

  if (status === "checking") {
    return <DashboardLoadingScreen />;
  }

  if (status === "maintenance") {
    return (
      <AuthMessageScreen
        variant="maintenance"
        title="Scheduled Maintenance"
        message={message}
        attempt={attempt}
      />
    );
  }

  if (status === "error") {
    return (
      <AuthMessageScreen
        variant="error"
        title="Can't reach the server"
        message="We couldn't load your workspace. Check your connection, then try again."
        onRetry={retry}
        attempt={attempt}
      />
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return cloneElement(children, { clientSession: session });
}

function AdminGuestRoute({ children }) {
  const { status, attempt, retry } = useAuthBootstrap("/api/admin/auth/me");

  if (status === "checking") {
    return <DashboardLoadingScreen admin />;
  }

  if (status === "error") {
    return (
      <AuthMessageScreen
        variant="error"
        title="Can't reach the server"
        message="We couldn't verify your session. Check your connection, then try again."
        onRetry={retry}
        attempt={attempt}
      />
    );
  }

  if (status === "authenticated") {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { status, attempt, retry } = useAuthBootstrap("/api/admin/auth/me");

  if (status === "checking") {
    return <DashboardLoadingScreen admin />;
  }

  if (status === "error") {
    return (
      <AuthMessageScreen
        variant="error"
        title="Can't reach the server"
        message="We couldn't verify your session. Check your connection, then try again."
        onRetry={retry}
        attempt={attempt}
      />
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <BackButtonHandler />
      <Suspense fallback={<DashboardLoadingScreen />}>
      <Routes>
        <Route
          path="/login"
          element={
            <ClientLogin />
          }
        />

        <Route
          path="/app/*"
          element={
            <ClientRoute>
              <ClientPortal />
            </ClientRoute>
          }
        />

        <Route
          path="/"
          element={
            <Navigate
              to="/app"
              replace
            />
          }
        />

        <Route
          path="/admin/login"
          element={
            <AdminGuestRoute>
              <AdminLogin />
            </AdminGuestRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <SuperAdmin />
            </AdminRoute>
          }
        />

        <Route
          path="/pay/:token"
          element={<PayPage />}
        />

        <Route
          path="/signup"
          element={<SignupPage />}
        />

        <Route
          path="/signup/:plan"
          element={<SignupPage />}
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/app"
              replace
            />
          }
        />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
