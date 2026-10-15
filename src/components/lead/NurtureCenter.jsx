import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Users,
  Workflow,
  X,
} from "lucide-react";

import { apiRequest } from "../../lib/api";
import { formatUiDateTime } from "../../lib/uiPreferences";

const EMPTY_FORM = {
  name: "Lead Re-Engagement",
  description: "Re-engage inactive leads with WhatsApp/email, create a follow-up task, then alert a manager when there is still no response.",
  whatsappTemplateName: "",
  whatsappLanguageCode: "en_US",
  waitAfterWhatsappHours: 24,
  emailSubject: "Following up on your enquiry",
  emailMessage:
    "Hi {{name}},\n\nWe are following up on your enquiry about {{course}}. Please reply if you would like us to help with the next step.\n\nThank you.",
  waitAfterEmailHours: 24,
  waitBeforeManagerHours: 24,
};

function statusTone(status) {
  const key = String(status || "").toUpperCase();
  if (key === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (key === "COMPLETED" || key === "REPLIED") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (key === "FAILED") return "bg-rose-50 text-rose-700 border-rose-200";
  if (key === "PAUSED") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function hoursToMinutes(value) {
  return Math.max(0, Math.round(Number(value || 0) * 60));
}

function buildSteps(form) {
  const steps = [];
  const templateName = String(form.whatsappTemplateName || "").trim();

  if (templateName) {
    steps.push({
      type: "WHATSAPP_TEMPLATE",
      delayMinutes: 0,
      templateName,
      languageCode: form.whatsappLanguageCode || "en_US",
    });
  }

  steps.push({
    type: "EMAIL",
    delayMinutes: templateName ? hoursToMinutes(form.waitAfterWhatsappHours) : 0,
    subject: form.emailSubject,
    message: form.emailMessage,
  });
  steps.push({
    type: "FOLLOW_UP_TASK",
    delayMinutes: hoursToMinutes(form.waitAfterEmailHours),
    message: "Smart Nurture follow-up: contact {{name}}, review the communication history and record the outcome.",
    durationMinutes: 30,
  });
  steps.push({
    type: "MANAGER_NOTIFICATION",
    delayMinutes: hoursToMinutes(form.waitBeforeManagerHours),
    message: "{{name}} has not replied after the nurture sequence. Please review this lead and intervene if needed.",
  });

  return steps;
}

export default function NurtureCenter({ open, onClose, selectedLeadIds = [] }) {
  const [sequences, setSequences] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [showCreate, setShowCreate] = useState(false);

  const selectedCount = selectedLeadIds.length;
  const activeSequences = useMemo(
    () => sequences.filter((item) => item.status !== "ARCHIVED"),
    [sequences]
  );

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [sequenceData, enrollmentData] = await Promise.all([
        apiRequest("/api/client/nurture/sequences"),
        apiRequest("/api/client/nurture/enrollments?limit=40"),
      ]);
      setSequences(sequenceData.sequences || []);
      setEnrollments(enrollmentData.enrollments || []);
    } catch (err) {
      setError(err?.data?.message || "Unable to load Smart Nurture.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setError("");
    setSuccess("");
    loadData();
  }, [open]);

  if (!open) return null;

  async function createSequence(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.emailSubject.trim() || !form.emailMessage.trim()) {
      setError("Sequence name, email subject and email message are required.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const data = await apiRequest("/api/client/nurture/sequences", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          steps: buildSteps(form),
        }),
      });
      setSuccess(`${data.sequence?.name || "Sequence"} created.`);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      setError(err?.data?.message || "Unable to create sequence.");
    } finally {
      setSaving(false);
    }
  }

  async function enroll(sequence) {
    if (!selectedCount) {
      setError("Select one or more leads in Lead Store first.");
      return;
    }
    setBusyId(sequence.id);
    setError("");
    setSuccess("");
    try {
      const data = await apiRequest(`/api/client/nurture/sequences/${sequence.id}/enroll`, {
        method: "POST",
        body: JSON.stringify({ leadIds: selectedLeadIds }),
      });
      setSuccess(data.message || "Leads enrolled successfully.");
      await loadData();
    } catch (err) {
      setError(err?.data?.message || "Unable to start nurture sequence.");
    } finally {
      setBusyId("");
    }
  }

  async function toggleSequence(sequence) {
    const nextStatus = sequence.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setBusyId(sequence.id);
    setError("");
    try {
      await apiRequest(`/api/client/nurture/sequences/${sequence.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadData();
    } catch (err) {
      setError(err?.data?.message || "Unable to update sequence.");
    } finally {
      setBusyId("");
    }
  }

  async function runNow() {
    setBusyId("run-now");
    setError("");
    setSuccess("");
    try {
      const data = await apiRequest("/api/client/nurture/run-now", { method: "POST" });
      setSuccess(`${data.processed || 0} due nurture item${Number(data.processed || 0) === 1 ? "" : "s"} processed.`);
      await loadData();
    } catch (err) {
      setError(err?.data?.message || "Unable to process nurture queue.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[2px]">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">
              <Workflow size={14} /> Smart Nurture & Re-Engagement
            </div>
            <div className="mt-1 text-[18px] font-bold text-slate-950">Automated follow-up sequences</div>
            <div className="mt-1 text-[12px] text-slate-500">
              WhatsApp template → Email → Follow-up task → Manager alert if there is still no reply.
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[12px] font-bold text-indigo-900">Selected audience</div>
              <div className="mt-1 flex items-center gap-2 text-[13px] text-indigo-700">
                <Users size={14} /> {selectedCount} lead{selectedCount === 1 ? "" : "s"} selected in Lead Store
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={runNow} disabled={busyId === "run-now"} className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 text-[12px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
                <RefreshCw size={13} className={busyId === "run-now" ? "animate-spin" : ""} /> Process due now
              </button>
              <button type="button" onClick={() => setShowCreate((value) => !value)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-[12px] font-semibold text-white hover:bg-indigo-700">
                <Plus size={13} /> New sequence
              </button>
            </div>
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

          {showCreate ? (
            <form onSubmit={createSequence} className="mb-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="mb-4">
                <div className="text-[14px] font-bold text-slate-900">Create nurture sequence</div>
                <div className="mt-1 text-[11px] text-slate-500">WhatsApp is optional. If used, enter an approved Meta template name.</div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Sequence name *</span>
                  <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px]" />
                </label>
                <label>
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Approved WhatsApp template name</span>
                  <input value={form.whatsappTemplateName} onChange={(e) => setForm((c) => ({ ...c, whatsappTemplateName: e.target.value }))} placeholder="Optional · e.g. lead_follow_up" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px]" />
                </label>
                <label>
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Wait after WhatsApp (hours)</span>
                  <input type="number" min="0" value={form.waitAfterWhatsappHours} onChange={(e) => setForm((c) => ({ ...c, waitAfterWhatsappHours: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px]" />
                </label>
                <label>
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Email subject *</span>
                  <input value={form.emailSubject} onChange={(e) => setForm((c) => ({ ...c, emailSubject: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px]" />
                </label>
                <label className="lg:col-span-2">
                  <span className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-600">
                    <span>Email message *</span>
                    <span className="font-normal text-slate-400">Use {"{{name}}"}, {"{{phone}}"}, {"{{email}}"}, {"{{course}}"}</span>
                  </span>
                  <textarea rows={5} value={form.emailMessage} onChange={(e) => setForm((c) => ({ ...c, emailMessage: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] leading-5" />
                </label>
                <label>
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Wait before follow-up task (hours)</span>
                  <input type="number" min="0" value={form.waitAfterEmailHours} onChange={(e) => setForm((c) => ({ ...c, waitAfterEmailHours: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px]" />
                </label>
                <label>
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Wait before manager alert (hours)</span>
                  <input type="number" min="0" value={form.waitBeforeManagerHours} onChange={(e) => setForm((c) => ({ ...c, waitBeforeManagerHours: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px]" />
                </label>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-[12px] font-semibold text-white disabled:opacity-50">
                  {saving ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />} Create sequence
                </button>
              </div>
            </form>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <div className="text-[13px] font-bold text-slate-900">Sequences</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">Start, pause and reuse nurture workflows.</div>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">{activeSequences.length} total</span>
              </div>

              {loading ? (
                <div className="py-12 text-center text-[12px] text-slate-500">Loading sequences...</div>
              ) : activeSequences.length === 0 ? (
                <div className="py-12 text-center text-[12px] text-slate-500">No nurture sequences yet.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeSequences.map((sequence) => {
                    const counts = sequence.counts || {};
                    return (
                      <div key={sequence.id} className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-[13px] font-bold text-slate-900">{sequence.name}</div>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone(sequence.status)}`}>{sequence.status}</span>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500">{sequence.steps?.length || 0} steps · {counts.ACTIVE || 0} active · {counts.REPLIED || 0} replied · {counts.COMPLETED || 0} completed</div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(sequence.steps || []).map((step, index) => (
                                <span key={`${sequence.id}-${index}`} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                  {step.type === "EMAIL" ? <Mail size={10} /> : step.type === "WHATSAPP_TEMPLATE" ? <MessageCircle size={10} /> : <Clock size={10} />}
                                  {String(step.type || "").replaceAll("_", " ")}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <button type="button" onClick={() => toggleSequence(sequence)} disabled={busyId === sequence.id} title={sequence.status === "ACTIVE" ? "Pause" : "Resume"} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50">
                              {sequence.status === "ACTIVE" ? <Pause size={13} /> : <Play size={13} />}
                            </button>
                            <button type="button" onClick={() => enroll(sequence)} disabled={!selectedCount || sequence.status !== "ACTIVE" || busyId === sequence.id} className="h-8 rounded-lg bg-indigo-600 px-3 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
                              {busyId === sequence.id ? "Starting..." : "Start selected"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="text-[13px] font-bold text-slate-900">Recent nurture activity</div>
                <div className="mt-0.5 text-[11px] text-slate-500">Latest lead enrollments and outcomes.</div>
              </div>
              {enrollments.length === 0 ? (
                <div className="py-12 text-center text-[12px] text-slate-500">No nurture activity yet.</div>
              ) : (
                <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
                  {enrollments.map((item) => (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-bold text-slate-900">{item.leadName || "Lead"}</div>
                          <div className="mt-0.5 truncate text-[11px] text-slate-500">{item.sequence?.name || "Sequence"}</div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone(item.status)}`}>{item.status}</span>
                      </div>
                      <div className="mt-2 text-[10px] text-slate-400">
                        {item.nextRunAt ? `Next: ${formatUiDateTime(item.nextRunAt)}` : item.completedAt ? `Finished: ${formatUiDateTime(item.completedAt)}` : "No pending step"}
                      </div>
                      {item.lastError ? <div className="mt-1 text-[10px] font-medium text-rose-600">{item.lastError}</div> : null}
                      {item.logs?.[0]?.summary ? <div className="mt-1.5 text-[10px] leading-4 text-slate-500">{item.logs[0].summary}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
