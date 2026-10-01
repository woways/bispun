import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  Bell,
  MessageSquare,
  Target,
  Gift,
  Store,
  CalendarDays,
  LogOut,
  Lock,
  Crown,
  Loader2,
  ChevronDown,
  GraduationCap,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Eye,
  EyeOff,
  X,
  CheckCircle2,
  AlertCircle,
  ReceiptIndianRupee,
  CalendarClock,
  Search,
  Sun,
  ChevronRight,
  Plus,
  Rocket,
  UserRound,
  ShieldCheck,
  SlidersHorizontal,
  MonitorSmartphone,
  Camera,
  Mail,
  Phone,
  Building2,
  Globe2,
  KeyRound,
  Smartphone,
  Save,
  Home,
  GitFork,
  ShoppingBag,
  CircleDollarSign,
  Wallet,
  BarChart3,
  Activity,
  CircleHelp,
  Menu,
} from "lucide-react";

import {
  MODULE_META,
} from "./data/tenants";

import {
  PlanPill,
  UpgradeGate,
} from "./components/ui";

import {
  apiRequest,
} from "./lib/api";

import Dashboard from "./modules/client/Dashboard";
import UTMLeads from "./modules/client/UTMLeads";
import Admissions from "./modules/client/Admissions";
import Revenue from "./modules/client/Revenue";
import LeadStore from "./modules/client/LeadStore";
import Walkins from "./modules/client/Walkins";
import Counselling from "./modules/client/Counselling";
import Analytics from "./modules/client/Analytics";
import Help from "./modules/client/Help";
import SettingsView from "./modules/client/Settings";
import CalendarModal from "./modules/client/CalendarModal";
import ChatPanel from "./modules/client/ChatPanel";
import GoalsAndTargets from "./modules/client/GoalsAndTargets";
import Referrals from "./modules/client/Referrals";
import MyStore from "./modules/client/MyStore";
import { applyBrandTheme } from "./lib/brandTheme";


function SidebarIcon({
  type,
  size = 22,
  className = "",
  strokeWidth = 2,
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };

  if (type === "home") {
    return (
      <svg {...common}>
        <path d="M3.5 10.5 12 3.5l8.5 7" />
        <path d="M5.5 9.5V20h13V9.5" />
        <path d="M9.5 20v-6h5v6" />
      </svg>
    );
  }

  if (type === "utm") {
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="2.2" />
        <circle cx="18" cy="6" r="2.2" />
        <circle cx="12" cy="18" r="2.2" />
        <path d="M8 7.4 10.7 15" />
        <path d="M16 7.4 13.3 15" />
        <path d="M8.3 6h7.4" />
      </svg>
    );
  }

  if (type === "store") {
    return (
      <svg {...common}>
        <path d="M5 8.5h14l-1.1 10H6.1L5 8.5Z" />
        <path d="M8.5 8.5V6.5a3.5 3.5 0 0 1 7 0v2" />
        <path d="M9.5 12h5" />
      </svg>
    );
  }

  if (type === "admissions") {
    return (
      <svg {...common}>
        <path d="m3 9 9-4 9 4-9 4-9-4Z" />
        <path d="M7 11.5V15c0 1.5 2.2 2.8 5 2.8s5-1.3 5-2.8v-3.5" />
        <path d="M21 9v5" />
      </svg>
    );
  }

  if (type === "finance") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9 7.5h6" />
        <path d="M9 10.5h5.2" />
        <path d="M9.2 7.5c0 3 1.7 4.5 4.8 4.5" />
        <path d="m10 12 5 5" />
      </svg>
    );
  }

  if (type === "insights") {
    return (
      <svg {...common}>
        <path d="M4 19V10" />
        <path d="M10 19V6" />
        <path d="M16 19v-8" />
        <path d="M22 19V4" />
      </svg>
    );
  }

  if (type === "help") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9.8 9.2a2.6 2.6 0 1 1 4.2 2c-.9.7-2 1.2-2 2.6" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  if (type === "settings") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.3 15.2a1.8 1.8 0 0 0 .4 2l.1.1-2.5 2.5-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.7v.1h-4.2V21a1.8 1.8 0 0 0-1.1-1.7 1.8 1.8 0 0 0-2 .4l-.1.1-2.5-2.5.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 3 14.1H2.9V10H3a1.8 1.8 0 0 0 1.7-1.1 1.8 1.8 0 0 0-.4-2l-.1-.1 2.5-2.5.1.1a1.8 1.8 0 0 0 2 .4A1.8 1.8 0 0 0 9.9 3v-.1h4.2V3a1.8 1.8 0 0 0 1.1 1.7 1.8 1.8 0 0 0 2-.4l.1-.1 2.5 2.5-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.7 1.1h.1V14H21a1.8 1.8 0 0 0-1.7 1.2Z" />
      </svg>
    );
  }

  return null;
}

const NAV_GROUPS = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: Home,
    items: ["dashboard"],
    direct: true,
  },

  {
    key: "lead-store",
    label: "Lead Store",
    icon: ShoppingBag,
    items: ["lead-store"],
    direct: true,
  },

  {
    key: "utm-leads",
    label: "UTM Leads",
    icon: GitFork,
    items: ["utm-leads"],
    direct: true,
  },

  {
    key: "chats",
    label: "Chats",
    icon: MessageSquare,
    items: ["chats"],
    direct: true,
  },

  {
    key: "goals-and-targets",
    label: "Goals and Targets",
    icon: Target,
    items: ["goals-and-targets"],
    direct: true,
  },

  {
    key: "admissions",
    label: "Admissions",
    icon: GraduationCap,
    items: ["admissions"],
  },

  {
    key: "finance",
    label: "Finance",
    icon: Wallet,
    items: ["revenue"],
  },

  {
    key: "insights",
    label: "Insights",
    icon: BarChart3,
    items: ["analytics"],
  },

  {
    key: "my-store",
    label: "My Store",
    icon: Store,
    items: ["my-store"],
    direct: true,
  },

  {
    key: "my-referrals",
    label: "My Referrals",
    icon: Gift,
    items: ["my-referrals"],
    direct: true,
  },

  {
    key: "help",
    label: "Help & Support",
    icon: CircleHelp,
    items: ["help"],
    direct: true,
  },

  {
    key: "settings",
    label: "Settings",
    icon: Settings,
    items: ["settings"],
    direct: true,
  },
];


const PAGE_META = {
  dashboard: { label: "Dashboard" },
  chats: { label: "Chats" },
  "goals-and-targets": { label: "Goals and Targets" },
  "my-referrals": { label: "My Referrals" },
  "my-store": { label: "My Store" },
  "utm-leads": { label: "UTM Leads" },
  "lead-store": { label: "Lead Store" },
  admissions: { group: "Admissions", label: "Overall" },
  "domestic-walkins": { group: "Admissions / Domestic", label: "Walk-ins" },
  "domestic-counselling": { group: "Admissions / Domestic", label: "Counselling" },
  "domestic-admissions": { group: "Admissions / Domestic", label: "Admissions Done" },
  "international-walkins": { group: "Admissions / International", label: "Walk-ins" },
  "international-counselling": { group: "Admissions / International", label: "Counselling" },
  "international-admissions": { group: "Admissions / International", label: "Admissions Done" },
  walkins: {
    group: "Admissions",
    label: "Walk-ins",
  },
  counselling: {
    group: "Admissions",
    label: "Counselling",
  },
  revenue: {
    group: "Finance",
    label: "Revenue",
  },
  analytics: {
    group: "Insights",
    label: "Analytics",
  },
  help: { label: "Help & Support" },
  settings: { label: "Settings" },
  profile: { label: "My Profile" },
};

const MODULE_ICON_OVERRIDES = {
  revenue: CircleDollarSign,
  analytics: Activity,
};

function getModuleIcon(key, fallbackIcon) {
  return MODULE_ICON_OVERRIDES[key] || fallbackIcon;
}

const MODULE_PERMISSION_MAP = {
  dashboard:
    "canViewAnalytics",
  "utm-leads":
    "canManageLeads",
  "lead-store":
    "canManageLeads",
  admissions: "canManageAdmissions",
  "domestic-walkins": "canManageAdmissions",
  "domestic-counselling": "canManageAdmissions",
  "domestic-admissions": "canManageAdmissions",
  "international-walkins": "canManageAdmissions",
  "international-counselling": "canManageAdmissions",
  "international-admissions": "canManageAdmissions",
  walkins:
    "canManageAdmissions",
  counselling:
    "canManageAdmissions",
  revenue:
    "canManageRevenue",
  analytics:
    "canViewAnalytics",
  help:
    "canManageSupport",
  settings:
    "canManageSettings",
};

const MODULE_PERMISSION_LABELS = {
  canManageLeads:
    "manage leads",
  canManageAdmissions:
    "manage admissions",
  canManageRevenue:
    "manage revenue",
  canViewAnalytics:
    "view analytics",
  canManageSupport:
    "manage support",
  canManageSettings:
    "manage company settings",
};

function getAccent(
  color
) {
  const colors = {
    indigo:
      "bg-indigo-600",

    blue:
      "bg-blue-600",

    sky:
      "bg-sky-600",

    teal:
      "bg-teal-600",

    emerald:
      "bg-emerald-600",

    maroon:
      "bg-rose-800",

    orange:
      "bg-orange-600",

    amber:
      "bg-amber-600",

    rose:
      "bg-rose-600",

    purple:
      "bg-purple-600",

    slate:
      "bg-slate-700",
  };

  return (
    colors[color] ||
    "bg-indigo-600"
  );
}
import bispunLogo from "./assets/bispun-logo.svg";
import bispunIcon from "./assets/bispun-icon.svg";

export default function ClientPortal({
  clientSession,
}) {
  const navigate =
    useNavigate();

  const [
    module,
    setModule,
  ] = useState(
    "dashboard"
  );

  const [
    signingOut,
    setSigningOut,
  ] = useState(
    false
  );

  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] = useState(false);

  const [
    mobileSidebarOpen,
    setMobileSidebarOpen,
  ] = useState(false);

  const [
    notificationsOpen,
    setNotificationsOpen,
  ] = useState(false);

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [
    unreadNotificationCount,
    setUnreadNotificationCount,
  ] = useState(0);

  const [
    notificationsLoading,
    setNotificationsLoading,
  ] = useState(false);

  const [
    notificationError,
    setNotificationError,
  ] = useState("");

  const notificationRef =
    useRef(null);

  const [
    profileMenuOpen,
    setProfileMenuOpen,
  ] = useState(false);
