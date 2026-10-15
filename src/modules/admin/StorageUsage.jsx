import { useEffect, useState } from "react";

import {
  HardDrive,
  Files,
  Building2,
  IndianRupee,
  Loader2,
  RefreshCw,
  AlertCircle,
  Info,
} from "lucide-react";

import { StatCard } from "../../components/ui";
import { apiRequest } from "../../lib/api";

function fmtSize(bytes) {
  const b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtInr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function StorageUsage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest("/api/admin/s3-usage");
      setData(res);
    } catch (err) {
      setError(err?.message || "Unable to load storage usage");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totals = data?.totals;

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

      {totals ? (
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
              label="Companies with files"
              value={Number(totals.companyCount).toLocaleString("en-IN")}
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
              Cost shown is <strong>storage only</strong> at ₹
              {data.storageRateInr}/GB-month. Data transfer (downloads) is
              billed separately by AWS and is usually the larger cost. Check the
              AWS Billing console for the exact monthly total.
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
                {data.companies.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      No files stored yet.
                    </td>
                  </tr>
                ) : (
                  data.companies.map((c) => (
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
