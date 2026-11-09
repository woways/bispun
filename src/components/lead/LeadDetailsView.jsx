import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  Check,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { apiRequest } from "../../lib/api";

function formatLeadId(leadNumber) {
  const value = Number(leadNumber);
  return Number.isInteger(value) && value > 0
    ? `LD${String(value).padStart(3, "0")}`
    : "—";
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replaceAll("_", " ");
}

function leadInitial(name) {
  const value = String(name || "L").trim();
  return value ? value.charAt(0).toUpperCase() : "L";
}

function summaryTone(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("admission")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value.includes("lost")) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-indigo-100 bg-indigo-50 text-indigo-700";
}

function DetailItem({ label, value, full = false }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 break-words text-[14px] font-medium text-slate-800">
        {displayValue(value)}
      </div>
    </div>
  );
}

function ActivityRow({ item }) {
  const iconMap = {
    created: FileText,
    remark: MessageSquare,
    communication: Mail,
    followup: CalendarClock,
  };
  const Icon = iconMap[item.type] || Activity;

  return (
    <div className="relative flex gap-3 pb-5 last:pb-0">
      <div className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 text-indigo-600">
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-800">{item.title}</div>
            {item.detail ? (
              <div className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-slate-500">
                {item.detail}
              </div>
            ) : null}
          </div>
          <div className="shrink-0 text-[11px] text-slate-400">{formatDateTime(item.at)}</div>
        </div>
      </div>
    </div>
  );
}

