import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Plus,
  Search,
  X,
  History,
  Pencil,
  Ticket,
} from "lucide-react";

import { apiRequest } from "../../lib/api";

const inr = (n) =>
  "₹" +
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const toDateInput = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
};

function couponState(c) {
  if (!c.active) return { label: "Inactive", cls: "bg-slate-100 text-slate-600" };
  if (c.validUntil && new Date(c.validUntil) < new Date())
    return { label: "Expired", cls: "bg-amber-100 text-amber-700" };
  if (c.maxRedemptions != null && c.usedCount >= c.maxRedemptions)
    return { label: "Exhausted", cls: "bg-rose-100 text-rose-700" };
  return { label: "Active", cls: "bg-emerald-100 text-emerald-700" };
}

const EMPTY_FORM = {
  code: "",
  description: "",
  finalAmount: "",
  active: false,
  validFrom: "",
  validUntil: "",
  maxRedemptions: "",
  perCustomerLimit: "",
  eligiblePlanKeys: [],
};

export default function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // coupon being edited, or null = create
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [historyFor, setHistoryFor] = useState(null);
  const [redemptions, setRedemptions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const triggerRef = useRef(null);
  const dialogTitleRef = useRef(null);
  const firstFieldRef = useRef(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [cRes, pRes] = await Promise.all([
        apiRequest(`/api/admin/coupons${query ? `?q=${encodeURIComponent(query)}` : ""}`),
        apiRequest("/api/admin/plans").catch(() => ({ plans: [] })),
      ]);
      setCoupons(cRes.coupons || []);
      setPlans(pRes.plans || []);
    } catch (e) {
      setError(e?.data?.message || "Unable to load coupons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  // Escape closes whichever overlay is open; focus returns to the trigger.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        if (modalOpen) closeModal();
        else if (historyFor) setHistoryFor(null);
      }
    }
    if (modalOpen || historyFor) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [modalOpen, historyFor]); // eslint-disable-line

  useEffect(() => {
    if (modalOpen) {
      requestAnimationFrame(() =>
        (firstFieldRef.current || dialogTitleRef.current)?.focus()
      );
    }
  }, [modalOpen]);

  function openCreate() {
    triggerRef.current = document.activeElement;
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(c) {
    triggerRef.current = document.activeElement;
    setEditing(c);
    setForm({
      code: c.code,
      description: c.description || "",
      finalAmount: String(c.finalAmount ?? ""),
      active: c.active,
      validFrom: toDateInput(c.validFrom),
      validUntil: toDateInput(c.validUntil),
      maxRedemptions: c.maxRedemptions == null ? "" : String(c.maxRedemptions),
      perCustomerLimit: c.perCustomerLimit == null ? "" : String(c.perCustomerLimit),
      eligiblePlanKeys: c.eligiblePlanKeys || [],
    });
    setFormError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus?.());
  }

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function togglePlan(key) {
    setForm((f) => ({
      ...f,
      eligiblePlanKeys: f.eligiblePlanKeys.includes(key)
        ? f.eligiblePlanKeys.filter((k) => k !== key)
        : [...f.eligiblePlanKeys, key],
    }));
  }

  async function saveCoupon(e) {
    e?.preventDefault?.();
    setFormError("");
    const code = form.code.trim().toUpperCase();
    if (!editing && !/^[A-Z0-9]{4,40}$/.test(code)) {
      setFormError("Code must be 4–40 letters/digits");
      return;
    }
    const finalAmount = Number(form.finalAmount);
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      setFormError("Enter a valid GST-inclusive amount");
      return;
    }
    setSaving(true);
    try {
      const body = {
        description: form.description,
        finalAmount,
        active: form.active,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        maxRedemptions: form.maxRedemptions === "" ? null : Number(form.maxRedemptions),
        perCustomerLimit: form.perCustomerLimit === "" ? null : Number(form.perCustomerLimit),
        eligiblePlanKeys: form.eligiblePlanKeys,
      };
      if (editing) {
        await apiRequest(`/api/admin/coupons/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setStatus(`Coupon ${editing.code} updated.`);
      } else {
        await apiRequest("/api/admin/coupons", {
          method: "POST",
          body: JSON.stringify({ ...body, code }),
        });
        setStatus(`Coupon ${code} created.`);
      }
      closeModal();
      await load();
    } catch (err) {
      setFormError(err?.data?.message || "Unable to save coupon");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c) {
    try {
      await apiRequest(`/api/admin/coupons/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !c.active }),
      });
      setStatus(`${c.code} ${!c.active ? "activated" : "deactivated"}.`);
      await load();
    } catch (err) {
      setError(err?.data?.message || "Unable to update coupon");
    }
  }

  async function openHistory(c) {
    setHistoryFor(c);
    setHistoryLoading(true);
    setRedemptions([]);
    try {
      const res = await apiRequest(`/api/admin/coupons/${c.id}/redemptions`);
      setRedemptions(res.redemptions || []);
    } catch (err) {
      setError(err?.data?.message || "Unable to load redemptions");
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Ticket size={20} className="text-indigo-600" aria-hidden="true" />
            Coupons
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Signup discount codes. Amounts are GST-inclusive final payable totals.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
        >
          <Plus size={16} aria-hidden="true" /> New coupon
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="mb-4 flex gap-2"
        role="search"
      >
        <label htmlFor="coupon-search" className="sr-only">
          Search coupons by code or description
        </label>
        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            id="coupon-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search coupons…"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          Search
        </button>
      </form>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <caption className="sr-only">Coupons</caption>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-3">Code</th>
              <th scope="col" className="px-4 py-3">Amount (incl. GST)</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Used / Remaining</th>
              <th scope="col" className="px-4 py-3">Valid</th>
              <th scope="col" className="px-4 py-3">Eligible plans</th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  <Loader2 size={18} className="mx-auto animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  <span className="sr-only">Loading coupons</span>
                </td>
              </tr>
            ) : coupons.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No coupons found.
                </td>
              </tr>
            ) : (
              coupons.map((c) => {
                const st = couponState(c);
                return (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0">
                    <th scope="row" className="px-4 py-3 text-left font-mono font-semibold text-slate-900">
                      {c.code}
                    </th>
                    <td className="px-4 py-3 text-slate-700">{inr(c.finalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {c.usedCount}
                      {c.maxRedemptions != null ? ` / ${c.remaining} left` : " / ∞"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {fmtDate(c.validFrom)} – {fmtDate(c.validUntil)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {(c.eligiblePlanKeys || []).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={c.active}
                          aria-label={`Coupon ${c.code} active`}
                          onClick={() => toggleActive(c)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 ${
                            c.active ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              c.active ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          aria-label={`Edit coupon ${c.code}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openHistory(c)}
                          aria-label={`View redemption history for ${c.code}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                        >
                          <History size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create / edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupon-dialog-title"
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <h2
                id="coupon-dialog-title"
                ref={dialogTitleRef}
                tabIndex={-1}
                className="text-lg font-semibold text-slate-900 focus:outline-none"
              >
                {editing ? `Edit coupon ${editing.code}` : "New coupon"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close dialog"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={saveCoupon} className="mt-4 space-y-3" noValidate>
              {formError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label htmlFor="cf-code" className="block text-xs font-medium text-slate-600 mb-1">
                  Code {!editing && <span className="text-rose-500" aria-hidden="true">*</span>}
                  {!editing && <span className="sr-only"> (required)</span>}
                </label>
                <input
                  id="cf-code"
                  ref={!editing ? firstFieldRef : undefined}
                  type="text"
                  value={form.code}
                  disabled={!!editing}
                  onChange={(e) => setField("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="CBSPN2W0W0K0C"
                />
              </div>

              <div>
                <label htmlFor="cf-amount" className="block text-xs font-medium text-slate-600 mb-1">
                  Amount (GST-inclusive) <span className="text-rose-500" aria-hidden="true">*</span>
                  <span className="sr-only"> (required)</span>
                </label>
                <input
                  id="cf-amount"
                  ref={editing ? firstFieldRef : undefined}
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.finalAmount}
                  onChange={(e) => setField("finalAmount", e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  placeholder="20000"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  The exact total the customer pays. GST is carved out of this, not added on top.
                </p>
              </div>

              <div>
                <label htmlFor="cf-desc" className="block text-xs font-medium text-slate-600 mb-1">
                  Description
                </label>
                <input
                  id="cf-desc"
                  type="text"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cf-from" className="block text-xs font-medium text-slate-600 mb-1">Valid from</label>
                  <input id="cf-from" type="date" value={form.validFrom} onChange={(e) => setField("validFrom", e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400" />
                </div>
                <div>
                  <label htmlFor="cf-until" className="block text-xs font-medium text-slate-600 mb-1">Valid until</label>
                  <input id="cf-until" type="date" value={form.validUntil} onChange={(e) => setField("validUntil", e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400" />
                </div>
                <div>
                  <label htmlFor="cf-max" className="block text-xs font-medium text-slate-600 mb-1">Max redemptions</label>
                  <input id="cf-max" type="number" min="0" step="1" value={form.maxRedemptions} onChange={(e) => setField("maxRedemptions", e.target.value)} placeholder="Unlimited" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400" />
                </div>
                <div>
                  <label htmlFor="cf-per" className="block text-xs font-medium text-slate-600 mb-1">Per-customer limit</label>
                  <input id="cf-per" type="number" min="0" step="1" value={form.perCustomerLimit} onChange={(e) => setField("perCustomerLimit", e.target.value)} placeholder="Unlimited" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400" />
                </div>
              </div>

              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-semibold text-slate-600">Eligible plans</legend>
                <div className="flex flex-wrap gap-3">
                  {plans.length === 0 && <span className="text-xs text-slate-400">No plans found</span>}
                  {plans.map((p) => (
                    <label key={p.key} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.eligiblePlanKeys.includes(p.key)}
                        onChange={() => togglePlan(p.key)}
                        className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="inline-flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.active}
                  aria-label="Coupon active"
                  onClick={() => setField("active", !form.active)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 ${
                    form.active ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span aria-hidden="true" className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.active ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                  Cancel
                </button>
                <button type="submit" disabled={saving} aria-busy={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2">
                  {saving && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                  {editing ? "Save changes" : "Create coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Redemption history */}
      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="coupon-history-title" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 id="coupon-history-title" tabIndex={-1} className="text-lg font-semibold text-slate-900 focus:outline-none">
                Redemptions — {historyFor.code}
              </h2>
              <button type="button" onClick={() => setHistoryFor(null)} aria-label="Close dialog" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              {historyLoading ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  <Loader2 size={16} className="mx-auto animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  <span className="sr-only">Loading redemptions</span>
                </p>
              ) : redemptions.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No redemptions yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <caption className="sr-only">Redemptions for {historyFor.code}</caption>
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th scope="col" className="px-3 py-2">Status</th>
                      <th scope="col" className="px-3 py-2">Amount</th>
                      <th scope="col" className="px-3 py-2">Customer</th>
                      <th scope="col" className="px-3 py-2">Plan</th>
                      <th scope="col" className="px-3 py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redemptions.map((r) => (
                      <tr key={r.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-2">{r.status}</td>
                        <td className="px-3 py-2">{inr(r.amount)}</td>
                        <td className="px-3 py-2 text-slate-600">{r.customerEmail || "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{r.planKey}</td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                          {fmtDate(r.consumedAt || r.reservedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
