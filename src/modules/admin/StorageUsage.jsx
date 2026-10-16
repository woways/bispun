import { useEffect, useMemo, useState } from "react";

import {
  HardDrive,
  Files,
  Building2,
  IndianRupee,
  Loader2,
  RefreshCw,
  AlertCircle,
  Info,
  X,
} from "lucide-react";

import { StatCard } from "../../components/ui";
import { apiRequest } from "../../lib/api";

function fmtSize(bytes) {
  const b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(3)} GB`;
}

// Show up to 4 decimals so tiny amounts (e.g. ₹0.0032) are visible.
function fmtInr(n) {
  const v = Number(n || 0);
  return `₹${v.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

const GB = 1024 * 1024 * 1024;

export default function StorageUsage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [companyId, setCompanyId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      const res = await apiRequest(
        `/api/admin/s3-usage${qs ? `?${qs}` : ""}`
      );
      setData(res);
    } catch (err) {
      setError(err?.message || "Unable to load storage usage");
    } finally {
      setLoading(false);
    }
  }

  // Reload from the server whenever the date window changes (date filtering
  // happens server-side). Company filtering is applied client-side below.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const storageRate = data?.storageRateInr ?? 2.1;

  // Company dropdown — driven by the live DB list, so new clients auto-appear.
  const companyOptions = data?.allCompanies || [];

  // Rows after applying the company filter.
  const rows = useMemo(() => {
    const all = data?.companies || [];
    if (companyId === "all") return all;
    return all.filter((r) => r.companyId === companyId);
  }, [data, companyId]);

  // Totals recomputed from the visible rows (so they respect the company filter).
  const totals = useMemo(() => {
    if (companyId === "all" && data?.totals) return data.totals;
    const bytes = rows.reduce((s, r) => s + Number(r.bytes || 0), 0);
    const fileCount = rows.reduce((s, r) => s + Number(r.fileCount || 0), 0);
    const gb = bytes / GB;
    return {
      bytes,
      gb,
      fileCount,
      estMonthlyStorageInr: gb * storageRate,
      companyCount: rows.length,
    };
  }, [rows, companyId, data, storageRate]);

  const hasActiveFilters = companyId !== "all" || from || to;

  function clearFilters() {
    setCompanyId("all");
    setFrom("");
    setTo("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-indigo-600" />
            Storage (AWS S3)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            File storage used per company in the Bispun S3 bucket (Mumbai).
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">
            Company
          </label>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="h-9 min-w-[200px] px-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="all">All companies</option>
            {companyOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">
            Uploaded from
          </label>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 px-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">
            Uploaded to
          </label>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 px-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>

        {hasActiveFilters ? (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={HardDrive}
              label="Total storage"
              value={fmtSize(totals.bytes)}
              tone="indigo"
            />
            <StatCard
              icon={Files}
              label="Total files"
              value={Number(totals.fileCount).toLocaleString("en-IN")}
              tone="sky"
            />
            <StatCard
              icon={Building2}
              label={companyId === "all" ? "Companies with files" : "Company"}
              value={
                companyId === "all"
                  ? Number(totals.companyCount).toLocaleString("en-IN")
                  : rows[0]?.companyName || "—"
              }
              tone="emerald"
            />
            <StatCard
              icon={IndianRupee}
              label="Est. storage / month"
              value={fmtInr(totals.estMonthlyStorageInr)}
              tone="amber"
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
            <span>
              Cost shown is <strong>storage only</strong> at ₹{storageRate}
              /GB-month (shown to 4 decimals so small amounts are visible). The
              date filter shows files <strong>uploaded</strong> in that range —
              not a past total. Data transfer (downloads) is billed separately
              by AWS.
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Company</th>
                  <th className="text-right font-semibold px-4 py-3">Files</th>
                  <th className="text-right font-semibold px-4 py-3">Storage</th>
                  <th className="text-right font-semibold px-4 py-3">
                    Est. / month
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      No files match these filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.companyId} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {c.companyName}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {c.companyId}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {Number(c.fileCount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {fmtSize(c.bytes)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {fmtInr(c.estMonthlyStorageInr)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
