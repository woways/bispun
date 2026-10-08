import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Plus,
  Search,
  Filter,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  X,
  Building2,
  UserRound,
  Eye,
  EyeOff,
  Loader2,
  FileText,
  Link2,
  Copy,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

import { downloadProformaPdf } from "../../lib/invoicePdf";

import {
  SectionHeader,
  Table,
  Badge,
  PlanPill,
  statusTone,
} from "../../components/ui";

import { apiRequest } from "../../lib/api";

function getAccent(primaryColor) {
  const colors = {
    indigo: "bg-indigo-600",
    emerald: "bg-emerald-600",
    amber: "bg-amber-600",
    rose: "bg-rose-600",
    purple: "bg-purple-600",
    blue: "bg-blue-600",
    slate: "bg-slate-700",
  };

  return (
    colors[primaryColor] ||
    "bg-indigo-600"
  );
}

function getInitials(client) {
  if (client.shortName) {
    return client.shortName
      .slice(0, 2)
      .toUpperCase();
  }

  return client.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatRenewal(date) {
  if (!date) return "—";

  const parsed = new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "—";
  }

  return parsed.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(
    String(value || "").trim()
  );
}

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function Input({
  label,
  required,
  ...props
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}

        {required && (
          <span className="text-rose-500 ml-0.5">
            *
          </span>
        )}
      </label>

      <input
        {...props}
        required={required}
        className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
      />
    </div>
  );
}

