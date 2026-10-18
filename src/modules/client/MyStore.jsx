import { useEffect, useState, useCallback } from "react";
import {
  Sparkles,
  Megaphone,
  MessageSquare,
  Copy,
  Check,
  Pencil,
  RefreshCw,
  Image as ImageIcon,
  Loader2,
  Wand2,
  Download,
} from "lucide-react";

import { apiRequest } from "../../lib/api";
import { SectionHeader } from "../../components/ui";

function Toast({ toast }) {
  if (!toast) return null;
  const tone =
    toast.tone === "error"
      ? "bg-rose-600"
      : toast.tone === "warn"
      ? "bg-amber-600"
      : "bg-slate-900";
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className={`rounded-xl ${tone} px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg`}>
        {toast.text}
      </div>
    </div>
  );
}

function CopyEditCard({ icon: Icon, tone, title, value, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(editing ? draft : value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center gap-2 text-[14px] font-bold">
        <Icon size={16} className={tone.icon} />
        <span className={tone.text}>{title}</span>
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          className={`mt-3 w-full resize-none rounded-xl ${tone.bg} p-4 text-[13px] leading-relaxed text-slate-700 outline-none ring-1 ring-transparent focus:ring-brand-300`}
        />
      ) : (
        <div className={`mt-3 whitespace-pre-line rounded-xl ${tone.bg} p-4 text-[13px] leading-relaxed text-slate-700`}>
          {value}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="flex-1 rounded-lg bg-brand-600 py-2.5 text-[12px] font-bold text-white transition hover:bg-brand-700"
        >
          {copied ? (
            <span className="inline-flex items-center justify-center gap-1">
              <Check size={13} /> Copied
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-1">
              <Copy size={13} /> Copy
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="flex-1 rounded-lg border border-slate-200 py-2.5 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <span className="inline-flex items-center justify-center gap-1">
            <Pencil size={13} /> {editing ? "Done" : "Edit"}
          </span>
        </button>

        <button
          type="button"
          onClick={onRegenerate}
          title="Reset to template"
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </div>
  );
}

export default function MyStore() {
  const [occasions, setOccasions] = useState([]);
  const [spotlight, setSpotlight] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tpl, setTpl] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState([]); // AI images this company has made
  const [toast, setToast] = useState(null);

  const flash = (text, tone = "info") => {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 2600);
  };

  const loadTemplates = useCallback(async (occasionId) => {
    const data = await apiRequest(`/api/client/store/templates/${occasionId}`);
    setTpl(data);
  }, []);

  const loadAssets = useCallback(async () => {
    try {
      const data = await apiRequest("/api/client/store/assets");
      setGenerated(data?.assets || []);
    } catch {
      /* non-fatal — gallery just stays empty */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [meta, use] = await Promise.all([
          apiRequest("/api/client/store/occasions"),
          apiRequest("/api/client/store/usage"),
        ]);
        if (!alive) return;
        setOccasions(meta.occasions || []);
        setSpotlight(meta.spotlight || null);
        setUsage(use);
        const first = meta.spotlight?.id || meta.occasions?.[0]?.id;
        setSelected(first);
        if (first) await loadTemplates(first);
        await loadAssets();
      } catch {
        flash("Couldn't load My Store. Please refresh.", "error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadTemplates, loadAssets]);

  const pickOccasion = async (id) => {
    setSelected(id);
    try {
      await loadTemplates(id);
    } catch {
      flash("Couldn't load that occasion.", "error");
    }
  };

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await apiRequest("/api/client/store/generate", {
        method: "POST",
        body: JSON.stringify({ occasionId: selected }),
      });
      if (res?.usage) setUsage(res.usage);
      if (res?.asset) setGenerated((prev) => [res.asset, ...prev]); // show it immediately
      flash("Image generated.");
    } catch (error) {
      const code = error?.data?.code;
      if (code === "IMAGE_GEN_DISABLED") {
        flash("Live image generation is coming soon — templates are ready now.", "warn");
      } else if (code === "QUOTA_EXCEEDED") {
        if (error?.data) setUsage(error.data);
        flash(error.data.message || "Monthly image limit reached.", "warn");
      } else {
        flash(error?.message || "Generation failed.", "error");
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  const spotLabel = spotlight?.label || tpl?.occasion?.label || "Today";
  const spotEmoji = spotlight?.emoji || tpl?.occasion?.emoji || "✨";

  return (
    <div className="space-y-8">
      <Toast toast={toast} />

      <SectionHeader
        title="My Store"
        subtitle="Beautiful occasion wish images, promos & messages — ready to share."
        action={
          usage ? (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600">
              <span className="text-slate-400">Images this month </span>
              <span className="text-slate-900">
                {usage.used}/{usage.limit}
              </span>
            </div>
          ) : null
        }
      />

      {/* spotlight strip */}
      {spotlight && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white px-5 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 text-[22px] text-white">
            {spotEmoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-black uppercase tracking-wide text-brand-500">
                Today's spotlight
              </span>
              {spotlight.live && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[13px] font-bold text-emerald-600">
                  Live today
                </span>
              )}
            </div>
            <div className="text-[15px] font-black text-slate-900">{spotlight.label}</div>
          </div>
          <button
            type="button"
            onClick={() => pickOccasion(spotlight.id)}
            className="rounded-xl bg-brand-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm transition hover:bg-brand-700"
          >
            <span className="inline-flex items-center gap-1">
              <Sparkles size={13} /> Create now
            </span>
          </button>
        </div>
      )}

      {/* occasion selector */}
      <div className="flex flex-wrap gap-2">
        {occasions.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => pickOccasion(o.id)}
            className={`rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition ${
              selected === o.id
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {o.emoji} {o.label}
          </button>
        ))}
      </div>

      {/* hero */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-fuchsia-600 to-orange-500 p-7 text-white shadow-brand-lg">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-lg">
            <div className="inline-flex rounded-full bg-white/20 px-3 py-1 text-[13px] font-black">
              {spotEmoji} {spotLabel}
            </div>
            <div className="mt-3 text-[32px] font-extrabold leading-tight">
              Create a beautiful wish in seconds
            </div>
            <p className="mt-2 text-[14px] text-white/85">
              Pick a design, brand it with your logo, and share.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generate}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[14px] font-black text-brand-700 transition hover:bg-white/90 disabled:opacity-70"
              >
                {generating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Wand2 size={16} /> Generate designs
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(tpl?.designs || []).slice(0, 4).map((d, i) => (
              <div
                key={i}
                className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/12 text-[26px] backdrop-blur"
              >
                {d.emoji}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI-generated images (real Ideogram output, stored in S3) */}
      {generated.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[16px] font-black text-slate-900">Your generated images</div>
            <span className="text-[12px] font-semibold text-slate-400">
              {generated.length} saved
            </span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {generated.map((a) => (
              <div
                key={a.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
              >
                <img
                  src={a.imageUrl}
                  alt="Generated design"
                  loading="lazy"
                  className="h-52 w-full object-cover transition group-hover:scale-[1.03]"
                />
                <a
                  href={a.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-slate-900/80 px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
                >
                  <Download size={12} /> Open
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ready designs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[16px] font-black text-slate-900">Ready designs</div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(tpl?.designs || []).map((d, i) => (
            <div
              key={i}
              className={`overflow-hidden rounded-2xl bg-gradient-to-br ${d.gradient} text-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-1 hover:shadow-brand-md`}
            >
              <div className="flex h-48 items-center justify-center p-4 text-center">
                <div>
                  <div className="text-[28px]">{d.emoji}</div>
                  <div className="mt-1 whitespace-pre-line text-[16px] font-black leading-tight">
                    {d.title}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* promo + message */}
      <div className="grid gap-5 lg:grid-cols-2">
        <CopyEditCard
          icon={Megaphone}
          tone={{ icon: "text-pink-500", text: "text-pink-600", bg: "bg-pink-50/70" }}
          title="Marketing promo"
          value={tpl?.promo || ""}
          onRegenerate={() => selected && loadTemplates(selected)}
        />
        <CopyEditCard
          icon={MessageSquare}
          tone={{ icon: "text-sky-500", text: "text-sky-600", bg: "bg-sky-50/70" }}
          title="Message"
          value={tpl?.message || ""}
          onRegenerate={() => selected && loadTemplates(selected)}
        />
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-[13px] text-slate-400">
        <ImageIcon size={12} /> Templates are free to use. Live image generation activates once
        set up.
      </p>
    </div>
  );
}
