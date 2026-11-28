import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import AccountDeletionSection from "../../components/client/AccountDeletionSection";
import { useModalA11y } from "../../lib/useModalA11y";

import {
  Building,
  Palette,
  Users,
  Layers,
  Bell,
  Save,
  ShieldCheck,
  Upload,
  Check,
  Globe2,
  Briefcase,
  MapPin,
  Copy,
  Mail,
  Smartphone,
  MessageCircle,
  Send,
  Plus,
  Pencil,
  KeyRound,
  Loader2,
  X,
  Search,
  Trash2,
  GripVertical,
  ExternalLink,
  Settings,
  History,
  RefreshCw,
  Eye,
  EyeOff,
  Play,
  Volume2,
  PhoneCall,
  Sparkles,
  ArrowRight,
  Star,
} from "lucide-react";

import {
  apiRequest,
} from "../../lib/api";

import {
  SCOPES,
  TEAM_TEMPLATES,
  levelPermissionsFromTemplateRole,
  templateRolePercent,
  levelPermissionPercent,
  suggestLevelCode,
  flagsFromComponents,
} from "../../components/client/accessModel.js";

import {
  getPrefs as getNotifSoundPrefs,
  setPrefs as setNotifSoundPrefs,
  subscribe as subscribeNotifSoundPrefs,
} from "../../lib/notificationPrefs";

import {
  getNotificationSounds,
  previewNotificationSound,
} from "../../lib/sound";

// Selectable notification sounds (synthesized in sound.js — no audio files).
const NOTIF_SOUND_OPTIONS = getNotificationSounds();

import { applyBrandTheme, BRAND_COLORS, BRAND_PALETTE, brandHex } from "../../lib/brandTheme";
import PermissionTree, {
  emptyPageAccess,
  normalizeClientPageAccess,
} from "../../components/client/PermissionTree";
import AccessTab from "../../components/client/AccessTab";

const QUICK_BRAND_COLOR_KEYS = [
  "indigo",
  "blue",
  "teal",
  "emerald",
  "purple",
  "orange",
];

const QUICK_BRAND_COLORS = BRAND_COLORS.filter((color) =>
  QUICK_BRAND_COLOR_KEYS.includes(color.key)
);

// Pick a readable foreground (near-black or white) for a given background hex,
// using WCAG relative luminance. Guarantees ~4.5:1 text on any tenant brand hue.
function readableOn(hex) {
  const raw = String(hex || "").trim().replace("#", "");
  const full =
    raw.length === 3
      ? raw.split("").map((c) => c + c).join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return "#ffffff";
  const toLin = (channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * toLin(full.slice(0, 2)) +
    0.7152 * toLin(full.slice(2, 4)) +
    0.0722 * toLin(full.slice(4, 6));
  // Contrast vs white vs vs near-black; choose the better.
  const contrastWhite = 1.05 / (luminance + 0.05);
  const contrastBlack = (luminance + 0.05) / 0.05;
  return contrastBlack >= contrastWhite ? "#141019" : "#ffffff";
}

// Scoped "premium" design-token styling for the Company + Integrations panes.
// Everything is namespaced under `.st-v2` so it never leaks into the rest of the
// Settings page (which stays on Tailwind). The accent variables read the live
// tenant brand ramp (--brand-*, written by applyBrandTheme) with safe fallbacks,
// so multi-tenant branding drives the look instead of a hardcoded hue.
const SETTINGS_V2_CSS = `
.st-v2{
  --canvas:#f1f0f6; --surface:#fff; --surface-2:#f6f5fa;
  --line:#e7e4f0; --line-2:#efedf5;
  --ink:#1b1726; --ink-2:#574f6a; --ink-3:#655d7d;
  --accent:rgb(var(--brand-600,79 70 229)); --accent-2:rgb(var(--brand-500,99 102 241));
  --accent-weak:rgb(var(--brand-50,238 242 255)); --accent-ink:rgb(var(--brand-700,67 56 202));
  --on-accent:#fff;
  --ok:#0f7a59; --ok-weak:#e2f6ee; --warn:#9a6508; --warn-weak:#fcf1d9;
  --danger:#c62d41; --danger-weak:#fde9ec; --info:#2f6ad8; --info-weak:#e7eefc;
  --viol:#6d28d9; --viol-weak:#f0e9ff;
  --sh-sm:0 1px 2px rgba(27,23,38,.05);
  --sh-md:0 2px 8px rgba(27,23,38,.06),0 12px 28px -18px rgba(27,23,38,.3);
  --r:14px; --r-lg:18px;
  --body:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;
  --display:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;
  background:transparent; color:var(--ink); font-family:var(--body); font-size:13px; line-height:1.5;
  font-variant-numeric:tabular-nums; border-radius:0; padding:0 18px;
  display:flex; flex-direction:column; gap:18px;
}
.st-v2 *{ box-sizing:border-box; }
.st-v2 svg{ display:block; }
.st-v2 h2,.st-v2 h3,.st-v2 h4{ margin:0; font-family:var(--display); letter-spacing:-.01em; }
.st-v2 button{ font-family:inherit; cursor:pointer; }
.st-v2 :focus-visible{ outline:2px solid var(--accent-ink); outline-offset:2px; border-radius:6px; }
.st-v2 .sr-only{ position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
.st-v2 .phead{ display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.st-v2 .phead h2{ font-size:18px; font-weight:700; }
.st-v2 .phead p{ font-size:13px; color:var(--ink-2); margin-top:3px; max-width:66ch; }
.st-v2 .btn,.st-v2 .ghost,.st-v2 .mini{ display:inline-flex; align-items:center; gap:8px; border-radius:11px; font-size:13px; font-weight:600; transition:.15s; text-decoration:none; }
.st-v2 .btn{ background:var(--accent); color:var(--on-accent); border:1px solid transparent; padding:9px 15px; box-shadow:0 10px 22px -12px var(--accent); }
.st-v2 .btn:hover{ background:var(--accent-ink); color:#fff; }
.st-v2 .ghost{ background:var(--surface); color:var(--ink-2); border:1px solid var(--line); padding:9px 14px; }
.st-v2 .ghost:hover{ border-color:var(--accent); color:var(--accent-ink); }
.st-v2 .mini{ background:var(--surface-2); color:var(--ink-2); border:1px solid var(--line); padding:7px 11px; font-size:12.5px; }
.st-v2 .mini:hover{ color:var(--accent-ink); border-color:var(--accent); }
.st-v2 .mini[aria-pressed="true"]{ color:var(--accent-ink); border-color:var(--accent); background:var(--accent-weak); }
.st-v2 .btn:disabled,.st-v2 .ghost:disabled,.st-v2 .mini:disabled{ opacity:.5; cursor:not-allowed; }
.st-v2 .btn svg,.st-v2 .ghost svg,.st-v2 .mini svg{ width:16px; height:16px; }
.st-v2 .card{ background:var(--surface); border:1px solid var(--line); border-radius:var(--r); box-shadow:var(--sh-sm); }
.st-v2 .ch{ display:flex; align-items:center; gap:13px; padding:16px 18px; }
.st-v2 .ch.bd{ border-bottom:1px solid var(--line-2); }
.st-v2 .ch .ic{ width:36px; height:36px; border-radius:11px; background:var(--accent-weak); color:var(--accent-ink); display:grid; place-items:center; flex:none; }
.st-v2 .ch .ic svg{ width:18px; height:18px; }
.st-v2 .ch h3{ font-size:15px; font-weight:650; font-family:var(--display); }
.st-v2 .ch p{ font-size:12.5px; color:var(--ink-3); margin-top:2px; }
.st-v2 .ch .sp{ margin-left:auto; }
.st-v2 .cc{ padding:18px; }
.st-v2 .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:22px; }
.st-v2 .badge{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:650; padding:4px 10px; border-radius:999px; }
.st-v2 .badge .d{ width:6px; height:6px; border-radius:50%; }
.st-v2 .badge.ok{ background:var(--ok-weak); color:var(--ok); } .st-v2 .badge.ok .d{ background:var(--ok); }
.st-v2 .badge.off{ background:var(--surface-2); color:var(--ink-2); border:1px solid var(--line); } .st-v2 .badge.off .d{ background:var(--ink-3); }
.st-v2 .badge.warn{ background:var(--warn-weak); color:var(--warn); } .st-v2 .badge.warn .d{ background:var(--warn); }
.st-v2 .note{ font-size:12px; color:var(--ink-2); display:inline-flex; align-items:flex-start; gap:7px; line-height:1.5; }
.st-v2 .note svg{ width:14px; height:14px; flex:none; margin-top:1px; }
/* Company */
.st-v2 .hero{ border-radius:var(--r); padding:20px; border:1px solid var(--line); background:radial-gradient(120% 140% at 0% 0%,var(--accent-weak),transparent 55%),var(--surface); display:flex; align-items:center; justify-content:space-between; gap:18px; flex-wrap:wrap; }
.st-v2 .hero-l{ display:flex; align-items:center; gap:15px; min-width:0; }
.st-v2 .hlogo{ width:56px; height:56px; border-radius:16px; overflow:hidden; background:linear-gradient(145deg,var(--accent),var(--accent-2)); color:#fff; display:grid; place-items:center; font-family:var(--display); font-weight:700; font-size:18px; flex:none; box-shadow:0 12px 26px -12px var(--accent); }
.st-v2 .hlogo img{ width:100%; height:100%; object-fit:cover; }
.st-v2 .hnm{ font-family:var(--display); font-size:18px; font-weight:700; }
.st-v2 .hurl{ font-size:12.5px; color:var(--ink-2); display:inline-flex; align-items:center; gap:6px; margin-top:4px; }
.st-v2 .hurl svg{ width:13px; height:13px; color:var(--ink-3); }
.st-v2 .hmeta{ display:flex; flex-wrap:wrap; gap:8px 14px; font-size:12.5px; color:var(--ink-2); font-weight:600; }
.st-v2 .hmeta span{ display:inline-flex; align-items:center; gap:6px; } .st-v2 .hmeta svg{ width:14px; height:14px; color:var(--ink-3); }
.st-v2 .leg{ font-size:10.5px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--ink-3); margin-bottom:11px; }
.st-v2 .fields{ display:grid; gap:13px; }
.st-v2 .fl{ display:block; font-size:13px; font-weight:600; color:var(--ink-2); margin-bottom:6px; }
.st-v2 .inp{ display:flex; align-items:center; gap:9px; border:1px solid var(--line); background:var(--surface-2); border-radius:11px; padding:10px 12px; color:var(--ink-3); transition:.14s; }
.st-v2 .inp:focus-within{ border-color:var(--accent); background:var(--surface); box-shadow:0 0 0 3px var(--accent-weak); }
.st-v2 .inp.err{ border-color:var(--danger); background:var(--danger-weak); }
.st-v2 .inp svg{ width:16px; height:16px; flex:none; }
.st-v2 .inp input,.st-v2 .inp select{ border:0; background:transparent; outline:none; color:var(--ink); font-size:13px; width:100%; font-family:inherit; min-width:0; }
.st-v2 .inp input::placeholder{ color:var(--ink-3); }
.st-v2 .suffix{ font-size:12.5px; color:var(--ink-2); white-space:nowrap; }
.st-v2 .swatches{ display:flex; gap:10px; flex-wrap:wrap; }
.st-v2 .swt{ width:34px; height:34px; border-radius:10px; border:2px solid transparent; position:relative; display:grid; place-items:center; }
.st-v2 .swt[aria-pressed="true"]{ border-color:var(--ink); box-shadow:0 0 0 3px var(--surface),0 0 0 4px var(--ink); }
.st-v2 .swt svg{ width:15px; height:15px; }
.st-v2 .hint{ font-size:11.5px; color:var(--ink-2); margin-top:7px; display:flex; gap:6px; }
.st-v2 .hint svg{ width:13px; height:13px; flex:none; margin-top:1px; }
.st-v2 .err-text{ font-size:11.5px; color:var(--danger); font-weight:600; margin-top:6px; }
.st-v2 .ta{ width:100%; resize:vertical; border:1px solid var(--line); background:var(--surface-2); border-radius:11px; padding:9px 12px; color:var(--ink); font-size:13px; font-family:inherit; outline:none; line-height:1.5; }
.st-v2 .ta:focus{ border-color:var(--accent); background:var(--surface); box-shadow:0 0 0 3px var(--accent-weak); }
/* Integrations */
.st-v2 .intg-grid{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.st-v2 .icard{ position:relative; overflow:hidden; border:1px solid var(--line); border-radius:var(--r-lg); background:var(--surface); box-shadow:var(--sh-sm); display:flex; flex-direction:column; transition:.18s; }
.st-v2 .icard:hover{ box-shadow:var(--sh-md); }
.st-v2 .icard .wash{ position:absolute; inset:0 0 auto; height:92px; opacity:.5; pointer-events:none; }
.st-v2 .icard-in{ position:relative; padding:18px; display:flex; flex-direction:column; gap:14px; flex:1; }
.st-v2 .icard-top{ display:flex; align-items:flex-start; gap:13px; }
.st-v2 .ilogo{ width:52px; height:52px; border-radius:14px; display:grid; place-items:center; flex:none; background:var(--surface); border:1px solid var(--line); box-shadow:var(--sh-sm); }
.st-v2 .icard-top .meta{ min-width:0; flex:1; }
.st-v2 .icard-top h4,.st-v2 .meta h4{ font-size:15px; font-weight:700; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.st-v2 .icard-top p,.st-v2 .meta p{ font-size:13px; color:var(--ink-2); margin-top:4px; line-height:1.5; }
.st-v2 .conn{ display:flex; align-items:center; gap:10px; border:1px solid var(--line-2); background:var(--surface-2); border-radius:12px; padding:11px 13px; }
.st-v2 .conn .dotwrap{ width:30px; height:30px; border-radius:8px; display:grid; place-items:center; flex:none; }
.st-v2 .conn .ct{ font-size:12.5px; font-weight:650; }
.st-v2 .conn .cs{ font-size:12px; color:var(--ink-3); margin-top:1px; }
.st-v2 .conn .right{ margin-left:auto; }
.st-v2 .tok{ background:var(--ok-weak); color:var(--ok); } .st-v2 .tw{ background:var(--warn-weak); color:var(--warn); }
.st-v2 .tv{ background:var(--viol-weak); color:var(--viol); } .st-v2 .tb{ background:var(--accent-weak); color:var(--accent-ink); }
.st-v2 .ti{ background:var(--info-weak); color:var(--info); }
.st-v2 .ifields{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.st-v2 .ifld{ min-width:0; } .st-v2 .ifld label{ font-size:12px; font-weight:600; color:var(--ink-2); margin-bottom:5px; display:block; }
.st-v2 .icard-foot{ display:flex; gap:9px; flex-wrap:wrap; margin-top:auto; padding-top:2px; }
.st-v2 .seg{ display:inline-flex; border:1px solid var(--line); border-radius:10px; overflow:hidden; flex-wrap:wrap; }
.st-v2 .seg button{ border:0; background:var(--surface); color:var(--ink-2); font-size:12px; font-weight:600; padding:9px 12px; display:flex; flex-direction:column; gap:2px; align-items:flex-start; min-width:150px; text-align:left; }
.st-v2 .seg button+button{ border-left:1px solid var(--line); }
.st-v2 .seg button[aria-pressed="true"]{ background:var(--accent-weak); color:var(--accent-ink); }
.st-v2 .seg button span{ font-size:11.5px; color:var(--ink-3); font-weight:500; }
.st-v2 .srow{ display:flex; align-items:center; justify-content:space-between; gap:12px; border:1px solid var(--line); border-radius:12px; background:var(--surface); padding:12px 14px; }
.st-v2 .srow .st{ font-size:13px; font-weight:600; color:var(--ink); }
.st-v2 .sw{ position:relative; width:42px; height:24px; border-radius:999px; border:0; background:var(--line); transition:.18s; flex:none; padding:0; }
.st-v2 .sw::after{ content:""; position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.35); transition:.18s; }
.st-v2 .sw[aria-checked="true"]{ background:var(--accent); } .st-v2 .sw[aria-checked="true"]::after{ transform:translateX(18px); }
.st-v2 .infonote{ border:1px solid var(--line); background:var(--surface-2); border-radius:12px; padding:12px 14px; font-size:12px; color:var(--ink-2); line-height:1.5; }
.st-v2 .warnnote{ border:1px solid var(--warn-weak); background:var(--warn-weak); border-radius:12px; padding:12px 14px; font-size:12px; color:var(--warn); line-height:1.5; }
@media (max-width:860px){
  .st-v2 .grid2{ grid-template-columns:1fr; }
  .st-v2 .intg-grid{ grid-template-columns:1fr; }
  .st-v2 .ifields{ grid-template-columns:1fr; }
}
@media (prefers-reduced-motion:reduce){
  .st-v2 .icard,.st-v2 .icard:hover,.st-v2 .btn,.st-v2 .ghost,.st-v2 .mini,
  .st-v2 .inp,.st-v2 .sw,.st-v2 .sw::after{ transition:none!important; transform:none!important; }
}
`;

const TABS = [
  {
    k: "company",
    l: "Company",
    i: Building,
  },
  {
    k: "users",
    l: "Users & Roles",
    i: Users,
  },
  {
    k: "sources",
    l: "Lead Sources",
    i: Layers,
  },
  {
    k: "notifications",
    l: "Notifications",
    i: Bell,
  },
  {
    k: "integrations",
    l: "Integrations",
    i: Globe2,
  },
  {
    k: "activity",
    l: "Activity Log",
    i: History,
  },
];

// Grouped layout for the Settings side navigation. Each group lists tab keys
// from TABS; only keys present in visibleTabs render, and empty groups are
// skipped, so permission filtering still applies.
const TAB_GROUPS = [
  { label: "Workspace", keys: ["company", "integrations"] },
  { label: "Access", keys: ["users"] },
  { label: "Leads", keys: ["sources"] },
  { label: "System", keys: ["notifications", "activity"] },
];



function normalizeBrandColorForPicker(color) {
  const value = String(color || "indigo").trim();
  return value === "sky" ? "blue" : value;
}

function getAccent(
  color
) {
  const item =
    BRAND_COLORS.find(
      (brandColor) =>
        brandColor.key ===
        color
    );

  return (
    item?.hex ||
    "#4f46e5"
  );
}


function validateLogoValue(value) {
  const logo = String(value || "").trim();

  if (!logo) return "";
  if (/^data:image\/(png|jpeg|webp|svg\+xml);/i.test(logo)) return "";

  try {
    const parsed = new URL(logo);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
      return "Enter a valid HTTP/HTTPS image URL.";
    }
  } catch {
    return "Enter a valid HTTP/HTTPS image URL.";
  }

  return "";
}