function OnboardClientModal({
  onClose,
  onCreated,
}) {
  const [plans, setPlans] =
    useState([]);

  const [loadingPlans, setLoadingPlans] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [prePaymentLink, setPrePaymentLink] =
    useState(null);

  const [generatingPaymentLink, setGeneratingPaymentLink] =
    useState(false);

  const [linkCopied, setLinkCopied] =
    useState(false);

  const [form, setForm] = useState({
    name: "",
    brandName: "",
    business: "",
    ownerName: "",
    city: "",
    email: "",
    phone: "",
    subdomain: "",
    primaryColor: "indigo",
    planKey: "basic",
    billingCycle: "YEARLY",
    discountAmount: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    referralCode: "",
  });

  useEffect(() => {
    async function loadPlans() {
      try {
        const data =
          await apiRequest(
            "/api/admin/clients/plans/available"
          );

        setPlans(
          data.plans || []
        );

        if (
          data.plans?.length
        ) {
          setForm((current) => ({
            ...current,
            planKey:
              data.plans[0].key,
          }));
        }
      } catch (error) {
        setError(
          error?.data?.message ||
            "Unable to load plans"
        );
      } finally {
        setLoadingPlans(false);
      }
    }

    loadPlans();
  }, []);

  function updateField(
    field,
    value
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function validateOnboardingForm() {
    const requiredFields = [
      ["name", "Company name"],
      ["business", "Business type"],
      ["ownerName", "Owner name"],
      ["email", "Company email"],
      ["phone", "Phone"],
      ["city", "City"],
      ["adminName", "Admin name"],
      ["adminEmail", "Admin email"],
      ["adminPassword", "Temporary password"],
    ];

    const missingField = requiredFields.find(
      ([field]) => !String(form[field] || "").trim()
    );

    if (missingField) return `${missingField[1]} is required`;
    if (!isValidEmail(form.email)) return "Enter a valid company email";
    if (!isValidEmail(form.adminEmail)) return "Enter a valid client admin email";
    if (!isValidPhone(form.phone)) return "Enter a valid company phone number";
    if (String(form.adminPassword).length < 8) {
      return "Temporary password must be at least 8 characters";
    }
    return "";
  }

  // Downloads the full client confirmation/proforma before onboarding/payment.
  // The temporary password is intentionally never printed in the PDF.
  function previewProforma() {
    setError("");

    const validationError = validateOnboardingForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const selectedPlan =
      plans.find((p) => p.key === form.planKey) || null;
    if (!selectedPlan) {
      setError("Select a plan before generating a proforma");
      return;
    }

    const listPrice = Number(selectedPlan.yearlyPrice || 0);
    let discount = Number(form.discountAmount);
    if (!Number.isFinite(discount) || discount < 0) discount = 0;
    if (discount > listPrice) discount = listPrice;
    const subtotal = Math.max(listPrice - discount, 0);
    const gstAmount = Math.round(subtotal * 0.18 * 100) / 100;
    const finalAmount = Math.round((subtotal + gstAmount) * 100) / 100;

    downloadProformaPdf({
      company: {
        name: form.name,
        brandName: form.brandName || form.name,
        business: form.business,
        ownerName: form.ownerName,
        city: form.city,
        email: form.email,
        phone: form.phone,
        subdomain: form.subdomain || "Auto-generated after payment",
        primaryColor: form.primaryColor,
      },
      admin: { name: form.adminName, email: form.adminEmail },
      referralCode: form.referralCode,
      plan: { name: selectedPlan.name },
      billingCycle: "Annual",
      paymentLink: prePaymentLink?.payUrl || "",
      listPrice,
      discountAmount: discount,
      subtotal,
      gstRate: 18,
      gstAmount,
      finalAmount,
    });
  }

  async function generatePreOnboardingPaymentLink() {
    if (generatingPaymentLink || prePaymentLink) return;

    setError("");
    const validationError = validateOnboardingForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setGeneratingPaymentLink(true);
    try {
      const data = await apiRequest(
        "/api/admin/payment-links/pre-onboard",
        {
          method: "POST",
          body: JSON.stringify(form),
        }
      );
      setPrePaymentLink(data);
      setLinkCopied(false);
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to generate pre-onboarding payment link"
      );
    } finally {
      setGeneratingPaymentLink(false);
    }
  }

  async function copyPrePaymentLink() {
    if (!prePaymentLink?.payUrl) return;
    try {
      await navigator.clipboard.writeText(prePaymentLink.payUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      setError("Unable to copy the payment link. Select and copy it manually.");
    }
  }

  async function cancelPrePaymentLink() {
    if (!prePaymentLink?.pendingId) return;
    setError("");
    try {
      await apiRequest(
        `/api/admin/payment-links/pre-onboard/${prePaymentLink.pendingId}`,
        { method: "DELETE" }
      );
      setPrePaymentLink(null);
      setLinkCopied(false);
    } catch (error) {
      setError(error?.data?.message || "Unable to cancel payment link");
    }
  }

  async function submit(e) {
    e.preventDefault();

    if (saving) return;

    setError("");

    if (prePaymentLink) {
      setError("A pre-onboarding payment link is active. Cancel it first if you want to onboard manually.");
      return;
    }

    const validationError = validateOnboardingForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const data =
        await apiRequest(
          "/api/admin/clients",
          {
            method: "POST",

            body: JSON.stringify(
              form
            ),
          }
        );

      onCreated(data.client);
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to onboard client"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-950">
              Onboard Client
            </h2>

            <p className="text-xs text-slate-500 mt-0.5">
              Confirm client details, share the proforma and collect payment before activation.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-9 h-9 rounded-lg border border-transparent hover:border-slate-200 hover:bg-white flex items-center justify-center text-slate-500 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="overflow-y-auto max-h-[calc(92vh-74px)]"
        >
          <fieldset
            disabled={Boolean(prePaymentLink)}
            className={`p-6 space-y-7 ${prePaymentLink ? "opacity-70" : ""}`}
          >
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-rose-200 bg-rose-50 text-sm text-rose-700">
                <AlertCircle
                  size={15}
                />

                {error}
              </div>
            )}

            <section>
              <div className="flex items-center gap-2 mb-3">
                <Building2
                  size={15}
                  className="text-indigo-600"
                />

                <h3 className="text-sm font-semibold text-slate-800">
                  Company Details
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Company Name"
                  required
                  value={form.name}
                  onChange={(e) =>
                    updateField(
                      "name",
                      e.target.value
                    )
                  }
                  placeholder="ABC Consultancy"
                />

                <Input
                  label="Portal / Brand Name"
                  value={
                    form.brandName
                  }
                  onChange={(e) =>
                    updateField(
                      "brandName",
                      e.target.value
                    )
                  }
                  placeholder="ABC Consultancy CRM"
                />

                <Input
                  label="Business Type"
                  required
                  value={
                    form.business
                  }
                  onChange={(e) =>
                    updateField(
                      "business",
                      e.target.value
                    )
                  }
                  placeholder="Education Consultancy"
                />

                <Input
                  label="Owner Name"
                  required
                  value={
                    form.ownerName
                  }
                  onChange={(e) =>
                    updateField(
                      "ownerName",
                      e.target.value
                    )
                  }
                  placeholder="Owner / Founder"
                />

                <Input
                  label="Company Email"
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    updateField(
                      "email",
                      e.target.value
                    )
                  }
                  placeholder="info@company.com"
                />

                <Input
                  label="Phone"
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    updateField(
                      "phone",
                      e.target.value
                    )
                  }
                  placeholder="9876543210"
                />

                <Input
                  label="City"
                  required
                  value={form.city}
                  onChange={(e) =>
                    updateField(
                      "city",
                      e.target.value
                    )
                  }
                  placeholder="Hyderabad"
                />

                <Input
                  label="Custom Subdomain"
                  value={
                    form.subdomain
                  }
                  onChange={(e) =>
                    updateField(
                      "subdomain",
                      e.target.value
                    )
                  }
                  placeholder="abc.bispun.com"
                />

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Brand Color
                  </label>

                  <select
                    value={
                      form.primaryColor
                    }
                    onChange={(e) =>
                      updateField(
                        "primaryColor",
                        e.target.value
                      )
                    }
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
                  >
                    <option value="indigo">
                      Indigo
                    </option>
                    <option value="blue">
                      Blue
                    </option>
                    <option value="emerald">
                      Emerald
                    </option>
                    <option value="amber">
                      Amber
                    </option>
                    <option value="rose">
                      Rose
                    </option>
                    <option value="purple">
                      Purple
                    </option>
                    <option value="slate">
                      Slate
                    </option>
                  </select>
                </div>
              </div>
            </section>

            <section className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">
                Subscription
              </h3>

              {loadingPlans ? (
                <div className="text-sm text-slate-500">
                  Loading plans...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {plans.map(
                      (plan) => {
                        const selected =
                          form.planKey ===
                          plan.key;

                        return (
                          <button
                            key={
                              plan.id
                            }
                            type="button"
                            onClick={() =>
                              updateField(
                                "planKey",
                                plan.key
                              )
                            }
                            className={`text-left border rounded-xl p-4 transition-all ${
                              selected
                                ? "border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/70 shadow-sm"
                                : "border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-sm text-slate-900">
                                {
                                  plan.name
                                }
                              </div>

                              {selected && (
                                <div className="w-2 h-2 rounded-full bg-indigo-600" />
                              )}
                            </div>

                            <div className="mt-2 text-lg font-semibold text-slate-900">
                              ₹
                              {Number(
                                plan.yearlyPrice || 0
                              ).toLocaleString(
                                "en-IN"
                              )}
                              <span className="text-xs font-normal text-slate-500">
                                /year
                              </span>
                            </div>

                            <p className="text-xs text-slate-500 mt-1">
                              {plan.tagline}
                            </p>

                            <div className="text-xs text-slate-400 mt-2">
                              {
                                plan.modules
                                  .length
                              }{" "}
                              modules
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>

                  <div className="mt-3 max-w-xs">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Billing Cycle
                    </label>

                    <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                      Annual only
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Referral Code <span className="font-normal text-slate-400">(optional)</span>
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
                        placeholder="Enter referrer code if applicable"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        When valid, this new paid CRM client is counted as a successful referral.
                      </p>
                    </div>
                  </div>

                  {/* Discount (₹) — Super Admin can give a manual discount.
                      "No discount" = 0. Total is shown live and can never be
                      negative; the server re-validates the same rules. */}
                  {(() => {
                    const selectedPlan =
                      plans.find(
                        (plan) =>
                          plan.key ===
                          form.planKey
                      ) || null;

                    const listPrice = Number(
                      selectedPlan?.yearlyPrice || 0
                    );

                    let discount = Number(
                      form.discountAmount
                    );
                    if (
                      !Number.isFinite(discount) ||
                      discount < 0
                    )
                      discount = 0;
                    if (discount > listPrice)
                      discount = listPrice;

                    // GST (18%) is charged on the discounted subtotal and the
                    // client is billed the grand total. Mirrors the server
                    // (adminClients.computePricing / clientBilling GST_RATE).
                    const subtotal = Math.max(
                      listPrice - discount,
                      0
                    );
                    const gstAmount =
                      Math.round(subtotal * 0.18 * 100) / 100;
                    const total =
                      Math.round((subtotal + gstAmount) * 100) / 100;

                    return (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="max-w-xs">
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Discount (₹)
                            </label>

                            <input
                              type="text"
                              inputMode="numeric"
                              value={
                                form.discountAmount
                              }
                              onChange={(e) => {
                                // Keep digits only; empty box = no discount.
                                const digits =
                                  e.target.value.replace(
                                    /\D/g,
                                    ""
                                  );

                                if (digits === "") {
                                  updateField(
                                    "discountAmount",
                                    ""
                                  );
                                  return;
                                }

                                let next =
                                  Number(digits);
                                if (
                                  next > listPrice
                                )
                                  next = listPrice;

                                updateField(
                                  "discountAmount",
                                  next
                                );
                              }}
                              placeholder="No discount"
                              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />

                            <p className="mt-1 text-[11px] text-slate-400">
                              Enter 0 for no discount.
                              Cannot exceed the plan
                              price.
                            </p>
                          </div>

                          <div className="text-right text-sm min-w-[180px]">
                            <div className="flex items-center justify-between gap-6 text-slate-500">
                              <span>Plan price</span>
                              <span>
                                ₹
                                {listPrice.toLocaleString(
                                  "en-IN"
                                )}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-6 text-slate-500 mt-1">
                              <span>Discount</span>
                              <span className="text-rose-600">
                                −₹
                                {discount.toLocaleString(
                                  "en-IN"
                                )}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-6 text-slate-500 mt-2 pt-2 border-t border-slate-200">
                              <span>Subtotal</span>
                              <span>
                                ₹
                                {subtotal.toLocaleString(
                                  "en-IN"
                                )}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-6 text-slate-500 mt-1">
                              <span>GST (18%)</span>
                              <span>
                                +₹
                                {gstAmount.toLocaleString(
                                  "en-IN"
                                )}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-6 mt-2 pt-2 border-t border-slate-200 font-semibold text-slate-900">
                              <span>Total payable</span>
                              <span>
                                ₹
                                {total.toLocaleString(
                                  "en-IN"
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </section>

            <section className="border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <UserRound
                  size={15}
                  className="text-indigo-600"
                />

                <h3 className="text-sm font-semibold text-slate-800">
                  First Client Admin
                </h3>
              </div>

              <p className="mb-3 text-[11px] leading-5 text-slate-500">
                The company and admin email domains are checked before the client is created.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Admin Name"
                  required
                  value={
                    form.adminName
                  }
                  onChange={(e) =>
                    updateField(
                      "adminName",
                      e.target.value
                    )
                  }
                  placeholder="Admin name"
                />

                <Input
                  label="Admin Email"
                  required
                  type="email"
                  value={
                    form.adminEmail
                  }
                  onChange={(e) =>
                    updateField(
                      "adminEmail",
                      e.target.value
                    )
                  }
                  placeholder="admin@company.com"
                />

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Temporary Password
                    <span className="text-rose-500 ml-0.5">
                      *
                    </span>
                  </label>

                  <div className="relative">
                    <input
                      required
                      minLength={8}
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      value={
                        form.adminPassword
                      }
                      onChange={(e) =>
                        updateField(
                          "adminPassword",
                          e.target.value
                        )
                      }
                      className="w-full h-10 px-3 pr-10 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                      placeholder="Minimum 8 characters"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (value) =>
                            !value
                        )
                      }
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOff
                          size={16}
                        />
                      ) : (
                        <Eye
                          size={16}
                        />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </fieldset>

          {prePaymentLink && (
            <div className="mx-6 mb-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-emerald-900">
                    Pre-onboarding payment link is ready
                  </div>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                    Send this link to the client. The company, subscription and client admin are created automatically only after Razorpay confirms the payment.
                  </p>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      readOnly
                      value={prePaymentLink.payUrl || ""}
                      onFocus={(e) => e.target.select()}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 text-xs text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={copyPrePaymentLink}
                      className="h-9 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 inline-flex items-center justify-center gap-2"
                    >
                      <Copy size={13} />
                      {linkCopied ? "Copied" : "Copy link"}
                    </button>
                    <a
                      href={prePaymentLink.payUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={13} />
                      Open
                    </a>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-emerald-700">
                      Link expires in {prePaymentLink.expiresInDays || 7} days. Re-download the proforma now if you want the payment link printed inside the PDF.
                    </span>
                    <button
                      type="button"
                      onClick={cancelPrePaymentLink}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                    >
                      Cancel payment link & edit details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 px-6 py-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-9 px-4 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={previewProforma}
              disabled={saving || loadingPlans}
              className="h-9 px-4 text-xs font-semibold border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 disabled:opacity-50 inline-flex items-center gap-2"
            >
              <FileText size={14} />
              Download Proforma PDF
            </button>

            {!prePaymentLink && (
              <button
                type="button"
                onClick={generatePreOnboardingPaymentLink}
                disabled={saving || loadingPlans || generatingPaymentLink}
                className="h-9 px-4 text-xs font-semibold border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {generatingPaymentLink ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Link2 size={14} />
                )}
                {generatingPaymentLink ? "Generating..." : "Generate Payment Link"}
              </button>
            )}

            <button
              type="submit"
              disabled={
                saving ||
                loadingPlans ||
                Boolean(prePaymentLink)
              }
              className="h-9 px-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg inline-flex items-center gap-2 shadow-sm"
            >
              {saving && (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              )}

              {saving
                ? "Creating..."
                : prePaymentLink
                ? "Waiting for Payment"
                : "Onboard Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Clients({
  onSelect,
}) {
  const [clients, setClients] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [filterOpen, setFilterOpen] =
    useState(false);

  const [planFilter, setPlanFilter] =
    useState("all");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [showOnboard, setShowOnboard] =
    useState(false);

  async function loadClients() {
    setLoading(true);
    setError("");

    try {
      const data =
        await apiRequest(
          "/api/admin/clients"
        );

      setClients(
        data.clients || []
      );
    } catch (error) {
      console.error(
        "Unable to load clients:",
        error
      );

      setError(
        error?.data?.message ||
          "Unable to load clients"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  const filteredClients =
    useMemo(() => {
      const query = search
        .trim()
        .toLowerCase();

      return clients.filter((client) => {
        const matchesSearch =
          !query ||
          [
            client.name,
            client.brandName,
            client.business,
            client.subdomain,
            client.ownerName,
            client.city,
            client.email,
            client.phone,
            client.plan,
            client.planName,
            client.status,
            client.subscriptionStatus,
            client.billingCycle,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value).toLowerCase().includes(query)
            );

        const matchesPlan =
          planFilter === "all" ||
          String(client.plan || "").toLowerCase() === planFilter;

        const matchesStatus =
          statusFilter === "all" ||
          String(client.status || "").toLowerCase() === statusFilter;

        return matchesSearch && matchesPlan && matchesStatus;
      });
    }, [clients, search, planFilter, statusFilter]);

  function handleCreated(
    client
  ) {
    setShowOnboard(false);

    setClients((current) => [
      client,
      ...current.filter(
        (item) =>
          item.id !== client.id
      ),
    ]);
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Clients"
        subtitle="Manage client workspaces, subscriptions, access and account health across Bispun"
        action={
          <button
            type="button"
            onClick={() =>
              setShowOnboard(true)
            }
            className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 shadow-sm"
          >
            <Plus size={14} />
            Onboard Client
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
            placeholder="Search clients..."
          />
        </div>

        <button
          type="button"
          onClick={() => setFilterOpen((current) => !current)}
          className={`h-9 px-3 border rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
            filterOpen || planFilter !== "all" || statusFilter !== "all"
              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Filter size={13} />
          Filter
        </button>

        <button
          type="button"
          onClick={loadClients}
          disabled={loading}
          className="h-9 px-3 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={13}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>
      </div>

      {filterOpen && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-end">
          <div className="min-w-[180px]">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Plan
            </label>
            <select
              value={planFilter}
              onChange={(event) => setPlanFilter(event.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-indigo-400"
            >
              <option value="all">All plans</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Company Status
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-indigo-400"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setPlanFilter("all");
              setStatusFilter("all");
              setSearch("");
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear Filters
          </button>

          <div className="sm:ml-auto text-[11px] font-semibold text-slate-500">
            {filteredClients.length} of {clients.length} clients
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-rose-200 bg-rose-50 text-sm text-rose-700">
          <AlertCircle
            size={15}
          />

          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl py-20 text-center text-sm text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          Loading clients...
        </div>
      ) : (
        <Table
          columns={[
            "Client",
            "Business",
            "Plan",
            "Users",
            "Leads",
            "Admissions",
            "Renewal",
            "Status",
            "",
          ]}
          empty="No clients found"
          rows={filteredClients.map(
            (client) => (
              <tr
                key={client.id}
                className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                onClick={() =>
                  onSelect(
                    client.id
                  )
                }
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-lg shadow-sm ${getAccent(
                        client.primaryColor
                      )} text-white text-xs font-semibold flex items-center justify-center`}
                    >
                      {getInitials(
                        client
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                        {client.name}
                      </div>

                      <div className="text-xs text-slate-500">
                        {client.subdomain ||
                          "No subdomain"}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3 text-sm text-slate-600">
                  {client.business ||
                    "—"}
                </td>

                <td className="px-4 py-3">
                  {client.plan ? (
                    <PlanPill
                      plan={
                        client.plan
                      }
                    />
                  ) : (
                    <Badge tone="slate">
                      No Plan
                    </Badge>
                  )}
                </td>

                <td className="px-4 py-3 text-sm text-slate-700">
                  {client.users}
                </td>

                <td className="px-4 py-3 text-sm text-slate-700">
                  {Number(
                    client.leads || 0
                  ).toLocaleString(
                    "en-IN"
                  )}
                </td>

                <td className="px-4 py-3 text-sm text-slate-700">
                  {Number(
                    client.admissions ||
                      0
                  ).toLocaleString(
                    "en-IN"
                  )}
                </td>

                <td className="px-4 py-3 text-sm text-slate-600">
                  {formatRenewal(
                    client.renewalDate
                  )}
                </td>

                <td className="px-4 py-3">
                  <Badge
                    tone={statusTone(
                      client.status
                    )}
                  >
                    {client.status}
                  </Badge>
                </td>

                <td className="px-4 py-3 text-right">
                  <ChevronRight
                    size={16}
                    className="text-slate-400 group-hover:text-indigo-500 transition-colors"
                  />
                </td>
              </tr>
            )
          )}
        />
      )}

      {showOnboard && (
        <OnboardClientModal
          onClose={() =>
            setShowOnboard(false)
          }
          onCreated={
            handleCreated
          }
        />
      )}
    </div>
  );
}
