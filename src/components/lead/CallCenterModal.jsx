import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  PhoneCall,
  RefreshCw,
  X,
} from "lucide-react";

import { apiRequest } from "../../lib/api";
import { formatUiDateTime } from "../../lib/uiPreferences";

const OUTCOMES = [
  "Connected",
  "Not Connected",
  "No Answer",
  "Busy",
  "Call Back Later",
  "Interested",
  "Not Interested",
  "Wrong Number",
  "Other",
];

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  if (!total) return "—";
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}m ${rest}s`;
}

function tone(status) {
  const key = String(status || "").toUpperCase();
  if (["CONNECTED", "COMPLETED"].includes(key)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["FAILED", "NOT_CONNECTED", "MISSED"].includes(key)) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function CallCenterModal({ open, onClose, lead }) {
  const [status, setStatus] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    status: "COMPLETED",
    outcome: "Connected",
    minutes: "",
    seconds: "",
    notes: "",
  });

  const phone = String(lead?.phone || "").trim();
  const title = lead?.name || "Lead";

  const historyQuery = useMemo(() => {
    if (lead?.id) return `leadId=${encodeURIComponent(lead.id)}`;
    if (phone) return `phone=${encodeURIComponent(phone)}`;
    return "";
  }, [lead?.id, phone]);

  async function loadData() {
    if (!open) return;
    setLoading(true);
    setError("");
    try {
      const [statusData, historyData] = await Promise.all([
        apiRequest("/api/client/telephony/status"),
        historyQuery
          ? apiRequest(`/api/client/telephony/history?${historyQuery}&limit=30`)
          : Promise.resolve({ calls: [] }),
      ]);
      setStatus(statusData);
      setCalls(historyData.calls || []);
    } catch (err) {
      setError(err?.data?.message || "Unable to load call history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setActiveCall(null);
    setError("");
    setSuccess("");
    setForm({ status: "COMPLETED", outcome: "Connected", minutes: "", seconds: "", notes: "" });
    loadData();
  }, [open, lead?.id, phone]);

  if (!open) return null;

  async function startCall() {
    if (!phone) {
      setError("This lead does not have a phone number.");
      return;
    }
    setCalling(true);
    setError("");
    setSuccess("");
    try {
      const data = await apiRequest("/api/client/telephony/calls", {
        method: "POST",
        body: JSON.stringify({
          leadId: lead?.id || null,
          leadName: title,
          phone,
        }),
      });
      setActiveCall(data.call || null);
      setSuccess(data.message || "Call started.");
      await loadData();
      if (data.dialMode === "DEVICE" && data.dialUrl) {
        window.location.href = data.dialUrl;
      }
    } catch (err) {
      setError(err?.data?.message || "Unable to start call.");
    } finally {
      setCalling(false);
    }
  }

  function editCall(call) {
    setActiveCall(call);
    const total = Number(call.durationSeconds || 0);
    setForm({
      status: call.status === "CONNECTED" ? "COMPLETED" : call.status || "COMPLETED",
      outcome: call.outcome || (call.status === "NOT_CONNECTED" ? "Not Connected" : "Connected"),
      minutes: total ? String(Math.floor(total / 60)) : "",
      seconds: total ? String(total % 60) : "",
      notes: call.notes || "",
    });
  }

  async function saveOutcome(event) {
    event.preventDefault();
    if (!activeCall?.id) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const durationSeconds = Math.max(0, Number(form.minutes || 0) * 60 + Number(form.seconds || 0));
      await apiRequest(`/api/client/telephony/calls/${activeCall.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: form.status,
          outcome: form.outcome,
          durationSeconds,
          notes: form.notes,
        }),
      });
      setSuccess("Call outcome saved.");
      setActiveCall(null);
      await loadData();
    } catch (err) {
      setError(err?.data?.message || "Unable to save call outcome.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[2px]">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">
              <PhoneCall size={14} /> Cloud Telephony
            </div>
            <div className="mt-1 text-[18px] font-bold text-slate-950">{title}</div>
            <div className="mt-1 text-[12px] text-slate-500">{phone || "No phone number"}</div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Calling mode</div>
              <div className="mt-1 text-[13px] font-bold text-slate-900">
                {status?.cloudDialEnabled ? `${status.provider} cloud calling` : "CRM dial + call tracking"}
              </div>
              <div className="mt-1 text-[11px] leading-5 text-slate-500">
                {status?.cloudDialEnabled
                  ? "Calls are initiated through the configured telephony provider. Provider callbacks can add duration, recording and missed-call history automatically."
                  : "The Call button opens the device dialer and Bispun stores the call history/outcome. Connect a telephony provider later for automatic duration, recordings and inbound/missed calls."}
              </div>
            </div>
            <button type="button" onClick={startCall} disabled={calling || !phone} className="inline-flex min-h-[86px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-[13px] font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
              {calling ? <RefreshCw size={16} className="animate-spin" /> : <PhoneCall size={17} />}
              {status?.cloudDialEnabled ? "Call from CRM" : "Dial & Track"}
            </button>
          </div>

          {error ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] font-semibold text-rose-700">
              <AlertCircle size={14} className="mt-0.5" /> {error}
            </div>
          ) : null}
          {success ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] font-semibold text-emerald-700">
              <CheckCircle2 size={14} className="mt-0.5" /> {success}
            </div>
          ) : null}

          {activeCall ? (
            <form onSubmit={saveOutcome} className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-bold text-slate-900">Record call outcome</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">Save connected/not connected, duration and the result of the call.</div>
                </div>
                <button type="button" onClick={() => setActiveCall(null)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800">Cancel</button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label>
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Connection</span>
                  <select value={form.status} onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px]">
                    <option value="COMPLETED">Connected / Completed</option>
                    <option value="NOT_CONNECTED">Not Connected</option>
                    <option value="MISSED">Missed</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Call outcome</span>
                  <select value={form.outcome} onChange={(e) => setForm((c) => ({ ...c, outcome: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px]">
                    {OUTCOMES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Duration minutes</span>
                  <input type="number" min="0" value={form.minutes} onChange={(e) => setForm((c) => ({ ...c, minutes: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px]" />
                </label>
                <label>
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Seconds</span>
                  <input type="number" min="0" max="59" value={form.seconds} onChange={(e) => setForm((c) => ({ ...c, seconds: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px]" />
                </label>
                <label className="sm:col-span-2 lg:col-span-4">
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Notes</span>
                  <textarea rows={3} value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} placeholder="What happened on the call?" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px]" />
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-[12px] font-semibold text-white disabled:opacity-50">
                  {saving ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Save outcome
                </button>
              </div>
            </form>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2 text-[13px] font-bold text-slate-900"><History size={14} /> Call history</div>
              <button type="button" onClick={loadData} disabled={loading} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-[12px] text-slate-500">Loading call history...</div>
            ) : calls.length === 0 ? (
              <div className="py-12 text-center text-[12px] text-slate-500">No calls logged for this lead yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {calls.map((call) => (
                  <button key={call.id} type="button" onClick={() => editCall(call)} className="grid w-full grid-cols-1 gap-2 px-4 py-3 text-left hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_150px_110px_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-bold text-slate-900">{String(call.direction || "OUTBOUND").replaceAll("_", " ")}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone(call.status)}`}>{String(call.status || "").replaceAll("_", " ")}</span>
                      </div>
                      <div className="mt-1 truncate text-[11px] text-slate-500">{call.outcome || "No outcome recorded"}{call.notes ? ` · ${call.notes}` : ""}</div>
                    </div>
                    <div className="text-[11px] text-slate-500">{formatUiDateTime(call.startedAt)}</div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600"><Clock size={11} /> {formatDuration(call.durationSeconds)}</div>
                    <div className="flex items-center justify-end gap-2">
                      {call.recordingUrl ? (
                        <a href={call.recordingUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex h-7 items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 text-[10px] font-semibold text-indigo-700">
                          Recording <ExternalLink size={10} />
                        </a>
                      ) : null}
                      <span className="text-[10px] font-semibold text-slate-400">Edit</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