export default function LeadDetailsView({
  lead,
  onBack,
  onEdit,
  onLeadChange,
}) {
  // Move focus to the detail heading when the view opens (covers both a normal
  // row click and a deep-link from a notification / dashboard), so keyboard and
  // screen-reader users land in the detail instead of at document top.
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const [tab, setTab] = useState("activity");
  const [remarks, setRemarks] = useState(lead?.remarks || []);
  const [remarkDraft, setRemarkDraft] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [editingRemarkId, setEditingRemarkId] = useState("");
  const [editingRemarkText, setEditingRemarkText] = useState("");
  const [communicationHistory, setCommunicationHistory] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    setRemarks(lead?.remarks || []);
  }, [lead]);

  // Refresh ONLY the activity history (and the lead's remarks) without reloading
  // the whole portal — used by the dedicated Refresh button in the Activity tab.
  const refreshActivity = useCallback(async () => {
    if (!lead?.id) return;
    setActivityLoading(true);
    try {
      const history = await apiRequest(
        `/api/client/communications/history?leadId=${encodeURIComponent(lead.id)}&limit=20`
      );
      setCommunicationHistory(history.logs || []);
      // Pull the latest remarks too, so a just-added remark appears on refresh.
      try {
        const latest = await apiRequest(
          `/api/client/lead-store/manual/${lead.id}/remarks`
        );
        if (Array.isArray(latest?.remarks)) {
          setRemarks(latest.remarks);
          onLeadChange?.({ ...lead, remarks: latest.remarks });
        }
      } catch {
        // Remarks GET is optional; keep whatever is in state on failure.
      }
    } catch {
      setCommunicationHistory([]);
    } finally {
      setActivityLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  useEffect(() => {
    refreshActivity();
  }, [refreshActivity]);

  const activities = useMemo(() => {
    const items = [];

    if (lead?.createdAt) {
      items.push({
        id: `created-${lead.id}`,
        type: "created",
        title: "Lead created",
        detail: `${lead.name || "Lead"} was added to Lead Store.`,
        at: lead.createdAt,
      });
    }

    if (lead?.followUpAt) {
      items.push({
        id: `followup-${lead.id}`,
        type: "followup",
        title: "Current follow-up scheduled",
        detail: `Follow-up is scheduled for ${formatDateTime(lead.followUpAt)}.`,
        at: lead.followUpAt,
      });
    }

    remarks.forEach((remark) => {
      items.push({
        id: `remark-${remark.id}`,
        type: "remark",
        title: remark.legacy ? "Existing note" : "Remark recorded",
        detail: `${remark.text || ""}${remark.createdBy ? `\nBy ${remark.createdBy}` : ""}`,
        at: remark.updatedAt || remark.createdAt,
      });
    });

    communicationHistory.forEach((item) => {
      items.push({
        id: `communication-${item.id}`,
        type: "communication",
        title: item.subject || `${item.channel || "Communication"} ${item.status || ""}`.trim(),
        detail: [item.recipient, item.status].filter(Boolean).join(" · "),
        at: item.createdAt,
      });
    });

    return items
      .filter((item) => item.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [communicationHistory, lead, remarks]);

  function publishRemarks(nextRemarks) {
    setRemarks(nextRemarks);
    onLeadChange?.({ ...lead, remarks: nextRemarks });
  }

  async function addRemark() {
    const text = remarkDraft.trim();
    if (!lead?.id || !text || remarkSaving) return;

    setRemarkSaving(true);
    try {
      const data = await apiRequest(`/api/client/lead-store/manual/${lead.id}/remarks`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      publishRemarks(data.remarks || []);
      setRemarkDraft("");
    } finally {
      setRemarkSaving(false);
    }
  }

  async function saveRemarkEdit(remarkId) {
    const text = editingRemarkText.trim();
    if (!lead?.id || !remarkId || !text || remarkSaving) return;

    setRemarkSaving(true);
    try {
      const data = await apiRequest(
        `/api/client/lead-store/manual/${lead.id}/remarks/${remarkId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ text }),
        }
      );
      publishRemarks(data.remarks || []);
      setEditingRemarkId("");
      setEditingRemarkText("");
    } finally {
      setRemarkSaving(false);
    }
  }

  async function deleteRemark(remarkId) {
    if (!lead?.id || !remarkId || remarkSaving) return;
    if (!window.confirm("Delete this remark?")) return;

    setRemarkSaving(true);
    try {
      const data = await apiRequest(
        `/api/client/lead-store/manual/${lead.id}/remarks/${remarkId}`,
        { method: "DELETE" }
      );
      publishRemarks(data.remarks || []);
      if (editingRemarkId === remarkId) {
        setEditingRemarkId("");
        setEditingRemarkText("");
      }
    } finally {
      setRemarkSaving(false);
    }
  }

  const intelligence = lead?.intelligence || null;
  const score = Number(intelligence?.score);
  const conversionChance = intelligence?.conversionChance;
  const status = lead?.leadStatus || lead?.stage || "Lead";

  const detailFields = [
    ["Lead ID", formatLeadId(lead?.leadNumber)],
    ["Name", lead?.name],
    ["Primary Phone", lead?.phone],
    ["Alternative Phone", lead?.alternatePhone],
    ["Email", lead?.email],
    ["Course / Interest", lead?.course],
    ["Interested College", lead?.preferredColleges],
    ["Lead Type", lead?.type],
    ["Temperature", lead?.temperature],
    ["Source", lead?.sourceName || lead?.source],
    ["Campaign", lead?.campaign],
    ["Medium", lead?.medium],
    ["Stage", lead?.stage],
    ["Status", lead?.leadStatus],
    ["Assigned To", lead?.assignedToName],
    ["Follow-up", lead?.followUpAt ? formatDateTime(lead.followUpAt) : "—"],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-indigo-600"
          >
            <ArrowLeft size={15} />
            Back to Leads
          </button>
          <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-2xl font-bold tracking-tight text-slate-950 outline-none">Lead Details</h1>
        </div>

        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700 sm:self-auto"
          >
            <Pencil size={14} />
            Edit Lead
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside>
          <div className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-white shadow-[0_10px_30px_rgba(79,70,229,0.08)]">
            <div className="absolute inset-y-0 left-0 w-1.5 bg-indigo-600" aria-hidden="true" />

            <div className="p-5 pl-6">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-lg font-bold text-indigo-700 ring-1 ring-indigo-200/80">
                  {leadInitial(lead?.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[18px] font-bold text-slate-950">{lead?.name || "Lead"}</div>
                  <div className="mt-0.5 text-[12px] font-medium text-slate-500">Lead ID {formatLeadId(lead?.leadNumber)}</div>
                  <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${summaryTone(status)}`}>
                    {displayValue(status)}
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-3 border-t border-slate-200 pt-4 text-[12px] text-slate-700">
                <div className="flex items-start gap-2.5">
                  <Phone size={14} className="mt-0.5 shrink-0 text-indigo-600" />
                  <span className="break-all font-medium">{displayValue(lead?.phone)}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Mail size={14} className="mt-0.5 shrink-0 text-indigo-600" />
                  <span className="break-all">{displayValue(lead?.email)}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <UserRound size={14} className="mt-0.5 shrink-0 text-indigo-600" />
                  <span>{displayValue(lead?.assignedToName)}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CalendarClock size={14} className="mt-0.5 shrink-0 text-indigo-600" />
                  <span>{lead?.followUpAt ? formatDateTime(lead.followUpAt) : "No follow-up scheduled"}</span>
                </div>
              </div>

              {(Number.isFinite(score) || conversionChance !== undefined) ? (
                <div className="-mx-1 mt-5 grid grid-cols-2 divide-x divide-indigo-100 rounded-xl bg-gradient-to-r from-indigo-50/90 to-violet-50/90 px-1 py-3 text-center ring-1 ring-indigo-100/80">
                  <div className="px-2">
                    <div className="text-xl font-bold tabular-nums text-indigo-700">{Number.isFinite(score) ? score : "—"}</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-indigo-500">Lead Score</div>
                  </div>
                  <div className="px-2">
                    <div className="text-xl font-bold tabular-nums text-indigo-700">{conversionChance ?? "—"}</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-indigo-500">Conversion</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex overflow-x-auto border-b border-slate-200 px-2 sm:px-3">
            {[
              ["activity", "Activity History", Activity],
              ["details", "Lead Details", FileText],
              ["remarks", "Remarks", MessageSquare],
            ].map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`inline-flex min-h-[48px] shrink-0 items-center gap-2 border-b-2 px-3 text-[13px] font-semibold transition-colors ${
                  tab === key
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5">
            {tab === "activity" ? (
              <div>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-bold text-slate-900">Activity History</h2>
                    <p className="mt-1 text-[12px] text-slate-500">Only activity already recorded by the CRM is shown here.</p>
                  </div>
                  <button
                    type="button"
                    onClick={refreshActivity}
                    disabled={activityLoading}
                    title="Refresh activity history"
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={activityLoading ? "animate-spin" : ""} /> Refresh
                  </button>
                </div>

                {activityLoading ? (
                  <div className="flex items-center gap-2 py-8 text-[13px] text-slate-500">
                    <Loader2 size={15} className="animate-spin" /> Loading activity...
                  </div>
                ) : activities.length ? (
                  <div className="relative">
                    <div className="absolute bottom-4 left-[15px] top-4 w-px bg-slate-200" />
                    {activities.map((item) => (
                      <ActivityRow key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-400">
                    No recorded activity yet.
                  </div>
                )}
              </div>
            ) : null}

            {tab === "details" ? (
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">Lead Details</h2>
                <div className="mt-4 grid gap-x-6 gap-y-5 md:grid-cols-2">
                  {detailFields.map(([label, value]) => (
                    <DetailItem key={label} label={label} value={value} />
                  ))}
                </div>

                {Array.isArray(lead?.customFields) && lead.customFields.length ? (
                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <h3 className="text-[13px] font-bold text-slate-900">Custom Fields</h3>
                    <div className="mt-4 grid gap-x-6 gap-y-5 md:grid-cols-2">
                      {lead.customFields.map((field) => (
                        <DetailItem key={field.key || field.id || field.name} label={field.name || field.key} value={field.value} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === "remarks" ? (
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-[15px] font-bold text-slate-900">Remarks</h2>
                    <p className="mt-1 text-[12px] text-slate-500">Add and manage remarks for this lead.</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
                  <textarea
                    rows={2}
                    value={remarkDraft}
                    onChange={(event) => setRemarkDraft(event.target.value)}
                    className="min-h-[72px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder="Add a new remark..."
                  />
                  <button
                    type="button"
                    onClick={addRemark}
                    disabled={remarkSaving || !remarkDraft.trim()}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {remarkSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    Add
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {remarks.length ? (
                    remarks.map((remark) => (
                      <div key={remark.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        {editingRemarkId === remark.id ? (
                          <div>
                            <textarea
                              rows={2}
                              value={editingRemarkText}
                              onChange={(event) => setEditingRemarkText(event.target.value)}
                              className="min-h-[72px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRemarkId("");
                                  setEditingRemarkText("");
                                }}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600"
                              >
                                <X size={12} /> Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveRemarkEdit(remark.id)}
                                disabled={remarkSaving || !editingRemarkText.trim()}
                                className="inline-flex h-8 items-center gap-1 rounded-lg bg-indigo-600 px-2.5 text-[11px] font-semibold text-white disabled:opacity-50"
                              >
                                <Check size={12} /> Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 whitespace-pre-wrap text-[13px] leading-5 text-slate-700">{remark.text}</div>
                              {!remark.legacy ? (
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingRemarkId(remark.id);
                                      setEditingRemarkText(remark.text || "");
                                    }}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                                    aria-label="Edit remark"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteRemark(remark.id)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                    aria-label="Delete remark"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            <div className="mt-1.5 text-[10px] text-slate-400">
                              {remark.createdBy || "CRM user"} · {formatDateTime(remark.updatedAt || remark.createdAt)}
                              {remark.legacy ? " · Existing note" : ""}
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-400">
                      No remarks yet.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
