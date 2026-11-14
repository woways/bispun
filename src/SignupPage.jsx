import { useEffect, useId, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Building2,
  UserRound,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  Check,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

import { apiRequest } from "./lib/api";
import ContactOtpVerification from "./components/ContactOtpVerification";
import { downloadInvoicePdf } from "./lib/invoicePdf";

const inr = (n) =>
  "₹" +
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function isValidEmail(value) {
  const email = String(value || "").trim().toLowerCase();

  if (!email || email.length > 254 || email.includes(" ")) {
    return false;
  }

  const atIndex = email.indexOf("@");
  if (atIndex <= 0 || atIndex !== email.lastIndexOf("@")) {
    return false;
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..")
  ) {
    return false;
  }

  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) &&
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);
}

function normalizePhoneInput(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

function isValidPhone(value) {
  return /^\d{10}$/.test(String(value || "").trim());
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function scrollToTop() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

function loadRazorpayCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Unable to load Razorpay"));
    document.body.appendChild(s);
  });
}

// Module-level so the input is never re-created on each keystroke (keeps focus).
function Input({ label, required, id, error, ...props }) {
  const reactId = useId();
  const inputId = id || reactId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-xs font-medium text-slate-600 mb-1"
      >
        {label}
        {required && (
          <>
            <span className="text-rose-500 ml-0.5" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>
      <input
        id={inputId}
        {...props}
        required={required}
        aria-required={required ? "true" : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={errorId}
        className={`w-full h-10 px-3 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
          error
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
            : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
        }`}
      />
      {error && (
        <p id={errorId} className="mt-1 text-[11px] font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

const EMPTY = {
  name: "",
  brandName: "",
  business: "",
  ownerName: "",
  city: "",
  email: "",
  phone: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  referralCode: "",
};

// Order used to pick which invalid field to focus first on a failed step.
const FIELD_ORDER = [
  "name",
  "business",
  "ownerName",
  "email",
  "phone",
  "adminName",
  "adminEmail",
  "adminPassword",
  "plan",
];

const FIELD_DOM_ID = {
  name: "su-name",
  business: "su-business",
  ownerName: "su-ownerName",
  email: "su-email",
  phone: "su-phone",
  adminName: "su-adminName",
  adminEmail: "su-adminEmail",
  adminPassword: "su-adminPassword",
  plan: "su-plan-group",
};

export default function SignupPage() {
  const { plan: planParam } = useParams();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [planKey, setPlanKey] = useState((planParam || "").toLowerCase());
  const [form, setForm] = useState(EMPTY);
  const [verificationTokens, setVerificationTokens] = useState({
    companyEmail: "",
    companyPhone: "",
    adminEmail: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [step, setStep] = useState(0);

  const headingRef = useRef(null);
  const successHeadingRef = useRef(null);
  const didMountRef = useRef(false);

  useEffect(() => {
    apiRequest("/api/public/onboard/plans")
      .then((d) => {
        const list = d.plans || [];
        setPlans(list);
        setPlanKey((cur) => cur || (list[0] ? list[0].key : ""));
      })
      .catch(() => setError("Unable to load plans. Please refresh."))
      .finally(() => setLoadingPlans(false));
  }, []); // eslint-disable-line

  // Prefill the referral code from a referral link (e.g. /signup?ref=CODE),
  // matching the ?ref= convention used across the app. Kept fully editable.
  useEffect(() => {
    const raw =
      searchParams.get("ref") ||
      searchParams.get("referral") ||
      searchParams.get("referralCode") ||
      searchParams.get("ref_code");
    if (!raw) return;
    const code = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) return;
    setForm((f) => (f.referralCode ? f : { ...f, referralCode: code }));
  }, [searchParams]);

  // Move focus to the step heading when the step changes (skip first mount),
  // so screen-reader users hear the new step's title/context.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (receipt) {
      successHeadingRef.current?.focus();
    }
  }, [receipt]);

  const plan = plans.find((p) => p.key === planKey) || null;
  // Plan is locked in when a valid plan came from the website link (/signup/<plan>).
  // Only show the picker as a fallback when someone lands on bare /signup.
  const planLocked =
    Boolean(planParam) &&
    plans.some((p) => p.key === String(planParam).toLowerCase());

  const steps = [
    { key: "org", title: "Organization", hint: "Tell us about your company." },
    {
      key: "verify",
      title: "Verify contacts",
      hint: "Confirm your company email and phone number.",
    },
    {
      key: "admin",
      title: "Admin & referral",
      hint: "Create the admin login you'll use to sign in.",
    },
    {
      key: "plan",
      title: planLocked ? "Review & pay" : "Choose plan & pay",
      hint: "Confirm your plan and pay securely.",
    },
  ];
  const totalSteps = steps.length;

  const clearFieldError = (key) =>
    setFieldErrors((fe) => {
      if (!fe[key]) return fe;
      const next = { ...fe };
      delete next[key];
      return next;
    });

  const updateField = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    clearFieldError(k);

    const verificationKey =
      k === "email"
        ? "companyEmail"
        : k === "phone"
        ? "companyPhone"
        : k === "adminEmail"
        ? "adminEmail"
        : null;

    if (verificationKey) {
      setVerificationTokens((current) => ({
        ...current,
        [verificationKey]: "",
      }));
    }
  };

  const allContactsVerified =
    Boolean(verificationTokens.companyEmail) &&
    Boolean(verificationTokens.companyPhone) &&
    Boolean(verificationTokens.adminEmail);

  // Per-step validation, reusing the exact same rules as the final validate().
  function getStepErrors(index) {
    const e = {};
    if (index === 0) {
      if (!form.name.trim()) e.name = "Company name is required";
      if (!form.business.trim()) e.business = "Business type is required";
      if (!form.ownerName.trim()) e.ownerName = "Owner name is required";
    } else if (index === 1) {
      if (!isValidEmail(form.email)) e.email = "Enter a valid company email";
      else if (!verificationTokens.companyEmail)
        e.email = "Verify the company email with the OTP";
      if (!isValidPhone(form.phone))
        e.phone = "Enter a valid 10-digit company phone number";
      else if (!verificationTokens.companyPhone)
        e.phone = "Verify the phone number with the OTP";
    } else if (index === 2) {
      if (!form.adminName.trim()) e.adminName = "Admin name is required";
      if (!isValidEmail(form.adminEmail))
        e.adminEmail = "Enter a valid admin email";
      else if (!verificationTokens.adminEmail)
        e.adminEmail = "Verify the admin email with the OTP";
      if (String(form.adminPassword).length < 8)
        e.adminPassword = "Password must be at least 8 characters";
    } else if (index === 3) {
      if (!planKey) e.plan = "Please choose a plan";
    }
    return e;
  }

  function goToStep(target) {
    setError("");
    setFieldErrors({});
    setStep(target);
    scrollToTop();
  }

  function handleStepSubmit(event) {
    event.preventDefault();
    // Last step is never submitted via Enter — payment requires an explicit
    // click on the Pay button, so Enter can never trigger a charge.
    if (step >= totalSteps - 1) return;

    const errs = getStepErrors(step);
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      const firstKey = FIELD_ORDER.find((k) => errs[k]);
      setError(firstKey ? errs[firstKey] : "Please complete the required fields.");
      requestAnimationFrame(() => {
        const el = firstKey ? document.getElementById(FIELD_DOM_ID[firstKey]) : null;
        el?.focus();
      });
      return;
    }

    setFieldErrors({});
    setError("");
    setStep((s) => Math.min(s + 1, totalSteps - 1));
    scrollToTop();
  }

  function goBack() {
    setFieldErrors({});
    setError("");
    setStep((s) => Math.max(s - 1, 0));
    scrollToTop();
  }

  // Authoritative final validation — unchanged backstop before payment.
  function validate() {
    if (!form.name.trim()) return "Company name is required";
    if (!form.business.trim()) return "Business type is required";
    if (!form.ownerName.trim()) return "Owner name is required";
    if (!isValidEmail(form.email)) return "Enter a valid company email";
    if (!isValidPhone(form.phone)) return "Enter a valid 10-digit company phone number";
    if (!planKey) return "Please choose a plan";
    if (!form.adminName.trim()) return "Admin name is required";
    if (!isValidEmail(form.adminEmail)) return "Enter a valid admin email";
    if (!verificationTokens.companyEmail) return "Verify the company email with OTP";
    if (!verificationTokens.companyPhone) return "Verify the company phone number with OTP";
    if (!verificationTokens.adminEmail) return "Verify the admin email with OTP";
    if (String(form.adminPassword).length < 8)
      return "Password must be at least 8 characters";
    return "";
  }

  async function pay() {
    const v = validate();
    if (v) {
      setError(v);
      scrollToTop();
      return;
    }
    setProcessing(true);
    setError("");
    try {
      await loadRazorpayCheckout();
      const data = await apiRequest("/api/public/onboard/start", {
        method: "POST",
        body: JSON.stringify({
          planKey,
          ...form,
          companyEmailVerificationToken: verificationTokens.companyEmail,
          phoneVerificationToken: verificationTokens.companyPhone,
          adminEmailVerificationToken: verificationTokens.adminEmail,
        }),
      });
      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.order.amount,
        currency: data.order.currency,
        name: "Bispun",
        description: `${data.plan.name} annual subscription`,
        order_id: data.order.id,
        prefill: data.prefill || {},
        theme: { color: "#4f46e5" },
        handler: async (response) => {
          try {
            const verified = await apiRequest("/api/public/onboard/verify", {
              method: "POST",
              body: JSON.stringify(response),
            });
            if (verified.receipt) {
              setReceipt(verified.receipt);
              scrollToTop();
            } else {
              setError(
                verified.message ||
                  "Payment received; your workspace is being created."
              );
            }
          } catch (err) {
            setError(err?.data?.message || err.message || "Could not verify payment");
          } finally {
            setProcessing(false);
          }
        },
        modal: { ondismiss: () => setProcessing(false) },
      });
      rzp.on("payment.failed", (r) => {
        setError(r?.error?.description || "Payment failed. Please try again.");
        setProcessing(false);
      });
      rzp.open();
    } catch (err) {
      setError(err?.data?.message || err.message || "Unable to start payment");
      setProcessing(false);
    }
  }

  // ---- Success screen ----
  if (receipt) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="text-green-600" size={26} aria-hidden="true" />
          </div>
          <h1
            ref={successHeadingRef}
            tabIndex={-1}
            className="text-lg font-semibold text-slate-900 focus:outline-none"
          >
            Your workspace is ready
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {receipt.plan?.name} subscription is active. Log in with your admin
            email to get started.
          </p>

          <div className="mt-5 rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm text-left">
            <Row label="Invoice" value={receipt.receiptNumber || receipt.id} />
            <Row
              label="Total paid"
              value={inr(receipt.finalAmount != null ? receipt.finalAmount : receipt.amount)}
              bold
            />
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => downloadInvoicePdf(receipt)}
              className="flex-1 rounded-xl border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
            >
              Download PDF invoice
            </button>
            <a
              href="/login"
              className="flex-1 text-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
            >
              Go to login
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ---- Guided multi-step signup (UI wrapper over the same submit/payment) ----
  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="text-2xl font-bold text-indigo-600">Bispun</div>
          {plan && (
            <div className="text-right">
              <div className="text-xs text-slate-500">{plan.name} · annual</div>
              <div className="text-sm font-bold text-slate-900">
                {inr(plan.breakdown.finalAmount)}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h1 className="text-lg font-semibold text-slate-900">
            Create your account
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            A few quick steps to set up your workspace and activate it.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3"
            >
              <AlertCircle
                size={16}
                aria-hidden="true"
                className="mt-0.5 flex-shrink-0"
              />
              <span>{error}</span>
            </div>
          )}

          {/* Progress indicator */}
          <nav aria-label="Signup progress" className="mt-5">
            <ol className="flex items-center">
              {steps.map((s, i) => {
                const state =
                  i < step ? "complete" : i === step ? "current" : "upcoming";
                const reachable = i <= step;
                const stateText =
                  state === "complete"
                    ? "completed"
                    : state === "current"
                    ? "current step"
                    : "not completed";
                return (
                  <li
                    key={s.key}
                    className={`flex items-center ${
                      i < steps.length - 1 ? "flex-1" : ""
                    } min-w-0`}
                  >
                    <button
                      type="button"
                      onClick={reachable ? () => goToStep(i) : undefined}
                      disabled={!reachable}
                      aria-current={state === "current" ? "step" : undefined}
                      className={`group flex items-center gap-2 rounded-lg px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                        reachable ? "cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                          state === "complete"
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : state === "current"
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200"
                            : "border-slate-300 bg-white text-slate-400"
                        }`}
                      >
                        {state === "complete" ? (
                          <Check size={15} aria-hidden="true" strokeWidth={3} />
                        ) : (
                          <span aria-hidden="true">{i + 1}</span>
                        )}
                      </span>
                      <span className="hidden min-w-0 sm:block">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Step {i + 1}
                        </span>
                        <span
                          className={`block truncate text-xs font-semibold ${
                            state === "upcoming"
                              ? "text-slate-400"
                              : "text-slate-800"
                          }`}
                        >
                          {s.title}
                        </span>
                      </span>
                      <span className="sr-only">
                        Step {i + 1} of {totalSteps}: {s.title}, {stateText}
                      </span>
                    </button>
                    {i < steps.length - 1 && (
                      <span
                        aria-hidden="true"
                        className={`mx-1 h-px flex-1 ${
                          i < step ? "bg-indigo-400" : "bg-slate-200"
                        }`}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          <form onSubmit={handleStepSubmit} noValidate className="mt-6">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="flex items-center gap-2 text-base font-semibold text-slate-900 focus:outline-none"
            >
              {step === 0 && <Building2 size={16} className="text-indigo-600" aria-hidden="true" />}
              {step === 1 && <ShieldCheck size={16} className="text-indigo-600" aria-hidden="true" />}
              {step === 2 && <UserRound size={16} className="text-indigo-600" aria-hidden="true" />}
              {step === 3 && <Check size={16} className="text-indigo-600" aria-hidden="true" />}
              {steps[step].title}
              <span className="sr-only">
                , step {step + 1} of {totalSteps}
              </span>
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">{steps[step].hint}</p>

            <div className="mt-5">
              {/* ---- Step 1: Organization ---- */}
              {step === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    id="su-name"
                    label="Company Name"
                    required
                    value={form.name}
                    error={fieldErrors.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="ABC Consultancy"
                  />
                  <Input
                    id="su-brandName"
                    label="Brand / Portal Name"
                    value={form.brandName}
                    onChange={(e) => updateField("brandName", e.target.value)}
                    placeholder="ABC Consultancy CRM"
                  />
                  <Input
                    id="su-business"
                    label="Business Type"
                    required
                    value={form.business}
                    error={fieldErrors.business}
                    onChange={(e) => updateField("business", e.target.value)}
                    placeholder="Education Consultancy"
                  />
                  <Input
                    id="su-ownerName"
                    label="Owner Name"
                    required
                    value={form.ownerName}
                    error={fieldErrors.ownerName}
                    onChange={(e) => updateField("ownerName", e.target.value)}
                    placeholder="Owner / Founder"
                  />
                  <Input
                    id="su-city"
                    label="City"
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder="Hyderabad"
                  />
                </div>
              )}

              {/* ---- Step 2: Verify contacts ---- */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <Input
                      id="su-email"
                      label="Company Email"
                      required
                      type="email"
                      maxLength={254}
                      value={form.email}
                      error={fieldErrors.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="info@company.com"
                    />
                    <ContactOtpVerification
                      endpointBase="/api/public/onboard"
                      channel="email"
                      purpose="company_email"
                      target={String(form.email || "").trim().toLowerCase()}
                      valid={isValidEmail(form.email)}
                      verifiedToken={verificationTokens.companyEmail}
                      onVerified={(token) => {
                        setVerificationTokens((current) => ({
                          ...current,
                          companyEmail: token,
                        }));
                        if (token) clearFieldError("email");
                      }}
                    />
                  </div>
                  <div>
                    <Input
                      id="su-phone"
                      label="Phone"
                      required
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[0-9]{10}"
                      title="Enter exactly 10 digits"
                      value={form.phone}
                      error={fieldErrors.phone}
                      onChange={(e) =>
                        updateField("phone", normalizePhoneInput(e.target.value))
                      }
                      placeholder="9876543210"
                    />
                    <ContactOtpVerification
                      endpointBase="/api/public/onboard"
                      channel="phone"
                      purpose="company_phone"
                      target={form.phone}
                      valid={isValidPhone(form.phone)}
                      verifiedToken={verificationTokens.companyPhone}
                      onVerified={(token) => {
                        setVerificationTokens((current) => ({
                          ...current,
                          companyPhone: token,
                        }));
                        if (token) clearFieldError("phone");
                      }}
                    />
                  </div>
                </div>
              )}

              {/* ---- Step 3: Admin login + referral ---- */}
              {step === 2 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    id="su-adminName"
                    label="Admin Name"
                    required
                    value={form.adminName}
                    error={fieldErrors.adminName}
                    onChange={(e) => updateField("adminName", e.target.value)}
                    placeholder="Your name"
                  />
                  <div>
                    <Input
                      id="su-adminEmail"
                      label="Admin Email"
                      required
                      type="email"
                      maxLength={254}
                      value={form.adminEmail}
                      error={fieldErrors.adminEmail}
                      onChange={(e) => updateField("adminEmail", e.target.value)}
                      placeholder="admin@company.com"
                    />
                    <ContactOtpVerification
                      endpointBase="/api/public/onboard"
                      channel="email"
                      purpose="admin_email"
                      target={String(form.adminEmail || "").trim().toLowerCase()}
                      valid={isValidEmail(form.adminEmail)}
                      verifiedToken={verificationTokens.adminEmail}
                      onVerified={(token) => {
                        setVerificationTokens((current) => ({
                          ...current,
                          adminEmail: token,
                        }));
                        if (token) clearFieldError("adminEmail");
                      }}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label
                      htmlFor="su-adminPassword"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Password
                      <span className="text-rose-500 ml-0.5" aria-hidden="true">
                        *
                      </span>
                      <span className="sr-only"> (required)</span>
                    </label>
                    <div className="relative">
                      <input
                        id="su-adminPassword"
                        required
                        minLength={8}
                        aria-required="true"
                        aria-invalid={fieldErrors.adminPassword ? "true" : undefined}
                        aria-describedby={
                          fieldErrors.adminPassword
                            ? "su-adminPassword-error"
                            : undefined
                        }
                        type={showPassword ? "text" : "password"}
                        value={form.adminPassword}
                        onChange={(e) => updateField("adminPassword", e.target.value)}
                        className={`w-full h-10 px-3 pr-10 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                          fieldErrors.adminPassword
                            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                            : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
                        }`}
                        placeholder="Minimum 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((val) => !val)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                      >
                        {showPassword ? (
                          <EyeOff size={16} aria-hidden="true" />
                        ) : (
                          <Eye size={16} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {fieldErrors.adminPassword && (
                      <p
                        id="su-adminPassword-error"
                        className="mt-1 text-[11px] font-medium text-rose-600"
                      >
                        {fieldErrors.adminPassword}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label
                      htmlFor="su-referralCode"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Referral Code{" "}
                      <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      id="su-referralCode"
                      type="text"
                      value={form.referralCode}
                      onChange={(e) =>
                        updateField(
                          "referralCode",
                          e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                        )
                      }
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                      placeholder="Enter referrer code if you have one"
                    />
                  </div>
                </div>
              )}

              {/* ---- Step 4: Choose plan & pay ---- */}
              {step === 3 && (
                <div className="space-y-5">
                  {!planLocked && (
                    <div
                      id="su-plan-group"
                      tabIndex={-1}
                      role="radiogroup"
                      aria-label="Choose your plan"
                      aria-describedby={fieldErrors.plan ? "su-plan-error" : undefined}
                      className="focus:outline-none"
                    >
                      {loadingPlans ? (
                        <p role="status" className="text-sm text-slate-500">
                          Loading plans…
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {plans.map((p) => {
                            const selected = planKey === p.key;
                            return (
                              <button
                                key={p.key}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => {
                                  setPlanKey(p.key);
                                  clearFieldError("plan");
                                }}
                                className={`text-left border rounded-xl p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 ${
                                  selected
                                    ? "border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/70 shadow-sm"
                                    : "border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="font-semibold text-sm text-slate-900">
                                    {p.name}
                                  </div>
                                  {selected && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700">
                                      <Check size={13} aria-hidden="true" strokeWidth={3} />
                                      Selected
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">
                                  {Number(p.breakdown.discount) > 0 && (
                                    <span className="text-sm font-normal text-slate-400 line-through mr-1.5">
                                      ₹{Number(p.breakdown.listPrice).toLocaleString("en-IN")}
                                    </span>
                                  )}
                                  ₹
                                  {Number(p.breakdown.subtotal).toLocaleString("en-IN")}
                                  <span className="text-xs font-normal text-slate-500">
                                    /year
                                  </span>
                                </div>
                                {p.tagline && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    {p.tagline}
                                  </p>
                                )}
                                <div className="text-[11px] text-slate-400 mt-2">
                                  + {p.breakdown.gstRate}% GST
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {fieldErrors.plan && (
                        <p
                          id="su-plan-error"
                          className="mt-2 text-[11px] font-medium text-rose-600"
                        >
                          {fieldErrors.plan}
                        </p>
                      )}
                    </div>
                  )}

                  {planLocked && plan && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-slate-700">
                      You're signing up for the{" "}
                      <span className="font-semibold text-slate-900">{plan.name}</span>{" "}
                      annual plan.
                    </div>
                  )}

                  {/* Order summary */}
                  {plan && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm">
                      <div className="flex items-center justify-between gap-6 text-slate-500">
                        <span>Plan price ({plan.name})</span>
                        <span>{inr(plan.breakdown.listPrice)}</span>
                      </div>
                      {Number(plan.breakdown.discount) > 0 && (
                        <div className="flex items-center justify-between gap-6 text-emerald-600 mt-1">
                          <span>Discount</span>
                          <span>−{inr(plan.breakdown.discount)}</span>
                        </div>
                      )}
                      {Number(plan.breakdown.discount) > 0 && (
                        <div className="flex items-center justify-between gap-6 text-slate-500 mt-1">
                          <span>Subtotal</span>
                          <span>{inr(plan.breakdown.subtotal)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-6 text-slate-500 mt-1">
                        <span>GST ({plan.breakdown.gstRate}%)</span>
                        <span>+{inr(plan.breakdown.gstAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-6 mt-2 pt-2 border-t border-slate-200 font-semibold text-slate-900">
                        <span>Total payable</span>
                        <span>{inr(plan.breakdown.finalAmount)}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <button
                      type="button"
                      onClick={pay}
                      disabled={processing || loadingPlans || !allContactsVerified}
                      aria-describedby={
                        !allContactsVerified ? "pay-requirement" : undefined
                      }
                      className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                    >
                      {processing && (
                        <Loader2
                          size={16}
                          className="animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      )}
                      {processing
                        ? "Opening payment…"
                        : plan
                        ? `Pay ${inr(plan.breakdown.finalAmount)}`
                        : "Pay"}
                    </button>
                    {!allContactsVerified && (
                      <p
                        id="pay-requirement"
                        className="mt-2 text-[11px] font-medium text-amber-700 text-center"
                      >
                        Verify company email, phone number and admin email before
                        payment.
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-slate-400 text-center">
                      Secured by Razorpay · UPI, cards, net-banking
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Step navigation */}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back
                </button>
              ) : (
                <span />
              )}

              {step < totalSteps - 1 && (
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                >
                  Continue
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className={bold ? "font-semibold text-slate-800" : "text-slate-500"}>
        {label}
      </span>
      <span className={bold ? "font-bold text-slate-900" : "text-slate-700"}>
        {value}
      </span>
    </div>
  );
}
