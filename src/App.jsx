import { cloneElement, lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ClientLogin from "./ClientLogin";
import AdminLogin from "./AdminLogin";
import { apiRequest } from "./lib/api";

const ClientPortal = lazy(() => import("./ClientPortal"));
const SuperAdmin = lazy(() => import("./SuperAdmin"));
const PayPage = lazy(() => import("./PayPage"));
const SignupPage = lazy(() => import("./SignupPage"));

function SkeletonBlock({ className = "" }) {
  return (
    <div
      className={`relative overflow-hidden bg-slate-200/80 rounded-lg ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[skeletonShimmer_1.7s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 9 }).map((_, index) => (
        <span
          key={index}
          className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse"
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
  return (
    <div className="min-h-screen bg-slate-100 overflow-hidden relative">
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
      `}</style>

      <div className="absolute inset-0">
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

      <div className="absolute inset-0 bg-white/72 backdrop-blur-[1px]" />

      <div className="relative min-h-screen flex items-center justify-center p-6">
        <div
          className="w-full max-w-[430px] bg-white border border-slate-200 rounded-2xl shadow-[0_24px_80px_rgba(15,23,42,0.16)] px-6 py-5"
          style={{
            animation: "loadingFloat 2.6s ease-in-out infinite",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <LoadingDots />
            </div>

            <div className="min-w-0">
              <div className="text-[15px] font-bold tracking-tight text-slate-950">
                {admin
                  ? "Getting the control center ready."
                  : "Getting your workspace ready."}
              </div>

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

function FullScreenMessage({
  title,
  message,
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="text-lg font-bold text-white">
          {title}
        </div>

        <div className="mt-2 text-sm leading-6 text-slate-400">
          {message}
        </div>
      </div>
    </div>
  );
}

function ClientRoute({
  children,
}) {
  const [
    status,
    setStatus,
  ] =
    useState(
      "checking"
    );

  const [
    session,
    setSession,
  ] =
    useState(null);

  const [
    message,
    setMessage,
  ] =
    useState("");

  useEffect(() => {
    let active =
      true;

    async function verifyClient() {
      try {
        const data =
          await apiRequest(
            "/api/client/auth/me"
          );

        if (active) {
          setSession(
            data
          );

          setStatus(
            "authenticated"
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }

        if (
          error?.status ===
            503 &&
          error?.data
            ?.maintenance ===
            true
        ) {
          setMessage(
            error.data
              ?.message ||
              "Bispun is temporarily under maintenance."
          );

          setStatus(
            "maintenance"
          );

          return;
        }

        setSession(
          null
        );

        setStatus(
          "unauthenticated"
        );
      }
    }

    verifyClient();

    return () => {
      active =
        false;
    };
  }, []);

  if (
    status ===
    "checking"
  ) {
    return (
      <DashboardLoadingScreen />
    );
  }

  if (
    status ===
    "maintenance"
  ) {
    return (
      <FullScreenMessage
        title="Scheduled Maintenance"
        message={
          message
        }
      />
    );
  }

  if (
    status ===
    "unauthenticated"
  ) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return cloneElement(
    children,
    {
      clientSession:
        session,
    }
  );
}

function AdminGuestRoute({
  children,
}) {
  const [
    status,
    setStatus,
  ] =
    useState(
      "checking"
    );

  useEffect(() => {
    let active =
      true;

    async function verifyAdminSession() {
      try {
        await apiRequest(
          "/api/admin/auth/me"
        );

        if (active) {
          setStatus(
            "authenticated"
          );
        }
      } catch {
        if (active) {
          setStatus(
            "unauthenticated"
          );
        }
      }
    }

    verifyAdminSession();

    return () => {
      active =
        false;
    };
  }, []);

  if (
    status ===
    "checking"
  ) {
    return (
      <DashboardLoadingScreen
        admin
      />
    );
  }

  if (
    status ===
    "authenticated"
  ) {
    return (
      <Navigate
        to="/admin"
        replace
      />
    );
  }

  return children;
}

function AdminRoute({
  children,
}) {
  const [
    status,
    setStatus,
  ] =
    useState(
      "checking"
    );

  useEffect(() => {
    let active =
      true;

    async function verifyAdmin() {
      try {
        await apiRequest(
          "/api/admin/auth/me"
        );

        if (active) {
          setStatus(
            "authenticated"
          );
        }
      } catch {
        if (active) {
          setStatus(
            "unauthenticated"
          );
        }
      }
    }

    verifyAdmin();

    return () => {
      active =
        false;
    };
  }, []);

  if (
    status ===
    "checking"
  ) {
    return (
      <DashboardLoadingScreen
        admin
      />
    );
  }

  if (
    status ===
    "unauthenticated"
  ) {
    return (
      <Navigate
        to="/admin/login"
        replace
      />
    );
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
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