function verifyRemoteLogoImage(value) {
  const logo = String(value || "").trim();
  if (!logo || logo.startsWith("data:image/")) return Promise.resolve(true);

  return new Promise((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      resolve(false);
    }, 7000);

    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(true);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      resolve(false);
    };
    image.src = logo;
  });
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono = false,
  disabled = false,
  icon: Icon,
  note,
  className = "",
}) {
  const id = useId();
  const noteId = useId();

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-[13px] font-semibold text-slate-600 mb-1.5"
      >
        {label}
      </label>

      <div className="relative">
        {Icon && (
          <Icon
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        )}

        <input
          id={id}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={note ? noteId : undefined}
          className={`w-full h-10 ${
            Icon ? "pl-9 pr-3" : "px-3"
          } border border-slate-200 rounded-lg text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-500 ${
            mono ? "font-mono" : ""
          }`}
        />
      </div>

      {note && (
        <p
          id={noteId}
          className="mt-1.5 text-[11.5px] leading-snug text-slate-500"
        >
          {note}
        </p>
      )}
    </div>
  );
}

function SubdomainPill({ value }) {
  const [copied, setCopied] = useState(false);
  const shown = value || "workspace.bispun.com";

  return (
    <div className="mt-1.5 inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1">
      <Globe2
        size={13}
        aria-hidden="true"
        className="flex-shrink-0 text-slate-400"
      />

      <span className="truncate font-mono text-[13px] text-slate-700">
        {shown}
      </span>

      <button
        type="button"
        onClick={() => {
          if (!value) return;
          navigator.clipboard
            ?.writeText(value)
            .then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => {});
        }}
        className="flex-shrink-0 rounded-md p-1 text-brand-600 transition hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        aria-label={
          copied
            ? "Subdomain copied"
            : `Copy subdomain ${shown} to clipboard`
        }
        title={copied ? "Copied" : "Copy"}
      >
        {copied ? (
          <Check
            size={13}
            strokeWidth={3}
            aria-hidden="true"
            className="text-emerald-600"
          />
        ) : (
          <Copy size={13} aria-hidden="true" />
        )}
      </button>

      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Subdomain copied to clipboard" : ""}
      </span>
    </div>
  );
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

