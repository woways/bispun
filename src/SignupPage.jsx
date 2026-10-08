import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Building2,
  UserRound,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { apiRequest } from "./lib/api";
import { downloadInvoicePdf } from "./lib/invoicePdf";

const inr = (n) =>
  "₹" +
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}
function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
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
function Input({ label, required, ...props }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <input
        {...props}
        required={required}
        className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
      />
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

export default function SignupPage() {
  const { plan: planParam } = useParams();
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [planKey, setPlanKey] = useState((planParam || "").toLowerCase());
  const [form, setForm] = useState(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState(null);

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

  const plan = plans.find((p) => p.key === planKey) || null;
  // Plan is locked in when a valid plan came from the website link (/signup/<plan>).
  // Only show the picker as a fallback when someone lands on bare /signup.
  const planLocked =
    Boolean(planParam) &&
    plans.some((p) => p.key === String(planParam).toLowerCase());
  const updateField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function validate() {
    if (!form.name.trim()) return "Company name is required";
    if (!form.business.trim()) return "Business type is required";
    if (!form.ownerName.trim()) return "Owner name is required";
    if (!isValidEmail(form.email)) return "Enter a valid company email";
    if (!isValidPhone(form.phone)) return "Enter a valid company phone number";
    if (!planKey) return "Please choose a plan";
    if (!form.adminName.trim()) return "Admin name is required";
    if (!isValidEmail(form.adminEmail)) return "Enter a valid admin email";
    if (String(form.adminPassword).length < 8)
      return "Password must be at least 8 characters";
    return "";
  }

  async function pay() {
    const v = validate();
    if (v) {
      setError(v);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setProcessing(true);
    setError("");
    try {
      await loadRazorpayCheckout();
      const data = await apiRequest("/api/public/onboard/start", {
        method: "POST",
        body: JSON.stringify({ planKey, ...form }),
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
              window.scrollTo({ top: 0, behavior: "smooth" });
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
            <CheckCircle2 className="text-green-600" size={26} />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
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
              className="flex-1 rounded-xl border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold py-2.5 text-sm"
            >
              Download PDF invoice
            </button>
            <a
              href="/login"
              className="flex-1 text-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 text-sm"
            >
              Go to login
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ---- Signup form (single page, mirrors Super Admin onboarding) ----
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
            Set up your company and admin login, then pay to activate.
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
              {error}
            </div>
          )}

          {/* Company */}
          <section className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={15} className="text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800">
                Company Details
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Company Name"
                required
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="ABC Consultancy"
              />
              <Input
                label="Brand / Portal Name"
                value={form.brandName}
                onChange={(e) => updateField("brandName", e.target.value)}
                placeholder="ABC Consultancy CRM"
              />
              <Input
                label="Business Type"
                required
                value={form.business}
                onChange={(e) => updateField("business", e.target.value)}
                placeholder="Education Consultancy"
              />
              <Input
                label="Owner Name"
                required
                value={form.ownerName}
                onChange={(e) => updateField("ownerName", e.target.value)}
                placeholder="Owner / Founder"
              />
              <Input
                label="Company Email"
                required
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="info@company.com"
              />
              <Input
                label="Phone"
                required
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="9876543210"
              />
              <Input
                label="City"
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
                placeholder="Hyderabad"
              />
            </div>
          </section>

          {/* Plan — picker shown only as a fallback (bare /signup with no plan). */}
          {!planLocked && (
          <section className="border-t border-slate-100 pt-5 mt-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">
              Choose Your Plan
            </h3>
            {loadingPlans ? (
              <div className="text-sm text-slate-500">Loading plans…</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {plans.map((p) => {
                  const selected = planKey === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPlanKey(p.key)}
                      className={`text-left border rounded-xl p-4 transition-all ${
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
                          <div className="w-2 h-2 rounded-full bg-indigo-600" />
                        )}
                      </div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">
                        ₹
                        {Number(p.breakdown.listPrice).toLocaleString("en-IN")}
                        <span className="text-xs font-normal text-slate-500">
                          /year
                        </span>
                      </div>
                      {p.tagline && (
                        <p className="text-xs text-slate-500 mt-1">{p.tagline}</p>
                      )}
                      <div className="text-[11px] text-slate-400 mt-2">
                        + {p.breakdown.gstRate}% GST
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          )}

          {/* Admin login */}
          <section className="border-t border-slate-100 pt-5 mt-5">
            <div className="flex items-center gap-2 mb-3">
              <UserRound size={15} className="text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800">
                Your Admin Login
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Admin Name"
                required
                value={form.adminName}
                onChange={(e) => updateField("adminName", e.target.value)}
                placeholder="Your name"
              />
              <Input
                label="Admin Email"
                required
                type="email"
                value={form.adminEmail}
                onChange={(e) => updateField("adminEmail", e.target.value)}
                placeholder="admin@company.com"
              />
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Password
                  <span className="text-rose-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    required
                    minLength={8}
                    type={showPassword ? "text" : "password"}
                    value={form.adminPassword}
                    onChange={(e) => updateField("adminPassword", e.target.value)}
                    className="w-full h-10 px-3 pr-10 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((val) => !val)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Referral Code{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
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
          </section>

          {/* Order summary */}
          {plan && (
            <section className="border-t border-slate-100 pt-5 mt-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm">
                <div className="flex items-center justify-between gap-6 text-slate-500">
                  <span>Plan price ({plan.name})</span>
                  <span>{inr(plan.breakdown.listPrice)}</span>
                </div>
                <div className="flex items-center justify-between gap-6 text-slate-500 mt-1">
                  <span>GST ({plan.breakdown.gstRate}%)</span>
                  <span>+{inr(plan.breakdown.gstAmount)}</span>
                </div>
                <div className="flex items-center justify-between gap-6 mt-2 pt-2 border-t border-slate-200 font-semibold text-slate-900">
                  <span>Total payable</span>
                  <span>{inr(plan.breakdown.finalAmount)}</span>
                </div>
              </div>
            </section>
          )}

          <button
            onClick={pay}
            disabled={processing || loadingPlans}
            className="mt-5 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 flex items-center justify-center gap-2"
          >
            {processing && <Loader2 size={16} className="animate-spin" />}
            {processing
              ? "Opening payment…"
              : plan
              ? `Pay ${inr(plan.breakdown.finalAmount)}`
              : "Pay"}
          </button>
          <p className="mt-2 text-[11px] text-slate-400 text-center">
            Secured by Razorpay · UPI, cards, net-banking
          </p>
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
