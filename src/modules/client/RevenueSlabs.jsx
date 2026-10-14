import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Building2,
  UserCheck,
  Pencil,
  Plus,
  Trash2,
  X,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { apiRequest } from "../../lib/api";

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function bandText(slab) {
  if (!slab) return "—";
  return slab.maxAdmissions
    ? `${slab.minAdmissions}–${slab.maxAdmissions}`
    : `${slab.minAdmissions}+`;
}

/* =========================================================
   Edit Slabs modal (shared by colleges + employees)
========================================================= */

function EditSlabsModal({
  title,
  subtitle,
  initialSlabs,
  defaultSlabs,
  onClose,
  onSave,
}) {
  const [rows, setRows] = useState(
    initialSlabs && initialSlabs.length
      ? initialSlabs.map((s) => ({
          minAdmissions: String(s.minAdmissions ?? ""),
          maxAdmissions:
            s.maxAdmissions === null || s.maxAdmissions === undefined
              ? ""
              : String(s.maxAdmissions),
          amount: String(s.amount ?? ""),
        }))
      : [{ minAdmissions: "1", maxAdmissions: "", amount: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateRow(index, field, value) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { minAdmissions: "", maxAdmissions: "", amount: "" },
    ]);
  }

  function removeRow(index) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function applyDefaults() {
    setRows(
      (defaultSlabs || []).map((s) => ({
        minAdmissions: String(s.minAdmissions),
        maxAdmissions:
          s.maxAdmissions === null || s.maxAdmissions === undefined
            ? ""
            : String(s.maxAdmissions),
        amount: String(s.amount),
      }))
    );
  }

  async function handleSave() {
    setError("");
    const slabs = rows
      .filter(
        (row) =>
          String(row.minAdmissions).trim() !== "" ||
          String(row.amount).trim() !== ""
      )
      .map((row) => ({
        minAdmissions: Number(row.minAdmissions),
        maxAdmissions:
          String(row.maxAdmissions).trim() === ""
            ? null
            : Number(row.maxAdmissions),
        amount: Number(row.amount),
      }));

    if (!slabs.length) {
      setError("Add at least one slab, or cancel.");
      return;
    }

    setSaving(true);
    try {
      await onSave(slabs);
      onClose();
    } catch (saveError) {
      setError(saveError?.data?.message || saveError?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-[15px] font-bold text-slate-900">{title}</div>
            {subtitle ? (
              <div className="mt-0.5 text-[12px] text-slate-500">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <div className="mb-2 grid grid-cols-[1fr_1fr_1.3fr_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span>From</span>
            <span>To (blank = no limit)</span>
            <span>Rate per admission (₹)</span>
            <span />
          </div>

          <div className="space-y-2">
            {rows.map((row, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_1.3fr_auto] items-center gap-2"
              >
                <input
                  type="number"
                  min="1"
                  value={row.minAdmissions}
                  onChange={(e) =>
                    updateRow(index, "minAdmissions", e.target.value)
                  }
                  className="h-9 rounded-lg border border-slate-200 px-2.5 text-[13px] outline-none focus:border-indigo-400"
                  placeholder="1"
                />
                <input
                  type="number"
                  min="1"
                  value={row.maxAdmissions}
                  onChange={(e) =>
                    updateRow(index, "maxAdmissions", e.target.value)
                  }
                  className="h-9 rounded-lg border border-slate-200 px-2.5 text-[13px] outline-none focus:border-indigo-400"
                  placeholder="∞"
                />
                <input
                  type="number"
                  min="0"
                  value={row.amount}
                  onChange={(e) => updateRow(index, "amount", e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 px-2.5 text-[13px] outline-none focus:border-indigo-400"
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Remove slab"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Plus size={14} /> Add slab
            </button>
            {defaultSlabs && defaultSlabs.length ? (
              <button
                type="button"
                onClick={applyDefaults}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-3 text-[12px] font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                <Sparkles size={14} /> Use suggested
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            Save slabs
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Main component
========================================================= */

export default function RevenueSlabs({ selectedYear = "all", view = "college" }) {
  const [data, setData] = useState({
    colleges: [],
    employees: [],
    totals: {},
    defaults: { college: [], employee: [] },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // { kind, id|name, title, slabs }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest(
        `/api/client/revenue-slabs?year=${encodeURIComponent(selectedYear)}`
      );
      setData(result);
    } catch (loadError) {
      setError(
        loadError?.data?.message || "Unable to load slabs and incentives"
      );
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveCollege(partnerId, slabs) {
    await apiRequest(`/api/client/revenue-slabs/college/${partnerId}`, {
      method: "PUT",
      body: JSON.stringify({ slabs }),
    });
    await load();
  }

  async function saveEmployee(name, slabs) {
    await apiRequest(`/api/client/revenue-slabs/employee`, {
      method: "PUT",
      body: JSON.stringify({ counsellorName: name, slabs }),
    });
    await load();
  }

  const totals = data.totals || {};

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center">
        <div className="text-[13px] font-medium text-rose-700">{error}</div>
        <button
          type="button"
          onClick={load}
          className="mt-3 inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 text-[12px] font-semibold text-rose-700 hover:bg-rose-100"
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  /* ---------------- College Revenue ---------------- */
  if (view === "college") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="mb-1 text-[15px] font-semibold text-slate-900">
          College Revenue
        </div>
        <div className="mb-4 text-[13px] text-slate-500">
          Admissions multiplied by the applicable slab rate.
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2 text-left font-semibold">College</th>
                <th className="px-3 py-2 text-right font-semibold">Total Adm.</th>
                <th className="px-3 py-2 text-right font-semibold">In Bucket</th>
                <th className="px-3 py-2 text-right font-semibold">Buffer</th>
                <th className="px-3 py-2 text-center font-semibold">Slab</th>
                <th className="px-3 py-2 text-right font-semibold">Rate</th>
                <th className="px-3 py-2 text-right font-semibold">In Bucket ₹</th>
                <th className="px-3 py-2 text-right font-semibold">Buffer ₹</th>
                <th className="px-3 py-2 text-right font-semibold">Total Potential</th>
                <th className="px-3 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.colleges.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-8 text-center text-slate-400"
                  >
                    No colleges yet. Add admission colleges first.
                  </td>
                </tr>
              ) : (
                data.colleges.map((college) => (
                  <tr
                    key={college.id}
                    className="border-b border-slate-50 hover:bg-slate-50/60"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          <Building2 size={15} />
                        </span>
                        <div>
                          <div className="font-semibold text-slate-800">
                            {college.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {college.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-slate-700">
                      {college.totalAdmissions}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-emerald-600">
                      {college.inBucketAdmissions}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-amber-600">
                      {college.bufferZoneAdmissions}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {college.hasSlabs ? (
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                          {college.slabLabel || "—"}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          not set
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {money(college.rate)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-emerald-600">
                      {money(college.inBucketRevenue)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-amber-600">
                      {money(college.bufferZoneRevenue)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-indigo-700">
                      {money(college.totalPotential)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            kind: "college",
                            id: college.id,
                            title: `Edit Slabs — ${college.name}`,
                            subtitle:
                              "Each band's rate is per admission. Band is chosen by total admissions.",
                            slabs: college.slabs,
                          })
                        }
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <Pencil size={13} /> Edit Slabs
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.colleges.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-slate-100 text-[13px] font-bold text-slate-900">
                  <td className="px-3 py-3" colSpan={6}>
                    Total
                  </td>
                  <td className="px-3 py-3 text-right text-emerald-600">
                    {money(totals.inBucketRevenue)}
                  </td>
                  <td className="px-3 py-3 text-right text-amber-600">
                    {money(totals.bufferZoneRevenue)}
                  </td>
                  <td className="px-3 py-3 text-right text-indigo-700">
                    {money(totals.totalPotential)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        {editing && editing.kind === "college" ? (
          <EditSlabsModal
            title={editing.title}
            subtitle={editing.subtitle}
            initialSlabs={editing.slabs}
            defaultSlabs={data.defaults?.college}
            onClose={() => setEditing(null)}
            onSave={(slabs) => saveCollege(editing.id, slabs)}
          />
        ) : null}
      </div>
    );
  }

  /* ---------------- Staff Incentives ---------------- */
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold text-slate-900">
            Staff Incentives
          </div>
          <div className="text-[13px] text-slate-500">
            Each employee's admissions multiplied by their slab rate.
          </div>
        </div>
        <div className="rounded-lg bg-indigo-50 px-3 py-1.5 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">
            Total incentives
          </div>
          <div className="text-[15px] font-bold text-indigo-700">
            {money(totals.totalIncentives)}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2 text-left font-semibold">Employee</th>
              <th className="px-3 py-2 text-right font-semibold">Admissions</th>
              <th className="px-3 py-2 text-center font-semibold">Slab</th>
              <th className="px-3 py-2 text-right font-semibold">Rate</th>
              <th className="px-3 py-2 text-right font-semibold">Incentive</th>
              <th className="px-3 py-2 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                  No employees with admissions yet.
                </td>
              </tr>
            ) : (
              data.employees.map((employee) => (
                <tr
                  key={employee.name}
                  className="border-b border-slate-50 hover:bg-slate-50/60"
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <UserCheck size={15} />
                      </span>
                      <span className="font-semibold text-slate-800">
                        {employee.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-slate-700">
                    {employee.admissions}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {employee.hasSlabs ? (
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                        {employee.slabLabel || "—"}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">not set</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700">
                    {money(employee.rate)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-indigo-700">
                    {money(employee.incentiveAmount)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          kind: "employee",
                          id: employee.name,
                          title: `Edit Slabs — ${employee.name}`,
                          subtitle:
                            "Each band's rate is per admission. Band is chosen by this employee's admission count.",
                          slabs: employee.slabs,
                        })
                      }
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      <Pencil size={13} /> Edit Slabs
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && editing.kind === "employee" ? (
        <EditSlabsModal
          title={editing.title}
          subtitle={editing.subtitle}
          initialSlabs={editing.slabs}
          defaultSlabs={data.defaults?.employee}
          onClose={() => setEditing(null)}
          onSave={(slabs) => saveEmployee(editing.id, slabs)}
        />
      ) : null}
    </div>
  );
}