// Self-contained storage-usage card (own fetch) for the Company settings tab.
function StorageUsageCard() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let alive = true;
    apiRequest("/api/client/store/storage")
      .then((data) => {
        if (alive) setStatus(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!status) return null;

  const pct = Math.min(100, Number(status.usedPercent || 0));
  const near = pct >= 90;

  return (
    <div className="rounded-xl bg-slate-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-brand-50 text-brand-600">
            <Layers size={17} aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-[13px] font-bold text-slate-900">Storage</h3>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Images and documents stored for this workspace.
            </p>
          </div>
        </div>
        <span className="text-[13px] font-semibold text-slate-700">
          {status.unlimited
            ? `${formatBytes(status.usedBytes)} used`
            : `${formatBytes(status.usedBytes)} of ${formatBytes(status.limitBytes)}`}
        </span>
      </div>

      {status.unlimited ? (
        <p className="mt-3 text-[12.5px] text-slate-500">
          Your plan includes unlimited storage.
        </p>
      ) : (
        <div className="mt-4">
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Storage used"
          >
            <div
              className={`h-full rounded-full transition-all ${near ? "bg-rose-500" : "bg-brand-600"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p
            className={`mt-2 text-[13px] ${near ? "font-semibold text-rose-600" : "text-slate-500"}`}
          >
            {pct}% used
            {near
              ? " — nearing your plan limit. Delete files or upgrade to add more."
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function PlaceholderPanel({
  title,
  description,
  icon: Icon,
}) {
  return (
    <div className="min-h-[360px] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 flex items-center justify-center mx-auto">
          <Icon size={20} />
        </div>

        <h3 className="mt-4 text-[17px] font-bold text-slate-900">
          {title}
        </h3>

        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
          {description}
        </p>

        <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5">
          <ShieldCheck size={12} />
          Production configuration
        </div>
      </div>
    </div>
  );
}

// Accessible dialog shell for the bare inline modals below. Mounts with the
// modal (rendered inside each `{open && (...)}`) so useModalA11y's focus trap,
// Escape handling and scroll lock run on open/close. Renders the same two
// nested divs (backdrop + panel) the modals used before; the panel carries the
// dialog semantics. Children receive the generated heading id to put on the
// modal title so aria-labelledby points at it. Visuals are unchanged.
function A11yDialog({
  onClose,
  backdropClassName,
  panelClassName,
  children,
}) {
  const { panelRef, onKeyDown } = useModalA11y(onClose);
  const headingId = useId();
  return (
    <div className={backdropClassName}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={panelClassName}
      >
        {typeof children === "function" ? children(headingId) : children}
      </div>
    </div>
  );
}

function PermissionSwitch({ checked, disabled = false, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? "bg-indigo-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function SettingsView({
  tenant,
  primaryColor,
  currentUser,
  onWorkspaceUpdated,
}) {
  const canManageUsers =
    currentUser?.role === "CLIENT_ADMIN" ||
    currentUser?.permissions?.canManageUsers === true;
  const canManageSettings =
    currentUser?.role === "CLIENT_ADMIN" ||
    currentUser?.permissions?.canManageSettings === true;

  const visibleTabs = TABS.filter((item) => {
    if (item.k === "integrations") return true;
    if (item.k === "users") return canManageUsers;
    if (item.k === "activity") return canManageUsers || canManageSettings;
    return canManageSettings;
  });

  const [
    tab,
    setTab,
  ] = useState(
    canManageSettings ? "company" : canManageUsers ? "users" : "integrations"
  );

  useEffect(() => {
    if (!visibleTabs.some((item) => item.k === tab)) {
      setTab(visibleTabs[0]?.k || "users");
    }
  }, [tab, canManageSettings, canManageUsers]);

  // ---- Google Workspace (Meet + Gmail) integration state ----
  const [googleStatus, setGoogleStatus] = useState({
    configured: false,
    connected: false,
    email: null,
    gmailEnabled: false,
  });
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleNotice, setGoogleNotice] = useState("");
  const [googleStatusLoading, setGoogleStatusLoading] = useState(true);
  const [googleStatusError, setGoogleStatusError] = useState("");

  async function loadGoogleStatus() {
    setGoogleStatusLoading(true);
    setGoogleStatusError("");

    try {
      const data = await apiRequest("/api/client/google/status");
      setGoogleStatus({
        configured: !!data?.configured,
        connected: !!data?.connected,
        email: data?.email || null,
        gmailEnabled: !!data?.gmailEnabled,
      });
    } catch (error) {
      console.error("Unable to load Google status:", error);
      setGoogleStatusError("Unable to check Google integration status");
    } finally {
      setGoogleStatusLoading(false);
    }
  }

  async function connectGoogle() {
    setGoogleBusy(true);
    setGoogleNotice("");
    try {
      const data = await apiRequest("/api/client/google/connect");
      if (data?.url) {
        window.location.href = data.url; // go to Google consent
        return;
      }
      setGoogleNotice("Google is not configured on the server yet.");
    } catch (error) {
      setGoogleNotice(error?.data?.message || "Unable to start Google connect.");
    } finally {
      setGoogleBusy(false);
    }
  }

  async function disconnectGoogle() {
    setGoogleBusy(true);
    try {
      await apiRequest("/api/client/google/disconnect", { method: "POST" });
      await loadGoogleStatus();
    } catch (error) {
      setGoogleNotice(error?.data?.message || "Unable to disconnect.");
    } finally {
      setGoogleBusy(false);
    }
  }

  async function sendGoogleTestEmail() {
    setGoogleBusy(true);
    setGoogleNotice("");
    try {
      const data = await apiRequest("/api/client/google/test-email", { method: "POST" });
      setGoogleNotice(data?.message || "Test email sent.");
    } catch (error) {
      setGoogleNotice(error?.data?.message || "Unable to send test email.");
    } finally {
      setGoogleBusy(false);
    }
  }

  // ---- WhatsApp (Meta Cloud API) integration state ----
  // Model A: the client connects their OWN WhatsApp Business number via Meta
  // Embedded Signup. Bispun never sends on its own number; Meta bills the client.
  const [waStatus, setWaStatus] = useState({
    configured: false,
    connected: false,
    status: "DISCONNECTED",
    displayNumber: null,
    verifiedName: null,
    config: { appId: "", configId: "", graphVersion: "v21.0" },
  });
  const [waBusy, setWaBusy] = useState(false);
  const [waNotice, setWaNotice] = useState("");
  const [waLoading, setWaLoading] = useState(true);

  async function loadWhatsAppStatus() {
    setWaLoading(true);
    try {
      const data = await apiRequest("/api/client/whatsapp/status");
      setWaStatus({
        configured: !!data?.configured,
        connected: !!data?.connected,
        status: data?.status || "DISCONNECTED",
        displayNumber: data?.displayNumber || null,
        verifiedName: data?.verifiedName || null,
        config: data?.config || { appId: "", configId: "", graphVersion: "v21.0" },
      });
    } catch (error) {
      console.error("Unable to load WhatsApp status:", error);
    } finally {
      setWaLoading(false);
    }
  }

  // Load the Facebook JS SDK once (needed to launch Embedded Signup).
  function loadFacebookSdk(appId, version) {
    return new Promise((resolve, reject) => {
      if (window.FB) return resolve(window.FB);
      window.fbAsyncInit = function () {
        window.FB.init({ appId, cookie: true, xfbml: false, version });
        resolve(window.FB);
      };
      const existing = document.getElementById("facebook-jssdk");
      if (existing) return; // init will fire via fbAsyncInit
      const s = document.createElement("script");
      s.id = "facebook-jssdk";
      s.async = true;
      s.defer = true;
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.onerror = () => reject(new Error("Unable to load Facebook SDK"));
      document.body.appendChild(s);
    });
  }

  async function connectWhatsApp() {
    setWaNotice("");
    const { appId, configId, graphVersion } = waStatus.config || {};
    if (!waStatus.configured || !appId || !configId) {
      setWaNotice("WhatsApp isn't set up on the server yet. Please try again later.");
      return;
    }
    setWaBusy(true);
    try {
      await loadFacebookSdk(appId, graphVersion || "v21.0");

      // Embedded Signup returns the WABA id + phone number id via postMessage.
      const captured = { wabaId: "", phoneNumberId: "" };
      const onMessage = (event) => {
        if (!String(event.origin || "").includes("facebook.com")) return;
        try {
          const payload =
            typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          if (payload?.type === "WA_EMBEDDED_SIGNUP" && payload?.data) {
            captured.wabaId = payload.data.waba_id || captured.wabaId;
            captured.phoneNumberId =
              payload.data.phone_number_id || captured.phoneNumberId;
          }
        } catch {
          /* ignore non-JSON messages */
        }
      };
      window.addEventListener("message", onMessage);

      window.FB.login(
        async (response) => {
          window.removeEventListener("message", onMessage);
          const code = response?.authResponse?.code;
          if (!code) {
            setWaBusy(false);
            setWaNotice("WhatsApp connection was cancelled.");
            return;
          }
          try {
            const data = await apiRequest("/api/client/whatsapp/connect", {
              method: "POST",
              body: JSON.stringify({
                code,
                wabaId: captured.wabaId,
                phoneNumberId: captured.phoneNumberId,
              }),
            });
            if (data?.connected) {
              setWaNotice("WhatsApp connected.");
              await loadWhatsAppStatus();
            } else {
              setWaNotice(data?.message || "Could not finish connecting.");
            }
          } catch (err) {
            setWaNotice(err?.data?.message || "Could not finish connecting WhatsApp.");
          } finally {
            setWaBusy(false);
          }
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: { setup: {}, sessionInfoVersion: "2" },
        }
      );
    } catch (error) {
      setWaBusy(false);
      setWaNotice(error?.message || "Unable to start WhatsApp connect.");
    }
  }

  async function disconnectWhatsApp() {
    setWaBusy(true);
    setWaNotice("");
    try {
      await apiRequest("/api/client/whatsapp/disconnect", { method: "POST" });
      await loadWhatsAppStatus();
      setWaNotice("WhatsApp disconnected.");
    } catch (error) {
      setWaNotice(error?.data?.message || "Unable to disconnect WhatsApp.");
    } finally {
      setWaBusy(false);
    }
  }

  // ---- SMS integration state (per-company, client-owned provider e.g. MSG91) ----
  const [smsConfig, setSmsConfig] = useState({
    enabled: false,
    provider: "MSG91",
    senderId: "",
    apiKeyMasked: "",
    hasApiKey: false,
    templates: [],
  });
  const [smsApiKeyInput, setSmsApiKeyInput] = useState("");
  const [smsCanManage, setSmsCanManage] = useState(false);
  const [smsBusy, setSmsBusy] = useState(false);
  const [smsNotice, setSmsNotice] = useState("");

  async function loadSmsConfig() {
    try {
      const data = await apiRequest("/api/client/communications/sms-config");
      setSmsConfig(
        data?.config || {
          enabled: false,
          provider: "MSG91",
          senderId: "",
          apiKeyMasked: "",
          hasApiKey: false,
          templates: [],
        }
      );
      setSmsCanManage(Boolean(data?.canManage));
    } catch (error) {
      console.error("Unable to load SMS config:", error);
    }
  }

  function addSmsTemplate() {
    setSmsConfig((c) => ({
      ...c,
      templates: [
        ...(c.templates || []),
        { id: `tpl_${Date.now()}`, name: "", templateId: "", body: "" },
      ],
    }));
  }

  function updateSmsTemplate(index, field, value) {
    setSmsConfig((c) => ({
      ...c,
      templates: (c.templates || []).map((t, i) =>
        i === index ? { ...t, [field]: value } : t
      ),
    }));
  }

  function removeSmsTemplate(index) {
    setSmsConfig((c) => ({
      ...c,
      templates: (c.templates || []).filter((_, i) => i !== index),
    }));
  }

  async function saveSmsConfig() {
    setSmsBusy(true);
    setSmsNotice("");
    try {
      const payload = {
        enabled: smsConfig.enabled,
        provider: smsConfig.provider,
        senderId: smsConfig.senderId,
        templates: smsConfig.templates,
      };
      // Only send the key when the admin typed a new one (they see a mask otherwise).
      if (smsApiKeyInput.trim()) payload.apiKey = smsApiKeyInput.trim();

      const data = await apiRequest("/api/client/communications/sms-config", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setSmsConfig(data?.config || smsConfig);
      setSmsApiKeyInput("");
      setSmsNotice(data?.message || "SMS integration saved.");
    } catch (error) {
      setSmsNotice(error?.data?.message || "Unable to save SMS integration.");
    } finally {
      setSmsBusy(false);
    }
  }

  // ---- Voice calling (company-wide) ----
  const [callingConfig, setCallingConfig] = useState({ enabled: false, mode: "DEVICE_DIAL", callerId: "", hasAuthKey: false, authKeyMasked: "", consentConfirmed: false });
  const [callingAuthKey, setCallingAuthKey] = useState("");
  const [callingCanManage, setCallingCanManage] = useState(false);
  const [callingBusy, setCallingBusy] = useState(false);
  const [callingNotice, setCallingNotice] = useState("");

  async function loadCallingConfig() {
    try {
      const data = await apiRequest("/api/client/telephony/config");
      setCallingConfig((current) => ({ ...current, ...(data?.config || {}) }));
      setCallingCanManage(Boolean(data?.canManage));
    } catch (error) {
      console.error("Unable to load calling config:", error);
    }
  }

  async function saveCallingConfig() {
    setCallingBusy(true);
    setCallingNotice("");
    try {
      const payload = { enabled: callingConfig.enabled, mode: callingConfig.mode, callerId: callingConfig.callerId, consentConfirmed: callingConfig.consentConfirmed };
      if (callingAuthKey.trim()) payload.authKey = callingAuthKey.trim();
      const data = await apiRequest("/api/client/telephony/config", { method: "PUT", body: JSON.stringify(payload) });
      setCallingConfig((current) => ({ ...current, ...(data?.config || {}) }));
      setCallingAuthKey("");
      setCallingNotice(data?.message || "Calling integration saved.");
    } catch (error) {
      setCallingNotice(error?.data?.message || "Unable to save calling integration.");
    } finally {
      setCallingBusy(false);
    }
  }

  // Load status when opening the Integrations tab, and show the result of a
  // just-completed OAuth redirect (?google=connected|error|norefresh).
  useEffect(() => {
    if (tab !== "integrations") return;
    loadGoogleStatus();
    loadWhatsAppStatus();
    loadSmsConfig();
    loadCallingConfig();
    try {
      const params = new URLSearchParams(window.location.search);
      const g = params.get("google");
      if (g === "connected") setGoogleNotice("Google account connected.");
      else if (g === "norefresh")
        setGoogleNotice(
          "Almost there — remove Bispun from your Google account's connected apps, then connect again."
        );
      else if (g === "error")
        setGoogleNotice("Something went wrong connecting Google. Try again.");
      if (g) {
        params.delete("google");
        const q = params.toString();
        window.history.replaceState(
          {},
          "",
          window.location.pathname + (q ? `?${q}` : "")
        );
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const [
    selectedColor,
    setSelectedColor,
  ] = useState(
    normalizeBrandColorForPicker(
      primaryColor ||
        tenant?.primaryColor ||
        "indigo"
    )
  );

  const [
    customColor,
    setCustomColor,
  ] = useState(() =>
    brandHex(
      normalizeBrandColorForPicker(
        primaryColor ||
          tenant?.primaryColor ||
          "indigo"
      )
    )
  );

  const [
    customPaletteOpen,
    setCustomPaletteOpen,
  ] = useState(false);

  const [
    workspaceSettingsLoading,
    setWorkspaceSettingsLoading,
  ] = useState(false);

  const [
    workspaceSettingsSaving,
    setWorkspaceSettingsSaving,
  ] = useState(false);

  const [
    workspaceSettingsError,
    setWorkspaceSettingsError,
  ] = useState("");

  const [
    workspaceSettingsMessage,
    setWorkspaceSettingsMessage,
  ] = useState("");

  const [
    settingsSuccessMessage,
    setSettingsSuccessMessage,
  ] = useState("");

  function showSettingsSuccess(message) {
    setSettingsSuccessMessage(message || "Changes saved successfully");
  }

  useEffect(() => {
    if (!settingsSuccessMessage) return undefined;

    const timer = window.setTimeout(() => {
      setSettingsSuccessMessage("");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [settingsSuccessMessage]);

  const [
    logoPreview,
    setLogoPreview,
  ] = useState(
    tenant?.logoUrl || ""
  );
  const [logoUrlError, setLogoUrlError] = useState("");

  const [
    notificationPreferences,
    setNotificationPreferences,
  ] = useState({
    inAppEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    leadUpdates: true,
    admissionUpdates: true,
    billingUpdates: true,
    supportUpdates: true,
    systemUpdates: true,
  });

  const [
    notificationWorkspaceDefaults,
    setNotificationWorkspaceDefaults,
  ] = useState({
    emailEnabled: true,
    smsEnabled: false,
  });

  // Notification sound preferences (tone + volume). Preview plays locally via Web Audio.
  const [soundPref, setSoundPref] = useState({
    enabled: true,
    tone: "chime",
    volume: 70,
  });

  function previewNotificationTone() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      const vol =
        Math.max(0, Math.min(1, (soundPref.volume || 0) / 100)) * 0.5;
      const freqs = {
        chime: [880, 1320],
        ping: [1200],
        bell: [660, 990, 1320],
        pop: [520],
      };
      const seq = freqs[soundPref.tone] || [880];
      seq.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = soundPref.tone === "pop" ? "triangle" : "sine";
        osc.frequency.value = f;
        const start = now + i * 0.14;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(vol, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.24);
      });
      window.setTimeout(() => ctx.close(), 1200);
    } catch {
      /* audio preview unavailable */
    }
  }

  const [
    notificationPreferencesLoading,
    setNotificationPreferencesLoading,
  ] = useState(false);

  const [
    notificationPreferencesSaving,
    setNotificationPreferencesSaving,
  ] = useState(false);

  const [
    notificationPreferencesError,
    setNotificationPreferencesError,
  ] = useState("");

  const [
    notificationPreferencesMessage,
    setNotificationPreferencesMessage,
  ] = useState("");

  // Notification SOUND preference (personal, client-side via notificationPrefs).
  // This is separate from the server-backed notification delivery preferences
  // above: it works immediately with no backend and the store handles any sync.
  const [soundPrefs, setSoundPrefs] = useState(() => getNotifSoundPrefs());

  useEffect(() => {
    // Re-sync from the store on mount (e.g. after hydrateFromServer ran), then
    // stay subscribed so the control reflects changes from anywhere.
    setSoundPrefs(getNotifSoundPrefs());
    return subscribeNotifSoundPrefs(setSoundPrefs);
  }, []);

  const [
    form,
    setForm,
  ] = useState({
    companyName:
      tenant?.name ||
      "",
    businessType:
      tenant?.business ||
      "",
    city:
      tenant?.city ||
      "",
    subdomain:
      tenant?.subdomain ||
      "",
    logoUrl:
      tenant?.logoUrl ||
      "",
  });

  const [
    users,
    setUsers,
  ] = useState([]);

  const [
    usersLoading,
    setUsersLoading,
  ] = useState(false);

  const [
    usersError,
    setUsersError,
  ] = useState("");

  const [
    userModalError,
    setUserModalError,
  ] = useState("");

  const [
    userFormErrors,
    setUserFormErrors,
  ] = useState({});

  const [organization, setOrganization] = useState({ departments: [], designations: [], levels: [], roles: [] });
  const [organizationLoading, setOrganizationLoading] = useState(false);
  const departmentSelectRef = useRef(null);
  const [organizationModal, setOrganizationModal] = useState(null);
  const [editingOrganizationItem, setEditingOrganizationItem] = useState(null);
  const [organizationSaving, setOrganizationSaving] = useState(false);
  const emptyOrganizationForm = {
    name: "",
    code: "",
    description: "",
    rank: 1,
    active: true,
    baseRole: "EMPLOYEE",
    permissions: {
      canManageUsers: false, canManageSettings: false, canManageBilling: false,
      canViewAnalytics: false, canManageAdmissions: false, canManageRevenue: false,
      canManageLeads: false, canManageSupport: false, canViewTeamTargets: false,
    },
  };
  const [organizationForm, setOrganizationForm] = useState(emptyOrganizationForm);
  const [usersManagementTab, setUsersManagementTab] = useState("users");
  const [applyingTemplate, setApplyingTemplate] = useState(null);
  const [appliedTemplate, setAppliedTemplate] = useState(null);
  const [storedTemplateKey, setStoredTemplateKey] = useState(() => {
    try {
      return localStorage.getItem("bispun.appliedTemplate");
    } catch {
      return null;
    }
  });

  const [
    userSearch,
    setUserSearch,
  ] = useState("");

  const [
    userModalOpen,
    setUserModalOpen,
  ] = useState(false);

  const [
    editingUser,
    setEditingUser,
  ] = useState(null);

  const [
    userSaving,
    setUserSaving,
  ] = useState(false);

  const [
    resetPasswordUser,
    setResetPasswordUser,
  ] = useState(null);

  const [
    resetPassword,
    setResetPassword,
  ] = useState("");

  const [
    showTempPassword,
    setShowTempPassword,
  ] = useState(false);

  const [
    resetSaving,
    setResetSaving,
  ] = useState(false);

  const emptyUserForm = {
    name: "",
    email: "",
    password: "",
    role: "EMPLOYEE",
    customRoleId: "",
    employeeId: "",
    phone: "",
    jobTitle: "",
    designationId: "",
    levelId: "",
    department: "",
    managerId: "",
    active: true,
    permissions: {
      canManageUsers: false,
      canManageSettings: false,
      canManageBilling: false,
      canViewAnalytics: false,
      canManageAdmissions: false,
      canManageRevenue: false,
      canManageLeads: true,
      canManageSupport: true,
      canViewTeamTargets: false,
    },
    pageAccess: emptyPageAccess(),
  };

  const [
    userForm,
    setUserForm,
  ] = useState(
    emptyUserForm
  );

  const [permissionTree, setPermissionTree] = useState(null);
  const [actorPageAccess, setActorPageAccess] = useState(null);
  const [levelAccessSaving, setLevelAccessSaving] = useState(false);
  const [userPermissionOverrideChanged, setUserPermissionOverrideChanged] = useState(false);

  async function saveLevelAccess(levelId, permissions) {
    setLevelAccessSaving(true);
    try {
      const data = await apiRequest(`/api/client/users/levels/${levelId}/access`, {
        method: "PATCH",
        body: JSON.stringify({ permissions }),
      });
      if (data?.success) {
        setOrganization((prev) => ({ ...prev, levels: data.levels }));
        await loadUsers();
      }
    } catch (err) {
      setUsersError(err?.data?.message || "Unable to save level access");
    } finally {
      setLevelAccessSaving(false);
    }
  }

  // Apply a team template: safe merge — create any missing levels and set their
  // permissions, update matching ones by name. Never deletes a level or a user.
  // The protected Admin level is left untouched (admin roles are skipped).
  async function applyTeamTemplate(templateKey) {
    const template = TEAM_TEMPLATES.find((t) => t.key === templateKey);
    if (!template) return;
    const roles = template.roles.filter((r) => !r.admin);
    const existingNames = new Set(organization.levels.map((l) => String(l.name).toLowerCase()));
    const toCreate = roles.filter((r) => !existingNames.has(r.name.toLowerCase()));
    const toUpdate = roles.filter((r) => existingNames.has(r.name.toLowerCase()));
    const summary =
      `Apply "${template.name}"?\n\n` +
      `• Create ${toCreate.length} new level${toCreate.length === 1 ? "" : "s"}: ${toCreate.map((r) => r.name).join(", ") || "none"}\n` +
      `• Update permissions on ${toUpdate.length} existing level${toUpdate.length === 1 ? "" : "s"}: ${toUpdate.map((r) => r.name).join(", ") || "none"}\n\n` +
      `No levels or users are deleted. Administrator access is unchanged.`;
    if (!window.confirm(summary)) return;

    setApplyingTemplate(templateKey);
    setUsersError("");
    try {
      let levels = organization.levels;
      let created = 0;
      let updated = 0;
      const takenCodes = new Set(levels.map((l) => String(l.code || "").toUpperCase()));
      let nextRank = levels.reduce((max, l) => Math.max(max, Number(l.rank) || 0), 0);

      for (const role of roles) {
        const permissions = levelPermissionsFromTemplateRole(role);
        permissions.flags = flagsFromComponents(permissions.components);
        let level = levels.find((l) => String(l.name).toLowerCase() === role.name.toLowerCase());
        if (!level) {
          const code = suggestLevelCode(role.name, [...takenCodes]);
          takenCodes.add(code);
          nextRank += 1;
          const createData = await apiRequest("/api/client/users/levels", {
            method: "POST",
            body: JSON.stringify({ name: role.name, code, rank: nextRank, description: role.role || "" }),
          });
          levels = createData.levels || levels;
          level = levels.find((l) => String(l.name).toLowerCase() === role.name.toLowerCase());
          created += 1;
        } else {
          updated += 1;
        }
        if (!level) continue;
        const accessData = await apiRequest(`/api/client/users/levels/${level.id}/access`, {
          method: "PATCH",
          body: JSON.stringify({ permissions }),
        });
        levels = accessData.levels || levels;
      }

      setOrganization((prev) => ({ ...prev, levels }));
      await loadUsers();
      setAppliedTemplate(templateKey);
      setStoredTemplateKey(templateKey);
      try {
        localStorage.setItem("bispun.appliedTemplate", templateKey);
      } catch {
        /* localStorage unavailable — session state still reflects it */
      }
      showSettingsSuccess(
        `"${template.name}" applied — ${created} level${created === 1 ? "" : "s"} created, ${updated} updated.`
      );
    } catch (error) {
      setUsersError(error?.data?.message || "Unable to apply template");
    } finally {
      setApplyingTemplate(null);
    }
  }

  useEffect(() => {
    if (usersManagementTab === "access") loadPermissionTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersManagementTab]);
  const [permissionTreeLoading, setPermissionTreeLoading] = useState(false);

  const [
    leadSources,
    setLeadSources,
  ] = useState([]);

  const [
    sourcesLoading,
    setSourcesLoading,
  ] = useState(false);

  const [
    sourcesError,
    setSourcesError,
  ] = useState("");

  const [
    sourceModalError,
    setSourceModalError,
  ] = useState("");

  const [
    sourceModalOpen,
    setSourceModalOpen,
  ] = useState(false);

  const [
    editingSource,
    setEditingSource,
  ] = useState(null);

  const [
    sourceSaving,
    setSourceSaving,
  ] = useState(false);

  const emptySourceForm = {
    name: "",
    key: "",
    description: "",
    active: true,
    showInForms: true,
    sortOrder: 100,
  };

  const [
    sourceForm,
    setSourceForm,
  ] = useState(
    emptySourceForm
  );


  const [
    auditLogs,
    setAuditLogs,
  ] = useState([]);

  const [
    auditLogsLoading,
    setAuditLogsLoading,
  ] = useState(false);

  const [
    auditLogsError,
    setAuditLogsError,
  ] = useState("");

  const [
    auditSearch,
    setAuditSearch,
  ] = useState("");

  const [
    auditEntityFilter,
    setAuditEntityFilter,
  ] = useState("");

  const [
    auditTotal,
    setAuditTotal,
  ] = useState(0);

  const activeTab =
    useMemo(
      () =>
        TABS.find(
          (
            item
          ) =>
            item.k ===
            tab
        ),
      [
        tab,
      ]
    );

  function update(
    key,
    value
  ) {
    setForm(
      (
        current
      ) => ({
        ...current,
        [key]:
          value,
      })
    );
  }


  async function loadWorkspaceSettings() {
    setWorkspaceSettingsLoading(true);
    setWorkspaceSettingsError("");

    try {
      const data =
        await apiRequest(
          "/api/client/settings"
        );

      const workspace =
        data.workspace || {};

      setForm({
        companyName:
          workspace.companyName || "",
        businessType:
          workspace.businessType || "",
        city:
          workspace.city || "",
        subdomain:
          workspace.subdomain || "",
        logoUrl:
          workspace.logoUrl || "",
      });

      setSelectedColor(
        normalizeBrandColorForPicker(
          workspace.primaryColor ||
            "indigo"
        )
      );

      setCustomColor(
        brandHex(
          normalizeBrandColorForPicker(
            workspace.primaryColor ||
              "indigo"
          )
        )
      );

      const loadedLogoError = validateLogoValue(workspace.logoUrl || "");
      setLogoUrlError(loadedLogoError);
      setLogoPreview(loadedLogoError ? "" : workspace.logoUrl || "");
    } catch (error) {
      setWorkspaceSettingsError(
        error?.data?.message ||
          "Unable to load company settings"
      );
    } finally {
      setWorkspaceSettingsLoading(false);
    }
  }

  useEffect(() => {
    if (canManageSettings) loadWorkspaceSettings();
  }, [canManageSettings]);

  async function saveWorkspaceSettings() {
    setWorkspaceSettingsError("");
    setWorkspaceSettingsMessage("");

    const logoValidationError = validateLogoValue(form.logoUrl);
    if (logoValidationError) {
      setLogoUrlError(logoValidationError);
      setLogoPreview("");
      setWorkspaceSettingsError(logoValidationError);
      return;
    }

    if (form.logoUrl && !(await verifyRemoteLogoImage(form.logoUrl))) {
      const message = "Unable to load an image from this logo URL.";
      setLogoUrlError(message);
      setLogoPreview("");
      setWorkspaceSettingsError(message);
      return;
    }

    setLogoUrlError("");
    setWorkspaceSettingsSaving(true);

    try {
      const data =
        await apiRequest(
          "/api/client/settings",
          {
            method: "PATCH",
            body:
              JSON.stringify({
                companyName:
                  form.companyName,
                businessType:
                  form.businessType,
                city:
                  form.city,
                subdomain:
                  form.subdomain,
                // Keep legacy backend portalName synchronized with Company Name.
                portalName:
                  form.companyName,
                primaryColor:
                  selectedColor,
                logoUrl:
                  form.logoUrl,
              }),
          }
        );

      const workspace =
        data.workspace || {};

      setForm({
        companyName:
          workspace.companyName || "",
        businessType:
          workspace.businessType || "",
        city:
          workspace.city || "",
        subdomain:
          workspace.subdomain || "",
        logoUrl:
          workspace.logoUrl || "",
      });

      setSelectedColor(
        normalizeBrandColorForPicker(
          workspace.primaryColor ||
            "indigo"
        )
      );

      setCustomColor(
        brandHex(
          normalizeBrandColorForPicker(
            workspace.primaryColor ||
              "indigo"
          )
        )
      );

      applyBrandTheme(
        workspace.primaryColor ||
        "indigo"
      );

      setLogoPreview(
        workspace.logoUrl || ""
      );
      setLogoUrlError("");

      setWorkspaceSettingsMessage(
        data.message ||
          "Settings saved successfully"
      );
      showSettingsSuccess(
        data.message ||
          "Settings saved successfully"
      );

      onWorkspaceUpdated?.(
        workspace
      );
    } catch (error) {
      setWorkspaceSettingsError(
        error?.data?.message ||
          "Unable to save company settings"
      );
    } finally {
      setWorkspaceSettingsSaving(false);
    }
  }

  function handleLogoUpload(event) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setWorkspaceSettingsError("");
    setLogoUrlError("");

    if (
      ![
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/svg+xml",
      ].includes(file.type)
    ) {
      setWorkspaceSettingsError(
        "Please upload PNG, JPG, WEBP or SVG"
      );
      event.target.value = "";
      return;
    }

    if (
      file.size >
      500 * 1024
    ) {
      setWorkspaceSettingsError(
        "Logo must be below 500 KB"
      );
      event.target.value = "";
      return;
    }

    const reader =
      new FileReader();

    reader.onload = () => {
      const value =
        String(
          reader.result || ""
        );

      setForm(
        (current) => ({
          ...current,
          logoUrl: value,
        })
      );

      setLogoPreview(value);
      setLogoUrlError("");
    };

    reader.onerror = () => {
      setWorkspaceSettingsError(
        "Unable to read the selected logo"
      );
    };

    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setForm(
      (current) => ({
        ...current,
        logoUrl: "",
      })
    );

    setLogoPreview("");
    setLogoUrlError("");
  }

  async function loadOrganization() {
    setOrganizationLoading(true);
    try {
      const data = await apiRequest("/api/client/users/organization");
      setOrganization({
        departments: Array.isArray(data.departments) ? data.departments : [],
        designations: Array.isArray(data.designations) ? data.designations : [],
        levels: Array.isArray(data.levels) ? data.levels : [],
        roles: Array.isArray(data.roles) ? data.roles : [],
      });
    } catch (error) {
      setUsersError(error?.data?.message || "Unable to load departments and roles");
    } finally {
      setOrganizationLoading(false);
    }
  }

  function openOrganizationModal(type) {
    setOrganizationModal(type);
    setEditingOrganizationItem(null);
    setOrganizationForm(emptyOrganizationForm);
    setUsersError("");
  }

  function openEditOrganizationModal(type, item) {
    setOrganizationModal(type);
    setEditingOrganizationItem(item);
    setOrganizationForm({
      ...emptyOrganizationForm,
      name: item.name || "",
      code: item.code || "",
      description: item.description || "",
      rank: item.rank || 1,
      active: item.active !== false,
      baseRole: item.baseRole || "EMPLOYEE",
      permissions: { ...emptyOrganizationForm.permissions, ...(item.permissions || {}) },
    });
    setUsersError("");
  }

  async function saveOrganizationItem() {
    setOrganizationSaving(true);
    setUsersError("");
    try {
      const endpoint = organizationModal === "department" ? "departments" : organizationModal === "designation" ? "designations" : organizationModal === "level" ? "levels" : "roles";
      const payload = {
        name: organizationForm.name,
        code: organizationForm.code,
        description: organizationForm.description,
        rank: organizationForm.rank,
        active: organizationForm.active,
        permissions: organizationForm.permissions,
        ...(organizationModal === "role" ? { baseRole: organizationForm.baseRole } : {}),
      };
      const data = await apiRequest(`/api/client/users/${endpoint}${editingOrganizationItem ? `/${editingOrganizationItem.id}` : ""}`, {
        method: editingOrganizationItem ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setOrganization({
        departments: data.departments || [],
        designations: data.designations || [],
        levels: data.levels || [],
        roles: data.roles || [],
      });
      showSettingsSuccess(`${organizationModal[0].toUpperCase()}${organizationModal.slice(1)} ${editingOrganizationItem ? "updated" : "added"} successfully`);
      setOrganizationModal(null);
      setEditingOrganizationItem(null);
      setOrganizationForm(emptyOrganizationForm);
    } catch (error) {
      setUsersError(error?.data?.message || "Unable to save organization item");
    } finally {
      setOrganizationSaving(false);
    }
  }

  async function deleteOrganizationItem(type, id) {
    if (!window.confirm(`Delete this ${type}?`)) return;
    setUsersError("");
    try {
      const endpoint = type === "department" ? "departments" : type === "designation" ? "designations" : type === "level" ? "levels" : "roles";
      const data = await apiRequest(`/api/client/users/${endpoint}/${id}`, { method: "DELETE" });
      setOrganization({ departments: data.departments || [], designations: data.designations || [], levels: data.levels || [], roles: data.roles || [] });
      showSettingsSuccess(`${type[0].toUpperCase()}${type.slice(1)} deleted successfully`);
    } catch (error) {
      setUsersError(error?.data?.message || `Unable to delete ${type}`);
    }
  }

  async function moveLevel(levelId, direction) {
    const ordered = [...organization.levels].sort((a, b) => (a.rank || 0) - (b.rank || 0));
    const index = ordered.findIndex((level) => level.id === levelId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
    setUsersError("");
    try {
      const data = await apiRequest("/api/client/users/levels/reorder", {
        method: "PATCH",
        body: JSON.stringify({ orderedIds: ordered.map((level) => level.id) }),
      });
      setOrganization({ departments: data.departments || [], designations: data.designations || [], levels: data.levels || [], roles: data.roles || [] });
      showSettingsSuccess("Level order updated");
    } catch (error) {
      setUsersError(error?.data?.message || "Unable to reorder levels");
    }
  }

  async function loadUsers() {
    setUsersLoading(true);
    setUsersError("");

    try {
      const data =
        await apiRequest(
          "/api/client/users"
        );

      setUsers(
        data.users || []
      );
    } catch (error) {
      setUsersError(
        error?.data?.message ||
          "Unable to load users"
      );
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "users") {
      loadUsers();
      loadOrganization();
    }
  }, [tab]);

  function roleDefaults(role) {
    if (role === "CLIENT_ADMIN") {
      return {
        canManageUsers: true,
        canManageSettings: true,
        canManageBilling: true,
        canViewAnalytics: true,
        canManageAdmissions: true,
        canManageRevenue: true,
        canManageLeads: true,
        canManageSupport: true,
        canViewTeamTargets: true,
      };
    }

    if (role === "MANAGER") {
      return {
        canManageUsers: false,
        canManageSettings: false,
        canManageBilling: false,
        canViewAnalytics: true,
        canManageAdmissions: true,
        canManageRevenue: false,
        canManageLeads: true,
        canManageSupport: true,
        canViewTeamTargets: true,
      };
    }

    return {
      canManageUsers: false,
      canManageSettings: false,
      canManageBilling: false,
      canViewAnalytics: false,
      canManageAdmissions: false,
      canManageRevenue: false,
      canManageLeads: true,
      canManageSupport: true,
      canViewTeamTargets: false,
    };
  }

  function closeUserModal() {
    setUserModalOpen(false);
    setEditingUser(null);
    setUserModalError("");
    setUserFormErrors({});
    setUsersError("");
  }

  async function loadPermissionTree() {
    setPermissionTreeLoading(true);
    try {
      const data = await apiRequest("/api/client/users/permission-tree");
      if (data?.success) {
        setPermissionTree(data.tree);
        setActorPageAccess(data.actorPageAccess || null);
      }
    } catch {
      // Non-fatal: the tree just shows a loading/empty state.
    } finally {
      setPermissionTreeLoading(false);
    }
  }

  function openCreateUser() {
    setEditingUser(null);
    setUserForm(
      emptyUserForm
    );
    setUsersError("");
    setUserModalError("");
    setUserFormErrors({});
    setUserPermissionOverrideChanged(false);
    setUserModalOpen(true);
    loadPermissionTree();
  }

  function openEditUser(user) {
    setEditingUser(user);

    setUserForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "EMPLOYEE",
      customRoleId: user.customRoleId || "",
      employeeId: user.employeeId || "",
      phone: user.phone || "",
      jobTitle: user.jobTitle || "",
      designationId: user.designationId || "",
      levelId: user.levelId || "",
      department:
        user.department || "",
      managerId: user.managerId || "",
      active: user.active,
      permissions: {
        ...emptyUserForm.permissions,
        ...(user.permissions || {}),
      },
      pageAccess: normalizeClientPageAccess(user.pageAccess),
    });

    setUsersError("");
    setUserModalError("");
    setUserFormErrors({});
    setUserPermissionOverrideChanged(false);
    setUserModalOpen(true);
    loadPermissionTree();
  }

  function setRole(selection) {
    const customRole = selection.startsWith("CUSTOM:")
      ? organization.roles.find((item) => `CUSTOM:${item.id}` === selection)
      : null;

    const role = customRole?.baseRole || selection;
    const rolePermissions = customRole?.permissions || roleDefaults(role);

    // Least-privilege rule: changing a department must never silently elevate
    // a user's access. Defaults come from the selected role/custom role only.
    // An admin can still deliberately customise individual permissions below.
    setUserForm((current) => ({
      ...current,
      role,
      customRoleId: customRole?.id || "",
      permissions: Object.fromEntries(
        Object.keys(current.permissions).map((key) => [
          key,
          rolePermissions?.[key] === true,
        ])
      ),
    }));
  }

  function updateUserField(field, value) {
    setUserForm((current) => ({
      ...current,
      [field]: value,
    }));

    setUserFormErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });

    setUserModalError("");
  }

  function setUserLevel(levelId) {
    const level = organization.levels.find((item) => item.id === levelId);
    const inheritedFlags = level
      ? flagsFromComponents(level.permissions?.components || {})
      : null;
    setUserForm((current) => ({
      ...current,
      levelId,
      permissions: inheritedFlags
        ? { ...current.permissions, ...inheritedFlags }
        : current.permissions,
    }));
    // Selecting a level means "follow this level" until an individual switch
    // is deliberately changed afterwards.
    setUserPermissionOverrideChanged(false);
  }

  function setUserDepartment(name) {
    updateUserField("department", name);
  }

  async function saveUser() {
    const nextErrors = {};
    const name = String(userForm.name || "").trim();
    const email = String(userForm.email || "").trim();
    const password = String(userForm.password || "");

    if (!name) {
      nextErrors.name = "Name is required.";
    }

    if (!email) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!userForm.department) {
      nextErrors.department = "Department is required.";
    }

    if (!editingUser) {
      if (!password) {
        nextErrors.password = "Temporary password is required.";
      } else if (password.length < 8) {
        nextErrors.password = "Temporary password must be at least 8 characters.";
      }
    }

    if (Object.keys(nextErrors).length) {
      setUserFormErrors(nextErrors);
      setUserModalError("Please correct the highlighted fields.");
      return;
    }

    setUserSaving(true);
    setUsersError("");
    setUserModalError("");
    setUserFormErrors({});

    try {
      const payload = {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        customRoleId: userForm.customRoleId || null,
        phone: userForm.phone,
        jobTitle:
          userForm.jobTitle,
        designationId:
          userForm.designationId || null,
        levelId:
          userForm.levelId || null,
        department:
          userForm.department,
        managerId:
          userForm.role === "EMPLOYEE" ? (userForm.managerId || null) : null,
        active: userForm.active,
      };

      if (userPermissionOverrideChanged || !editingUser) {
        payload.permissions = userForm.permissions;
        payload.pageAccess = userForm.pageAccess;
        payload.permissionOverride = userPermissionOverrideChanged;
      }

      if (!editingUser) {
        payload.password =
          userForm.password;
      }

      const data =
        await apiRequest(
          editingUser
            ? `/api/client/users/${editingUser.id}`
            : "/api/client/users",
          {
            method:
              editingUser
                ? "PATCH"
                : "POST",
            body:
              JSON.stringify(
                payload
              ),
          }
        );

      setUsers(
        (current) =>
          editingUser
            ? current.map(
                (item) =>
                  item.id ===
                  data.user.id
                    ? data.user
                    : item
              )
            : [
                ...current,
                data.user,
              ]
      );

      showSettingsSuccess(
        editingUser
          ? "User updated successfully"
          : "User added successfully"
      );
      closeUserModal();
    } catch (error) {
      setUserModalError(
        error?.data?.message ||
          "Unable to save user"
      );
    } finally {
      setUserSaving(false);
    }
  }

  async function toggleUserActive(user) {
    try {
      const data =
        await apiRequest(
          `/api/client/users/${user.id}`,
          {
            method: "PATCH",
            body:
              JSON.stringify({
                active:
                  !user.active,
              }),
          }
        );

      setUsers(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              data.user.id
                ? data.user
                : item
          )
      );
      showSettingsSuccess(
        data.user?.active
          ? "User activated successfully"
          : "User deactivated successfully"
      );
    } catch (error) {
      setUsersError(
        error?.data?.message ||
          "Unable to update user"
      );
    }
  }

  async function submitResetPassword() {
    if (!resetPasswordUser) return;

    setResetSaving(true);
    setUsersError("");

    try {
      await apiRequest(
        `/api/client/users/${resetPasswordUser.id}/reset-password`,
        {
          method: "PATCH",
          body:
            JSON.stringify({
              password:
                resetPassword,
            }),
        }
      );

      showSettingsSuccess("Password reset successfully");
      setResetPasswordUser(null);
      setResetPassword("");
    } catch (error) {
      setUsersError(
        error?.data?.message ||
          "Unable to reset password"
      );
    } finally {
      setResetSaving(false);
    }
  }

  async function loadLeadSources() {
    setSourcesLoading(true);
    setSourcesError("");

    try {
      const data =
        await apiRequest(
          "/api/client/lead-sources"
        );

      setLeadSources(
        data.sources || []
      );
    } catch (error) {
      setSourcesError(
        error?.data?.message ||
          "Unable to load lead sources"
      );
    } finally {
      setSourcesLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "sources") {
      loadLeadSources();
    }
  }, [tab]);

  function closeSourceModal() {
    setSourceModalOpen(false);
    setEditingSource(null);
    setSourceModalError("");
  }

  function openCreateSource() {
    setEditingSource(null);
    setSourceForm(
      emptySourceForm
    );
    setSourcesError("");
    setSourceModalError("");
    setSourceModalOpen(true);
  }

  function openEditSource(source) {
    setEditingSource(source);
    setSourceForm({
      name:
        source.name || "",
      key:
        source.key || "",
      description:
        source.description || "",
      active:
        source.active,
      showInForms:
        source.showInForms,
      sortOrder:
        source.sortOrder ?? 100,
    });
    setSourcesError("");
    setSourceModalError("");
    setSourceModalOpen(true);
  }

  async function saveLeadSource() {
    setSourceSaving(true);
    setSourceModalError("");

    try {
      const data =
        await apiRequest(
          editingSource
            ? `/api/client/lead-sources/${editingSource.id}`
            : "/api/client/lead-sources",
          {
            method:
              editingSource
                ? "PATCH"
                : "POST",
            body:
              JSON.stringify(
                sourceForm
              ),
          }
        );

      setLeadSources(
        (current) => {
          const next =
            editingSource
              ? current.map(
                  (item) =>
                    item.id ===
                    data.source.id
                      ? data.source
                      : item
                )
              : [
                  ...current,
                  data.source,
                ];

          return next
            .slice()
            .sort(
              (a, b) =>
                a.sortOrder -
                  b.sortOrder ||
                a.name.localeCompare(
                  b.name
                )
            );
        }
      );

      showSettingsSuccess(
        editingSource
          ? "Lead source updated successfully"
          : "Lead source added successfully"
      );
      closeSourceModal();
    } catch (error) {
      setSourceModalError(
        error?.data?.message ||
          "Unable to save lead source"
      );
    } finally {
      setSourceSaving(false);
    }
  }

  async function toggleLeadSource(
    source,
    field
  ) {
    try {
      const data =
        await apiRequest(
          `/api/client/lead-sources/${source.id}`,
          {
            method: "PATCH",
            body:
              JSON.stringify({
                [field]:
                  !source[field],
              }),
          }
        );

      setLeadSources(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              data.source.id
                ? data.source
                : item
          )
      );
      showSettingsSuccess("Lead source updated successfully");
    } catch (error) {
      setSourcesError(
        error?.data?.message ||
          "Unable to update lead source"
      );
    }
  }

  async function deleteLeadSource(
    source
  ) {
    if (
      !window.confirm(
        `Delete "${source.name}"?`
      )
    ) {
      return;
    }

    try {
      await apiRequest(
        `/api/client/lead-sources/${source.id}`,
        {
          method: "DELETE",
        }
      );

      setLeadSources(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              source.id
          )
      );
      showSettingsSuccess("Lead source deleted successfully");
    } catch (error) {
      setSourcesError(
        error?.data?.message ||
          "Unable to delete lead source"
      );
    }
  }



  async function loadNotificationPreferences() {
    setNotificationPreferencesLoading(true);
    setNotificationPreferencesError("");
    setNotificationPreferencesMessage("");

    try {
      const data =
        await apiRequest(
          "/api/client/notifications/preferences"
        );

      setNotificationPreferences(
        data.preference || {
          inAppEnabled: true,
          emailEnabled: true,
          smsEnabled: false,
          leadUpdates: true,
          admissionUpdates: true,
          billingUpdates: true,
          supportUpdates: true,
          systemUpdates: true,
        }
      );

      setNotificationWorkspaceDefaults(
        data.workspaceDefaults || {
          emailEnabled: true,
          smsEnabled: false,
        }
      );
    } catch (error) {
      setNotificationPreferencesError(
        error?.data?.message ||
          "Unable to load notification preferences"
      );
    } finally {
      setNotificationPreferencesLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "notifications") {
      loadNotificationPreferences();
    }
  }, [tab]);

  function updateNotificationPreference(
    key,
    value
  ) {
    setNotificationPreferences(
      (current) => ({
        ...current,
        [key]: value,
      })
    );

    setNotificationPreferencesMessage("");
  }

  async function saveNotificationPreferences() {
    setNotificationPreferencesSaving(true);
    setNotificationPreferencesError("");
    setNotificationPreferencesMessage("");

    try {
      const data =
        await apiRequest(
          "/api/client/notifications/preferences",
          {
            method: "PATCH",
            body:
              JSON.stringify(
                notificationPreferences
              ),
          }
        );

      setNotificationPreferences(
        data.preference
      );

      setNotificationWorkspaceDefaults(
        data.workspaceDefaults
      );

      setNotificationPreferencesMessage(
        data.message ||
          "Notification preferences saved"
      );
      showSettingsSuccess(
        data.message ||
          "Notification preferences saved"
      );
    } catch (error) {
      setNotificationPreferencesError(
        error?.data?.message ||
          "Unable to save notification preferences"
      );
    } finally {
      setNotificationPreferencesSaving(false);
    }
  }


  async function loadAuditLogs() {
    setAuditLogsLoading(true);
    setAuditLogsError("");

    try {
      const params =
        new URLSearchParams();

      params.set(
        "limit",
        "100"
      );

      if (
        auditSearch.trim()
      ) {
        params.set(
          "search",
          auditSearch.trim()
        );
      }

      if (
        auditEntityFilter
      ) {
        params.set(
          "entityType",
          auditEntityFilter
        );
      }

      const data =
        await apiRequest(
          `/api/client/audit-logs?${params.toString()}`
        );

      setAuditLogs(
        data.logs || []
      );

      setAuditTotal(
        data.total || 0
      );
    } catch (error) {
      setAuditLogsError(
        error?.data?.message ||
          "Unable to load activity logs"
      );
    } finally {
      setAuditLogsLoading(false);
    }
  }

  useEffect(() => {
    if (
      tab ===
      "activity"
    ) {
      loadAuditLogs();
    }
  }, [
    tab,
    auditEntityFilter,
  ]);

  function formatAuditDate(
    value
  ) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function auditActionLabel(
    action
  ) {
    return String(
      action || ""
    )
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(
        /\b\w/g,
        (char) =>
          char.toUpperCase()
      );
  }

  const filteredUsers =
    users.filter((user) => {
      const query =
        userSearch
          .trim()
          .toLowerCase();

      if (!query) return true;

      return [
        user.name,
        user.email,
        user.employeeId,
        user.customRoleName,
        user.role,
        user.department,
        user.jobTitle,
      ].some(
        (value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
      );
    });

  return (
    <div className="space-y-4">

      {/* PAGE HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Workspace / Configuration
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            Settings
          </h1>

          <p className="mt-1 text-[13px] text-slate-500">
            Manage company profile,
            branding, access,
            lead configuration and
            workspace preferences.
          </p>
        </div>

        <button
          type="button"
          onClick={
            saveWorkspaceSettings
          }
          disabled={
            workspaceSettingsSaving ||
            workspaceSettingsLoading
          }
          className="h-9 px-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold rounded-lg inline-flex items-center justify-center gap-2 shadow-sm"
        >
          {workspaceSettingsSaving ? (
            <Loader2
              size={14}
              className="animate-spin"
            />
          ) : (
            <Save size={14} />
          )}

          {workspaceSettingsSaving
            ? "Saving..."
            : "Save Changes"}
        </button>
      </div>

      {workspaceSettingsError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-[13px]">
          {workspaceSettingsError}
        </div>
      )}

      {settingsSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-[13px] font-medium">
          {settingsSuccessMessage}
        </div>
      )}

      {/* SETTINGS LAYOUT */}

      <div className="space-y-5">

        {/* HORIZONTAL TAB NAV */}

        <nav aria-label="Settings sections" className="border-b border-slate-200">
          <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {visibleTabs.map((item) => {
              const Icon = item.i;
              const active = tab === item.k;

              return (
                <button
                  key={item.k}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setTab(item.k)}
                  className={`flex items-center gap-1.5 whitespace-nowrap -mb-px border-b-2 px-3.5 py-3 text-[13px] font-semibold transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 ${
                    active
                      ? "border-brand-600 text-brand-700"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <Icon
                    size={15}
                    aria-hidden="true"
                    className={active ? "text-brand-600" : "text-slate-400"}
                  />

                  <span>{item.l}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* CONTENT */}

        <section
          className={
            tab === "company"
              ? "overflow-visible"
              : "bg-white rounded-xl shadow-sm overflow-hidden"
          }
        >
          {tab !== "users" && tab !== "company" && (
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {activeTab && (
                  <activeTab.i
                    size={16}
                    className="text-indigo-600"
                  />
                )}

                <h2 className="text-[17px] font-bold text-slate-950">
                  {
                    activeTab
                      ?.l
                  }
                </h2>
              </div>
            </div>
          )}

          {/* COMPANY */}

          {tab ===
            "company" && (
            <div>
              <div className="st-v2">
                <style dangerouslySetInnerHTML={{ __html: SETTINGS_V2_CSS }} />

                {/* Live region: announces brand-accent + save state to screen readers */}
                <div className="sr-only" role="status" aria-live="polite">
                  {workspaceSettingsSaving
                    ? "Saving brand settings…"
                    : `Brand accent set to ${brandHex(selectedColor)}`}
                </div>

                {/* HERO / identity */}
                <div className="hero">
                  <div className="hero-l">
                    <div className="hlogo" aria-hidden="true">
                      {logoPreview ? (
                        <img src={logoPreview} alt="" />
                      ) : (
                        tenant?.short || "CB"
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="hnm">
                        {form.companyName ||
                          tenant?.name ||
                          tenant?.brandName ||
                          "CRM Workspace"}
                      </div>
                      <div className="hurl">
                        <Globe2 aria-hidden="true" />
                        {form.subdomain ||
                          tenant?.subdomain ||
                          "your-workspace"}
                      </div>
                    </div>
                  </div>
                  <div className="hmeta">
                    <span className="badge ok">
                      <span className="d" aria-hidden="true" />
                      Active
                    </span>
                    <span>
                      <Briefcase aria-hidden="true" />
                      {form.businessType ||
                        tenant?.business ||
                        "Business not set"}
                    </span>
                    <span>
                      <MapPin aria-hidden="true" />
                      {form.city || tenant?.city || "City not set"}
                    </span>
                  </div>
                </div>

                <StorageUsageCard />

                {/* PROFILE */}
                <div className="card">
                  <div className="ch bd">
                    <span className="ic" aria-hidden="true">
                      <Building />
                    </span>
                    <div>
                      <h3>Profile</h3>
                      <p>Core workspace identity shown throughout the CRM.</p>
                    </div>
                  </div>
                  <div className="cc grid2">
                    <div>
                      <div className="leg">Identity</div>
                      <div className="fields">
                        <div>
                          <label className="fl" htmlFor="st-company-name">
                            Company Name
                          </label>
                          <div className="inp">
                            <Building aria-hidden="true" />
                            <input
                              id="st-company-name"
                              value={form.companyName}
                              onChange={(e) => update("companyName", e.target.value)}
                              placeholder="e.g. Bright Future Academy"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="fl" htmlFor="st-business-type">
                            Business Type
                          </label>
                          <div className="inp">
                            <Briefcase aria-hidden="true" />
                            <input
                              id="st-business-type"
                              value={form.businessType}
                              onChange={(e) => update("businessType", e.target.value)}
                              placeholder="e.g. Education Consultancy"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="leg">Location &amp; web address</div>
                      <div className="fields">
                        <div>
                          <label className="fl" htmlFor="st-city">
                            City
                          </label>
                          <div className="inp">
                            <MapPin aria-hidden="true" />
                            <input
                              id="st-city"
                              value={form.city}
                              onChange={(e) => update("city", e.target.value)}
                              placeholder="e.g. Hyderabad"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="fl" htmlFor="st-subdomain">
                            Subdomain
                          </label>
                          <div className="inp">
                            <Globe2 aria-hidden="true" />
                            <input
                              id="st-subdomain"
                              value={form.subdomain}
                              onChange={(e) => update("subdomain", e.target.value)}
                              placeholder="e.g. brightfuture.bispun.com"
                              aria-describedby="st-subdomain-hint"
                            />
                          </div>
                          <div className="hint" id="st-subdomain-hint">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 16v-4M12 8h.01" />
                            </svg>
                            Auto-generated from the company name. Override only if you need a different address.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="cc" style={{ paddingTop: 0 }}>
                    <div className="note">
                      <Globe2 aria-hidden="true" />
                      Company profile changes are saved to this tenant and reflected across the client portal after save.
                    </div>
                  </div>
                </div>

                {/* BRANDING */}
                <div className="card">
                  <div className="ch bd">
                    <span className="ic" aria-hidden="true">
                      <Palette />
                    </span>
                    <div>
                      <h3>Branding</h3>
                      <p>Logo and accent applied portal-wide.</p>
                    </div>
                  </div>
                  <div className="cc grid2">
                    {/* Logo */}
                    <div>
                      <span className="fl" id="st-logo-label">Company Logo</span>
                      {logoPreview ? (
                        <div
                          style={{
                            height: 96,
                            borderRadius: 12,
                            background: "var(--surface-2)",
                            border: "1px solid var(--line)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          <img
                            src={logoPreview}
                            alt={`${form.companyName || tenant?.name || "Company"} logo`}
                            onError={() => {
                              setLogoPreview("");
                              setLogoUrlError("Unable to load an image from this logo URL.");
                            }}
                            style={{ maxHeight: 80, maxWidth: 220, objectFit: "contain" }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            height: 96,
                            borderRadius: 12,
                            background: "var(--surface-2)",
                            border: "1px dashed var(--line)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--ink-3)",
                            fontSize: 13,
                          }}
                        >
                          No logo uploaded
                        </div>
                      )}
                      <div style={{ marginTop: 11, display: "flex", gap: 9, flexWrap: "wrap" }}>
                        <div className={`inp${logoUrlError ? " err" : ""}`} style={{ flex: 1, minWidth: 180 }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="9" cy="9" r="2" />
                            <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                          </svg>
                          <input
                            id="st-logo-url"
                            aria-labelledby="st-logo-label"
                            type="url"
                            value={form.logoUrl}
                            aria-invalid={!!logoUrlError}
                            aria-describedby={logoUrlError ? "st-logo-error" : "st-logo-hint"}
                            onChange={(event) => {
                              const value = event.target.value;
                              const validationError = validateLogoValue(value);
                              update("logoUrl", value);
                              setLogoUrlError(validationError);
                              if (!value.trim()) {
                                setLogoPreview("");
                              } else if (!validationError) {
                                setLogoPreview(value.trim());
                              } else {
                                setLogoPreview("");
                              }
                            }}
                            placeholder="https://example.com/logo.png"
                          />
                        </div>
                        <label className="ghost" style={{ cursor: "pointer" }}>
                          <Upload aria-hidden="true" />
                          Upload
                          <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={handleLogoUpload}
                            className="sr-only"
                            aria-label="Upload a logo image file"
                          />
                        </label>
                      </div>
                      {logoUrlError ? (
                        <div className="err-text" id="st-logo-error">
                          {logoUrlError}
                        </div>
                      ) : (
                        <div className="hint" id="st-logo-hint">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4M12 8h.01" />
                          </svg>
                          PNG, JPG, WEBP or SVG. Square works best. Maximum 500 KB for local storage.
                        </div>
                      )}
                      {logoPreview && (
                        <button
                          type="button"
                          className="mini"
                          style={{ marginTop: 10 }}
                          onClick={removeLogo}
                          aria-label="Remove company logo"
                        >
                          <X aria-hidden="true" width={14} height={14} />
                          Remove logo
                        </button>
                      )}
                    </div>

                    {/* Accent */}
                    <div>
                      <span className="fl" id="st-accent-label">Brand Accent</span>
                      <div className="swatches" role="group" aria-labelledby="st-accent-label">
                        {QUICK_BRAND_COLORS.map((color) => {
                          const selected =
                            brandHex(selectedColor) === color.hex.toLowerCase();
                          return (
                            <button
                              key={color.key}
                              type="button"
                              className="swt"
                              aria-pressed={selected}
                              title={color.label}
                              aria-label={`Use ${color.label} as the primary brand color`}
                              style={{ background: color.hex, color: readableOn(color.hex) }}
                              onClick={() => {
                                setSelectedColor(color.key);
                                setCustomColor(color.hex);
                                applyBrandTheme(color.key);
                              }}
                            >
                              {selected && (
                                <Check strokeWidth={3} aria-hidden="true" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="hint">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 16v-4M12 8h.01" />
                        </svg>
                        Buttons, highlights and active states use this hue.
                      </div>

                      <div style={{ marginTop: 13, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", position: "relative" }}>
                        <button
                          type="button"
                          className="mini"
                          aria-pressed={customPaletteOpen}
                          aria-expanded={customPaletteOpen}
                          onClick={() => setCustomPaletteOpen((current) => !current)}
                        >
                          <Plus aria-hidden="true" width={14} height={14} />
                          Customize color
                        </button>

                        <span
                          className="note"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 7,
                            padding: "5px 9px",
                            border: "1px solid var(--line)",
                            borderRadius: 9,
                            background: "var(--surface-2)",
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              height: 16,
                              width: 16,
                              borderRadius: 5,
                              border: "1px solid rgba(0,0,0,.12)",
                              background: brandHex(selectedColor),
                            }}
                          />
                          <span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 600, textTransform: "uppercase" }}>
                            {brandHex(selectedColor)}
                          </span>
                        </span>

                        {customPaletteOpen && (
                          <>
                            <button
                              type="button"
                              className="fixed inset-0 z-[79] cursor-default bg-transparent"
                              aria-label="Close custom color palette"
                              onClick={() => setCustomPaletteOpen(false)}
                            />

                            <div
                              role="dialog"
                              aria-label="Custom brand colors"
                              className="fixed inset-x-3 bottom-3 z-[80] max-h-[80vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-1/2 sm:w-[360px] sm:max-w-[calc(100vw-48px)] sm:-translate-y-1/2"
                            >
                              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
                                <div>
                                  <div className="text-[14px] font-bold text-slate-900">
                                    Custom Colors
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-slate-500">
                                    Choose from the full palette or enter an exact HEX color.
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setCustomPaletteOpen(false)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="Close custom colors"
                                >
                                  <X size={15} />
                                </button>
                              </div>

                              <div className="max-h-[calc(100vh-180px)] overflow-y-auto overscroll-contain p-4">
                                <div className="grid grid-cols-10 gap-2 native:grid-cols-6">
                                  {BRAND_PALETTE.map((hex) => {
                                    const selected =
                                      brandHex(selectedColor) === hex.toLowerCase();
                                    return (
                                      <button
                                        key={hex}
                                        type="button"
                                        title={hex.toUpperCase()}
                                        aria-label={`Use ${hex} as the primary brand color`}
                                        aria-pressed={selected}
                                        onClick={() => {
                                          const normalized = hex.toLowerCase();
                                          setSelectedColor(normalized);
                                          setCustomColor(normalized);
                                          applyBrandTheme(normalized);
                                        }}
                                        style={{ backgroundColor: hex }}
                                        className={`relative h-6 w-6 justify-self-center rounded-md border border-black/10 ring-offset-1 transition hover:scale-110 ${
                                          selected
                                            ? "ring-2 ring-slate-900 shadow-sm"
                                            : "ring-1 ring-transparent hover:ring-slate-300"
                                        }`}
                                      >
                                        {selected && (
                                          <Check
                                            size={10}
                                            strokeWidth={3}
                                            className="absolute inset-0 m-auto text-white drop-shadow"
                                          />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="mt-4 border-t border-slate-100 pt-4">
                                  <div className="text-[13px] font-semibold text-slate-800">
                                    Exact HEX
                                  </div>
                                  <div className="mt-2 flex items-center gap-2">
                                    <label
                                      className="relative flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                                      title="Open system color picker"
                                    >
                                      <span
                                        className="h-6 w-6 rounded-md border border-black/10"
                                        style={{ backgroundColor: customColor }}
                                      />
                                      <input
                                        type="color"
                                        value={/^#[0-9a-fA-F]{6}$/.test(customColor) ? customColor : "#4f46e5"}
                                        onChange={(event) => {
                                          const value = event.target.value.toLowerCase();
                                          setCustomColor(value);
                                          setSelectedColor(value);
                                          applyBrandTheme(value);
                                        }}
                                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                        aria-label="Choose a custom brand color"
                                      />
                                    </label>
                                    <input
                                      aria-label="Brand color HEX value"
                                      value={customColor}
                                      onChange={(event) => {
                                        const value = event.target.value.trim();
                                        setCustomColor(value);
                                        if (/^#[0-9a-fA-F]{6}$/.test(value)) {
                                          const normalized = value.toLowerCase();
                                          setSelectedColor(normalized);
                                          applyBrandTheme(normalized);
                                        }
                                      }}
                                      placeholder="#4F46E5"
                                      maxLength={7}
                                      className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 font-mono text-[13px] font-semibold uppercase text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    disabled={!/^#[0-9a-fA-F]{6}$/.test(customColor)}
                                    onClick={() => {
                                      const normalized = customColor.toLowerCase();
                                      setSelectedColor(normalized);
                                      applyBrandTheme(normalized);
                                    }}
                                    className="mt-3 h-10 w-full rounded-lg bg-brand-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Apply Color
                                  </button>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn"
                          onClick={saveWorkspaceSettings}
                          disabled={workspaceSettingsSaving || workspaceSettingsLoading}
                        >
                          {workspaceSettingsSaving ? (
                            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <Save size={14} aria-hidden="true" />
                          )}
                          {workspaceSettingsSaving ? "Saving..." : "Save Brand Color"}
                        </button>
                        <span className="note">
                          Preview is instant. Save to keep this color after refresh.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <AccountDeletionSection />
            </div>
          )}

          {/* USERS */}

          {tab ===
            "users" && (
            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-[13px] font-bold text-slate-900">
                  Users & Roles
                </h3>

                <p className="mt-1 text-[13px] text-slate-500">
                  Manage team members, departments and role permissions without showing everything at once.
                </p>
              </div>

              <nav
                aria-label="User management sections"
                className="border-b border-slate-200"
              >
                <div
                  className="flex gap-1 overflow-x-auto"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {[
                    ["templates", "Templates", TEAM_TEMPLATES.length, Star],
                    ["users", "Users", users.length, Users],
                    ["departments", "Departments", organization.departments.length, Building],
                    ["roles", "Roles", organization.roles.length, KeyRound],
                  ].map(([key, label, count, Icon]) => {
                    const active = usersManagementTab === key;

                    return (
                      <button
                        key={key}
                        type="button"
                        aria-current={active ? "page" : undefined}
                        onClick={() => setUsersManagementTab(key)}
                        className={`flex items-center gap-1.5 whitespace-nowrap -mb-px border-b-2 px-3.5 py-3 text-[13px] font-semibold transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 ${
                          active
                            ? "border-brand-600 text-brand-700"
                            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <Icon
                          size={15}
                          aria-hidden="true"
                          className={active ? "text-brand-600" : "text-slate-400"}
                        />

                        <span>{label}</span>

                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                            active
                              ? "bg-brand-50 text-brand-600"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </nav>

              {usersError &&
                !userModalOpen &&
                !organizationModal &&
                !resetPasswordUser && (
                  <div
                    role="alert"
                    className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-700"
                  >
                    <span>{usersError}</span>
                    <button
                      type="button"
                      onClick={() => {
                        loadUsers();
                        loadOrganization();
                      }}
                      disabled={usersLoading}
                      className="shrink-0 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                    >
                      {usersLoading ? "Retrying…" : "Try again"}
                    </button>
                  </div>
                )}

              {usersManagementTab === "users" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Total users", value: users.length, Icon: Users, tint: "bg-brand-50 text-brand-600" },
                      { label: "Active", value: users.filter((member) => member.active).length, Icon: Check, tint: "bg-emerald-50 text-emerald-600" },
                      { label: "Roles", value: organization.roles.length, Icon: KeyRound, tint: "bg-indigo-50 text-indigo-600" },
                      { label: "Departments", value: organization.departments.length, Icon: Building, tint: "bg-amber-50 text-amber-600" },
                    ].map((kpi) => (
                      <div
                        key={kpi.label}
                        className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${kpi.tint}`}>
                          <kpi.Icon size={16} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[18px] font-bold leading-none text-slate-900 tabular-nums">{kpi.value}</div>
                          <div className="mt-1 truncate text-[11.5px] font-medium text-slate-500">{kpi.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[14px] font-bold text-slate-900">
                        Team Members
                      </div>
                      <div className="mt-0.5 text-[13px] text-slate-500">
                        {filteredUsers.length} of {users.length} users
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                      <div className="relative w-full sm:w-[300px]">
                        <Search
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          value={userSearch}
                          onChange={(event) => setUserSearch(event.target.value)}
                          placeholder="Search users..."
                          className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[14px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={openCreateUser}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700"
                      >
                        <Plus size={14} />
                        Add User
                      </button>
                    </div>
                  </div>

                  {usersLoading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-slate-500">
                      <Loader2 size={16} className="animate-spin" />
                      Loading users...
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                          <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Employee ID</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">User</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Role</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Department</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Status</th>
                              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Actions</th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100">
                            {filteredUsers.map((user) => (
                              <tr key={user.id} className="hover:bg-slate-50/70">
                                <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] font-semibold text-indigo-700">
                                  {user.employeeId || "—"}
                                </td>

                                <td className="px-4 py-3">
                                  <div className="font-semibold text-slate-900">
                                    {user.name}
                                  </div>
                                  <div className="mt-0.5 text-[13px] text-slate-500">
                                    {user.email}
                                  </div>
                                </td>

                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[13px] font-semibold text-indigo-700">
                                    {(user.customRoleName || user.role).replaceAll("_", " ")}
                                  </span>
                                </td>

                                <td className="px-4 py-3 text-[13px] text-slate-600">
                                  {user.department || "—"}
                                </td>

                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleUserActive(user)}
                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-semibold ${
                                      user.active
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {user.active ? "Active" : "Inactive"}
                                  </button>
                                </td>

                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openEditUser(user)}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                                      title="Edit user"
                                    >
                                      <Pencil size={13} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setResetPasswordUser(user);
                                        setResetPassword("");
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                                      title="Reset password"
                                    >
                                      <KeyRound size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}

                            {!filteredUsers.length && (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="py-12 text-center text-[13px] text-slate-500"
                                >
                                  No users found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {usersManagementTab === "departments" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[14px] font-bold text-slate-900">
                        Departments
                      </div>
                      <div className="mt-0.5 text-[13px] text-slate-500">
                        Organize users by team or business function.
                      </div>
                    </div>

                    {currentUser?.role === "CLIENT_ADMIN" && (
                      <button
                        type="button"
                        onClick={() => openOrganizationModal("department")}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700"
                      >
                        <Plus size={14} aria-hidden="true" />
                        Add Department
                      </button>
                    )}
                  </div>

                  {organization.departments.length ? (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                          <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Department</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Code</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Description</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Members</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Type</th>
                              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {organization.departments.map((department) => {
                              const memberCount = users.filter((user) => user.department === department.name).length;
                              return (
                                <tr key={department.id} className="hover:bg-slate-50/70">
                                  <td className="whitespace-nowrap px-3 py-3 text-[13px] font-semibold text-slate-900">{department.name}</td>
                                  <td className="whitespace-nowrap px-3 py-3 font-mono text-[13px] text-slate-500">{department.code}</td>
                                  <td className="px-3 py-3 text-[13px] text-slate-500">{department.description || "—"}</td>
                                  <td className="whitespace-nowrap px-3 py-3 text-[13px] text-slate-600">{memberCount} {memberCount === 1 ? "member" : "members"}</td>
                                  <td className="whitespace-nowrap px-3 py-3">
                                    {department.system ? (
                                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">Default</span>
                                    ) : (
                                      <span className="text-[13px] text-slate-400">Custom</span>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      {!department.system && currentUser?.role === "CLIENT_ADMIN" && (
                                        <>
                                          <button type="button" onClick={() => openEditOrganizationModal("department", department)} aria-label={`Edit ${department.name}`} title="Edit department" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><Pencil size={13} aria-hidden="true" /></button>
                                          <button type="button" onClick={() => deleteOrganizationItem("department", department.id)} aria-label={`Delete ${department.name}`} title="Delete department" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><Trash2 size={13} aria-hidden="true" /></button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-[13px] text-slate-400">No departments yet.</div>
                  )}
                </div>
              )}

              {usersManagementTab === "roles" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[14px] font-bold text-slate-900">
                        Custom Roles
                      </div>
                      <div className="mt-0.5 text-[13px] text-slate-500">
                        Create reusable permission templates for your team.
                      </div>
                    </div>

                    {currentUser?.role === "CLIENT_ADMIN" && (
                      <button
                        type="button"
                        onClick={() => openOrganizationModal("role")}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700"
                      >
                        <Plus size={14} />
                        Add Role
                      </button>
                    )}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px]">
                        <thead className="border-b border-slate-200 bg-slate-50">
                          <tr>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Role</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Code</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Members</th>
                            <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {organization.roles.length ? (
                            organization.roles.map((role) => {
                              const memberCount = users.filter(
                                (user) => user.customRoleId === role.id || user.customRoleName === role.name
                              ).length;
                              return (
                                <tr key={role.id} className="hover:bg-slate-50/70">
                                  <td className="whitespace-nowrap px-3 py-3 text-[13px] font-semibold text-slate-900">{role.name}</td>
                                  <td className="whitespace-nowrap px-3 py-3 font-mono text-[13px] text-slate-500">{role.code}</td>
                                  <td className="whitespace-nowrap px-3 py-3 text-[13px] text-slate-600">{memberCount} {memberCount === 1 ? "member" : "members"}</td>
                                  <td className="whitespace-nowrap px-3 py-3">
                                    {currentUser?.role === "CLIENT_ADMIN" && (
                                      <div className="flex items-center justify-end gap-1">
                                        <button type="button" onClick={() => openEditOrganizationModal("role", role)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Edit role"><Pencil size={13}/></button>
                                        <button type="button" onClick={() => deleteOrganizationItem("role", role.id)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" title="Delete role"><Trash2 size={13} /></button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-12 text-center text-[13px] text-slate-400">No custom roles yet. Add a role when you need reusable access rules.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {usersManagementTab === "templates" && (
                <div className="space-y-5">
                  <p className="flex items-center gap-2 text-[13px] text-slate-500">
                    <Star size={16} aria-hidden="true" className="shrink-0 text-indigo-600" />
                    Pick a template — it creates your levels and their access. Then add people and assign a level.
                  </p>

                  {appliedTemplate && (
                    <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700">
                      <Check size={16} aria-hidden="true" />
                      <span><b>{TEAM_TEMPLATES.find((t) => t.key === appliedTemplate)?.name}</b> applied. Next: add users &amp; assign a level.</span>
                    </div>
                  )}

                  <div>
                    <h3 className="text-[14px] font-bold text-slate-900">Team templates</h3>
                    <div className="mt-0.5 text-[13px] text-slate-500">Applying one creates any missing levels and sets their permissions. Existing levels and users are never deleted.</div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {TEAM_TEMPLATES.map((tpl) => {
                      const isApplied = (appliedTemplate || storedTemplateKey) === tpl.key;
                      return (
                      <div key={tpl.key} className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${isApplied ? "border-indigo-300 ring-2 ring-indigo-500/60" : "border-slate-200"}`}>
                        <div className="border-b border-slate-100 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">{tpl.tagline} · {tpl.roles.length} levels</div>
                            {isApplied && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                <Check size={12} strokeWidth={3} aria-hidden="true" /> Applied
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-[16px] font-bold text-slate-900">{tpl.name}</div>
                        </div>
                        <ul className="flex-1 px-4 py-2">
                          {tpl.roles.map((r) => (
                            <li key={r.name} className="flex items-center justify-between gap-3 border-b border-dashed border-slate-100 py-2 last:border-0">
                              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-800">{r.name}</span>
                              <span
                                aria-label={r.admin ? `${r.name}, full permissions` : `${r.name}, ${Math.round(templateRolePercent(r) * 100)}% of permissions`}
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${r.admin ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-600"}`}
                              >
                                {r.admin ? "Full" : `${Math.round(templateRolePercent(r) * 100)}%`}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 p-3">
                          <button
                            type="button"
                            disabled={currentUser?.role !== "CLIENT_ADMIN" || applyingTemplate !== null}
                            aria-busy={applyingTemplate === tpl.key}
                            aria-label={`${isApplied ? "Re-apply" : "Apply"} ${tpl.name}`}
                            onClick={() => applyTeamTemplate(tpl.key)}
                            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {applyingTemplate === tpl.key ? "Applying…" : isApplied ? "Re-apply" : "Apply"}
                          </button>
                          <button
                            type="button"
                            aria-label={`Preview ${tpl.name}`}
                            onClick={() => setUsersManagementTab("access")}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                          >
                            Preview <ArrowRight size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>

                  {currentUser?.role !== "CLIENT_ADMIN" && (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-500">Only a Client Admin can apply templates.</div>
                  )}
                </div>
              )}

              {false && usersManagementTab === "levels" && (() => {
                const items = [...organization.levels].sort((a, b) => (a.rank || 0) - (b.rank || 0));
                const type = "level";
                return (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[14px] font-bold text-slate-900">Levels</div>
                        <div className="mt-0.5 text-[13px] text-slate-500">
                          Define organizational access levels, create custom levels and control their order.
                        </div>
                      </div>
                      {currentUser?.role === "CLIENT_ADMIN" && (
                        <button type="button" onClick={() => openOrganizationModal(type)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700">
                          <Plus size={14} aria-hidden="true" /> Add Level
                        </button>
                      )}
                    </div>
                    {items.length ? (
                      <div className="space-y-3">
                        {items.map((item) => {
                          const memberCount = users.filter((user) => user.levelId === item.id).length;
                          const admin = String(item.name).trim().toLowerCase() === "admin" || String(item.code).trim().toUpperCase() === "ADM";
                          const pct = admin ? 100 : Math.round(levelPermissionPercent(item.permissions) * 100);
                          const scopeLbl = admin ? "Everyone" : (SCOPES.find((s) => s[0] === item.permissions?.scope)?.[1] || "Only themselves");
                          return (
                            <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[13px] font-extrabold text-indigo-600">L{item.rank}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[13px] font-bold text-slate-900">{item.name}</span>
                                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-500">{item.code}</span>
                                  {admin && <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">Protected</span>}
                                  {item.system && !admin && <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700">Default</span>}
                                  {item.active === false && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">Inactive</span>}
                                </div>
                                <div className="mt-1 text-[13px] text-slate-500">Scope: {scopeLbl} · {memberCount} user{memberCount === 1 ? "" : "s"}</div>
                              </div>
                              {currentUser?.role === "CLIENT_ADMIN" && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button type="button" onClick={openCreateUser} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-semibold text-slate-700 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><Plus size={13} aria-hidden="true" /> Add user</button>
                                  <button type="button" onClick={() => setUsersManagementTab("access")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-semibold text-slate-700 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><KeyRound size={13} aria-hidden="true" /> Edit access</button>
                                  <button type="button" onClick={() => moveLevel(item.id, -1)} disabled={item.rank <= 1} aria-label={`Move ${item.name} up`} title="Move level up" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-30">↑</button>
                                  <button type="button" onClick={() => moveLevel(item.id, 1)} disabled={item.rank >= items.length} aria-label={`Move ${item.name} down`} title="Move level down" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-30">↓</button>
                                  <button type="button" onClick={() => openEditOrganizationModal(type, item)} aria-label={`Edit ${item.name}`} title="Edit level" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><Pencil size={13} aria-hidden="true" /></button>
                                  {!item.system && <button type="button" onClick={() => deleteOrganizationItem(type, item.id)} aria-label={`Delete ${item.name}`} title="Delete level" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><Trash2 size={13} aria-hidden="true" /></button>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-[13px] text-slate-400">No levels yet.</div>
                    )}
                  </div>
                );
              })()}

              {false && usersManagementTab === "access" && (
                <AccessTab
                  key={organization.levels.map((l) => l.id).join(",")}
                  levels={organization.levels}
                  admissionsTree={permissionTree}
                  canEdit={currentUser?.role === "CLIENT_ADMIN"}
                  saving={levelAccessSaving}
                  onSave={saveLevelAccess}
                />
              )}

            </div>
          )}

          {/* SOURCES */}

          {tab ===
            "sources" && (
            <div className="p-6 space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-[13px] font-bold text-slate-900">
                    Lead Sources
                  </h3>

                  <p className="text-[13px] text-slate-500 mt-1">
                    Control which acquisition sources are available in this company workspace.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    openCreateSource
                  }
                  className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold rounded-lg inline-flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus size={14} />
                  Add Source
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Total sources", value: leadSources.length, Icon: Layers, tint: "bg-brand-50 text-brand-600" },
                  { label: "Active", value: leadSources.filter((source) => source.active).length, Icon: Check, tint: "bg-emerald-50 text-emerald-600" },
                  { label: "Inactive", value: leadSources.filter((source) => !source.active).length, Icon: EyeOff, tint: "bg-slate-100 text-slate-500" },
                  { label: "Default sources", value: leadSources.filter((source) => source.system).length, Icon: Sparkles, tint: "bg-indigo-50 text-indigo-600" },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${kpi.tint}`}>
                      <kpi.Icon size={16} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[18px] font-bold leading-none text-slate-900 tabular-nums">{kpi.value}</div>
                      <div className="mt-1 truncate text-[11.5px] font-medium text-slate-500">{kpi.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {sourcesError && !sourceModalOpen && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-[13px]">
                  {sourcesError}
                </div>
              )}

              {sourcesLoading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-[13px] text-slate-500">
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Loading lead sources...
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead className="border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Order
                          </th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Source
                          </th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Key
                          </th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Active
                          </th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Forms
                          </th>
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {leadSources.map(
                          (source) => (
                            <tr
                              key={
                                source.id
                              }
                              className="hover:bg-slate-50/70"
                            >
                              <td className="px-4 py-3">
                                <div className="inline-flex items-center gap-2 text-[13px] text-slate-500">
                                  <GripVertical
                                    size={13}
                                    className="text-slate-300"
                                  />
                                  {source.sortOrder}
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">
                                  {source.name}
                                </div>

                                <div className="text-[13px] text-slate-500 mt-0.5 max-w-sm">
                                  {source.description ||
                                    "—"}
                                </div>

                                {source.system && (
                                  <span className="inline-flex mt-1.5 rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[13px] font-semibold uppercase tracking-wide">
                                    Default
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <code className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                                  {source.key}
                                </code>
                              </td>

                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleLeadSource(
                                      source,
                                      "active"
                                    )
                                  }
                                  className={`relative w-10 h-6 rounded-full transition-colors ${
                                    source.active
                                      ? "bg-indigo-600"
                                      : "bg-slate-200"
                                  }`}
                                >
                                  <span
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                                      source.active
                                        ? "left-5"
                                        : "left-1"
                                    }`}
                                  />
                                </button>
                              </td>

                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleLeadSource(
                                      source,
                                      "showInForms"
                                    )
                                  }
                                  className={`relative w-10 h-6 rounded-full transition-colors ${
                                    source.showInForms
                                      ? "bg-indigo-600"
                                      : "bg-slate-200"
                                  }`}
                                >
                                  <span
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                                      source.showInForms
                                        ? "left-5"
                                        : "left-1"
                                    }`}
                                  />
                                </button>
                              </td>

                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditSource(
                                        source
                                      )
                                    }
                                    className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center"
                                    title="Edit source"
                                  >
                                    <Pencil
                                      size={13}
                                    />
                                  </button>

                                  {!source.system && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        deleteLeadSource(
                                          source
                                        )
                                      }
                                      className="w-8 h-8 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center"
                                      title="Delete source"
                                    >
                                      <Trash2
                                        size={13}
                                      />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        )}

                        {!leadSources.length && (
                          <tr>
                            <td
                              colSpan={6}
                              className="py-12 text-center text-[13px] text-slate-500"
                            >
                              No lead sources configured.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[13px] text-slate-500">
                Disabling a source keeps historical leads intact. Turning off “Forms” hides it from new lead-entry source lists without disabling existing data.
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}

          {tab ===
            "notifications" && (
            <div className="p-6 space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-[13px] font-bold text-slate-900">
                    Notification Preferences
                  </h3>

                  <p className="text-[13px] text-slate-500 mt-1 max-w-2xl">
                    Control how this user receives workspace updates. Email and SMS use the company defaults until this user saves their own preferences.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    saveNotificationPreferences
                  }
                  disabled={
                    notificationPreferencesSaving ||
                    notificationPreferencesLoading
                  }
                  className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[13px] font-semibold rounded-lg inline-flex items-center justify-center gap-2 shadow-sm"
                >
                  {notificationPreferencesSaving ? (
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={13} />
                  )}

                  Save Preferences
                </button>
              </div>

              {notificationPreferencesError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-[13px]">
                  {notificationPreferencesError}
                </div>
              )}

              {/* NOTIFICATION SOUND — personal, per-device preference. Rendered
                  outside the server-prefs loading state because it is handled
                  entirely client-side by the notificationPrefs store and must be
                  usable immediately (it syncs to the server when that endpoint
                  exists). Not tied to any admin permission. */}
              <div className="rounded-xl bg-slate-50 p-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                      <Bell size={16} />
                    </div>

                    <div>
                      <div
                        id="notif-sound-label"
                        className="text-[13px] font-semibold text-slate-900"
                      >
                        Notification sound
                      </div>

                      <div className="text-[13px] text-slate-500 mt-1">
                        Play a sound for new chat messages and workspace alerts on
                        this device.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={soundPrefs.soundEnabled}
                    aria-labelledby="notif-sound-label"
                    onClick={() =>
                      setNotifSoundPrefs({
                        soundEnabled: !soundPrefs.soundEnabled,
                      })
                    }
                    className={`relative w-10 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                      soundPrefs.soundEnabled
                        ? "bg-indigo-600"
                        : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                        soundPrefs.soundEnabled ? "left-5" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <label
                    htmlFor="notif-sound-volume"
                    className="text-[13px] font-semibold text-slate-600 w-16"
                  >
                    Volume
                  </label>

                  <input
                    id="notif-sound-volume"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={soundPrefs.volume}
                    disabled={!soundPrefs.soundEnabled}
                    aria-valuetext={`${Math.round(
                      soundPrefs.volume * 100
                    )} percent`}
                    onChange={(event) =>
                      setNotifSoundPrefs({
                        volume: Number(event.target.value),
                      })
                    }
                    className="flex-1 accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  />

                  <span
                    className="text-[13px] tabular-nums text-slate-500 w-10 text-right"
                    aria-hidden="true"
                  >
                    {Math.round(soundPrefs.volume * 100)}%
                  </span>
                </div>

                <fieldset
                  className="border-t border-slate-100 pt-4"
                  disabled={!soundPrefs.soundEnabled}
                >
                  <legend className="text-[13px] font-semibold text-slate-600">
                    Notification tone
                  </legend>

                  <p className="mt-0.5 mb-3 text-[13px] text-slate-400">
                    Choose the sound for workspace alerts, then preview each one.
                  </p>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {NOTIF_SOUND_OPTIONS.map((option) => {
                      const selected =
                        soundPrefs.soundChoice === option.key;

                      return (
                        <div
                          key={option.key}
                          className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${
                            selected
                              ? "border-indigo-300 bg-indigo-50/60"
                              : "border-slate-200 bg-white"
                          } ${soundPrefs.soundEnabled ? "" : "opacity-50"}`}
                        >
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                            <input
                              type="radio"
                              name="notif-sound-choice"
                              value={option.key}
                              checked={selected}
                              disabled={!soundPrefs.soundEnabled}
                              onChange={() => {
                                setNotifSoundPrefs({
                                  soundChoice: option.key,
                                });
                                previewNotificationSound(option.key);
                              }}
                              className="h-4 w-4 shrink-0 accent-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                            />

                            <span className="truncate text-[13px] font-semibold text-slate-700">
                              {option.label}
                            </span>

                            {selected ? (
                              <Check
                                size={14}
                                className="shrink-0 text-indigo-600"
                                aria-hidden="true"
                              />
                            ) : null}
                          </label>

                          <button
                            type="button"
                            onClick={() =>
                              previewNotificationSound(option.key)
                            }
                            disabled={!soundPrefs.soundEnabled}
                            aria-label={`Preview ${option.label} sound`}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Play size={13} aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              </div>

              {notificationPreferencesLoading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-[13px] text-slate-500">
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Loading notification preferences...
                </div>
              ) : (
                <>
                  <div className="rounded-xl bg-slate-50 p-5">
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <Send size={15} aria-hidden="true" />
                      </span>
                      <div>
                        <div className="text-[13px] font-bold text-slate-900">Delivery Channels</div>
                        <div className="text-[13px] text-slate-500">Where this user receives alerts.</div>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {[
                        {
                          key: "inAppEnabled",
                          label: "In-App Notifications",
                          description:
                            "Show workspace alerts in the notification bell.",
                          icon: Bell,
                          defaultText:
                            "Available inside Bispun",
                        },
                        {
                          key: "emailEnabled",
                          label: "Email Notifications",
                          description:
                            "Receive supported workspace updates by email after email delivery is connected.",
                          icon: Mail,
                          defaultText: `Workspace default: ${
                            notificationWorkspaceDefaults.emailEnabled
                              ? "On"
                              : "Off"
                          }`,
                        },
                        {
                          key: "smsEnabled",
                          label: "SMS Notifications",
                          description:
                            "Receive supported CRM alerts by SMS after an SMS provider is connected.",
                          icon: Smartphone,
                          defaultText: `Workspace default: ${
                            notificationWorkspaceDefaults.smsEnabled
                              ? "On"
                              : "Off"
                          }`,
                        },
                      ].map(
                        (item) => {
                          const Icon =
                            item.icon;

                          const enabled =
                            notificationPreferences[
                              item.key
                            ];

                          return (
                            <div
                              key={
                                item.key
                              }
                              className="p-4 flex items-center justify-between gap-4"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                                  <Icon
                                    size={16}
                                  />
                                </div>

                                <div>
                                  <div className="text-[13px] font-semibold text-slate-900">
                                    {item.label}
                                  </div>

                                  <div className="text-[13px] text-slate-500 mt-1">
                                    {item.description}
                                  </div>

                                  <div className="text-[13px] text-slate-400 mt-1.5">
                                    {item.defaultText}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                role="switch"
                                aria-checked={enabled}
                                aria-label={item.label}
                                onClick={() =>
                                  updateNotificationPreference(
                                    item.key,
                                    !enabled
                                  )
                                }
                                className={`relative w-10 h-6 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                                  enabled
                                    ? "bg-indigo-600 border-indigo-600"
                                    : "bg-slate-200 border-slate-300"
                                }`}
                              >
                                <span
                                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                                    enabled
                                      ? "left-5"
                                      : "left-1"
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-5">
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <Bell size={15} aria-hidden="true" />
                      </span>
                      <div>
                        <div className="text-[13px] font-bold text-slate-900">Notification Categories</div>
                        <div className="text-[13px] text-slate-500">Choose which updates you want to receive.</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        [
                          "leadUpdates",
                          "Lead Updates",
                          "Lead assignment, source and pipeline activity.",
                        ],
                        [
                          "admissionUpdates",
                          "Admission Updates",
                          "Admission progress and related operational updates.",
                        ],
                        [
                          "billingUpdates",
                          "Billing Updates",
                          "Plan, payment and subscription events.",
                        ],
                        [
                          "supportUpdates",
                          "Support Updates",
                          "Support ticket and customization request changes.",
                        ],
                        [
                          "systemUpdates",
                          "System Updates",
                          "Important workspace and platform notices.",
                        ],
                      ].map(
                        ([
                          key,
                          label,
                          description,
                        ]) => (
                          <label
                            key={key}
                            className={`rounded-xl border p-4 flex items-start gap-3 cursor-pointer transition-colors ${
                              notificationPreferences[key]
                                ? "border-slate-200 bg-slate-50/70"
                                : "border-slate-200 hover:bg-slate-50/70"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={
                                notificationPreferences[
                                  key
                                ]
                              }
                              onChange={(
                                event
                              ) =>
                                updateNotificationPreference(
                                  key,
                                  event.target.checked
                                )
                              }
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                            />

                            <div>
                              <div className="text-[13px] font-semibold text-slate-800">
                                {label}
                              </div>

                              <div className="text-xs text-slate-500 mt-1 leading-5">
                                {description}
                              </div>
                            </div>
                          </label>
                        )
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-5">
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <Volume2 size={15} aria-hidden="true" />
                      </span>
                      <div>
                        <div className="text-[13px] font-bold text-slate-900">Notification Sound</div>
                        <div className="text-[13px] text-slate-500">Play a tone when a new alert arrives.</div>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-[13px] font-semibold text-slate-900">Enable sound</div>
                          <div className="text-[13px] text-slate-500 mt-1">Turn notification sounds on or off for this account.</div>
                        </div>
                        <PermissionSwitch
                          checked={soundPref.enabled}
                          onChange={(value) => setSoundPref((state) => ({ ...state, enabled: value }))}
                          label="Enable notification sound"
                        />
                      </div>

                      <div className="p-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="notif-tone" className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                            Tone
                          </label>
                          <select
                            id="notif-tone"
                            value={soundPref.tone}
                            disabled={!soundPref.enabled}
                            onChange={(event) => setSoundPref((state) => ({ ...state, tone: event.target.value }))}
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
                          >
                            <option value="chime">Chime</option>
                            <option value="ping">Ping</option>
                            <option value="bell">Bell</option>
                            <option value="pop">Pop</option>
                          </select>
                        </div>

                        <div>
                          <label htmlFor="notif-volume" className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                            Volume <span className="font-normal text-slate-400">({soundPref.volume}%)</span>
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              id="notif-volume"
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={soundPref.volume}
                              disabled={!soundPref.enabled}
                              aria-valuetext={`${soundPref.volume} percent`}
                              onChange={(event) => setSoundPref((state) => ({ ...state, volume: Number(event.target.value) }))}
                              className="h-2 flex-1 cursor-pointer accent-indigo-600 disabled:opacity-50"
                            />
                            <button
                              type="button"
                              onClick={previewNotificationTone}
                              disabled={!soundPref.enabled}
                              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
                            >
                              <Play size={13} aria-hidden="true" /> Preview
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}


          {/* ACTIVITY LOG */}

          {tab ===
            "activity" && (
            <div className="p-6 space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-[13px] font-bold text-slate-900">
                    Activity Log
                  </h3>

                  <p className="text-[13px] text-slate-500 mt-1">
                    Review important workspace and user-management changes for this company.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    loadAuditLogs
                  }
                  disabled={
                    auditLogsLoading
                  }
                  className="h-9 px-3.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-[13px] font-semibold rounded-lg inline-flex items-center justify-center gap-2"
                >
                  <RefreshCw
                    size={13}
                    className={
                      auditLogsLoading
                        ? "animate-spin"
                        : ""
                    }
                  />
                  Refresh
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-3 native:flex-row native:flex-nowrap native:items-center native:max-w-full native:relative native:overflow-x-auto native:[-webkit-overflow-scrolling:touch]">
                <div className="relative flex-1 native:w-[200px] native:flex-none native:shrink-0">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={
                      auditSearch
                    }
                    onChange={(
                      event
                    ) =>
                      setAuditSearch(
                        event.target.value
                      )
                    }
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        loadAuditLogs();
                      }
                    }}
                    placeholder="Search actor, email or activity..."
                    className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>

                <select
                  value={
                    auditEntityFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setAuditEntityFilter(
                      event.target.value
                    )
                  }
                  className="h-9 px-3 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 native:w-[150px] native:shrink-0"
                >
                  <option value="">
                    All Activity
                  </option>
                  <option value="USER">
                    Users
                  </option>
                  <option value="COMPANY">
                    Company / Branding
                  </option>
                </select>

                <button
                  type="button"
                  onClick={
                    loadAuditLogs
                  }
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold shadow-sm transition-colors native:shrink-0 native:whitespace-nowrap"
                >
                  Search
                </button>
              </div>

              {auditLogsError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-[13px]">
                  {auditLogsError}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Showing up to 100 latest records
                </div>

                <div className="text-xs font-semibold text-slate-600">
                  {auditTotal} record{auditTotal === 1 ? "" : "s"}
                </div>
              </div>

              {auditLogsLoading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-[13px] text-slate-500">
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Loading activity...
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead className="border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Date & Time
                          </th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            User
                          </th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Action
                          </th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Activity
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {auditLogs.map(
                          (log) => (
                            <tr
                              key={
                                log.id
                              }
                              className="hover:bg-slate-50/70 align-top"
                            >
                              <td className="px-4 py-3 whitespace-nowrap text-[13px] text-slate-500">
                                {formatAuditDate(
                                  log.createdAt
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <div className="text-[13px] font-semibold text-slate-800">
                                  {log.actorName ||
                                    "System"}
                                </div>

                                <div className="text-[13px] text-slate-400 mt-0.5">
                                  {log.actorEmail ||
                                    log.actorRole ||
                                    "—"}
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                <span className="inline-flex rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-1 text-[13px] font-semibold">
                                  {auditActionLabel(
                                    log.action
                                  )}
                                </span>

                                <div className="text-[13px] text-slate-400 mt-1">
                                  {log.entityType}
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                <div className="text-[13px] text-slate-700 max-w-xl">
                                  {log.summary}
                                </div>

                                {log.ipAddress && (
                                  <div className="text-[13px] text-slate-400 mt-1.5">
                                    IP: {log.ipAddress}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        )}

                        {!auditLogs.length && (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-14 text-center text-[13px] text-slate-500"
                            >
                              {auditSearch.trim() || auditEntityFilter
                                ? "No activity matches your search or selected filter."
                                : "No activity has been recorded yet."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[13px] text-slate-500 leading-5">
                Audit entries are company-isolated and read-only. Password values and logo image data are never written into the activity log.
              </div>
            </div>
          )}

          {tab === "integrations" && (
            <div className="st-v2">
              <style dangerouslySetInnerHTML={{ __html: SETTINGS_V2_CSS }} />

              <div className="phead">
                <div>
                  <h2>Communication Integrations</h2>
                  <p>Connect your own communication accounts. Gmail and SMS are available now; WhatsApp is prepared for the next phase.</p>
                </div>
              </div>

              {googleNotice && (
                <div
                  role="status"
                  className="infonote"
                  style={{ fontWeight: 600 }}
                >
                  {googleNotice}
                </div>
              )}

              <div className="intg-grid">
                {/* GMAIL (featured, full width) */}
                <div className="icard" style={{ gridColumn: "1 / -1" }}>
                  <div className="wash" style={{ background: "radial-gradient(120% 160% at 100% 0%, rgba(234,67,53,.18), transparent 60%)" }} />
                  <div className="icard-in" style={{ flexDirection: "row", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1, minWidth: 260 }}>
                      <span className="ilogo" style={{ width: 58, height: 58 }} aria-hidden="true">
                        <svg viewBox="0 0 48 48" style={{ width: 30, height: 30 }}>
                          <path fill="#4285F4" d="M6 38V14l18 13L42 14v24a2 2 0 0 1-2 2h-6V22l-10 7.3L14 22v18H8a2 2 0 0 1-2-2z" />
                          <path fill="#34A853" d="M6 14v24a2 2 0 0 0 2 2h6V22z" />
                          <path fill="#FBBC04" d="M34 40h6a2 2 0 0 0 2-2V14L34 22z" />
                          <path fill="#EA4335" d="M6 14l18 13L42 14v-.5A3.5 3.5 0 0 0 38.5 10h-29A3.5 3.5 0 0 0 6 13.5z" />
                        </svg>
                      </span>
                      <div className="meta">
                        <h4>
                          Gmail
                          {googleStatus.connected && googleStatus.gmailEnabled ? (
                            <span className="badge ok"><span className="d" aria-hidden="true" />Connected</span>
                          ) : (
                            <span className="badge off"><span className="d" aria-hidden="true" />Not connected</span>
                          )}
                        </h4>
                        <p>Send one-to-one or bulk emails to leads directly from Lead Store using your connected Google account.</p>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div className="conn">
                        <span className={`dotwrap ${googleStatus.connected ? "tok" : "tb"}`} aria-hidden="true">
                          {googleStatus.connected ? <Check size={16} strokeWidth={2.4} /> : <Mail size={15} />}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="ct">{googleStatus.connected ? (googleStatus.email || "Google account") : "Not connected"}</div>
                          <div className="cs">
                            {googleStatus.connected
                              ? `Gmail sending · ${googleStatus.gmailEnabled ? "Ready" : "Reconnect required"}`
                              : "Connect Google once to enable Gmail and Google Meet."}
                          </div>
                        </div>
                        {googleStatus.connected && googleStatus.gmailEnabled && (
                          <span className="right badge ok"><span className="d" aria-hidden="true" />Live</span>
                        )}
                      </div>
                      <div className="icard-foot">
                        {googleStatusLoading ? (
                          <span className="note"><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Checking…</span>
                        ) : googleStatusError ? (
                          <span className="err-text">{googleStatusError}</span>
                        ) : googleStatus.connected && googleStatus.gmailEnabled ? (
                          <>
                            <button type="button" className="btn" onClick={sendGoogleTestEmail} disabled={googleBusy}>
                              <Send size={14} aria-hidden="true" /> {googleBusy ? "Sending…" : "Send test email"}
                            </button>
                            <button type="button" className="ghost" onClick={disconnectGoogle} disabled={googleBusy}>Disconnect</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="btn" onClick={connectGoogle} disabled={googleBusy}>
                              <Globe2 size={15} aria-hidden="true" /> {googleBusy ? "Opening Google…" : googleStatus.connected ? "Reconnect Google" : "Connect Google"}
                            </button>
                            {!googleStatus.configured && (
                              <span className="badge warn"><span className="d" aria-hidden="true" />Server setup pending</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* WHATSAPP */}
                <div className="icard">
                  <div className="wash" style={{ background: "radial-gradient(120% 160% at 100% 0%, rgba(37,211,102,.16), transparent 60%)" }} />
                  <div className="icard-in">
                    <div className="icard-top">
                      <span className="ilogo" aria-hidden="true">
                        <svg viewBox="0 0 24 24" style={{ width: 26, height: 26 }}>
                          <path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2z" />
                          <path fill="#fff" d="M17 14.3c-.3-.1-1.7-.8-1.9-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a8 8 0 0 1-2.4-1.5 9 9 0 0 1-1.6-2c-.2-.3 0-.4.1-.6l.4-.5c.1-.2.1-.3.2-.5s0-.3 0-.5-.6-1.5-.8-2-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3A3 3 0 0 0 5.5 9c0 1.3.9 2.5 1 2.7s1.9 2.9 4.6 4c1.8.8 2.5.8 3.4.7a2.8 2.8 0 0 0 1.9-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3z" />
                        </svg>
                      </span>
                      <div className="meta">
                        <h4>
                          WhatsApp
                          {waStatus.connected && (
                            <span className="badge ok"><span className="d" aria-hidden="true" />Connected</span>
                          )}
                        </h4>
                        <p>Connect your own WhatsApp Business number to message leads. You pay Meta directly for messages; Bispun adds no charge.</p>
                        {waStatus.connected && waStatus.displayNumber && (
                          <p style={{ marginTop: 4 }}>{waStatus.verifiedName ? `${waStatus.verifiedName} · ` : ""}{waStatus.displayNumber}</p>
                        )}
                      </div>
                    </div>

                    <div className="conn">
                      <span className={`dotwrap ${waStatus.connected ? "tok" : "tw"}`} aria-hidden="true">
                        {waStatus.connected ? <Check size={15} strokeWidth={2.4} /> : <MessageCircle size={15} />}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="ct">{waStatus.connected ? (waStatus.displayNumber || "Connected") : "Setup pending"}</div>
                        <div className="cs">{waStatus.connected ? "WhatsApp Business · Ready" : "Available once Bispun finishes WhatsApp setup"}</div>
                      </div>
                    </div>

                    {waNotice && <div role="status" className="infonote">{waNotice}</div>}

                    <div className="icard-foot">
                      {waLoading ? (
                        <span className="note">Checking status…</span>
                      ) : !waStatus.configured ? (
                        <span className="badge warn"><span className="d" aria-hidden="true" />Setup pending</span>
                      ) : waStatus.connected ? (
                        <button type="button" className="ghost" onClick={disconnectWhatsApp} disabled={waBusy}>
                          {waBusy ? "Working…" : "Disconnect"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          style={{ background: "#25D366", boxShadow: "0 10px 22px -12px #25D366", color: "#fff" }}
                          onClick={connectWhatsApp}
                          disabled={waBusy}
                        >
                          <MessageCircle size={15} aria-hidden="true" /> {waBusy ? "Opening…" : "Connect WhatsApp"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* SMS */}
                <div className="icard">
                  <div className="wash" style={{ background: "radial-gradient(120% 160% at 100% 0%, rgba(109,74,255,.16), transparent 60%)" }} />
                  <div className="icard-in">
                    <div className="icard-top">
                      <span className="ilogo" style={{ color: "var(--accent-ink)" }} aria-hidden="true"><Smartphone size={24} /></span>
                      <div className="meta">
                        <h4>
                          SMS
                          {smsConfig.enabled && smsConfig.hasApiKey ? (
                            <span className="badge ok"><span className="d" aria-hidden="true" />Connected</span>
                          ) : (
                            <span className="badge off"><span className="d" aria-hidden="true" />Not connected</span>
                          )}
                        </h4>
                        <p>Connect your company&apos;s own SMS provider (e.g. MSG91) with DLT-approved templates. Everyone in your company can then send template SMS to leads from Lead Store.</p>
                      </div>
                    </div>

                    <>
                      {!smsCanManage && (
                        <div className="infonote">Only a Client Admin can save or connect SMS for the company.</div>
                      )}
                      <>
                        <div className="ifields">
                          <div className="ifld">
                            <label htmlFor="st-sms-provider">Provider</label>
                            <div className="inp"><input id="st-sms-provider" value={smsConfig.provider} onChange={(e) => setSmsConfig((c) => ({ ...c, provider: e.target.value }))} placeholder="MSG91" /></div>
                          </div>
                          <div className="ifld">
                            <label htmlFor="st-sms-sender">Sender ID (DLT header)</label>
                            <div className="inp"><input id="st-sms-sender" value={smsConfig.senderId} onChange={(e) => setSmsConfig((c) => ({ ...c, senderId: e.target.value }))} placeholder="BISPUN" /></div>
                          </div>
                        </div>
                        <div className="ifld">
                          <label htmlFor="st-sms-key">API Key</label>
                          <div className="inp">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <input id="st-sms-key" type="password" value={smsApiKeyInput} onChange={(e) => setSmsApiKeyInput(e.target.value)} placeholder={smsConfig.hasApiKey ? (smsConfig.apiKeyMasked || "••••••") : "Paste provider auth key"} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 10 }}>
                            <span className="fl" style={{ margin: 0 }}>DLT-approved templates</span>
                            <button type="button" className="mini" onClick={addSmsTemplate}><Plus size={13} aria-hidden="true" /> Add template</button>
                          </div>
                          {(smsConfig.templates || []).length === 0 ? (
                            <div className="infonote" style={{ borderStyle: "dashed", textAlign: "center" }}>No templates yet. Add your DLT-approved templates so your team can pick them when sending.</div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                              {(smsConfig.templates || []).map((t, index) => (
                                <div key={t.id || index} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, background: "var(--surface)" }}>
                                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <div className="inp" style={{ flex: 1 }}><input value={t.name} onChange={(e) => updateSmsTemplate(index, "name", e.target.value)} placeholder="Template name (e.g. Follow-up)" aria-label="Template name" /></div>
                                    <div className="inp" style={{ flex: 1 }}><input value={t.templateId} onChange={(e) => updateSmsTemplate(index, "templateId", e.target.value)} placeholder="Provider template ID" aria-label="Provider template ID" /></div>
                                    <button type="button" className="mini" onClick={() => removeSmsTemplate(index)} aria-label="Remove template"><X size={15} aria-hidden="true" /></button>
                                  </div>
                                  <textarea className="ta" style={{ marginTop: 8 }} value={t.body} onChange={(e) => updateSmsTemplate(index, "body", e.target.value)} rows={2} placeholder="Approved template content (for preview). Put the lead's name where the name variable goes." aria-label="Template content" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="srow">
                          <span className="st">Enable SMS sending for this company</span>
                          <button type="button" role="switch" aria-checked={smsConfig.enabled} aria-label="Enable SMS sending for this company" className="sw" onClick={() => setSmsConfig((c) => ({ ...c, enabled: !c.enabled }))} />
                        </div>

                        {smsNotice && <div role="status" className="infonote" style={{ borderColor: "var(--accent-weak)", background: "var(--accent-weak)", color: "var(--accent-ink)", fontWeight: 600 }}>{smsNotice}</div>}

                        <div className="icard-foot" style={{ justifyContent: "flex-end" }}>
                          <button type="button" className="btn" onClick={saveSmsConfig} disabled={smsBusy || !smsCanManage}>{smsBusy ? "Saving…" : "Connect SMS"}</button>
                        </div>

                        <div className="warnnote">India DLT note: SMS content must match your provider&apos;s DLT-approved templates exactly, and each template&apos;s name variable must be set so the lead&apos;s name fills correctly.</div>
                      </>
                    </>
                  </div>
                </div>

                {/* VOICE (full width) */}
                <div className="icard" style={{ gridColumn: "1 / -1" }}>
                  <div className="wash" style={{ background: "radial-gradient(120% 160% at 100% 0%, rgba(124,58,237,.16), transparent 60%)" }} />
                  <div className="icard-in">
                    <div className="icard-top">
                      <span className="ilogo" style={{ color: "var(--viol)" }} aria-hidden="true"><PhoneCall size={24} /></span>
                      <div className="meta">
                        <h4>
                          Voice Calling &amp; Recording
                          {callingConfig.enabled ? (
                            <span className="badge ok"><span className="d" aria-hidden="true" />Enabled</span>
                          ) : (
                            <span className="badge off"><span className="d" aria-hidden="true" />Device dial</span>
                          )}
                        </h4>
                        <p>Choose who provides the MSG91 number. After setup, users call directly from Lead Store; call history and provider recordings stay linked to the lead.</p>
                      </div>
                    </div>

                    <>
                      {!callingCanManage && (
                        <div className="infonote">Only a Client Admin can save the company calling connection.</div>
                      )}
                      <>
                        <div className="seg" role="group" aria-label="Number provider">
                          {[
                            ["BISPUN_MANAGED", "Bispun-managed", "We provide the number"],
                            ["OWN_MSG91", "Bring your own", "Use your MSG91 number"],
                          ].map(([mode, title, desc]) => (
                            <button key={mode} type="button" aria-pressed={callingConfig.mode === mode} onClick={() => setCallingConfig((c) => ({ ...c, mode, enabled: true }))}>
                              {title}
                              <span>{desc}</span>
                            </button>
                          ))}
                        </div>

                        {callingConfig.mode === "OWN_MSG91" && (
                          <div className="ifields">
                            <div className="ifld">
                              <label htmlFor="st-call-cid">MSG91 Caller ID / DID</label>
                              <div className="inp"><input id="st-call-cid" value={callingConfig.callerId || ""} onChange={(e) => setCallingConfig((c) => ({ ...c, callerId: e.target.value }))} placeholder="Approved caller ID" /></div>
                            </div>
                            <div className="ifld">
                              <label htmlFor="st-call-key">MSG91 Auth Key</label>
                              <div className="inp"><input id="st-call-key" type="password" value={callingAuthKey} onChange={(e) => setCallingAuthKey(e.target.value)} placeholder={callingConfig.hasAuthKey ? (callingConfig.authKeyMasked || "••••••••") : "Paste Auth Key"} /></div>
                            </div>
                          </div>
                        )}

                        {callingConfig.mode === "BISPUN_MANAGED" && (
                          <div className="warnnote">Selection saved now; cloud calling activates after Bispun receives MSG91 approval and assigns your company caller ID. Until then, Lead Store safely falls back to device dial.</div>
                        )}

                        <label className="srow" style={{ cursor: "pointer" }}>
                          <span style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <input type="checkbox" style={{ marginTop: 3 }} checked={callingConfig.consentConfirmed} onChange={(e) => setCallingConfig((c) => ({ ...c, consentConfirmed: e.target.checked }))} />
                            <span className="note" style={{ color: "var(--ink-2)" }}>We will call only consented leads and comply with applicable DND/TCC, recording disclosure and telecom rules.</span>
                          </span>
                        </label>

                        <div className="srow">
                          <span className="st">Enable calling for this company</span>
                          <PermissionSwitch checked={callingConfig.enabled} onChange={(enabled) => setCallingConfig((c) => ({ ...c, enabled }))} label="Enable company calling" />
                        </div>

                        {callingNotice && <div role="status" className="infonote" style={{ borderColor: "var(--accent-weak)", background: "var(--accent-weak)", color: "var(--accent-ink)", fontWeight: 600 }}>{callingNotice}</div>}

                        <div className="icard-foot" style={{ justifyContent: "flex-end" }}>
                          <button type="button" className="btn" onClick={saveCallingConfig} disabled={callingBusy || !callingCanManage}>{callingBusy ? "Saving…" : "Enable calling"}</button>
                        </div>
                      </>
                    </>
                  </div>
                </div>
              </div>

              <div className="infonote">
                Gmail uses the connected user&apos;s own Google account and Google&apos;s sending rules. Bispun records sent/failed communication history, but Google controls the actual daily sending limit.
              </div>
            </div>
          )}

        </section>
      </div>

      {organizationModal && (
        <A11yDialog
          onClose={() => setOrganizationModal(null)}
          backdropClassName="fixed inset-0 z-[105] bg-slate-950/55 backdrop-blur-[2px] flex items-end justify-center p-0 sm:items-center sm:p-4"
          panelClassName="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          {(headingId) => (
            <>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div><div id={headingId} className="text-[17px] font-bold text-slate-950">{editingOrganizationItem ? "Edit" : "Add"} {organizationModal === "department" ? "Department" : organizationModal === "designation" ? "Designation" : organizationModal === "level" ? "Level" : "Role"}</div><div className="mt-1 text-[13px] text-slate-500">Configure this organization item without changing unrelated access.</div></div>
              <button type="button" aria-label="Close" onClick={() => setOrganizationModal(null)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Name *</label><input value={organizationForm.name} onChange={(e)=>setOrganizationForm(c=>({...c,name:e.target.value}))} className="w-full h-10 px-3 rounded-lg border border-slate-200" placeholder={organizationModal === "department" ? "Technology" : organizationModal === "designation" ? "Senior Counsellor" : organizationModal === "level" ? "Level 2" : "Team Lead"}/></div>
                <div><label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Code *</label><input value={organizationForm.code} onChange={(e)=>setOrganizationForm(c=>({...c,code:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,4)}))} className="w-full h-10 px-3 rounded-lg border border-slate-200 font-mono" placeholder={organizationModal === "department" ? "TEC" : "TLD"}/></div>
              </div>
              <div><label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Description</label><textarea rows={2} value={organizationForm.description} onChange={(e)=>setOrganizationForm(c=>({...c,description:e.target.value}))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]" placeholder="Optional description"/></div>
              {organizationModal === "level" && <div><label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Hierarchy rank</label><input type="number" min="1" value={organizationForm.rank} onChange={(e)=>setOrganizationForm(c=>({...c,rank:Math.max(1,Number(e.target.value)||1)}))} className="w-full h-10 px-3 rounded-lg border border-slate-200"/></div>}
              {editingOrganizationItem && !editingOrganizationItem.system && <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5"><span className="text-[13px] font-semibold text-slate-700">Active</span><input type="checkbox" checked={organizationForm.active} onChange={(e)=>setOrganizationForm(c=>({...c,active:e.target.checked}))}/></label>}
              {organizationModal === "role" && <div><label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Base access level</label><select value={organizationForm.baseRole} onChange={(e)=>setOrganizationForm(c=>({...c,baseRole:e.target.value}))} className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white"><option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option></select></div>}
              {(organizationModal === "department" || organizationModal === "role") && <div><div className="text-[13px] font-bold text-slate-700">Default permissions</div><div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  ["canManageUsers","Manage Users"],["canManageSettings","Manage Settings"],["canManageBilling","Manage Billing"],["canViewAnalytics","View Analytics"],["canManageAdmissions","Manage Admissions"],["canManageRevenue","Manage Revenue"],["canManageLeads","Manage Leads"],["canManageSupport","Manage Support"],["canViewTeamTargets","View Team Targets"],
                ].map(([key,label])=><label key={key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"><span className="text-[13px] text-slate-700">{label}</span><input type="checkbox" checked={organizationForm.permissions[key]} onChange={(e)=>setOrganizationForm(c=>({...c,permissions:{...c.permissions,[key]:e.target.checked}}))}/></label>)}
              </div></div>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-4"><button type="button" onClick={()=>{setOrganizationModal(null);setEditingOrganizationItem(null);}} className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold">Cancel</button><button type="button" disabled={organizationSaving || !organizationForm.name.trim() || !organizationForm.code.trim()} onClick={saveOrganizationItem} className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold disabled:opacity-50">{organizationSaving ? "Saving..." : editingOrganizationItem ? "Save Changes" : "Create"}</button></div>
            </>
          )}
        </A11yDialog>
      )}

      {userModalOpen && (
        <A11yDialog
          onClose={closeUserModal}
          backdropClassName="fixed inset-0 z-[200] bg-slate-950/55 backdrop-blur-[2px] flex items-end justify-center p-0 sm:items-start sm:px-4 sm:pb-4 sm:pt-[92px]"
          panelClassName="flex w-full max-w-2xl max-h-[calc(100dvh-92px)] flex-col overflow-hidden bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-2xl"
        >
          {(headingId) => (
            <>
            <div className="shrink-0 px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div>
                <div id={headingId} className="text-[17px] font-bold text-slate-950">
                  {editingUser
                    ? "Edit User"
                    : "Add User"}
                </div>

                <div className="text-[13px] text-slate-500 mt-1">
                  Configure account details, department and role.
                </div>
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={closeUserModal}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-5">
              {userModalError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-700">
                  {userModalError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[
                  ["name", "Name", "text", true],
                  ["email", "Email", "email", true],
                  ["phone", "Phone", "text", false],
                ].map(
                  ([
                    key,
                    label,
                    type,
                    required,
                  ]) => (
                    <div key={key}>
                      <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                        {label}
                        {required && (
                          <span className="text-rose-500 ml-0.5">*</span>
                        )}
                      </label>

                      <input
                        type={type}
                        required={required}
                        aria-invalid={Boolean(userFormErrors[key])}
                        value={
                          userForm[
                            key
                          ]
                        }
                        onChange={(
                          event
                        ) =>
                          updateUserField(
                            key,
                            event.target.value
                          )
                        }
                        className={`w-full h-10 px-3 border rounded-lg text-[13px] focus:outline-none focus:ring-2 ${
                          userFormErrors[key]
                            ? "border-rose-300 focus:ring-rose-100 focus:border-rose-400"
                            : "border-slate-200 focus:ring-indigo-100 focus:border-indigo-400"
                        }`}
                      />

                      {userFormErrors[key] && (
                        <p className="mt-1 text-[13px] text-rose-600">
                          {userFormErrors[key]}
                        </p>
                      )}
                    </div>
                  )
                )}

                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Employee ID</label>
                  <input readOnly value={editingUser ? (userForm.employeeId || "") : "Generated automatically after creation"} className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-slate-50 text-[13px] font-mono text-slate-600" />
                </div>

                <div>
                  <label htmlFor="add-user-department" className="block text-[13px] font-semibold text-slate-600 mb-1.5">Department <span className="text-rose-500" aria-hidden="true">*</span></label>
                  <select
                    id="add-user-department"
                    ref={departmentSelectRef}
                    required
                    aria-invalid={Boolean(userFormErrors.department)}
                    aria-describedby={
                      userFormErrors.department
                        ? "add-user-department-error"
                        : (!organizationLoading && organization.departments.length === 0
                            ? "add-user-department-empty"
                            : undefined)
                    }
                    aria-busy={organizationLoading}
                    disabled={organizationLoading}
                    value={userForm.department}
                    onChange={(event) => setUserDepartment(event.target.value)}
                    className={`w-full h-10 px-3 border rounded-lg bg-white text-[13px] disabled:bg-slate-50 disabled:text-slate-500 ${
                      userFormErrors.department
                        ? "border-rose-300 focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
                        : "border-slate-200"
                    }`}
                  >
                    <option value="">
                      {organizationLoading ? "Loading departments…" : "Select department"}
                    </option>
                    {organization.departments.filter((department) => department.active !== false || department.name === userForm.department).map((department) => <option key={department.id} value={department.name}>{department.name} ({department.code})</option>)}
                  </select>
                  {!organizationLoading && organization.departments.length === 0 && !userFormErrors.department && (
                    <div className="mt-1 text-[13px] text-amber-600">
                      <p id="add-user-department-empty" role="status">
                        No departments loaded. Add one in the Departments tab, or retry.
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          await loadOrganization();
                          departmentSelectRef.current?.focus();
                        }}
                        className="underline font-semibold hover:text-amber-700"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {userFormErrors.department && (
                    <p id="add-user-department-error" className="mt-1 text-[13px] text-rose-600" role="alert">
                      {userFormErrors.department}
                    </p>
                  )}
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                      Temporary Password
                      <span className="text-rose-500 ml-0.5">*</span>
                    </label>

                    <div className="relative">
                      <input
                        type={showTempPassword ? "text" : "password"}
                        required
                        minLength={8}
                        aria-invalid={Boolean(userFormErrors.password)}
                        value={
                          userForm.password
                        }
                        onChange={(
                          event
                        ) =>
                          updateUserField(
                            "password",
                            event.target.value
                          )
                        }
                        className={`w-full h-10 px-3 pr-10 border rounded-lg text-[13px] focus:outline-none focus:ring-2 ${
                          userFormErrors.password
                            ? "border-rose-300 focus:ring-rose-100 focus:border-rose-400"
                            : "border-slate-200 focus:ring-indigo-100 focus:border-indigo-400"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowTempPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-7 w-7 rounded text-slate-400 hover:text-slate-700 transition-colors"
                        aria-label={showTempPassword ? "Hide password" : "Show password"}
                      >
                        {showTempPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {userFormErrors.password && (
                      <p className="mt-1 text-[13px] text-rose-600">
                        {userFormErrors.password}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                    Role
                  </label>

                  <select
                    value={
                      userForm.customRoleId ? `CUSTOM:${userForm.customRoleId}` : userForm.role
                    }
                    onChange={(
                      event
                    ) =>
                      setRole(
                        event.target.value
                      )
                    }
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] bg-white"
                  >
                    <option value="CLIENT_ADMIN">
                      Client Admin
                    </option>
                    <option value="MANAGER">
                      Manager
                    </option>
                    <option value="EMPLOYEE">
                      Employee
                    </option>
                    {organization.roles.length > 0 && (
                      <optgroup label="Custom Roles">
                        {organization.roles.filter((role) => role.active !== false || role.id === userForm.customRoleId).map((role) => (
                          <option key={role.id} value={`CUSTOM:${role.id}`}>
                            {role.name} ({role.code})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {userForm.role !== "CLIENT_ADMIN" && (
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                      Reports To
                    </label>
                    <select
                      value={userForm.managerId || ""}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          managerId: event.target.value,
                        }))
                      }
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] bg-white"
                    >
                      <option value="">— Select manager —</option>
                      {users
                        .filter((u) => (u.role === "CLIENT_ADMIN" || u.role === "MANAGER") && u.active && u.id !== editingUser?.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                            {m.department ? ` · ${m.department}` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-[13px] text-slate-500">
                  Permissions are managed through templates. Select a template in the Templates tab to configure access for all roles at once.
                </p>
              </div>

              {editingUser && (
                <label className="flex items-center gap-2 text-[13px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={
                      userForm.active
                    }
                    onChange={(
                      event
                    ) =>
                      setUserForm(
                        (
                          current
                        ) => ({
                          ...current,
                          active:
                            event.target
                              .checked,
                        })
                      )
                    }
                  />
                  Active account
                </label>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeUserModal}
                  className="h-9 px-4 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveUser}
                  disabled={
                    userSaving
                  }
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2"
                >
                  {userSaving && (
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                  )}

                  {editingUser
                    ? "Save User"
                    : "Create User"}
                </button>
              </div>
            </div>
            </>
          )}
        </A11yDialog>
      )}

      {resetPasswordUser && (
        <A11yDialog
          onClose={() => setResetPasswordUser(null)}
          backdropClassName="fixed inset-0 z-[110] bg-slate-950/55 backdrop-blur-[2px] flex items-end justify-center p-0 sm:items-center sm:p-4"
          panelClassName="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl"
        >
          {(headingId) => (
            <>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div id={headingId} className="text-[17px] font-bold text-slate-950">
                  Reset Password
                </div>

                <div className="text-[13px] text-slate-500 mt-1">
                  Set a new password for {resetPasswordUser.name}.
                </div>
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={() =>
                  setResetPasswordUser(null)
                }
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                  New Password
                </label>

                <input
                  type="password"
                  value={
                    resetPassword
                  }
                  onChange={(
                    event
                  ) =>
                    setResetPassword(
                      event.target.value
                    )
                  }
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                Minimum 8 characters with uppercase, lowercase and a number.
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setResetPasswordUser(null)
                  }
                  className="h-9 px-4 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    submitResetPassword
                  }
                  disabled={
                    resetSaving
                  }
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2"
                >
                  {resetSaving && (
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                  )}

                  Reset Password
                </button>
              </div>
            </div>
            </>
          )}
        </A11yDialog>
      )}


      {sourceModalOpen && (
        <A11yDialog
          onClose={closeSourceModal}
          backdropClassName="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-[2px] flex items-end justify-center p-0 sm:items-center sm:p-4"
          panelClassName="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
        >
          {(headingId) => (
            <>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div id={headingId} className="text-[17px] font-bold text-slate-950">
                  {editingSource
                    ? "Edit Lead Source"
                    : "Add Lead Source"}
                </div>

                <div className="text-[13px] text-slate-500 mt-1">
                  Configure how this source appears across CRM forms and reporting.
                </div>
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={closeSourceModal}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                  Source Name
                </label>

                <input
                  value={
                    sourceForm.name
                  }
                  onChange={(
                    event
                  ) =>
                    setSourceForm(
                      (current) => ({
                        ...current,
                        name:
                          event.target.value,
                        key:
                          editingSource
                            ? current.key
                            : event.target.value
                                .toUpperCase()
                                .replace(
                                  /[^A-Z0-9]+/g,
                                  "_"
                                )
                                .replace(
                                  /^_+|_+$/g,
                                  ""
                                ),
                      })
                    )
                  }
                  placeholder="Referral"
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                  Source Key
                </label>

                <input
                  value={
                    sourceForm.key
                  }
                  onChange={(
                    event
                  ) =>
                    setSourceForm(
                      (current) => ({
                        ...current,
                        key:
                          event.target.value
                            .toUpperCase()
                            .replace(
                              /[^A-Z0-9]+/g,
                              "_"
                            ),
                      })
                    )
                  }
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                  Description
                </label>

                <textarea
                  rows={3}
                  value={
                    sourceForm.description
                  }
                  onChange={(
                    event
                  ) =>
                    setSourceForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target.value,
                      })
                    )
                  }
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                  Sort Order
                </label>

                <input
                  type="number"
                  value={
                    sourceForm.sortOrder
                  }
                  onChange={(
                    event
                  ) =>
                    setSourceForm(
                      (current) => ({
                        ...current,
                        sortOrder:
                          Number(
                            event.target.value
                          ),
                      })
                    )
                  }
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-slate-700">
                    Active
                  </span>

                  <input
                    type="checkbox"
                    checked={
                      sourceForm.active
                    }
                    onChange={(
                      event
                    ) =>
                      setSourceForm(
                        (current) => ({
                          ...current,
                          active:
                            event.target.checked,
                        })
                      )
                    }
                  />
                </label>

                <label className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-slate-700">
                    Show in Forms
                  </span>

                  <input
                    type="checkbox"
                    checked={
                      sourceForm.showInForms
                    }
                    onChange={(
                      event
                    ) =>
                      setSourceForm(
                        (current) => ({
                          ...current,
                          showInForms:
                            event.target.checked,
                        })
                      )
                    }
                  />
                </label>
              </div>

              {sourceModalError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-[13px]">
                  {sourceModalError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeSourceModal}
                  className="h-9 px-4 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    saveLeadSource
                  }
                  disabled={
                    sourceSaving
                  }
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2"
                >
                  {sourceSaving && (
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                  )}

                  {editingSource
                    ? "Save Source"
                    : "Create Source"}
                </button>
              </div>
            </div>
            </>
          )}
        </A11yDialog>
      )}


    </div>
  );
}
