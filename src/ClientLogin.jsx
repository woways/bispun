import {
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  BarChart3,
  UsersRound,
} from "lucide-react";


import { apiRequest } from "./lib/api";
import bispunLogo from "./assets/bispun-logo.svg";

export default function ClientLogin() {
  const nav = useNavigate();

  const [email, setEmail] = useState(
    () => localStorage.getItem("cb_remembered_email") || ""
  );

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [rememberMe, setRememberMe] = useState(
    () => Boolean(localStorage.getItem("cb_remembered_email"))
  );

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      try {
        await apiRequest("/api/client/auth/me");

        if (active) {
          nav("/app", { replace: true });
        }
      } catch {
        // No active client session.
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    checkExistingSession();

    return () => {
      active = false;
    };
  }, [nav]);

  async function submit(event) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      await apiRequest("/api/client/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      // Do not treat a 200 login response as a complete sign-in until
      // the browser proves that it kept and can resend the session cookie.
      try {
        await apiRequest("/api/client/auth/me", {
          cache: "no-store",
        });
      } catch (sessionError) {
        const browserSessionError = new Error(
          "Your credentials were accepted, but this browser did not keep the secure login session. Please allow cookies for this site and try again."
        );
        browserSessionError.status = sessionError?.status;
        browserSessionError.data = {
          message:
            "Your credentials were accepted, but this browser did not keep the secure login session. Please allow cookies for this site and try again.",
        };
        throw browserSessionError;
      }

      if (rememberMe) {
        localStorage.setItem(
          "cb_remembered_email",
          normalizedEmail
        );
      } else {
        localStorage.removeItem("cb_remembered_email");
      }

      nav("/app", { replace: true });
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to sign in"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleForgotPassword() {
  setSupportOpen(true);
}

  if (checking) {
    return (
      <div className="min-h-screen bg-[#050b18] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2
            size={16}
            className="animate-spin"
          />
          Checking workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050b18] lg:p-5">
      <div className="min-h-screen lg:min-h-[calc(100vh-40px)] lg:grid lg:grid-cols-[1fr_1fr] lg:overflow-hidden lg:rounded-[30px] lg:border lg:border-white/15">

        {/* =====================================================
            LEFT BRAND PANEL
        ====================================================== */}

        <section className="relative hidden lg:flex overflow-hidden bg-[#020b1d] text-white">

          {/* ABSTRACT BLUE WAVE BACKGROUND */}

          <div className="absolute inset-0 overflow-hidden pointer-events-none">

            <div
              className="absolute -left-[22%] -top-[28%] h-[620px] w-[760px] rounded-[50%] border border-blue-500/50"
              style={{
                boxShadow:
                  "0 0 35px rgba(37,99,235,0.22)",
              }}
            />

            <div
              className="absolute -left-[17%] -top-[23%] h-[620px] w-[760px] rounded-[50%] border border-blue-500/25"
            />

            <div
              className="absolute -right-[42%] top-[20%] h-[780px] w-[900px] rounded-[50%] border border-blue-500/30"
            />

            <div
              className="absolute -right-[37%] top-[24%] h-[780px] w-[900px] rounded-[50%] border border-blue-500/15"
            />

            <div
              className="absolute -bottom-[33%] -left-[18%] h-[650px] w-[920px] rounded-[50%] border border-blue-400/40"
              style={{
                boxShadow:
                  "0 0 50px rgba(37,99,235,0.17)",
              }}
            />

            <div
              className="absolute -bottom-[28%] -left-[10%] h-[560px] w-[820px] rounded-[50%] border border-blue-500/20"
            />

            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 10% 15%, rgba(37,99,235,0.12), transparent 35%), radial-gradient(circle at 90% 75%, rgba(30,64,175,0.12), transparent 32%)",
              }}
            />
          </div>

          <div className="relative z-10 flex min-h-full w-full flex-col px-12 py-11 xl:px-16 xl:py-12">

            {/* BRAND */}

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white px-3 py-2 shadow-[0_8px_30px_rgba(37,99,235,0.15)]">
                <img
                  src={bispunLogo}
                  alt="Bispun"
                  className="h-10 w-auto object-contain"
                />
              </div>

              <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                CRM made simple
              </div>
            </div>

            {/* MAIN CONTENT */}

            <div className="my-auto max-w-[560px]">

              <div className="mb-8 h-[3px] w-9 rounded-full bg-blue-500" />

              <h1 className="max-w-[540px] text-[44px] font-semibold leading-[1.12] tracking-[-0.045em] text-white xl:text-[49px]">
                Run your business
                <br />
                from{" "}
                <span className="text-blue-500">
                  one clear workspace.
                </span>
              </h1>

              <p className="mt-6 max-w-[500px] text-[16px] leading-7 text-slate-300">
                Leads, admissions, revenue and performance —
                connected.
              </p>

              {/* BENEFITS */}

              <div className="mt-14 flex items-start">

                <div className="flex flex-1 items-center gap-3 pr-5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-blue-500/30 text-blue-400">
                    <ShieldCheck size={19} />
                  </div>

                  <div className="text-[13px] font-medium leading-5 text-slate-200">
                    Secure
                    <br />
                    & Reliable
                  </div>
                </div>

                <div className="h-10 w-px bg-white/15" />

                <div className="flex flex-1 items-center gap-3 px-5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-blue-500/30 text-blue-400">
                    <BarChart3 size={19} />
                  </div>

                  <div className="text-[13px] font-medium leading-5 text-slate-200">
                    Real-time
                    <br />
                    Insights
                  </div>
                </div>

                <div className="h-10 w-px bg-white/15" />

                <div className="flex flex-1 items-center gap-3 pl-5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-blue-500/30 text-blue-400">
                    <UsersRound size={19} />
                  </div>

                  <div className="text-[13px] font-medium leading-5 text-slate-200">
                    Built for
                    <br />
                    Growth
                  </div>
                </div>

              </div>
            </div>

            <div className="text-[10px] text-slate-600">
              Bispun Client Workspace
            </div>
          </div>
        </section>

        {/* =====================================================
            LOGIN PANEL
        ====================================================== */}

        <section className="relative flex min-h-screen items-center justify-center bg-white px-4 py-6 sm:px-10 sm:py-10 lg:min-h-0 lg:px-14 xl:px-20">

          <div className="w-full max-w-[510px]">

            {/* MOBILE BRAND */}

            <div className="mb-8 flex items-center sm:mb-12 lg:hidden">
              <img
                src={bispunLogo}
                alt="Bispun"
                className="h-11 w-auto object-contain"
              />
            </div>

            {/* SECURITY ICON */}

            <div className="mx-auto mb-5 hidden h-[76px] w-[76px] items-center justify-center rounded-full bg-blue-50 text-[#163d78] lg:flex">
              <ShieldCheck size={38} strokeWidth={1.6} />
            </div>

            {/* HEADER */}

            <div className="text-left lg:text-center">
              <h2 className="text-[30px] font-bold tracking-[-0.04em] text-[#07101f] sm:text-[38px]">
                Welcome back!
              </h2>

              <p className="mt-2 text-[15px] text-slate-500">
                Sign in to your Bispun workspace
              </p>
            </div>

            {/* FORM */}

            <form
              onSubmit={submit}
              className="mt-8 space-y-5 sm:mt-10 sm:space-y-6"
            >
              {/* EMAIL */}

              <label className="block">
                <div className="mb-2 text-[14px] font-semibold text-slate-900">
                  Work Email
                </div>

                <div className="relative">
                  <Mail
                    size={19}
                    strokeWidth={1.8}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                  />

                  <input
                    type="email"
                    required
                    disabled={loading}
                    autoComplete="username"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="Enter your work email"
                    className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-[15px] text-slate-950 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50"
                  />
                </div>
              </label>

              {/* PASSWORD */}

              <label className="block">
                <div className="mb-2 text-[14px] font-semibold text-slate-900">
                  Password
                </div>

                <div className="relative">
                  <LockKeyhole
                    size={19}
                    strokeWidth={1.8}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                  />

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    required
                    disabled={loading}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-[15px] text-slate-950 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) => !value
                      )
                    }
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </label>

              {/* REMEMBER / FORGOT */}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) =>
                      setRememberMe(
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  />

                  <span className="text-[13px] font-medium text-slate-700">
                    Remember me
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[13px] font-medium text-blue-600 hover:text-blue-700"
                >
                  Forgot password?
                </button>
              </div>

              {/* ERROR */}

              {error ? (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12px] leading-5 text-rose-700">
                  <AlertCircle
                    size={15}
                    className="mt-0.5 flex-shrink-0"
                  />

                  <span>
                    {error}
                  </span>
                </div>
              ) : null}

              {/* SIGN IN */}

              <button
                type="submit"
                disabled={loading}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.16)] transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <ArrowRight size={17} />
                )}

                {loading
                  ? "Signing in..."
                  : "Sign in"}
              </button>
            </form>

            {/* FOOTER */}

            <div className="mt-10 border-t border-slate-200 pt-5 sm:mt-14 sm:pt-6">
              <div className="flex flex-col items-center justify-center gap-2 text-[11px] text-slate-400 sm:flex-row sm:gap-4">

                <div className="inline-flex items-center gap-2">
                  <LockKeyhole size={12} />
                  Secure workspace access
                </div>

                <div className="hidden h-3 w-px bg-slate-200 sm:block" />

                <div>
  Need help?{" "}
  <button
    type="button"
    onClick={() => setSupportOpen(true)}
    className="font-medium text-blue-600 hover:text-blue-700"
  >
    Contact support
  </button>
  {supportOpen && (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-[2px]"
    onClick={() => setSupportOpen(false)}
  >
    <div
      className="w-full max-w-[430px] rounded-2xl bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)]"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <ShieldCheck size={21} />
        </div>

        <button
          type="button"
          onClick={() => setSupportOpen(false)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          ✕
        </button>
      </div>

      <h3 className="mt-5 text-[20px] font-bold tracking-[-0.025em] text-slate-950">
        Need help signing in?
      </h3>

      <p className="mt-2 text-[13px] leading-6 text-slate-500">
        Contact the Bispun support team if you're having trouble
        accessing your workspace.
      </p>

      <div className="mt-5 space-y-3">
        <a
          href="mailto:support@bispun.com"
          className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50"
        >
          <Mail size={17} className="text-blue-600" />

          <div>
            <div className="text-[11px] font-medium text-slate-400">
              Email Support
            </div>

            <div className="mt-0.5 text-[13px] font-semibold text-slate-800">
              support@bispun.com
            </div>
          </div>
        </a>

        <a
          href="tel:+919000000000"
          className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50"
        >
          <div className="flex h-[17px] w-[17px] items-center justify-center text-blue-600">
            ☎
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-400">
              Call Support
            </div>

            <div className="mt-0.5 text-[13px] font-semibold text-slate-800">
              +91 90000 00000
            </div>
          </div>
        </a>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
        <div className="text-[11px] text-slate-400">
          Support Hours
        </div>

        <div className="mt-0.5 text-[12px] font-semibold text-slate-700">
          Monday – Saturday · 9:00 AM – 6:00 PM
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSupportOpen(false)}
        className="mt-5 h-11 w-full rounded-xl bg-slate-950 text-[13px] font-semibold text-white hover:bg-slate-800"
      >
        Close
      </button>

      <p className="mt-4 text-center text-[10px] leading-4 text-slate-400">
        Support details shown here are temporary and will be replaced
        with official Bispun contact information before launch.
      </p>
    </div>
  </div>
)}
</div>

              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}