const [accountActionsOpen, setAccountActionsOpen] = useState(false);

  const [profileTab, setProfileTab] = useState("profile");
  const [profileSessions, setProfileSessions] = useState([]);
  const [profileSessionHistory, setProfileSessionHistory] = useState([]);
  const [profileSessionsLoading, setProfileSessionsLoading] = useState(false);
  const [profileSessionsError, setProfileSessionsError] = useState("");
  const [profileSessionAction, setProfileSessionAction] = useState("");
  const [profileHistoryClearing, setProfileHistoryClearing] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: clientSession?.user?.name || "",
    email: clientSession?.user?.email || "",
    phone: clientSession?.user?.phone || clientSession?.company?.phone || "",
  });
  const profilePhotoInputRef = useRef(null);

  const dashboardRole =
    clientSession?.user?.role || "EMPLOYEE";

  const dashboardViewOptions =
    dashboardRole === "CLIENT_ADMIN"
      ? [
          [
            "business",
            "Business Overview",
            "Company KPIs, revenue and performance",
          ],
          [
            "team",
            "Team Operations",
            "Leads, admissions and team execution",
          ],
          [
            "my-work",
            "My Work",
            "Your schedule and personal performance",
          ],
        ]
      : dashboardRole === "MANAGER"
        ? [
            [
              "team",
              "Team Operations",
              "Leads, admissions and team execution",
            ],
            [
              "my-work",
              "My Work",
              "Your schedule and personal performance",
            ],
          ]
        : [
            [
              "my-work",
              "My Work",
              "Your schedule and personal performance",
            ],
          ];

  const allowedDashboardViews =
    dashboardViewOptions.map(([value]) => value);

  const defaultDashboardView =
    dashboardRole === "MANAGER"
      ? "team"
      : dashboardRole === "EMPLOYEE"
        ? "my-work"
        : "business";

  const uiPreferencesStorageKey =
    `cb_ui_preferences_${clientSession?.user?.id || "default"}`;

  const [uiPreferences, setUiPreferences] = useState(() => {
    try {
      const savedForUser =
        window.localStorage.getItem(uiPreferencesStorageKey);
      const legacySaved =
        window.localStorage.getItem("cb_ui_preferences");
      const saved = savedForUser || legacySaved;

      if (saved) {
        const parsed = JSON.parse(saved);

        return {
          appearance: "light",
          showGreeting: true,
          showCalendar: true,
          dateFormat: "DD/MM/YYYY",
          timeFormat: "12H",
          ...parsed,
          dashboardView:
            savedForUser &&
            allowedDashboardViews.includes(parsed.dashboardView)
              ? parsed.dashboardView
              : defaultDashboardView,
        };
      }
    } catch (error) {
      console.error("Unable to load UI preferences:", error);
    }

    return {
      appearance: "light",
      dashboardView: defaultDashboardView,
      showGreeting: true,
      showCalendar: true,
      dateFormat: "DD/MM/YYYY",
      timeFormat: "12H",
    };
  });

  useEffect(() => {
    setUiPreferences((current) =>
      allowedDashboardViews.includes(current.dashboardView)
        ? current
        : {
            ...current,
            dashboardView: defaultDashboardView,
          }
    );
  }, [dashboardRole]);

  const [uiPreferencesSaved, setUiPreferencesSaved] = useState(false);

  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );

  const resolvedTheme =
    uiPreferences.appearance === "system"
      ? systemPrefersDark
        ? "dark"
        : "light"
      : uiPreferences.appearance;

  const [workspaceSearch, setWorkspaceSearch] = useState("");

  const profileMenuRef =
    useRef(null);

  const [
    changePasswordOpen,
    setChangePasswordOpen,
  ] = useState(false);

  const [
    passwordForm,
    setPasswordForm,
  ] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [
    passwordVisibility,
    setPasswordVisibility,
  ] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const [
    passwordSaving,
    setPasswordSaving,
  ] = useState(false);

  const [
    passwordError,
    setPasswordError,
  ] = useState("");

  const [
    passwordMessage,
    setPasswordMessage,
  ] = useState("");

  const [
    billingOpen,
    setBillingOpen,
  ] = useState(false);

  const [
    billingData,
    setBillingData,
  ] = useState({
    subscription: null,
    plans: [],
    payments: [],
  });

  const [
    billingLoading,
    setBillingLoading,
  ] = useState(false);

  const [
    billingError,
    setBillingError,
  ] = useState("");

  const [
    paymentProcessing,
    setPaymentProcessing,
  ] = useState("");

  const [
    receiptOpen,
    setReceiptOpen,
  ] = useState(false);

  const [
    receiptData,
    setReceiptData,
  ] = useState(null);

  const [
    receiptLoading,
    setReceiptLoading,
  ] = useState(false);

  const [
    openGroups,
    setOpenGroups,
  ] = useState({
    leads: true,
    admissions: false,
    finance: false,
    insights: false,
    support: true,
  });

  const [
    liveCompany,
    setLiveCompany,
  ] = useState(
    clientSession?.company ||
      null
  );

  // ---- Sidebar drag-and-drop ordering (persisted per user) ----------------
  const savedSidebarOrder = clientSession?.user?.sidebarOrder;
  const sidebarOrderStorageKey =
    `cb_sidebar_order_${clientSession?.user?.id || "default"}`;

  const orderedNavGroups = useMemo(() => {
    const base = NAV_GROUPS;

    let preferredOrder =
      Array.isArray(savedSidebarOrder) && savedSidebarOrder.length > 0
        ? savedSidebarOrder
        : [];

    // Same-browser fallback. The server value remains the primary source,
    // so a user's custom order also follows them across devices when saved.
    if (preferredOrder.length === 0) {
      try {
        const localOrder = JSON.parse(
          window.localStorage.getItem(sidebarOrderStorageKey) || "[]"
        );

        if (Array.isArray(localOrder) && localOrder.length > 0) {
          preferredOrder = localOrder;
        }
      } catch (error) {
        console.error("Unable to load saved sidebar order:", error);
      }
    }

    if (preferredOrder.length === 0) {
      return base;
    }

    const byKey = new Map(base.map((group) => [group.key, group]));

    // The user's saved order, limited to groups that still exist.
    const savedKnown = preferredOrder.filter((key) => byKey.has(key));
    const savedSet = new Set(savedKnown);

    // Walk the default order. Slots for saved keys are filled in the user's
    // saved sequence; any new/renamed group the saved order never knew about
    // keeps its DEFAULT position instead of being pushed to the very end.
    const ordered = [];
    let si = 0;
    base.forEach((group) => {
      if (savedSet.has(group.key)) {
        ordered.push(byKey.get(savedKnown[si]));
        si += 1;
      } else {
        ordered.push(group);
      }
    });

    return ordered;
  }, [savedSidebarOrder, sidebarOrderStorageKey]);

  const [navGroups, setNavGroups] = useState(orderedNavGroups);

  useEffect(() => {
    setNavGroups(orderedNavGroups);
  }, [orderedNavGroups]);


  const dragIndexRef = useRef(null);
  const [dragOverKey, setDragOverKey] = useState(null);

  async function persistSidebarOrder(order) {
    try {
      window.localStorage.setItem(
        sidebarOrderStorageKey,
        JSON.stringify(order)
      );
    } catch (error) {
      console.error("Unable to save sidebar order locally:", error);
    }

    try {
      await apiRequest("/api/client/settings/sidebar-order", {
        method: "PATCH",
        body: JSON.stringify({ order }),
      });
    } catch (error) {
      console.error("Unable to save sidebar order:", error);
    }
  }

  function handleNavDragStart(index) {
    dragIndexRef.current = index;
  }

  function handleNavDragOverItem(event, key) {
    event.preventDefault();
    if (dragOverKey !== key) setDragOverKey(key);
  }

  function handleNavDrop(index) {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    setDragOverKey(null);
    if (from === null || from === index) return;
    setNavGroups((current) => {
      const next = current.slice();
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      persistSidebarOrder(next.map((g) => g.key));
      return next;
    });
  }

  function handleNavDragEnd() {
    dragIndexRef.current = null;
    setDragOverKey(null);
  }

  const [calendarOpen, setCalendarOpen] = useState(false);

  // Global CRM year workspace shared by all operational modules.
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(() => {
    const saved = window.localStorage.getItem("cb_global_year");
    return saved || String(new Date().getFullYear());
  });
  const [availableYears, setAvailableYears] = useState([currentYear]);
  const [addYearOpen, setAddYearOpen] = useState(false);
  const [newWorkspaceYear, setNewWorkspaceYear] = useState("");
  const [yearMode, setYearMode] = useState("EMPTY");
  const [yearSaving, setYearSaving] = useState(false);
  const [yearError, setYearError] = useState("");

  useEffect(() => {
    window.localStorage.setItem("cb_global_year", selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return undefined;
    const onChange = (event) => setSystemPrefersDark(event.matches);
    setSystemPrefersDark(media.matches);
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
          uiPreferencesStorageKey,
          JSON.stringify(uiPreferences)
        );
        window.localStorage.setItem(
          "cb_ui_preferences",
          JSON.stringify(uiPreferences)
        );
    } catch (error) {
      console.error("Unable to save UI preferences:", error);
    }
  }, [uiPreferences]);

  async function loadAvailableYears() {
    try {
      const result = await apiRequest("/api/client/years");
      const years = Array.isArray(result.years) ? result.years.map((x) => Number(x.year)).filter(Number.isFinite) : [];
      const next = Array.from(new Set([currentYear, ...years])).sort((a,b) => b-a);
      setAvailableYears(next);
      if (
        selectedYear !== "all" &&
        !next.includes(Number(selectedYear))
      ) {
        setSelectedYear(
          String(next[0] || currentYear)
        );
      }
    } catch (error) {
      console.error("Unable to load CRM workspace years:", error);
    }
  }

  useEffect(() => { loadAvailableYears(); }, []);

  async function createYearWorkspace(event) {
    event.preventDefault();
    setYearError("");
    const year = Number(newWorkspaceYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) { setYearError("Enter a valid year between 2000 and 2100."); return; }
    if (availableYears.includes(year)) { setYearError(`${year} workspace already exists.`); return; }
    // CA-005: confirm before creating, since a year workspace can't be removed.
    if (!window.confirm(`Create a workspace for ${year}? It will be added to your period list and cannot be removed later.`)) { return; }
    setYearSaving(true);
    try {
      await apiRequest("/api/client/years", {
        method: "POST",
        body: JSON.stringify({
          year,
          mode: yearMode,
          copiedFromYear:
            yearMode === "COPY_STRUCTURE"
              ? selectedYear === "all"
                ? currentYear
                : Number(selectedYear)
              : null,
        }),
      });
      await loadAvailableYears();
      setSelectedYear(String(year));
      setAddYearOpen(false);
      setNewWorkspaceYear("");
      setYearMode("EMPTY");
      setModule("dashboard");
    } catch (error) { setYearError(error?.data?.message || "Unable to create year workspace"); }
    finally { setYearSaving(false); }
  }

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [module]);

  useEffect(() => {
    setLiveCompany(
      clientSession?.company ||
        null
    );

    setProfileForm({
      name: clientSession?.user?.name || "",
      email: clientSession?.user?.email || "",
      phone:
        clientSession?.user?.phone ||
        clientSession?.company?.phone ||
        "",
    });
  }, [
    clientSession,
  ]);

  const company =
    liveCompany;

  useEffect(() => {
    applyBrandTheme(
      company?.settings?.primaryColor ||
        company?.primaryColor ||
        "indigo"
    );
  }, [company?.settings?.primaryColor, company?.primaryColor]);

  const user =
    clientSession?.user;

  const isClientAdmin =
    user?.role === "CLIENT_ADMIN";

  const permissions =
    user?.permissions ||
    {};

  function hasModulePermission(
    moduleKey
  ) {
    if (
      user?.role ===
      "CLIENT_ADMIN"
    ) {
      return true;
    }

    const permission =
      MODULE_PERMISSION_MAP[
        moduleKey
      ];

    if (!permission) {
      return true;
    }

    return (
      permissions[
        permission
      ] === true
    );
  }

  function permissionMessage(
    moduleKey
  ) {
    const permission =
      MODULE_PERMISSION_MAP[
        moduleKey
      ];

    const label =
      MODULE_PERMISSION_LABELS[
        permission
      ] ||
      "access this module";

    return `You don't have permission to ${label}.`;
  }

  const enabledFeatures =
    useMemo(() => {
      return (
        company?.modules
          ?.filter(
            (item) =>
              item.enabled
          )
          .map(
            (item) =>
              item.key
          ) || []
      );
    }, [
      company,
    ]);

  const plan =
    company
      ?.subscription
      ?.plan
      ?.key ||
    "basic";

  const planLabel =
    String(
      plan || "basic"
    )
      .charAt(0)
      .toUpperCase() +
    String(
      plan || "basic"
    ).slice(1);

  const sidebarRenewalDate =
    company?.subscription
      ?.renewalDate ||
    billingData?.subscription
      ?.renewalDate ||
    null;

  const sidebarNextAnnualRenewalDate =
    sidebarRenewalDate &&
    !Number.isNaN(new Date(sidebarRenewalDate).getTime())
      ? (() => {
          const next = new Date(sidebarRenewalDate);
          next.setFullYear(next.getFullYear() + 1);
          return next;
        })()
      : null;

  const sidebarNextAnnualRenewalLabel =
    sidebarNextAnnualRenewalDate
      ? sidebarNextAnnualRenewalDate.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : null;

  const tenant =
    useMemo(
      () => ({
        id:
          company?.slug,

        slug:
          company?.slug,

        name:
          company?.name ||
          "Company",

        brandName:
          company?.brandName ||
          company?.name ||
          "CRM",

        short:
          company?.shortName ||
          "CB",

        accent:
          getAccent(
            company?.primaryColor
          ),

        subdomain:
          company?.subdomain ||
          "",

        owner:
          company?.ownerName ||
          user?.name ||
          "Admin",

        ownerName:
          company?.ownerName ||
          user?.name ||
          "Admin",

        business:
          company?.business ||
          "",

        city:
          company?.city ||
          "",

        leads:
          0,

        admissions:
          0,

        plan,
      }),

      [
        company,
        user,
        plan,
      ]
    );

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(
          event.target
        )
      ) {
        setNotificationsOpen(false);
      }

      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(
          event.target
        )
      ) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  async function loadNotifications() {
    setNotificationsLoading(true);
    setNotificationError("");

    try {
      const data = await apiRequest(
        "/api/client/notifications?limit=20"
      );

      setNotifications(data.notifications || []);
      setUnreadNotificationCount(
        Number(data.unreadCount || 0)
      );
    } catch (error) {
      console.error("Unable to load notifications:", error);
      setNotificationError(
        error?.data?.message ||
          "Unable to load notifications"
      );
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function loadUnreadNotificationCount() {
    try {
      const data = await apiRequest(
        "/api/client/notifications/unread-count"
      );

      setUnreadNotificationCount(
        Number(data.unreadCount || 0)
      );
    } catch (error) {
      console.error(
        "Unable to load notification count:",
        error
      );
    }
  }

  async function markNotificationRead(notification) {
    if (!notification.read) {
      try {
        await apiRequest(
          `/api/client/notifications/${notification.id}/read`,
          { method: "PATCH" }
        );

        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  read: true,
                  readAt: new Date().toISOString(),
                }
              : item
          )
        );

        setUnreadNotificationCount((current) =>
          Math.max(0, current - 1)
        );
      } catch (error) {
        console.error(
          "Unable to mark notification as read:",
          error
        );
      }
    }

    if (notification.actionModule) {
      setModule(notification.actionModule);
    }

    setNotificationsOpen(false);
  }

  async function markAllNotificationsRead() {
    try {
      await apiRequest(
        "/api/client/notifications/read-all",
        { method: "PATCH" }
      );

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          read: true,
          readAt:
            item.readAt ||
            new Date().toISOString(),
        }))
      );

      setUnreadNotificationCount(0);
    } catch (error) {
      console.error(
        "Unable to mark all notifications as read:",
        error
      );
    }
  }

  useEffect(() => {
    loadUnreadNotificationCount();

    const interval = window.setInterval(
      loadUnreadNotificationCount,
      60000
    );

    return () => window.clearInterval(interval);
  }, []);

  async function signOut() {
    if (
      signingOut
    ) {
      return;
    }

    setSigningOut(
      true
    );

    try {
      await apiRequest(
        "/api/client/auth/logout",
        {
          method:
            "POST",
        }
      );
    } catch (error) {
      console.error(
        "Client logout failed:",
        error
      );
    } finally {
      navigate(
        "/login",
        {
          replace:
            true,
        }
      );
    }
  }

  function openChangePassword() {
    setProfileMenuOpen(false);
    setPasswordError("");
    setPasswordMessage("");
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setChangePasswordOpen(true);
  }

  function updatePasswordField(
    field,
    value
  ) {
    setPasswordForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  async function submitPasswordChange(
    event
  ) {
    event.preventDefault();

    if (passwordSaving) {
      return;
    }

    setPasswordSaving(true);
    setPasswordError("");
    setPasswordMessage("");

    try {
      const data = await apiRequest(
        "/api/client/auth/change-password",
        {
          method: "PATCH",
          body: JSON.stringify(
            passwordForm
          ),
        }
      );

      setPasswordMessage(
        data.message ||
          "Password changed successfully"
      );

      window.setTimeout(() => {
        navigate(
          "/login",
          {
            replace: true,
          }
        );
      }, 900);
    } catch (error) {
      setPasswordError(
        error?.data?.message ||
          "Unable to change password"
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  async function loadBillingData() {
    setBillingLoading(true);
    setBillingError("");

    try {
      const data = await apiRequest(
        "/api/client/billing"
      );

      setBillingData({
        subscription:
          data.subscription || null,
        plans:
          data.plans || [],
        payments:
          data.payments || [],
      });
    } catch (error) {
      setBillingError(
        error?.data?.message ||
          "Unable to load subscription billing"
      );
    } finally {
      setBillingLoading(false);
    }
  }

  async function openBilling() {
    if (!isClientAdmin) {
      return;
    }

    setProfileMenuOpen(false);
    setBillingOpen(true);
    await loadBillingData();
  }

  function loadRazorpayCheckout() {
    return new Promise(
      (resolve, reject) => {
        if (window.Razorpay) {
          resolve();
          return;
        }

        const existing =
          document.querySelector(
            'script[data-consulbuzz-razorpay="true"]'
          );

        if (existing) {
          existing.addEventListener(
            "load",
            () => resolve()
          );
          existing.addEventListener(
            "error",
            () =>
              reject(
                new Error(
                  "Unable to load Razorpay Checkout"
                )
              )
          );
          return;
        }

        const script =
          document.createElement(
            "script"
          );

        script.src =
          "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.dataset.consulbuzzRazorpay =
          "true";

        script.onload = () =>
          resolve();

        script.onerror = () =>
          reject(
            new Error(
              "Unable to load Razorpay Checkout"
            )
          );

        document.body.appendChild(
          script
        );
      }
    );
  }

  async function startSubscriptionPayment(
    planKey
  ) {
    const billingCycle = "YEARLY";
    const paymentKey =
      `${planKey}:${billingCycle}`;

    setPaymentProcessing(
      paymentKey
    );
    setBillingError("");

    try {
      await loadRazorpayCheckout();

      const orderData =
        await apiRequest(
          "/api/client/billing/create-order",
          {
            method: "POST",
            body: JSON.stringify({
              planKey,
              billingCycle,
            }),
          }
        );

      const razorpay =
        new window.Razorpay({
          key: orderData.keyId,
          amount:
            orderData.order.amount,
          currency:
            orderData.order.currency,
          name: "Bispun",
          description:
            `${orderData.plan.name} annual subscription`,
          order_id:
            orderData.order.id,
          prefill: {
            name: user.name,
            email: user.email,
            contact:
              company.phone || "",
          },
          notes: {
            company:
              company.name,
            plan:
              orderData.plan.name,
          },
          theme: {
            color: "#4f46e5",
          },
          handler: async (
            response
          ) => {
            try {
              const verified =
                await apiRequest(
                  "/api/client/billing/verify-payment",
                  {
                    method: "POST",
                    body: JSON.stringify(
                      response
                    ),
                  }
                );

              await loadBillingData();

              if (verified.captured) {
                if (verified.receipt) {
                  setReceiptData(
                    verified.receipt
                  );
                  setReceiptOpen(true);
                }

                await loadUnreadNotificationCount();
              }
            } catch (error) {
              setBillingError(
                error?.data?.message ||
                  "Payment verification failed"
              );
            } finally {
              setPaymentProcessing(
                ""
              );
            }
          },
          modal: {
            ondismiss: () => {
              setPaymentProcessing(
                ""
              );
            },
          },
        });

      razorpay.on(
        "payment.failed",
        (response) => {
          setBillingError(
            response?.error
              ?.description ||
              "Payment failed. Please try again."
          );
          setPaymentProcessing(
            ""
          );
        }
      );

      razorpay.open();
    } catch (error) {
      setBillingError(
        error?.data?.message ||
          error?.message ||
          "Unable to start payment"
      );
      setPaymentProcessing("");
    }
  }

  async function openPaymentReceipt(
    paymentId
  ) {
    setReceiptOpen(true);
    setReceiptLoading(true);

    try {
      const data =
        await apiRequest(
          `/api/client/billing/receipts/${paymentId}`
        );

      setReceiptData(
        data.receipt || null
      );
    } catch (error) {
      setBillingError(
        error?.data?.message ||
          "Unable to load payment receipt"
      );
      setReceiptOpen(false);
    } finally {
      setReceiptLoading(false);
    }
  }

  function printReceipt() {
    const receipt =
      document.getElementById(
        "consulbuzz-payment-receipt"
      );

    if (!receipt) {
      return;
    }

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=900,height=1100"
      );

    if (!printWindow) {
      setBillingError(
        "Please allow pop-ups to print the receipt."
      );
      return;
    }

    printWindow.document.open();

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Bispun Payment Receipt</title>

          <script src="https://cdn.tailwindcss.com"></script>

          <style>
            @page {
              size: A4;
              margin: 6mm;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body {
              font-family: "Inter", sans-serif;
            }

            #consulbuzz-payment-receipt {
              width: 100%;
              max-width: 794px;
              margin: 0 auto;
              box-shadow: none !important;
              border-radius: 0 !important;
            }

            @media print {
              .print\\:hidden {
                display: none !important;
              }
            }
          </style>
        </head>

        <body>
          ${receipt.outerHTML}

          <script>
            window.addEventListener(
              "load",
              function () {
                setTimeout(
                  function () {
                    window.print();
                  },
                  500
                );
              }
            );
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  function toggleGroup(
    key
  ) {
    setOpenGroups(
      (current) => ({
        ...current,

        [key]:
          !current[key],
      })
    );
  }

  function handleWorkspaceUpdated(
    workspace
  ) {
    if (!workspace) {
      return;
    }

    setLiveCompany(
      (current) => {
        if (!current) {
          return current;
        }

        const nextName =
          workspace.companyName ||
          current.name;

        const nextShortName =
          String(nextName)
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(
              (word) =>
                word[0]
            )
            .join("")
            .toUpperCase() ||
          current.shortName;

        return {
          ...current,
          name:
            nextName,
          shortName:
            nextShortName,
          brandName:
            workspace.portalName ||
            current.brandName,
          business:
            workspace.businessType ??
            current.business,
          subdomain:
            workspace.subdomain ||
            current.subdomain,
          primaryColor:
            workspace.primaryColor ||
            current.primaryColor,
          logoUrl:
            workspace.logoUrl ??
            current.logoUrl,
        };
      }
    );
  }

  async function loadProfileSessions() {
    setProfileSessionsLoading(true);
    setProfileSessionsError("");

    try {
      const data = await apiRequest(
        "/api/client/auth/sessions"
      );

      setProfileSessions(
        Array.isArray(data.activeSessions)
          ? data.activeSessions
          : []
      );

      setProfileSessionHistory(
        Array.isArray(data.history)
          ? data.history
          : []
      );
    } catch (error) {
      setProfileSessionsError(
        error?.data?.message ||
          "Unable to load active sessions"
      );
    } finally {
      setProfileSessionsLoading(false);
    }
  }

  async function revokeProfileSession(session) {
    if (!session?.id || profileSessionAction) {
      return;
    }

    setProfileSessionAction(
      session.id
    );
    setProfileSessionsError("");

    try {
      const data = await apiRequest(
        `/api/client/auth/sessions/${session.id}`,
        {
          method: "DELETE",
        }
      );

      if (data.current) {
        navigate(
          "/login",
          {
            replace:
              true,
          }
        );
        return;
      }

      await loadProfileSessions();
    } catch (error) {
      setProfileSessionsError(
        error?.data?.message ||
          "Unable to sign out this device"
      );
    } finally {
      setProfileSessionAction("");
    }
  }

  async function revokeOtherProfileSessions() {
    if (profileSessionAction) {
      return;
    }

    setProfileSessionAction(
      "others"
    );
    setProfileSessionsError("");

    try {
      await apiRequest(
        "/api/client/auth/sessions/revoke-others",
        {
          method: "POST",
        }
      );

      await loadProfileSessions();
    } catch (error) {
      setProfileSessionsError(
        error?.data?.message ||
          "Unable to sign out other devices"
      );
    } finally {
      setProfileSessionAction("");
    }
  }

  useEffect(() => {
    if (
      module === "profile" &&
      profileTab === "sessions"
    ) {
      loadProfileSessions();
    }
  }, [
    module,
    profileTab,
  ]);

  async function clearProfileSessionHistory() {
    if (
      profileHistoryClearing ||
      profileSessionHistory.length === 0
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Clear all ended session history? Active sessions will not be affected."
      );

    if (!confirmed) {
      return;
    }

    setProfileHistoryClearing(true);
    setProfileSessionsError("");

    try {
      await apiRequest(
        "/api/client/auth/sessions/history",
        {
          method: "DELETE",
        }
      );

      setProfileSessionHistory([]);
    } catch (error) {
      setProfileSessionsError(
        error?.data?.message ||
          "Unable to clear session history"
      );
    } finally {
      setProfileHistoryClearing(false);
    }
  }

  function renderProfile() {
    const tabs = [
      { key: "profile", label: "Profile", icon: UserRound },
      { key: "security", label: "Security", icon: ShieldCheck },
      { key: "preferences", label: "Preferences", icon: SlidersHorizontal },
      { key: "sessions", label: "Sessions", icon: MonitorSmartphone },
    ];

    const displayName = profileForm.name || user.name || "Client Admin";
    const displayEmail = profileForm.email || user.email || "—";
    const displayPhone = profileForm.phone || company.phone || "—";
    const companyDisplayName =
      company.brandName || company.name || "Company";

    function saveProfile(event) {
      event?.preventDefault?.();
      setProfileSaved(true);
      window.setTimeout(() => setProfileSaved(false), 2200);
    }

    function selectProfilePhoto(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => setProfilePhoto(String(reader.result || ""));
      reader.readAsDataURL(file);
    }

    function updateUiPreference(key, value) {
      setUiPreferences((current) => ({
        ...current,
        [key]: value,
      }));
      setUiPreferencesSaved(false);
    }

    function saveUiPreferences() {
      try {
        window.localStorage.setItem(
          uiPreferencesStorageKey,
          JSON.stringify(uiPreferences)
        );
        window.localStorage.setItem(
          "cb_ui_preferences",
          JSON.stringify(uiPreferences)
        );
        setUiPreferencesSaved(true);
        window.setTimeout(() => setUiPreferencesSaved(false), 2200);
      } catch (error) {
        console.error("Unable to save UI preferences:", error);
      }
    }

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-[22px] font-black tracking-[-0.035em] text-indigo-900">
            My Profile
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Update your personal information and account settings.
          </p>
        </div>

        <section className="overflow-hidden rounded-[22px] border border-indigo-700 bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-800 shadow-[0_14px_36px_rgba(2,8,23,0.16)]">
          <div className="relative px-5 py-6 sm:px-7">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.08),transparent_35%)]" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative flex-shrink-0">
                <div className="flex h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-full border-[3px] border-white/80 bg-indigo-700 text-2xl font-black text-white shadow-lg">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => profilePhotoInputRef.current?.click()}
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-indigo-900 bg-white text-indigo-900 shadow-md hover:bg-slate-100"
                  aria-label="Change profile photo"
                >
                  <Camera size={14} />
                </button>

                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={selectProfilePhoto}
                  className="hidden"
                />
              </div>

              <div className="min-w-0 flex-1 text-white">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="truncate text-[25px] font-black tracking-[-0.04em]">
                    {displayName}
                  </h2>
                  <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[12px] font-bold text-slate-200">
                    {formatRole(user.role)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail size={13} />
                    {displayEmail}
                  </span>
                  <span className="hidden h-3 w-px bg-white/20 sm:block" />
                  <span className="inline-flex items-center gap-1.5">
                    <Phone size={13} />
                    {displayPhone}
                  </span>
                </div>

              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[18px] border border-slate-200 bg-white shadow-[0_5px_18px_rgba(15,23,42,0.04)]">
          <div className="grid grid-cols-4 border-b border-slate-100 px-2 sm:px-5">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const active = profileTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setProfileTab(tab.key)}
                  className={`relative flex min-h-[76px] flex-col items-center justify-center gap-1.5 px-1 text-[12px] font-bold transition-colors sm:text-xs ${
                    active
                      ? "text-indigo-900"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      active
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <TabIcon size={15} />
                  </span>
                  {tab.label}
                  {active && (
                    <span className="absolute bottom-0 h-[2px] w-14 rounded-full bg-indigo-600" />
                  )}
                </button>
              );
            })}
          </div>

          {profileTab === "profile" && (
            <div className="grid gap-5 p-5 lg:grid-cols-[1.45fr_0.75fr] lg:p-6">
              <form
                onSubmit={saveProfile}
                className="rounded-2xl border border-slate-200 p-5"
              >
                <div>
                  <h3 className="text-sm font-black text-indigo-900">
                    Personal Information
                  </h3>
                  <p className="mt-1 text-[13px] text-slate-500">
                    Keep your account details accurate and up to date.
                  </p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-bold text-slate-600">
                      Full Name
                    </span>
                    <input
                      value={profileForm.name}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-indigo-900 outline-none focus:border-slate-400"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-bold text-slate-600">
                      Email Address
                    </span>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-indigo-900 outline-none focus:border-slate-400"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-bold text-slate-600">
                      Phone Number
                    </span>
                    <input
                      value={profileForm.phone}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-indigo-900 outline-none focus:border-slate-400"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-bold text-slate-600">
                      Role
                    </span>
                    <input
                      value={formatRole(user.role)}
                      readOnly
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500 outline-none"
                    />
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="text-[13px] font-medium text-slate-500">
                    {profileSaved
                      ? "Profile changes saved locally."
                      : "Review your details before saving."}
                  </div>

                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    {profileSaved ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <Save size={14} />
                    )}
                    {profileSaved ? "Saved" : "Save Changes"}
                  </button>
                </div>
              </form>

              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 p-5">
                  <h3 className="text-sm font-black text-indigo-900">
                    Quick Actions
                  </h3>

                  <div className="mt-4 space-y-2">

                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="text-[12px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Profile Preview
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-indigo-600 text-xs font-black text-white">
                      {profilePhoto ? (
                        <img
                          src={profilePhoto}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-indigo-900">
                        {displayName}
                      </div>
                      <div className="truncate text-[13px] text-slate-500">
                        {displayEmail}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {profileTab === "security" && (
            <div className="grid gap-5 p-5 lg:grid-cols-2 lg:p-6">
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                    <ShieldCheck size={18} />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-indigo-900">
                      Security Overview
                    </h3>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      Manage password and account protection.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openChangePassword}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  <KeyRound size={14} />
                  Change Password
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-xs font-black text-indigo-900">
                  Account Access
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs">
                    <span className="text-slate-500">Account role</span>
                    <span className="font-bold text-indigo-900">
                      {formatRole(user.role)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Password</span>
                    <span className="font-bold text-emerald-600">Configured</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {profileTab === "preferences" && (
            <div className="p-5 lg:p-6">
              <div className="mb-5">
                <h3 className="text-sm font-black text-indigo-900">
                  UI Preferences
                </h3>
                <p className="mt-1 text-[13px] leading-5 text-slate-500">
                  Personalize how Bispun looks and feels for your account.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* APPEARANCE */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Sun size={18} />
                    </span>

                    <div>
                      <div className="text-xs font-black text-indigo-900">
                        Appearance
                      </div>
                      <div className="mt-1 text-[12px] leading-4 text-slate-500">
                        Choose the visual theme you prefer.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      ["light", "Light"],
                      ["dark", "Dark"],
                      ["system", "System"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          updateUiPreference("appearance", value)
                        }
                        className={`h-9 rounded-xl border text-[13px] font-bold transition-all ${
                          uiPreferences.appearance === value
                            ? value === "dark"
                              ? "border-[#17375e] bg-[#0b223d] text-white"
                              : "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DASHBOARD VIEW */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <SlidersHorizontal size={18} />
                    </span>

                    <div>
                      <div className="text-xs font-black text-indigo-900">
                        Dashboard View
                      </div>
                      <div className="mt-1 text-[12px] leading-4 text-slate-500">
                        Choose the dashboard that best matches how you work.
                      </div>
                    </div>
                  </div>

                  <div
                    className={`mt-4 grid grid-cols-1 gap-2 ${
                      dashboardViewOptions.length >= 3
                        ? "sm:grid-cols-3"
                        : dashboardViewOptions.length === 2
                          ? "sm:grid-cols-2"
                          : ""
                    }`}
                  >
                    {dashboardViewOptions.map(([value, label, description]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          updateUiPreference("dashboardView", value)
                        }
                        className={`min-h-[72px] rounded-xl border px-3 py-2.5 text-left transition-all ${
                          uiPreferences.dashboardView === value
                            ? "border-indigo-600 bg-indigo-600 text-white shadow-[0_6px_16px_rgba(79,70,229,0.16)]"
                            : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/40"
                        }`}
                      >
                        <span className="block text-[12px] font-black">
                          {label}
                        </span>
                        <span
                          className={`mt-1 block text-[10px] leading-[14px] ${
                            uiPreferences.dashboardView === value
                              ? "text-indigo-100"
                              : "text-slate-400"
                          }`}
                        >
                          {description}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 text-[10px] font-semibold text-slate-400">
                    Default for {formatRole(user.role)}:{" "}
                    {defaultDashboardView === "business"
                      ? "Business Overview"
                      : defaultDashboardView === "team"
                        ? "Team Operations"
                        : "My Work"}
                  </div>
                </div>

                {/* DASHBOARD ELEMENTS */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <CalendarClock size={18} />
                    </span>

                    <div>
                      <div className="text-xs font-black text-indigo-900">
                        Dashboard Elements
                      </div>
                      <div className="mt-1 text-[12px] leading-4 text-slate-500">
                        Choose which optional elements should be visible.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 divide-y divide-slate-100">
                    {[
                      ["showGreeting", "Show Greeting", "Good morning / afternoon / evening"],
                      ["showCalendar", "Show Dashboard Calendar", "Calendar in Team Operations and My Work"],
                    ].map(([key, label, description]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <div>
                          <div className="text-[13px] font-bold text-slate-800">
                            {label}
                          </div>
                          <div className="mt-0.5 text-[13px] text-slate-400">
                            {description}
                          </div>
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(uiPreferences[key])}
                          onClick={() =>
                            updateUiPreference(
                              key,
                              !uiPreferences[key]
                            )
                          }
                          className={`relative inline-flex h-[28px] w-[52px] flex-shrink-0 items-center rounded-full border p-[3px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 ${
                            uiPreferences[key]
                              ? "border-[#17375e] bg-[#0b223d] shadow-inner"
                              : "border-slate-300 bg-slate-200"
                          }`}
                        >
                          <span
                            className={`h-5 w-5 rounded-full bg-white shadow-[0_2px_5px_rgba(15,23,42,0.22)] transition-transform duration-200 ${
                              uiPreferences[key]
                                ? "translate-x-[24px]"
                                : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DATE & TIME */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <CalendarClock size={18} />
                    </span>

                    <div>
                      <div className="text-xs font-black text-indigo-900">
                        Date & Time
                      </div>
                      <div className="mt-1 text-[12px] leading-4 text-slate-500">
                        Set how dates and time are displayed.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-bold text-slate-500">
                        Date Format
                      </span>
                      <select
                        value={uiPreferences.dateFormat}
                        onChange={(event) =>
                          updateUiPreference(
                            "dateFormat",
                            event.target.value
                          )
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 outline-none focus:border-slate-400"
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD MMM YYYY">DD MMM YYYY</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-bold text-slate-500">
                        Time Format
                      </span>
                      <select
                        value={uiPreferences.timeFormat}
                        onChange={(event) =>
                          updateUiPreference(
                            "timeFormat",
                            event.target.value
                          )
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 outline-none focus:border-slate-400"
                      >
                        <option value="12H">12 Hour (AM/PM)</option>
                        <option value="24H">24 Hour</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5">
                <div>
                  <div className="text-[13px] font-bold text-slate-800">
                    Personal UI preferences
                  </div>
                  <div className="mt-0.5 text-[13px] text-slate-400">
                    These choices are stored for this browser.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={saveUiPreferences}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  {uiPreferencesSaved ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <Save size={14} />
                  )}
                  {uiPreferencesSaved
                    ? "Preferences Saved"
                    : "Save Preferences"}
                </button>
              </div>
            </div>
          )}

          {profileTab === "sessions" && (
            <div className="p-5 lg:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-black text-indigo-900">
                    Active Sessions
                  </h3>
                  <p className="mt-1 text-[13px] leading-5 text-slate-500">
                    See every device currently signed in to this Bispun account.
                  </p>
                </div>

                {profileSessions.some(
                  (session) =>
                    !session.current
                ) && (
                  <button
                    type="button"
                    onClick={revokeOtherProfileSessions}
                    disabled={Boolean(profileSessionAction)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    {profileSessionAction === "others" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <LogOut size={14} />
                    )}
                    Sign out all other devices
                  </button>
                )}
              </div>

              {profileSessionsError && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs font-semibold text-rose-700">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  {profileSessionsError}
                </div>
              )}

              {profileSessionsLoading ? (
                <div className="flex min-h-[220px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-xs text-slate-500">
                  <Loader2 size={15} className="animate-spin" />
                  Loading session activity...
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {profileSessions.length ? (
                      profileSessions.map((session) => {
                        const location = [session.city, session.country]
                          .filter(Boolean)
                          .join(", ");

                        const lastActive = session.current
                          ? "Active now"
                          : session.lastActiveAt
                          ? new Date(session.lastActiveAt).toLocaleString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "—";

                        const signedIn = session.createdAt
                          ? new Date(session.createdAt).toLocaleString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "—";

                        return (
                          <div
                            key={session.id}
                            className={`rounded-2xl border p-4 sm:p-5 ${
                              session.current
                                ? "border-indigo-200 bg-indigo-50/40"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                              <div
                                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
                                  session.current
                                    ? "bg-brand-600 text-white"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {session.deviceType === "Mobile" ? (
                                  <Smartphone size={18} />
                                ) : (
                                  <MonitorSmartphone size={18} />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-sm font-black text-indigo-900">
                                    {session.deviceName || "Unknown device"}
                                  </div>

                                  {session.current && (
                                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[13px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                      This device
                                    </span>
                                  )}
                                </div>

                                <div className="mt-1 text-[13px] font-medium text-slate-500">
                                  {session.browser || "Unknown browser"} ·{" "}
                                  {session.os || "Unknown OS"}
                                </div>

                                <div className="mt-3 grid gap-2 text-[12px] text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                                  <div>
                                    <div className="font-bold uppercase tracking-wide text-slate-400">
                                      Last active
                                    </div>
                                    <div
                                      className={`mt-1 font-semibold ${
                                        session.current
                                          ? "text-emerald-700"
                                          : "text-slate-700"
                                      }`}
                                    >
                                      {lastActive}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="font-bold uppercase tracking-wide text-slate-400">
                                      Signed in
                                    </div>
                                    <div className="mt-1 font-semibold text-slate-700">
                                      {signedIn}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="font-bold uppercase tracking-wide text-slate-400">
                                      IP address
                                    </div>
                                    <div className="mt-1 font-semibold text-slate-700">
                                      {session.ipAddress || "Unavailable"}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="font-bold uppercase tracking-wide text-slate-400">
                                      Approx. location
                                    </div>
                                    <div className="mt-1 font-semibold text-slate-700">
                                      {location || "Not available"}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => revokeProfileSession(session)}
                                disabled={Boolean(profileSessionAction)}
                                className={`inline-flex h-9 flex-shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-[13px] font-bold disabled:opacity-50 ${
                                  session.current
                                    ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                }`}
                              >
                                {profileSessionAction === session.id ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <LogOut size={13} />
                                )}
                                {session.current
                                  ? "Sign out"
                                  : "Sign out device"}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
                        <MonitorSmartphone
                          size={24}
                          className="mx-auto text-slate-300"
                        />
                        <div className="mt-3 text-sm font-black text-indigo-900">
                          No active sessions found
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-7">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h3 className="text-sm font-black text-indigo-900">
                          Session History
                        </h3>
                        <p className="mt-1 text-[13px] text-slate-500">
                          Previous sessions remain visible after logout, remote sign-out, password change or expiry. History older than 90 days is removed automatically.
                        </p>
                      </div>

                      {profileSessionHistory.length > 0 && (
                        <button
                          type="button"
                          onClick={clearProfileSessionHistory}
                          disabled={profileHistoryClearing}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {profileHistoryClearing ? (
                            <Loader2
                              size={13}
                              className="animate-spin"
                            />
                          ) : (
                            <X size={13} />
                          )}
                          {profileHistoryClearing
                            ? "Clearing..."
                            : "Clear History"}
                        </button>
                      )}
                    </div>

                    {profileSessionHistory.length ? (
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        {profileSessionHistory.map((session) => {
                          const reasonMap = {
                            LOGOUT: "Logged out",
                            REMOTE_SIGN_OUT: "Signed out remotely",
                            PASSWORD_CHANGED: "Password changed",
                            EXPIRED: "Session expired",
                            SIGNED_OUT: "Signed out",
                          };

                          const endedAt = session.endedAt
                            ? new Date(session.endedAt).toLocaleString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            : "—";

                          const lastActive = session.lastActiveAt
                            ? new Date(session.lastActiveAt).toLocaleString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            : "—";

                          const location = [session.city, session.country]
                            .filter(Boolean)
                            .join(", ");

                          return (
                            <div
                              key={`history-${session.id}`}
                              className="border-b border-slate-100 px-4 py-4 last:border-0 sm:px-5"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                                  {session.deviceType === "Mobile" ? (
                                    <Smartphone size={17} />
                                  ) : (
                                    <MonitorSmartphone size={17} />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-xs font-black text-indigo-900">
                                      {session.deviceName || "Unknown device"}
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-slate-500">
                                      {reasonMap[session.historyStatus] ||
                                        session.historyStatus ||
                                        "Ended"}
                                    </span>
                                  </div>

                                  <div className="mt-1 text-[12px] text-slate-500">
                                    {session.browser || "Unknown browser"} ·{" "}
                                    {session.os || "Unknown OS"}
                                    {location ? ` · ${location}` : ""}
                                  </div>

                                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-slate-400">
                                    <span>
                                      Last active:{" "}
                                      <strong className="font-semibold text-slate-600">
                                        {lastActive}
                                      </strong>
                                    </span>
                                    <span>
                                      Session ended:{" "}
                                      <strong className="font-semibold text-slate-600">
                                        {endedAt}
                                      </strong>
                                    </span>
                                    <span>
                                      IP:{" "}
                                      <strong className="font-semibold text-slate-600">
                                        {session.ipAddress || "Unavailable"}
                                      </strong>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center text-[13px] text-slate-500">
                        Session history will appear here after a device signs out or a session expires.
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-800">
                Multiple devices can share the same public IP when they use the same Wi-Fi or office network. Bispun identifies sessions by a unique secure session ID, not by IP address.
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  function renderAdmissionsMarketWorkspace({
    market,
    activeModule,
    children,
  }) {
    const isInternational = market === "INTERNATIONAL";
    const prefix = isInternational ? "international" : "domestic";
    const marketLabel = isInternational ? "International" : "Domestic";

    const tabs = [
      {
        key: `${prefix}-walkins`,
        label: "Walk-ins",
        icon: UserRound,
        premium: true,
      },
      {
        key: `${prefix}-counselling`,
        label: "Counselling",
        icon: CalendarClock,
        premium: true,
      },
      {
        key: `${prefix}-admissions`,
        label: "Admissions Done",
        icon: GraduationCap,
        premium: false,
      },
    ];

    return (
      <div className="space-y-5">
        <section className="border-b border-slate-200 bg-white/70 px-1 pt-1">
          <div className="px-1 pb-4">
            <div className="text-[13px] font-semibold text-slate-500">
              Admissions
            </div>

            <h1 className="mt-1 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
              {marketLabel}
            </h1>

            <p className="mt-1 text-[13px] text-slate-500">
              {isInternational
                ? "Manage international walk-ins, counselling and completed admissions."
                : "Manage domestic walk-ins, counselling and completed admissions."}
            </p>
          </div>

          <div className="flex min-w-0 gap-7 overflow-x-auto px-1">
            {tabs.map((tab) => {
              const active = activeModule === tab.key;
              const featureKey = tab.key.includes("walkins")
                ? "walkins"
                : tab.key.includes("counselling")
                  ? "counselling"
                  : "admissions";

              const locked = tab.premium
                ? !enabledFeatures.includes(featureKey) ||
                  !hasModulePermission(tab.key)
                : !hasModulePermission(tab.key);

              const TabIcon = tab.icon;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setModule(tab.key)}
                  className={`relative flex h-12 flex-shrink-0 items-center gap-2 px-1 text-[13px] font-semibold transition-colors ${
                    active
                      ? "text-slate-950"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <TabIcon
                    size={15}
                    strokeWidth={1.9}
                    className={active ? "text-indigo-600" : "text-slate-400"}
                  />

                  <span>{tab.label}</span>

                  {tab.premium ? (
                    <Crown
                      size={12}
                      className="text-amber-500"
                      title="Premium module"
                    />
                  ) : null}

                  {locked ? (
                    <Lock
                      size={10}
                      className="text-slate-400"
                    />
                  ) : null}

                  <span
                    className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full transition ${
                      active ? "bg-indigo-600" : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </section>

        <div>{children}</div>
      </div>
    );
  }

  function renderModule() {
    if (module === "profile") {
      return renderProfile();
    }

    if (module === "chats") {
      return <ChatPanel currentUser={user} />;
    }

    if (module === "goals-and-targets") {
      return <GoalsAndTargets currentUser={user} selectedYear={selectedYear} />;
    }

    if (module === "my-referrals") {
      return <Referrals currentUser={user} />;
    }

    if (module === "my-store") {
      return <MyStore currentUser={user} />;
    }

    if (
      !hasModulePermission(
        module
      )
    ) {
      return (
        <div className="min-h-[420px] flex items-center justify-center">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Lock
                size={21}
              />
            </div>

            <div className="mt-4 text-base font-bold text-slate-950">
              Access restricted
            </div>

            <div className="mt-2 text-sm leading-6 text-slate-500">
              {
                permissionMessage(
                  module
                )
              }
            </div>

            <div className="mt-4 text-xs text-slate-400">
              Contact your Client Admin if you need access.
            </div>
          </div>
        </div>
      );
    }

    const featureKeyForModule =
      module.includes("walkins")
        ? "walkins"
        : module.includes("counselling")
          ? "counselling"
          : module.includes("admissions")
            ? "admissions"
            : module;

    if (
      !enabledFeatures.includes(
        featureKeyForModule
      )
    ) {
      return (
        <UpgradeGate
          module={
            featureKeyForModule
          }
          currentPlan={
            plan
          }
          onUpgrade={() =>
            setModule(
              "help"
            )
          }
        />
      );
    }

    switch (
      module
    ) {
      case "chats":
        return <ChatPanel currentUser={user} />;

      case "dashboard":
        return (
          <Dashboard
            tenant={tenant}
            user={user}
            selectedYear={selectedYear}
            uiPreferences={uiPreferences}
          />
        );

      case "utm-leads":
        return (
          <UTMLeads selectedYear={selectedYear} />
        );

      case "admissions":
        return <Admissions selectedYear={selectedYear} market="ALL" overviewOnly />;

      case "domestic-walkins":
        return renderAdmissionsMarketWorkspace({
          market: "DOMESTIC",
          activeModule: module,
          children: (
            <Walkins
              selectedYear={selectedYear}
              market="DOMESTIC"
            />
          ),
        });

      case "domestic-counselling":
        return renderAdmissionsMarketWorkspace({
          market: "DOMESTIC",
          activeModule: module,
          children: (
            <Counselling
              selectedYear={selectedYear}
              market="DOMESTIC"
            />
          ),
        });

      case "domestic-admissions":
        return renderAdmissionsMarketWorkspace({
          market: "DOMESTIC",
          activeModule: module,
          children: (
            <Admissions
              selectedYear={selectedYear}
              market="DOMESTIC"
            />
          ),
        });

      case "international-walkins":
        return renderAdmissionsMarketWorkspace({
          market: "INTERNATIONAL",
          activeModule: module,
          children: (
            <Walkins
              selectedYear={selectedYear}
              market="INTERNATIONAL"
            />
          ),
        });

      case "international-counselling":
        return renderAdmissionsMarketWorkspace({
          market: "INTERNATIONAL",
          activeModule: module,
          children: (
            <Counselling
              selectedYear={selectedYear}
              market="INTERNATIONAL"
            />
          ),
        });

      case "international-admissions":
        return renderAdmissionsMarketWorkspace({
          market: "INTERNATIONAL",
          activeModule: module,
          children: (
            <Admissions
              selectedYear={selectedYear}
              market="INTERNATIONAL"
            />
          ),
        });

      case "revenue":
        return (
          <Revenue selectedYear={selectedYear} />
        );

      case "lead-store":
        return (
          <LeadStore selectedYear={selectedYear} />
        );

      case "walkins":
        return (
          <Walkins selectedYear={selectedYear} />
        );

      case "counselling":
        return (
          <Counselling selectedYear={selectedYear} />
        );

      case "analytics":
        return (
          <Analytics selectedYear={selectedYear} />
        );

      case "help":
        return (
          <Help
            tenant={
              tenant
            }
            plan={
              plan
            }
            user={
              user
            }
          />
        );

      case "settings":
        return (
          <SettingsView
            tenant={
              tenant
            }
            primaryColor={
              company?.primaryColor
            }
            currentUser={user}
            onWorkspaceUpdated={
              handleWorkspaceUpdated
            }
          />
        );

      default:
        return null;
    }
  }

  function renderDirectItem(
    group
  ) {
    const key =
      group.items[0];

    const active =
      module === key;

    const locked =
      !enabledFeatures.includes(
        key
      ) ||
      !hasModulePermission(
        key
      );

    const Icon =
      group.icon;

    return (
      <button
        key={
          group.key
        }
        type="button"
        title={
          sidebarCollapsed
            ? group.label
            : undefined
        }
        onClick={() =>
          setModule(
            key
          )
        }
        className={`relative mx-2 w-[calc(100%-16px)] rounded-xl flex items-center py-2.5 text-[13px] font-semibold transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          sidebarCollapsed
            ? "justify-center px-2"
            : "gap-3 px-4"
        } ${
          active
            ? "bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
            : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
        }`}
      >
        {active && (
          <span className="absolute left-1.5 top-2 bottom-2 w-[2px] rounded-full bg-indigo-400" />
        )}

        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
          <Icon
            size={24}
            strokeWidth={2}
            className={
              active
                ? "text-indigo-300"
                : "text-slate-400"
            }
          />
        </span>

        {!sidebarCollapsed && (
          <>
            <span className="flex-1 text-left">
              {
                group.label
              }
            </span>

            {locked && (
              <Lock
                size={
                  11
                }
                className="text-slate-600"
              />
            )}
          </>
        )}

        {sidebarCollapsed &&
          locked && (
            <span className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-slate-500" />
          )}
      </button>
    );
  }

  function renderChildItem(
    key
  ) {
    const meta =
      MODULE_META[
        key
      ];

    if (
      !meta
    ) {
      return null;
    }

    const Icon =
      getModuleIcon(
        key,
        meta.icon
      );

    const active =
      module === key;

    const locked =
      !enabledFeatures.includes(
        key
      ) ||
      !hasModulePermission(
        key
      );

    return (
      <button
        key={
          key
        }
        type="button"
        onClick={() =>
          setModule(
            key
          )
        }
        className={`relative mx-2 w-[calc(100%-16px)] rounded-lg flex items-center gap-2.5 pl-[42px] pr-3 py-2 text-[12px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          active
            ? "text-white bg-white/[0.07]"
            : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-400" />
        )}

        <Icon
          size={
            14
          }
          className={
            active
              ? "text-indigo-300"
              : "text-slate-500"
          }
        />

        <span className="flex-1 text-left font-medium">
          {
            meta.label
          }
        </span>

        {locked && (
          <Lock
            size={
              11
            }
            className="text-slate-600"
          />
        )}

        {!locked &&
          meta.plan && (
            <Crown
              size={
                11
              }
              className={
                meta.plan ===
                "pro"
                  ? "text-indigo-400"
                  : "text-amber-400"
              }
            />
          )}
      </button>
    );
  }

  if (
    !company ||
    !user
  ) {
    return (
      <div className="min-h-screen bg-[#071321] flex items-center justify-center">
        <Loader2
          size={
            20
          }
          className="animate-spin text-indigo-500"
        />
      </div>
    );
  }

  const formatRole = (role) => {
    if (!role) return "User";

    return String(role)
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const initials =
    String(
      user.name
    )
      .split(
        " "
      )
      .filter(
        Boolean
      )
      .slice(
        0,
        2
      )
      .map(
        (part) =>
          part[0]
      )
      .join(
        ""
      )
      .toUpperCase();


  function getTimeGreeting() {
    const hour = new Date().getHours();

    if (hour < 12) {
      return "Good morning";
    }

    if (hour < 17) {
      return "Good afternoon";
    }

    return "Good evening";
  }

  const timeGreeting = getTimeGreeting();

  const sidebarCompact =
    sidebarCollapsed &&
    !mobileSidebarOpen;

  const currentPage =
    PAGE_META[module] || {
      label:
        MODULE_META[module]?.label ||
        module,
    };

  return (
    <div
      data-cb-theme={resolvedTheme}
      data-cb-dashboard-view={uiPreferences.dashboardView}
      className="cb-client-portal min-h-screen bg-[#f6f7fa] text-slate-900 overflow-x-hidden"
    >
      <style>{`
        /* Portal typography is globally standardized to Inter in index.css. */
        .cb-client-portal h1 { font-size:24px !important; line-height:1.25 !important; font-weight:700 !important; letter-spacing:-0.02em !important; }
        .cb-client-portal h2 { font-size:17px !important; line-height:1.35 !important; font-weight:700 !important; }
        .cb-client-portal h3 { font-size:15px !important; line-height:1.4 !important; font-weight:700 !important; }

        html,
        body,
        #root {
          margin: 0;
          min-height: 100%;
          background: #f6f7fa;
          font-family: "Inter", sans-serif;
        }

        .sidebar-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .sidebar-scroll::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }

        [data-cb-theme="dark"] { background: #0b0d10 !important; color: #e5e7eb !important; }
        [data-cb-theme="dark"] main,
        [data-cb-theme="dark"] header { background: #0f1115 !important; }
        [data-cb-theme="dark"] .bg-white { background-color: #15181d !important; }
        [data-cb-theme="dark"] .bg-slate-50,
        [data-cb-theme="dark"] .bg-slate-100 { background-color: #191d23 !important; }
        [data-cb-theme="dark"] .text-slate-950,
        [data-cb-theme="dark"] .text-slate-900,
        [data-cb-theme="dark"] .text-slate-800,
        [data-cb-theme="dark"] .text-slate-700 { color: #f3f4f6 !important; }
        [data-cb-theme="dark"] .text-slate-600,
        [data-cb-theme="dark"] .text-slate-500,
        [data-cb-theme="dark"] .text-slate-400 { color: #9ca3af !important; }
        [data-cb-theme="dark"] .border-slate-100,
        [data-cb-theme="dark"] .border-slate-200,
        [data-cb-theme="dark"] .border-slate-300 { border-color: #2b3038 !important; }
        [data-cb-theme="dark"] input,
        [data-cb-theme="dark"] select,
        [data-cb-theme="dark"] textarea { background-color: #15181d !important; border-color: #303640 !important; color: #f3f4f6 !important; }
        [data-cb-theme="dark"] input::placeholder,
        [data-cb-theme="dark"] textarea::placeholder { color: #6b7280 !important; }
        [data-cb-density="compact"] main { padding-top: 10px !important; padding-bottom: 12px !important; }
        [data-cb-density="compact"] .cb-dashboard-root { gap: .75rem !important; }
        [data-cb-density="compact"] .cb-dashboard-root .gap-4 { gap: .65rem !important; }
        [data-cb-density="compact"] .cb-dashboard-root .p-4,
        [data-cb-density="compact"] .cb-dashboard-root .p-5 { padding: .85rem !important; }

      `}</style>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          body > * {
            display: none !important;
          }

          #consulbuzz-payment-receipt-print-root {
            display: block !important;
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          #consulbuzz-payment-receipt {
            display: block !important;
            position: static !important;
            width: 113.64% !important;
            max-width: none !important;
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
            transform: scale(0.88);
            transform-origin: top left;
          }

          #consulbuzz-payment-receipt * {
            visibility: visible !important;
          }

          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      {/* MOBILE APP BAR */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-[60] h-14 bg-[#f6f7fb]/95 backdrop-blur-xl border-b border-slate-200/70 px-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            setMobileSidebarOpen(
              (current) => !current
            )
          }
          className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center shadow-sm active:scale-[0.98]"
          aria-label={
            mobileSidebarOpen
              ? "Close navigation"
              : "Open navigation"
          }
        >
          {mobileSidebarOpen ? (
            <X size={19} />
          ) : (
            <Menu size={20} />
          )}
        </button>

        <div className="absolute left-1/2 max-w-[58vw] -translate-x-1/2 text-center">
          <div className="text-[13px] font-bold text-slate-950 truncate">
            {company.brandName}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setMobileSidebarOpen(false);
            setProfileTab("profile");
            setModule("profile");
          }}
          className="relative w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-[12px] font-bold shadow-sm"
          aria-label="Open profile"
        >
          {initials}
          {unreadNotificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-[#f6f7fb]" />
          )}
        </button>
      </div>

      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileSidebarOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px]"
        />
      )}

      <div className="flex">
        {/* FIXED LIGHT SIDEBAR */}
        <aside
          className={`fixed inset-y-0 left-0 z-[70] overflow-visible border-r border-white/[0.07] bg-[#0f172a] transition-[width,transform,box-shadow] duration-200 ease-out ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          } ${
            sidebarCompact
              ? "w-[72px] shadow-[5px_0_18px_rgba(2,8,23,0.08)]"
              : "w-[82vw] max-w-[292px] lg:w-[252px] lg:max-w-none shadow-[8px_0_28px_rgba(2,8,23,0.10)]"
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setSidebarCollapsed((current) => !current);
            }}
            title={sidebarCollapsed ? "Expand menu" : "Collapse menu"}
            aria-label={sidebarCollapsed ? "Expand menu" : "Collapse menu"}
            className="hidden lg:flex absolute top-1/2 right-[-14px] z-[80] h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_5px_16px_rgba(15,23,42,0.18)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-indigo-300 hover:text-indigo-600 hover:shadow-[0_7px_20px_rgba(15,23,42,0.22)]"
          >
            {sidebarCollapsed ? (
              <ChevronRight size={15} strokeWidth={2.2} />
            ) : (
              <PanelLeftClose size={15} strokeWidth={2.2} />
            )}
          </button>

          <div className="h-full flex flex-col overflow-visible">
            {/* CLIENT COMPANY IDENTITY — TOP LEFT */}
            {!sidebarCompact ? (
              <div className="px-5 pt-4 pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-white/10 bg-brand-600 text-[13px] font-black tracking-tight text-white shadow-[0_8px_22px_rgba(79,70,229,0.28)]">
                    {company?.logoUrl ? (
                      <img src={company.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="relative">{(company?.brandName || company?.name || "CB").slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>

                  <div className="min-w-0 overflow-visible">
                    <div
                      title={company?.brandName || company?.name || "Workspace"}
                      className="line-clamp-2 break-words text-[17px] font-black leading-tight tracking-[-0.02em] text-white"
                    >
                      {company?.brandName || company?.name || "Workspace"}
                    </div>
                    <div className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {company?.business || company?.subdomain || "Workspace"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pt-4 pb-2 flex justify-center">
                <div
                  className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[10px] border border-white/10 bg-brand-600 text-[13px] font-black tracking-tight text-white shadow-[0_8px_22px_rgba(79,70,229,0.24)]"
                  title={company?.brandName || company?.name || "Workspace"}
                >
                  {company?.logoUrl ? (
                    <img src={company.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="relative">{(company?.brandName || company?.name || "CB").slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
              </div>
            )}

            <nav
              className={`relative mx-2 mb-3 flex-1 min-h-0 overflow-hidden ${
                sidebarCompact
                  ? "px-1.5 py-2"
                  : "px-2 py-2"
              }`}
            >
              <div className="sidebar-scroll h-full overflow-y-auto overflow-x-hidden pr-0.5">
                {navGroups.map((group, navIndex) => {
                  const Icon = group.icon;
                  const groupActive =
                    group.items.includes(module) ||
                    (group.key === "admissions" &&
                      (module.startsWith("domestic-") ||
                        module.startsWith("international-")));
                  const draggable = !sidebarCompact;
                  const isDragOver = dragOverKey === group.key;

                  if (group.direct) {
                    const key = group.items[0];
                    const active = module === key;
                    const locked =
                      group.key === "chats" || group.key === "goals-and-targets" || group.key === "my-referrals" || group.key === "my-store"
                        ? false
                        : !enabledFeatures.includes(key) ||
                          !hasModulePermission(key);

                    return (
                      <button
                        key={group.key}
                        type="button"
                        draggable={draggable}
                        onDragStart={() => handleNavDragStart(navIndex)}
                        onDragOver={(e) => handleNavDragOverItem(e, group.key)}
                        onDrop={() => handleNavDrop(navIndex)}
                        onDragEnd={handleNavDragEnd}
                        title={sidebarCompact ? group.label : undefined}
                        onClick={() => {
                          setModule(key);
                          setMobileSidebarOpen(false);
                        }}
                        className={`relative mb-1 w-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isDragOver ? "opacity-60 " : ""}${
                          sidebarCompact
                            ? "h-11 rounded-xl flex items-center justify-center"
                            : "rounded-xl px-3 py-2.5 flex items-center gap-3"
                        } ${
                          active
                            ? "bg-brand-600 text-white shadow-brand-sm"
                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        {sidebarCompact ? (
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
                            <Icon size={20} strokeWidth={2} />
                          </span>
                        ) : (
                          <Icon size={16} strokeWidth={2} className="flex-shrink-0" />
                        )}

                        {!sidebarCompact && (
                          <>
                            <span className="flex-1 text-left text-sm font-medium">
                              {group.label}
                            </span>

                            {active ? (
                              <ChevronRight className="h-3.5 w-3.5 text-white/60" />
                            ) : locked ? (
                              <Lock size={11} className="text-slate-400" />
                            ) : null}
                          </>
                        )}
                      </button>
                    );
                  }

                  const open = Boolean(openGroups[group.key]);

                  if (sidebarCompact) {
                    return (
                      <div key={group.key} className="mb-1">
                        <button
                          type="button"
                          title={group.label}
                          onClick={() =>
                            setOpenGroups((current) => ({
                              ...current,
                              [group.key]: !current[group.key],
                            }))
                          }
                          className={`relative h-11 w-full rounded-lg flex items-center justify-center transition-all duration-300 ${
                            groupActive
                              ? "bg-white/10 text-white"
                              : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                          }`}
                        >
                          {groupActive && (
                            <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-indigo-400" />
                          )}
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
                            <Icon size={24} strokeWidth={2} />
                          </span>
                        </button>

                        {open && (
                          <div className="mt-1 space-y-1">
                            {group.items.map((key) => {
                              const meta = MODULE_META[key];
                              if (!meta) return null;

                              const ChildIcon = getModuleIcon(key, meta.icon);
                              const active = module === key;
                              const locked =
                                !enabledFeatures.includes(key.includes("walkins") ? "walkins" : key.includes("counselling") ? "counselling" : key.includes("admissions") ? "admissions" : key) ||
                                !hasModulePermission(key);

                              return (
                                <button
                                  key={key}
                                  type="button"
                                  title={meta.label}
                                  onClick={() => setModule(key)}
                                  className={`relative mx-auto flex h-9 w-10 items-center justify-center rounded-lg transition-all duration-200 ${
                                    active
                                      ? "bg-indigo-500/20 text-indigo-200"
                                      : "text-slate-500 hover:bg-white/[0.06] hover:text-white"
                                  }`}
                                >
                                  {active && (
                                    <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-indigo-400" />
                                  )}
                                  <ChildIcon size={18} strokeWidth={2} />

                                  {(key.includes("walkins") || key.includes("counselling")) && (
                                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                                  )}

                                  {locked && (
                                    <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={group.key}
                      draggable={draggable}
                      onDragStart={() => handleNavDragStart(navIndex)}
                      onDragOver={(e) => handleNavDragOverItem(e, group.key)}
                      onDrop={() => handleNavDrop(navIndex)}
                      onDragEnd={handleNavDragEnd}
                      className={`mb-1 ${isDragOver ? "opacity-60" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          toggleGroup(group.key)
                        }
                        className={`relative w-full rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                          groupActive
                            ? "bg-brand-600 text-white shadow-brand-sm"
                            : open
                            ? "bg-slate-800 text-white"
                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <Icon size={16} strokeWidth={2} className="flex-shrink-0" />

                        <span className="flex-1 text-left text-sm font-medium">
                          {group.label}
                        </span>

                        <ChevronDown
                          size={14}
                          className={`text-slate-500 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                            open ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      <div
                        className={`grid transition-[grid-template-rows,opacity] duration-200 ${
                          open
                            ? "grid-rows-[1fr] opacity-100"
                            : "grid-rows-[0fr] opacity-0"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="relative ml-[18px] mt-1 mb-1 pl-4">
                            <span className="absolute left-0 top-1 bottom-1 w-px bg-white/10" />

                            <div className="space-y-0.5">
                              {group.items.map((key) => {
                                const meta = MODULE_META[key];
                                if (!meta) return null;

                                const ChildIcon = getModuleIcon(key, meta.icon);
                                const active = module === key;
                                const locked =
                                  !enabledFeatures.includes(key.includes("walkins") ? "walkins" : key.includes("counselling") ? "counselling" : key.includes("admissions") ? "admissions" : key) ||
                                  !hasModulePermission(key);

                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => {
                                      setModule(key);
                                      setMobileSidebarOpen(false);
                                    }}
                                    className={`relative w-full min-h-9 rounded-xl px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                                      active
                                        ? "text-white"
                                        : "text-slate-400 hover:text-white"
                                    }`}
                                  >
                                    <ChildIcon size={16} strokeWidth={2} className="flex-shrink-0" />

                                    <span className="flex-1 text-[13px] font-medium">
                                      {key === "domestic-walkins" ? <span className="mb-1 block text-[12px] uppercase tracking-[0.12em] text-slate-500">Domestic</span> : null}
                                      {key === "international-walkins" ? <span className="mb-1 block text-[12px] uppercase tracking-[0.12em] text-slate-500">International</span> : null}
                                      {key === "admissions" ? "Overall" : meta.label}
                                    </span>

                                    {(key.includes("walkins") || key.includes("counselling")) && (
                                      <Crown
                                        size={12}
                                        className="text-amber-500"
                                        title="Premium module"
                                      />
                                    )}

                                    {locked ? (
                                      <Lock
                                        size={10}
                                        className="text-slate-400"
                                      />
                                    ) : null}
                                  </button>
                                );
                              })}

                              {group.key === "admissions" ? (
                                <>
                                  {[
                                    {
                                      key: "domestic",
                                      label: "Domestic",
                                      icon: Building2,
                                      defaultModule: "domestic-admissions",
                                      matchPrefix: "domestic-",
                                    },
                                    {
                                      key: "international",
                                      label: "International",
                                      icon: Globe2,
                                      defaultModule: "international-admissions",
                                      matchPrefix: "international-",
                                    },
                                  ].map((section) => {
                                    const sectionActive =
                                      module.startsWith(section.matchPrefix);
                                    const SectionIcon = section.icon;

                                    return (
                                      <button
                                        key={section.key}
                                        type="button"
                                        onClick={() => {
                                          setModule(section.defaultModule);
                                          setMobileSidebarOpen(false);
                                        }}
                                        className={`relative mt-1 w-full min-h-9 rounded-lg px-2.5 py-2 flex items-center gap-2.5 text-left transition-colors ${
                                          sectionActive
                                            ? "bg-white/[0.05] text-white"
                                            : "text-slate-400 hover:text-white"
                                        }`}
                                      >
                                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                                          <SectionIcon
                                            size={18}
                                            strokeWidth={2}
                                            className={
                                              sectionActive
                                                ? "text-indigo-300"
                                                : "text-slate-500"
                                            }
                                          />
                                        </span>

                                        <span className="flex-1 text-[12px] font-semibold">
                                          {section.label}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </nav>

            {/* BISPUN ACCOUNT — compact button + menu */}
            <div className={`${sidebarCompact ? "px-2" : "px-3"} pb-3`}>
              {!sidebarCompact ? (
                <div className="relative">
                  <button type="button" onClick={() => setAccountActionsOpen((v) => !v)} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.06]">
                    <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-white">
                      <img src={bispunIcon} alt="Bispun" className="h-full w-full object-contain" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold leading-tight text-white">Bis<span className="text-[#4f8cff]">pun</span></span>
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{planLabel} plan</span>
                    </span>
                    <ChevronRight size={15} strokeWidth={2.2} className={`flex-shrink-0 text-slate-400 transition-transform ${accountActionsOpen ? "-rotate-90" : ""}`} />
                  </button>

                  {accountActionsOpen && (
                    <>
                      <div className="fixed inset-0 z-[75]" onClick={() => setAccountActionsOpen(false)} />
                      <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-[80] overflow-hidden rounded-xl border border-white/10 bg-[#111a2e] py-1 shadow-[0_18px_40px_rgba(2,8,23,0.5)]">
                        {isClientAdmin && (
                          <button type="button" onClick={() => { setAccountActionsOpen(false); openBilling(); }} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-white/[0.06]">
                            <Rocket size={15} strokeWidth={2} className="flex-shrink-0 text-slate-400" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-semibold text-slate-200">Upgrade plan</span>
                              {sidebarNextAnnualRenewalLabel && (
                                <span className="block text-[10px] text-slate-500">Valid till {sidebarNextAnnualRenewalLabel}</span>
                              )}
                            </span>
                          </button>
                        )}
                        <button type="button" onClick={() => { setAccountActionsOpen(false); setProfileTab("profile"); setModule("profile"); }} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-200 hover:bg-white/[0.06]">
                          <UserRound size={15} strokeWidth={2} className="flex-shrink-0 text-slate-400" />Profile
                        </button>
                        <div className="my-1 border-t border-white/10" />
                        <button type="button" onClick={() => { setAccountActionsOpen(false); signOut(); }} disabled={signingOut} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-semibold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">
                          <LogOut size={15} strokeWidth={2} className="flex-shrink-0" />{signingOut ? "Signing out..." : "Log out"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={
                    isClientAdmin
                      ? openBilling
                      : () => {
                          setProfileTab("profile");
                          setModule("profile");
                        }
                  }
                  className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 text-[11px] font-black text-white transition hover:brightness-110"
                  title={isClientAdmin ? `${planLabel} plan` : "Profile"}
                >
                  <img src={bispunIcon} alt="Bispun" className="h-full w-full rounded-[10px] object-contain" />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* MAIN WORKSPACE */}
        <div
          className={`flex-1 min-w-0 bg-[#f6f7fa] transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[252px]"
          }`}
        >
          {/* TOP BAR — continuous with sidebar */}
          <header
            className={`hidden lg:block fixed top-0 right-0 z-40 h-[64px] bg-[#f6f7fa]/96 text-slate-900 backdrop-blur-xl transition-[left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              sidebarCollapsed
                ? "left-[72px]"
                : "left-[252px]"
            }`}
          >
            <div className="h-full px-4 sm:px-6 lg:px-7 flex items-center gap-4">
              

              <div className="relative min-w-0 flex-1 max-w-[520px]">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="client-global-search"
                  value={workspaceSearch}
                  onChange={(event) => setWorkspaceSearch(event.target.value)}
                  placeholder="Search portal..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-[12px] font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
                {workspaceSearch && (
                  <button type="button" onClick={() => setWorkspaceSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Clear portal search">
                    <X size={14} />
                  </button>
                )}
                {workspaceSearch.trim() && (
                  <div className="absolute left-0 right-0 top-[46px] z-[95] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
                    {NAV_GROUPS.flatMap((group) =>
                      group.items.map((key) => ({
                        key,
                        groupLabel: group.label,
                        label: key === "dashboard" ? "Dashboard" : key === "settings" ? "Settings" : MODULE_META[key]?.label || group.label || key,
                      }))
                    )
                      .filter((item, index, all) => all.findIndex((candidate) => candidate.key === item.key) === index)
                      .filter((item) => {
                        const query = workspaceSearch.trim().toLowerCase();
                        return item.label.toLowerCase().includes(query) || item.groupLabel.toLowerCase().includes(query) || item.key.toLowerCase().includes(query);
                      })
                      .slice(0, 10)
                      .map((item) => (
                        <button key={item.key} type="button" onClick={() => { setModule(item.key); setWorkspaceSearch(""); setMobileSidebarOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-slate-50">
                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-semibold text-slate-900">{item.label}</div>
                            <div className="mt-0.5 text-[12px] text-slate-500">{item.groupLabel}</div>
                          </div>
                          <ChevronRight size={14} className="text-slate-300" />
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                {/* GLOBAL PERIOD */}
                <div className="hidden md:flex h-9 items-center rounded-xl border border-slate-200/80 bg-white/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
                  <div className="px-3 text-[12px] font-bold uppercase tracking-[0.1em] text-slate-400 border-r border-slate-200">
                    Period
                  </div>

                  <select
                    value={selectedYear}
                    onChange={(event) => {
                      if (event.target.value === "__add_year__") { setYearError(""); setNewWorkspaceYear(""); setAddYearOpen(true); return; }
                      setSelectedYear(event.target.value);
                    }}
                    className="h-full min-w-[108px] bg-transparent px-3 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                    aria-label="Global CRM workspace year"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={String(year)}>{year}</option>
                    ))}
                    <option value="all">All Time</option>
                    <option value="__add_year__">+ Add Year</option>
                  </select>
                </div>

                {/* CALENDAR */}
                <button
                  type="button"
                  onClick={() => setCalendarOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  aria-label="Open calendar"
                  title="Calendar"
                >
                  <CalendarDays size={18} />
                </button>

                {/* NOTIFICATIONS */}
                <div ref={notificationRef} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !notificationsOpen;
                      setNotificationsOpen(next);
                      setProfileMenuOpen(false);

                      if (next) {
                        loadNotifications();
                      }
                    }}
                    className="relative w-9 h-9 rounded-lg text-slate-600 flex items-center justify-center hover:bg-slate-100 hover:text-slate-950"
                    aria-label="Notifications"
                  >
                    <Bell size={18} />

                    {unreadNotificationCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-brand-600 text-white text-[13px] font-bold leading-[17px] text-center">
                        {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                      </span>
                    )}
                  </button>

                  {notificationsOpen && (
                    <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div className="text-sm font-bold text-slate-950">
                          Notifications
                        </div>

                        {unreadNotificationCount > 0 && (
                          <button
                            type="button"
                            onClick={markAllNotificationsRead}
                            className="text-[13px] font-semibold text-indigo-600"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-[420px] overflow-y-auto">
                        {notificationsLoading ? (
                          <div className="py-10 flex items-center justify-center gap-2 text-xs text-slate-500">
                            <Loader2 size={14} className="animate-spin" />
                            Loading...
                          </div>
                        ) : notificationError ? (
                          <div className="p-4 text-xs text-rose-600">
                            {notificationError}
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="py-10 text-center text-xs text-slate-500">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.map((notification) => (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => markNotificationRead(notification)}
                              className={`w-full px-4 py-3 text-left border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                                notification.read
                                  ? "bg-white"
                                  : "bg-indigo-50/30"
                              }`}
                            >
                              <div className="text-xs font-bold text-slate-900">
                                {notification.title}
                              </div>

                              <div className="mt-1 text-[13px] leading-5 text-slate-500 break-words">
                                {notification.message}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </header>

          {/* MAIN CONTENT */}
          <main className="mt-14 min-h-[calc(100vh-56px)] bg-[#f6f7fa] px-3 pt-3 pb-4 sm:px-5 sm:pt-4 sm:pb-5 lg:mt-[64px] lg:min-h-[calc(100vh-64px)] lg:px-6 lg:pt-4 lg:pb-6">
            <div className="max-w-[1560px] mx-auto">
              {renderModule()}
            </div>
          </main>
        </div>
      </div>

      {billingOpen && (
        <div className="fixed inset-0 z-[95] bg-slate-950/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-5xl max-h-[94vh] sm:max-h-[90vh] bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-base font-bold text-slate-950">
                  Billing & Subscription
                </div>

                <div className="text-xs text-slate-500 mt-1">
                  Review plans, billing cycles and upgrade options for {company.name}.
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setBillingOpen(false)
                }
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {billingError && (
                <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <AlertCircle
                    size={14}
                    className="mt-0.5 flex-shrink-0"
                  />
                  {billingError}
                </div>
              )}

              {billingLoading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Loading subscription...
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-[12px] uppercase tracking-wider font-semibold text-slate-400">
                        Current Subscription
                      </div>

                      <div className="text-sm font-bold text-slate-900 mt-1">
                        {billingData.subscription
                          ?.plan?.name ||
                          "No active subscription"}
                      </div>

                      {billingData.subscription && (
                        <div className="text-xs text-slate-500 mt-1">
                          Annual · Renewal{" "}
                          {billingData.subscription.renewalDate
                            ? new Date(
                                billingData.subscription.renewalDate
                              ).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )
                            : "—"}
                        </div>
                      )}

                      {billingData.subscription &&
                        Number(
                          billingData.subscription
                            .discountAmount || 0
                        ) > 0 && (
                          <div className="mt-2 text-xs text-slate-600">
                            <span className="text-slate-400 line-through">
                              ₹
                              {Number(
                                billingData.subscription
                                  .listPrice || 0
                              ).toLocaleString("en-IN")}
                            </span>{" "}
                            <span className="text-rose-600 font-medium">
                              (− ₹
                              {Number(
                                billingData.subscription
                                  .discountAmount || 0
                              ).toLocaleString("en-IN")}
                              )
                            </span>{" "}
                            <span className="font-bold text-slate-900">
                              You pay ₹
                              {Number(
                                billingData.subscription
                                  .finalAmount ||
                                  billingData.subscription
                                    .amount ||
                                  0
                              ).toLocaleString("en-IN")}
                            </span>
                          </div>
                        )}
                    </div>

                    {billingData.subscription && (
                      <div className="text-right">
                        <div className="text-xs text-slate-500">
                          Status
                        </div>
                        <div className="text-sm font-bold text-indigo-600 mt-0.5">
                          {billingData.subscription.status}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="rounded-2xl border border-slate-200 bg-[#f8f9fb] px-4 py-5 sm:px-6 sm:py-6">
                    <div className="mx-auto max-w-2xl text-center">
                      <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">
                        Pricing Plans
                      </div>

                      <h2 className="mt-1.5 text-[24px] font-bold tracking-[-0.035em] text-slate-950 sm:text-[28px]">
                        Choose the right plan for your business
                      </h2>

                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Compare annual plans and upgrade without changing your existing CRM data.
                      </p>

                      <div className="mt-5 flex justify-center">
                        <div className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700">
                          Annual billing
                        </div>
                      </div>
                    </div>

                    <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-3">
                      {billingData.plans.map((billingPlan) => {
                        const isCurrent =
                          billingData.subscription?.plan?.key === billingPlan.key;

                        const isPopular =
                          String(billingPlan.key || "").toLowerCase() === "pro";

                        const yearlyAvailable =
                          billingPlan.yearlyPrice !== null &&
                          billingPlan.yearlyPrice !== undefined;

                        const planKey =
                          String(billingPlan.key || "").toLowerCase();

                        const isProPlan = planKey === "pro";
                        const proOfferPrice = 29500;
                        const proListPrice = 54000;
                        const proOfferEndsAt = new Date("2026-11-10T23:59:59+05:30").getTime();
                        const isProOfferActive =
                          isProPlan && Date.now() <= proOfferEndsAt;

                        const selectedPrice =
                          yearlyAvailable
                            ? isProOfferActive
                              ? proOfferPrice
                              : Number(billingPlan.yearlyPrice || 0)
                            : 0;

                        const planDescriptions = {
                          basic:
                            "Essential CRM tools for teams getting started.",
                          pro:
                            "Built for growing consultancies that need more operational control.",
                          advanced:
                            "Complete CRM flexibility for larger and more complex operations.",
                        };

                        const featureMap = {
                          basic: [
                            "Dashboard & core analytics",
                            "UTM Leads & Lead Store",
                            "Admissions management",
                            "Revenue tracking",
                            "In-app notifications",
                            "Standard support",
                          ],
                          pro: [
                            "Everything in Basic",
                            "Walk-ins module",
                            "Counselling module",
                            "Advanced analytics",
                            "Expanded team workflows",
                            "Priority support",
                          ],
                          advanced: [
                            "Everything in Pro",
                            "Advanced customization access",
                            "White-label capabilities",
                            "Premium operational controls",
                            "Customization request support",
                            "Priority assistance",
                          ],
                        };

                        const description =
                          planDescriptions[planKey] ||
                          billingPlan.tagline ||
                          "Flexible CRM tools for your business.";

                        const features =
                          featureMap[planKey] || [];

                        return (
                          <div
                            key={billingPlan.id}
                            className={`relative overflow-hidden rounded-[22px] border transition-all duration-300 ${
                              isPopular
                                ? "border-brand-400 bg-brand-900 text-white shadow-brand-lg"
                                : "border-slate-200 bg-white text-slate-950 shadow-[0_8px_24px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
                            }`}
                          >
                            {isPopular && (
                              <div className="flex items-center justify-center border-b border-brand-300/20 bg-brand-800/70 px-4 py-2.5">
                                <span className="rounded-full bg-brand-700/70 px-3 py-1 text-[12px] font-black uppercase tracking-[0.08em] text-brand-50 ring-1 ring-inset ring-brand-300/40">
                                  Most Popular
                                </span>
                              </div>
                            )}

                            <div className="p-5 sm:p-6">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div
                                    className={`text-[12px] font-black uppercase tracking-[0.12em] ${
                                      isPopular
                                        ? "text-brand-200"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {billingPlan.name}
                                  </div>

                                  <div
                                    className={`mt-3 text-[14px] font-semibold leading-5 ${
                                      isPopular
                                        ? "text-white"
                                        : "text-slate-900"
                                    }`}
                                  >
                                    {description}
                                  </div>
                                </div>

                                {isCurrent && (
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[13px] font-bold uppercase tracking-wide ${
                                      isPopular
                                        ? "bg-brand-800/70 text-white ring-1 ring-inset ring-brand-300/30"
                                        : "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100"
                                    }`}
                                  >
                                    Current
                                  </span>
                                )}
                              </div>

                              <div className="mt-6">
                                {isProOfferActive && yearlyAvailable && (
                                  <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <span className="text-[15px] font-semibold text-brand-200 line-through decoration-2">
                                      ₹{proListPrice.toLocaleString("en-IN")}/year
                                    </span>
                                    <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-emerald-300 ring-1 ring-inset ring-emerald-300/30">
                                      ~45% OFF
                                    </span>
                                  </div>
                                )}

                                <div className="flex items-end gap-1.5">
                                  <div
                                    className={`text-[32px] font-black tracking-[-0.05em] ${
                                      isPopular
                                        ? "text-white"
                                        : "text-slate-950"
                                    }`}
                                  >
                                    ₹{selectedPrice.toLocaleString("en-IN")}
                                  </div>

                                  <div
                                    className={`pb-1.5 text-[13px] font-medium ${
                                      isPopular
                                        ? "text-brand-100"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    /year
                                  </div>
                                </div>

                                {isProOfferActive && yearlyAvailable && (
                                  <div className="mt-1.5 text-[11px] font-semibold text-brand-200">
                                    Offer valid till Nov 10, 2026
                                  </div>
                                )}
                              </div>

                              <div
                                className={`my-5 h-px ${
                                  isPopular
                                    ? "bg-brand-700"
                                    : "bg-slate-100"
                                }`}
                              />

                              <div className="space-y-3">
                                {features.map((feature) => (
                                  <div
                                    key={feature}
                                    className={`flex items-start gap-2.5 text-xs leading-5 ${
                                      isPopular
                                        ? "text-brand-100"
                                        : "text-slate-600"
                                    }`}
                                  >
                                    <CheckCircle2
                                      size={14}
                                      className={`mt-0.5 flex-shrink-0 ${
                                        isPopular
                                          ? "text-brand-200"
                                          : "text-brand-600"
                                      }`}
                                    />
                                    <span>{feature}</span>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-7">
                                {isCurrent ? (
                                  <button
                                    type="button"
                                    disabled
                                    className={`h-11 w-full rounded-xl text-xs font-bold ${
                                      isPopular
                                        ? "bg-white text-brand-700"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    Current Plan
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={
                                      Boolean(paymentProcessing) ||
                                      !yearlyAvailable
                                    }
                                    onClick={() =>
                                      startSubscriptionPayment(
                                        billingPlan.key
                                      )
                                    }
                                    className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                                      isPopular
                                        ? "bg-white text-brand-700 hover:bg-brand-50"
                                        : "bg-brand-600 text-white hover:bg-brand-700"
                                    }`}
                                  >
                                    {paymentProcessing ===
                                      `${billingPlan.key}:YEARLY` && (
                                      <Loader2
                                        size={13}
                                        className="animate-spin"
                                      />
                                    )}

                                    {!yearlyAvailable
                                      ? "Annual plan unavailable"
                                      : `Upgrade to ${billingPlan.name}`}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mx-auto mt-5 max-w-2xl text-center text-[12px] leading-5 text-slate-500">
                      Your existing CRM records remain unchanged when you upgrade. New plan capabilities become available after successful payment verification.
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <CalendarClock
                        size={14}
                        className="text-indigo-600"
                      />
                      <div className="text-sm font-bold text-slate-900">
                        Recent Payments
                      </div>
                    </div>

                    <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
                      {billingData.payments.length ? (
                        billingData.payments.map(
                          (payment) => (
                            <div
                              key={payment.id}
                              className="px-4 py-3 border-b border-slate-100 last:border-0 flex items-center justify-between gap-3"
                            >
                              <div>
                                <div className="text-xs font-semibold text-slate-800">
                                  {payment.plan.name} · Annual
                                </div>
                                <div className="text-[12px] text-slate-500 mt-0.5">
                                  {new Date(
                                    payment.paidAt ||
                                      payment.createdAt
                                  ).toLocaleDateString(
                                    "en-IN"
                                  )}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-xs font-bold text-slate-900">
                                  ₹{Number(
                                    payment.amount
                                  ).toLocaleString("en-IN")}
                                </div>
                                <div
                                  className={`text-[12px] font-semibold mt-0.5 ${
                                    payment.status ===
                                    "CAPTURED"
                                      ? "text-indigo-600"
                                      : payment.status ===
                                        "FAILED"
                                      ? "text-rose-600"
                                      : "text-amber-600"
                                  }`}
                                >
                                  {payment.status}
                                </div>

                                {payment.status === "CAPTURED" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openPaymentReceipt(
                                        payment.id
                                      )
                                    }
                                    className="mt-1.5 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700"
                                  >
                                    View Receipt
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        )
                      ) : (
                        <div className="py-8 text-center text-xs text-slate-500">
                          No payment history yet.
                        </div>
                      )}
                    </div>
                  </div>

                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {receiptOpen && (
        <div
          id="consulbuzz-payment-receipt-print-root"
          className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-[3px] p-2 sm:p-3 overflow-y-auto"
        >
          <div className="max-w-[780px] mx-auto">
            <div className="flex items-center justify-between gap-3 mb-3 print:hidden">
              <button
                type="button"
                onClick={() => {
                  setReceiptOpen(false);
                  setReceiptData(null);
                }}
                className="h-9 px-3 rounded-xl border border-white/20 bg-white/10 text-white text-xs font-semibold hover:bg-white/15"
              >
                Close
              </button>

              {receiptData && (
                <button
                  type="button"
                  onClick={printReceipt}
                  className="h-9 px-4 rounded-xl bg-white text-slate-950 text-xs font-semibold shadow-sm"
                >
                  Print / Save PDF
                </button>
              )}
            </div>

            <div
              id="consulbuzz-payment-receipt"
              className="bg-white rounded-[24px] shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:text-[13px]"
            >
              {receiptLoading ? (
                <div className="py-24 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  Loading receipt...
                </div>
              ) : receiptData ? (
                <>
                  <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-6">
                      <div>
                        <div className="flex items-center gap-3">
                          <img
                            src={bispunLogo}
                            alt="Bispun"
                            className="h-11 w-auto object-contain"
                          />

                          <div className="text-[12px] uppercase tracking-[0.12em] font-semibold text-slate-400">
                            CRM Subscription
                          </div>
                        </div>

                        <div className="mt-5 text-[13px] font-bold uppercase tracking-[0.14em] text-slate-400">
                          Payment Receipt
                        </div>

                        <div className="mt-1.5 text-[25px] sm:text-[30px] leading-none font-black tracking-[-0.045em] text-slate-950">
                          ₹{Number(
                            receiptData.amount || 0
                          ).toLocaleString("en-IN")}
                        </div>

                        <div className="mt-1.5 text-[12px] font-semibold text-emerald-600">
                          Payment successful
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                          <CheckCircle2 size={12} />
                          Paid
                        </div>

                        <div className="mt-3 text-[13px] text-slate-400">
                          Receipt No.
                        </div>
                        <div className="mt-1 text-xs font-bold text-slate-800 break-all max-w-[220px]">
                          {receiptData.receiptNumber || receiptData.id}
                        </div>

                        <div className="mt-2 text-[13px] text-slate-400">
                          Payment Date
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-700">
                          {new Date(
                            receiptData.paidAt ||
                              receiptData.createdAt
                          ).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 sm:px-8 py-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Billed To
                        </div>

                        <div className="mt-3 text-sm font-bold text-slate-950">
                          {receiptData.company?.brandName ||
                            receiptData.company?.name ||
                            company.name}
                        </div>

                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          {receiptData.company?.email || company.email || "—"}
                          <br />
                          {receiptData.company?.phone || company.phone || ""}
                          {receiptData.company?.city
                            ? ` · ${receiptData.company.city}`
                            : company.city
                            ? ` · ${company.city}`
                            : ""}
                        </div>
                      </div>

                      <div>
                        <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Subscription
                        </div>

                        <div className="mt-3 text-sm font-bold text-slate-950">
                          {receiptData.plan?.name} Plan
                        </div>

                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          Annual Billing
                          <br />
                          Renewal:{" "}
                          {receiptData.subscription?.renewalDate
                            ? new Date(
                                receiptData.subscription.renewalDate
                              ).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl border border-slate-200 overflow-hidden">
                      <div className="grid grid-cols-[1fr_auto] bg-slate-50 px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-slate-400">
                        <div>Description</div>
                        <div>Amount</div>
                      </div>

                      <div className="grid grid-cols-[1fr_auto] px-4 py-3 border-t border-slate-100">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            Bispun {receiptData.plan?.name} Plan
                          </div>
                          <div className="mt-1 text-[13px] text-slate-500">
                            Annual CRM subscription
                          </div>
                        </div>

                        <div className="text-sm font-bold text-slate-950">
                          ₹{Number(
                            receiptData.listPrice ??
                              receiptData.amount ??
                              0
                          ).toLocaleString("en-IN")}
                        </div>
                      </div>

                      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Original Price</span>
                          <span className="font-semibold text-slate-800">
                            ₹{Number(
                              receiptData.listPrice ??
                                receiptData.amount ??
                                0
                            ).toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-slate-500">Discount</span>
                          <span
                            className={`font-semibold ${
                              Number(
                                receiptData.discountAmount || 0
                              ) > 0
                                ? "text-rose-600"
                                : "text-slate-500"
                            }`}
                          >
                            {Number(
                              receiptData.discountAmount || 0
                            ) > 0
                              ? `− ₹${Number(
                                  receiptData.discountAmount
                                ).toLocaleString("en-IN")}`
                              : "No discount"}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-slate-500">Subtotal</span>
                          <span className="font-semibold text-slate-800">
                            ₹{Number(
                              receiptData.subtotal ??
                                (Number(receiptData.listPrice ?? receiptData.amount ?? 0) -
                                  Number(receiptData.discountAmount || 0))
                            ).toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-slate-500">GST (18%)</span>
                          <span className="font-semibold text-slate-800">
                            ₹{Number(
                              receiptData.gstAmount ??
                                (Number(receiptData.subtotal ?? 0) * 0.18)
                            ).toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-200 flex items-end justify-between gap-3">
                          <span className="text-sm font-bold text-slate-950">
                            Total Paid
                          </span>
                          <span className="text-[19px] font-black tracking-tight text-slate-950">
                            ₹{Number(
                              receiptData.finalAmount ??
                                receiptData.amount ??
                                0
                            ).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Payment Details
                      </div>

                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {[
                          ["Payment Method", "Razorpay"],
                          ["Currency", receiptData.currency || "INR"],
                          ["Payment ID", receiptData.providerPaymentId || "—"],
                          ["Order ID", receiptData.providerOrderId || "—"],
                          ["Status", receiptData.status || "CAPTURED"],
                          [
                            "Billing Cycle",
                            "Annual",
                          ],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="border-b border-slate-100 pb-2"
                          >
                            <div className="text-[12px] text-slate-400">
                              {label}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-800 break-all">
                              {value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          Thank you for choosing Bispun.
                        </div>
                        <div className="mt-1 text-[13px] text-slate-500">
                          This receipt confirms successful payment for your CRM subscription.
                        </div>
                      </div>

                      <div className="text-[12px] text-slate-400 sm:text-right">
                        Bispun CRM
                        <br />
                        Subscription Receipt
                        <br />
                        <span className="font-semibold text-slate-600">WOWAYS PRIVATE LIMITED</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <CalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        currentUser={user}
      />

      {addYearOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <form onSubmit={createYearWorkspace} className="w-full max-w-lg overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div><div className="text-[12px] font-bold uppercase tracking-[0.14em] text-indigo-500">CRM Year Workspace</div><h2 className="mt-1 text-xl font-bold text-slate-950">Add Year</h2><p className="mt-1 text-xs leading-5 text-slate-500">Create a fresh historical workspace. Existing {selectedYear} data stays untouched.</p></div>
              <button type="button" onClick={() => setAddYearOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"><X size={17}/></button>
            </div>
            <div className="space-y-5 px-6 py-5">
              <div><label className="mb-1.5 block text-xs font-bold text-slate-700">Year</label><input type="number" min="2000" max="2100" value={newWorkspaceYear} onChange={(e)=>setNewWorkspaceYear(e.target.value)} placeholder="Example: 2025" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-indigo-400" autoFocus/></div>
              <div><div className="mb-2 text-xs font-bold text-slate-700">How should this year start?</div><div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={()=>setYearMode("EMPTY")} className={`rounded-2xl border p-4 text-left ${yearMode === "EMPTY" ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200"}`}><div className="text-sm font-bold">Start Empty</div><div className="mt-1 text-[13px] leading-5 text-slate-500">Yearly leads, admissions, revenue and activity start empty.</div></button>
                <button type="button" onClick={()=>setYearMode("COPY_STRUCTURE")} className={`rounded-2xl border p-4 text-left ${yearMode === "COPY_STRUCTURE" ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200"}`}><div className="text-sm font-bold">Use Current Setup</div><div className="mt-1 text-[13px] leading-5 text-slate-500">Keep company setup and admission structure, but no yearly records.</div></button>
              </div></div>
              {yearError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">{yearError}</div>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4"><button type="button" onClick={()=>setAddYearOpen(false)} disabled={yearSaving} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold">Cancel</button><button type="submit" disabled={yearSaving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white disabled:opacity-50">{yearSaving ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} {yearSaving ? "Creating..." : "Create & Open Year"}</button></div>
          </form>
        </div>
      )}

      {changePasswordOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-base font-bold text-slate-950">
                  Change Password
                </div>

                <div className="text-xs text-slate-500 mt-1">
                  Update the password for {user.email}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setChangePasswordOpen(false)
                }
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
                disabled={passwordSaving}
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={
                submitPasswordChange
              }
              className="p-5 space-y-4"
            >
              {[
                [
                  "currentPassword",
                  "Current Password",
                ],
                [
                  "newPassword",
                  "New Password",
                ],
                [
                  "confirmPassword",
                  "Confirm New Password",
                ],
              ].map(
                ([
                  key,
                  label,
                ]) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      {label}
                    </label>

                    <div className="relative">
                      <input
                        type={
                          passwordVisibility[
                            key
                          ]
                            ? "text"
                            : "password"
                        }
                        value={
                          passwordForm[
                            key
                          ]
                        }
                        onChange={(
                          event
                        ) =>
                          updatePasswordField(
                            key,
                            event.target.value
                          )
                        }
                        required
                        autoComplete={
                          key ===
                          "currentPassword"
                            ? "current-password"
                            : "new-password"
                        }
                        className="w-full h-10 px-3 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setPasswordVisibility(
                            (
                              current
                            ) => ({
                              ...current,
                              [key]:
                                !current[
                                  key
                                ],
                            })
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {passwordVisibility[
                          key
                        ] ? (
                          <EyeOff
                            size={15}
                          />
                        ) : (
                          <Eye
                            size={15}
                          />
                        )}
                      </button>
                    </div>
                  </div>
                )
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[13px] text-slate-500 leading-5">
                Password must be at least 8 characters and include uppercase, lowercase and a number.
              </div>

              {passwordError && (
                <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <AlertCircle
                    size={14}
                    className="mt-0.5 flex-shrink-0"
                  />
                  {passwordError}
                </div>
              )}

              {passwordMessage && (
                <div className="flex items-start gap-2 text-xs text-indigo-700 bg-indigo-50 border border-emerald-200 rounded-lg p-3">
                  <CheckCircle2
                    size={14}
                    className="mt-0.5 flex-shrink-0"
                  />
                  {passwordMessage}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setChangePasswordOpen(
                      false
                    )
                  }
                  disabled={
                    passwordSaving
                  }
                  className="h-9 px-4 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    passwordSaving
                  }
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 shadow-sm"
                >
                  {passwordSaving && (
                    <Loader2
                      size={14}
                      className="animate-spin"
                    />
                  )}

                  {passwordSaving
                    ? "Updating..."
                    : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
