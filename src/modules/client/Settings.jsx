import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Building,
  Palette,
  Users,
  Layers,
  FileCheck,
  Bell,
  Save,
  ShieldCheck,
  Upload,
  Check,
  Globe2,
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
} from "lucide-react";

import {
  apiRequest,
} from "../../lib/api";

import { applyBrandTheme, BRAND_COLORS, BRAND_PALETTE, brandHex } from "../../lib/brandTheme";
import PermissionTree, {
  emptyPageAccess,
  normalizeClientPageAccess,
} from "../../components/client/PermissionTree";

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

const TABS = [
  {
    k: "company",
    l: "Company",
    i: Building,
  },
  {
    k: "branding",
    l: "Branding",
    i: Palette,
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
    k: "fields",
    l: "Custom Fields",
    i: FileCheck,
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
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
        {label}
      </label>

      <input
        value={
          value
        }
        onChange={(
          event
        ) =>
          onChange?.(
            event.target
              .value
          )
        }
        disabled={
          disabled
        }
        placeholder={
          placeholder
        }
        className={`w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-500 ${
          mono
            ? "font-mono"
            : ""
        }`}
      />
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

        <p className="mt-2 text-[15px] leading-relaxed text-slate-500">
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

export default function SettingsView({
  tenant,
  primaryColor,
  currentUser,
  onWorkspaceUpdated,
}) {
  const [
    tab,
    setTab,
  ] = useState(
    "company"
  );

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

  // Load status when opening the Integrations tab, and show the result of a
  // just-completed OAuth redirect (?google=connected|error|norefresh).
  useEffect(() => {
    if (tab !== "integrations") return;
    loadGoogleStatus();
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

  const [organization, setOrganization] = useState({ departments: [], roles: [] });
  const [organizationLoading, setOrganizationLoading] = useState(false);
  const [organizationModal, setOrganizationModal] = useState(null);
  const [organizationSaving, setOrganizationSaving] = useState(false);
  const emptyOrganizationForm = {
    name: "",
    code: "",
    baseRole: "EMPLOYEE",
    permissions: {
      canManageUsers: false, canManageSettings: false, canManageBilling: false,
      canViewAnalytics: false, canManageAdmissions: false, canManageRevenue: false,
      canManageLeads: false, canManageSupport: false, canViewTeamTargets: false,
    },
  };
  const [organizationForm, setOrganizationForm] = useState(emptyOrganizationForm);
  const [usersManagementTab, setUsersManagementTab] = useState("users");

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
    customFields,
    setCustomFields,
  ] = useState([]);

  const [
    customFieldsLoading,
    setCustomFieldsLoading,
  ] = useState(false);

  const [
    customFieldsError,
    setCustomFieldsError,
  ] = useState("");

  const [
    customFieldModalOpen,
    setCustomFieldModalOpen,
  ] = useState(false);

  const [
    editingCustomField,
    setEditingCustomField,
  ] = useState(null);

  const [
    customFieldSaving,
    setCustomFieldSaving,
  ] = useState(false);

  const emptyCustomFieldForm = {
    name: "",
    key: "",
    entityType: "LEAD",
    fieldType: "TEXT",
    description: "",
    required: false,
    showInForms: true,
    active: true,
    sortOrder: 100,
    optionsText: "",
  };

  const [
    customFieldForm,
    setCustomFieldForm,
  ] = useState(
    emptyCustomFieldForm
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
    loadWorkspaceSettings();
  }, []);

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
    setOrganizationForm(emptyOrganizationForm);
    setUsersError("");
  }

  async function saveOrganizationItem() {
    setOrganizationSaving(true);
    setUsersError("");
    try {
      const endpoint = organizationModal === "department" ? "departments" : "roles";
      const payload = {
        name: organizationForm.name,
        code: organizationForm.code,
        permissions: organizationForm.permissions,
        ...(organizationModal === "role" ? { baseRole: organizationForm.baseRole } : {}),
      };
      const data = await apiRequest(`/api/client/users/${endpoint}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOrganization({
        departments: data.departments || [],
        roles: data.roles || [],
      });
      showSettingsSuccess(
        organizationModal === "department"
          ? "Department added successfully"
          : "Role added successfully"
      );
      setOrganizationModal(null);
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
      const endpoint = type === "department" ? "departments" : "roles";
      const data = await apiRequest(`/api/client/users/${endpoint}/${id}`, { method: "DELETE" });
      setOrganization({ departments: data.departments || [], roles: data.roles || [] });
      showSettingsSuccess(
        type === "department"
          ? "Department deleted successfully"
          : "Role deleted successfully"
      );
    } catch (error) {
      setUsersError(error?.data?.message || `Unable to delete ${type}`);
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
        canManageRevenue: true,
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
        department:
          userForm.department,
        managerId:
          userForm.role === "EMPLOYEE" ? (userForm.managerId || null) : null,
        active: userForm.active,
        permissions:
          userForm.permissions,
        pageAccess:
          userForm.pageAccess,
      };

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


  async function loadCustomFields() {
    setCustomFieldsLoading(true);
    setCustomFieldsError("");

    try {
      const data =
        await apiRequest(
          "/api/client/custom-fields?entityType=LEAD"
        );

      setCustomFields(
        data.fields || []
      );
    } catch (error) {
      setCustomFieldsError(
        error?.data?.message ||
          "Unable to load custom fields"
      );
    } finally {
      setCustomFieldsLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "fields") {
      loadCustomFields();
    }
  }, [tab]);

  function openCreateCustomField() {
    setEditingCustomField(null);
    setCustomFieldForm(
      emptyCustomFieldForm
    );
    setCustomFieldsError("");
    setCustomFieldModalOpen(true);
  }

  function openEditCustomField(field) {
    setEditingCustomField(field);

    setCustomFieldForm({
      name: field.name || "",
      key: field.key || "",
      entityType:
        field.entityType || "LEAD",
      fieldType:
        field.fieldType || "TEXT",
      description:
        field.description || "",
      required:
        field.required === true,
      showInForms:
        field.showInForms !== false,
      active:
        field.active !== false,
      sortOrder:
        field.sortOrder ?? 100,
      optionsText:
        Array.isArray(
          field.options
        )
          ? field.options.join("\n")
          : "",
    });

    setCustomFieldsError("");
    setCustomFieldModalOpen(true);
  }

  async function saveCustomField() {
    setCustomFieldSaving(true);
    setCustomFieldsError("");

    try {
      const payload = {
        name:
          customFieldForm.name,
        key:
          customFieldForm.key,
        entityType:
          customFieldForm.entityType,
        fieldType:
          customFieldForm.fieldType,
        description:
          customFieldForm.description,
        required:
          customFieldForm.required,
        showInForms:
          customFieldForm.showInForms,
        active:
          customFieldForm.active,
        sortOrder:
          Number(
            customFieldForm.sortOrder
          ),
        options:
          customFieldForm.fieldType ===
          "DROPDOWN"
            ? customFieldForm.optionsText
                .split(/\n|,/)
                .map(
                  (item) =>
                    item.trim()
                )
                .filter(Boolean)
            : [],
      };

      const data =
        await apiRequest(
          editingCustomField
            ? `/api/client/custom-fields/${editingCustomField.id}`
            : "/api/client/custom-fields",
          {
            method:
              editingCustomField
                ? "PATCH"
                : "POST",
            body:
              JSON.stringify(
                payload
              ),
          }
        );

      setCustomFields(
        (current) => {
          const next =
            editingCustomField
              ? current.map(
                  (item) =>
                    item.id ===
                    data.field.id
                      ? data.field
                      : item
                )
              : [
                  ...current,
                  data.field,
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
        editingCustomField
          ? "Custom field updated successfully"
          : "Custom field added successfully"
      );
      setCustomFieldModalOpen(false);
      setEditingCustomField(null);
    } catch (error) {
      setCustomFieldsError(
        error?.data?.message ||
          "Unable to save custom field"
      );
    } finally {
      setCustomFieldSaving(false);
    }
  }

  async function toggleCustomField(
    field,
    property
  ) {
    try {
      const data =
        await apiRequest(
          `/api/client/custom-fields/${field.id}`,
          {
            method: "PATCH",
            body:
              JSON.stringify({
                [property]:
                  !field[property],
              }),
          }
        );

      setCustomFields(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              data.field.id
                ? data.field
                : item
          )
      );
      showSettingsSuccess("Custom field updated successfully");
    } catch (error) {
      setCustomFieldsError(
        error?.data?.message ||
          "Unable to update custom field"
      );
    }
  }

  async function deleteCustomField(
    field
  ) {
    if (
      !window.confirm(
        `Delete "${field.name}"? Existing values for this field will also be deleted.`
      )
    ) {
      return;
    }

    try {
      await apiRequest(
        `/api/client/custom-fields/${field.id}`,
        {
          method: "DELETE",
        }
      );

      setCustomFields(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              field.id
          )
      );
      showSettingsSuccess("Custom field deleted successfully");
    } catch (error) {
      setCustomFieldsError(
        error?.data?.message ||
          "Unable to delete custom field"
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

          <p className="mt-1 text-[15px] text-slate-500">
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

        {/* HORIZONTAL TAB BAR */}

        <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-wrap gap-1">
            {TABS.map(
              (
                item
              ) => {
                const Icon =
                  item.i;

                const active =
                  tab ===
                  item.k;

                return (
                  <button
                    key={
                      item.k
                    }
                    type="button"
                    onClick={() =>
                      setTab(
                        item.k
                      )
                    }
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-[15px] transition-colors ${
                      active
                        ? "bg-indigo-600 text-white font-semibold shadow-sm"
                        : "text-slate-600 hover:text-indigo-700 hover:bg-indigo-50"
                    }`}
                  >
                    <Icon
                      size={
                        15
                      }
                      className={
                        active
                          ? "text-white"
                          : "text-slate-400"
                      }
                    />

                    <span className="text-left">
                      {
                        item.l
                      }
                    </span>
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* CONTENT */}

        <section
          className={`bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${
            tab === "branding" ? "overflow-visible" : "overflow-hidden"
          }`}
        >
          {tab !== "users" && (
            <div className="px-6 py-5 border-b border-slate-200">
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
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">
                  Company Profile
                </h3>

                <p className="text-[13px] text-slate-500 mt-1">
                  Core workspace identity
                  shown throughout the CRM.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-600 text-[13px] font-bold text-white shadow-sm"
                    >
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Company logo"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        tenant?.short ||
                        "CB"
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-[16px] font-bold text-slate-950">
                        {
                          form.companyName ||
                          tenant?.name ||
                          tenant?.brandName ||
                          "CRM Workspace"
                        }
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-slate-500">
                        {
                          form.subdomain ||
                          tenant?.subdomain ||
                          "Workspace"
                        }
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
                    <div className="inline-flex items-center gap-2 text-slate-600">
                      <Building size={14} className="text-slate-400" />
                      <span className="font-semibold">
                        {
                          form.businessType ||
                          tenant?.business ||
                          "Business not set"
                        }
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-2 text-slate-600">
                      <Globe2 size={14} className="text-slate-400" />
                      <span className="font-semibold">
                        {
                          form.city ||
                          tenant?.city ||
                          "City not set"
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Field
                  label="Company Name"
                  value={
                    form.companyName
                  }
                  onChange={(
                    value
                  ) =>
                    update(
                      "companyName",
                      value
                    )
                  }
                />

                <Field
                  label="Business Type"
                  value={
                    form.businessType
                  }
                  onChange={(
                    value
                  ) =>
                    update(
                      "businessType",
                      value
                    )
                  }
                />

                <Field
                  label="City"
                  value={
                    form.city
                  }
                  onChange={(
                    value
                  ) =>
                    update(
                      "city",
                      value
                    )
                  }
                  placeholder="e.g. Hyderabad"
                />

                <Field
                  label="Subdomain"
                  value={
                    form.subdomain
                  }
                  onChange={(
                    value
                  ) =>
                    update(
                      "subdomain",
                      value
                    )
                  }
                  mono
                />

              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-3">
                <Globe2
                  size={16}
                  className="text-slate-500 mt-0.5"
                />

                <div>
                  <div className="text-[13px] font-semibold text-slate-800">
                    Workspace identity
                  </div>

                  <div className="text-[13px] text-slate-500 mt-1">
                    Company profile changes are saved to this tenant and reflected across the client portal after save.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BRANDING */}

          {tab ===
            "branding" && (
            <div className="p-6 space-y-7">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">
                  Brand Appearance
                </h3>

                <p className="text-[13px] text-slate-500 mt-1">
                  Configure the visual
                  identity used inside the
                  client portal.
                </p>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-3">
                  Primary Color
                </label>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[15px] font-bold text-slate-900">
                        System Colors
                      </div>
                      <div className="mt-1 text-[13px] text-slate-500">
                        Choose a quick brand color or customize the full theme palette.
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                      <span
                        className="h-5 w-5 rounded-full border border-black/10"
                        style={{ backgroundColor: brandHex(selectedColor) }}
                      />
                      <span className="font-mono text-[12px] font-semibold uppercase text-slate-600">
                        {brandHex(selectedColor)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-start gap-4">
                    {QUICK_BRAND_COLORS.map((color) => {
                      const selected =
                        brandHex(selectedColor) === color.hex.toLowerCase();

                      return (
                        <button
                          key={color.key}
                          type="button"
                          title={color.label}
                          aria-label={`Use ${color.label} as the primary brand color`}
                          onClick={() => {
                            setSelectedColor(color.key);
                            setCustomColor(color.hex);
                            applyBrandTheme(color.key);
                          }}
                          className="group flex w-[58px] flex-col items-center gap-2 text-center"
                        >
                          <span
                            style={{ backgroundColor: color.hex }}
                            className={`relative flex h-11 w-11 items-center justify-center rounded-full border border-black/10 ring-offset-2 transition-all group-hover:-translate-y-0.5 ${
                              selected
                                ? "ring-2 ring-brand-600 shadow-[0_6px_14px_rgba(79,70,229,0.18)]"
                                : "ring-2 ring-transparent group-hover:ring-slate-300"
                            }`}
                          >
                            {selected && (
                              <Check
                                size={16}
                                strokeWidth={3}
                                className="text-white drop-shadow-sm"
                              />
                            )}
                          </span>

                          <span
                            className={`text-[12px] font-semibold ${
                              selected ? "text-brand-700" : "text-slate-600"
                            }`}
                          >
                            {color.label}
                          </span>
                        </button>
                      );
                    })}

                    <div className="relative ml-auto">
                      <button
                        type="button"
                        onClick={() =>
                          setCustomPaletteOpen((current) => !current)
                        }
                        className={`group flex min-w-[92px] flex-col items-center gap-2 rounded-xl border px-3 py-2.5 transition-all ${
                          customPaletteOpen
                            ? "border-brand-300 bg-brand-50/70"
                            : "border-dashed border-slate-300 bg-slate-50/50 hover:border-brand-300 hover:bg-brand-50/50"
                        }`}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm ring-1 ring-slate-200">
                          <Plus size={17} />
                        </span>
                        <span className="text-[12px] font-semibold text-slate-700 group-hover:text-brand-700">
                          Customize
                        </span>
                      </button>

                      {customPaletteOpen && (
                        <>
                          <button
                            type="button"
                            className="fixed inset-0 z-[79] cursor-default bg-transparent"
                            aria-label="Close custom color palette"
                            onClick={() => setCustomPaletteOpen(false)}
                          />

                          <div className="fixed right-6 top-1/2 z-[80] w-[360px] max-w-[calc(100vw-48px)] -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
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
                              <div className="grid grid-cols-10 gap-2">
                                {BRAND_PALETTE.map((hex) => {
                                  const selected =
                                    brandHex(selectedColor) === hex.toLowerCase();

                                  return (
                                    <button
                                      key={hex}
                                      type="button"
                                      title={hex.toUpperCase()}
                                      aria-label={`Use ${hex} as the primary brand color`}
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
                                <div className="text-[12px] font-semibold text-slate-800">
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
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={saveWorkspaceSettings}
                    disabled={
                      workspaceSettingsSaving ||
                      workspaceSettingsLoading
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {workspaceSettingsSaving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    {workspaceSettingsSaving ? "Saving..." : "Save Brand Color"}
                  </button>

                  <div className="text-[13px] text-slate-500">
                    Preview is instant. Save to keep this color after refresh.
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-2">
                  Company Logo
                </label>

                <div className="border border-slate-200 rounded-xl p-4 space-y-4">
                  {logoPreview ? (
                    <div className="h-24 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
                      <img
                        src={logoPreview}
                        alt="Company logo preview"
                        onError={() => {
                          setLogoPreview("");
                          setLogoUrlError("Unable to load an image from this logo URL.");
                        }}
                        className="max-h-20 max-w-[220px] object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-24 rounded-xl bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-[13px] text-slate-400">
                      No logo uploaded
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                    <input
                      value={
                        form.logoUrl
                      }
                      type="url"
                      onChange={(
                        event
                      ) => {
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
                      aria-invalid={!!logoUrlError}
                      className={`w-full h-10 px-3 border rounded-lg text-[15px] focus:outline-none focus:ring-2 ${
                        logoUrlError
                          ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                          : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
                      }`}
                    />

                    <label className="h-10 px-4 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-2 cursor-pointer">
                      <Upload size={14} />
                      Upload Logo

                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={
                          handleLogoUpload
                        }
                        className="hidden"
                      />
                    </label>
                  </div>

                  {logoUrlError && (
                    <div className="text-[12px] font-medium text-rose-600">
                      {logoUrlError}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] text-slate-400">
                      PNG, JPG, WEBP or SVG. Maximum 500 KB for local storage.
                    </div>

                    {logoPreview && (
                      <button
                        type="button"
                        onClick={
                          removeLogo
                        }
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                      >
                        Remove logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USERS */}

          {tab ===
            "users" && (
            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">
                  Users & Roles
                </h3>

                <p className="mt-1 text-[13px] text-slate-500">
                  Manage team members, departments and role permissions without showing everything at once.
                </p>
              </div>

              <div className="inline-flex max-w-full items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                {[
                  ["users", "Users", users.length],
                  ["departments", "Departments", organization.departments.length],
                  ["roles", "Roles", organization.roles.length],
                ].map(([key, label, count]) => {
                  const active = usersManagementTab === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setUsersManagementTab(key)}
                      className={`inline-flex h-10 items-center gap-2.5 rounded-lg px-4 text-[15px] font-semibold transition-colors ${
                        active
                          ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
                          : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
                      }`}
                    >
                      <span>{label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                          active
                            ? "bg-indigo-50 text-indigo-600"
                            : "bg-slate-200/70 text-slate-500"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {usersError &&
                !userModalOpen &&
                !organizationModal &&
                !resetPasswordUser && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-700">
                    {usersError}
                  </div>
                )}

              {usersManagementTab === "users" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[14px] font-bold text-slate-900">
                        Team Members
                      </div>
                      <div className="mt-0.5 text-[12px] text-slate-500">
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
                    <div className="flex items-center justify-center gap-2 py-16 text-[15px] text-slate-500">
                      <Loader2 size={16} className="animate-spin" />
                      Loading users...
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[15px]">
                          <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">Employee ID</th>
                              <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">User</th>
                              <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">Role</th>
                              <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">Department</th>
                              <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">Status</th>
                              <th className="px-4 py-3 text-right text-[13px] font-semibold text-slate-500">Actions</th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100">
                            {filteredUsers.map((user) => (
                              <tr key={user.id} className="hover:bg-slate-50/70">
                                <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] font-semibold text-indigo-700">
                                  {user.employeeId || "—"}
                                </td>

                                <td className="px-4 py-3">
                                  <div className="font-semibold text-slate-900">
                                    {user.name}
                                  </div>
                                  <div className="mt-0.5 text-[13px] text-slate-500">
                                    {user.email}
                                  </div>
                                  {user.jobTitle && (
                                    <div className="mt-1 text-[13px] text-slate-400">
                                      {user.jobTitle}
                                    </div>
                                  )}
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
                                  className="py-12 text-center text-[15px] text-slate-500"
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
                      <div className="mt-0.5 text-[12px] text-slate-500">
                        Organize users by team or business function.
                      </div>
                    </div>

                    {currentUser?.role === "CLIENT_ADMIN" && (
                      <button
                        type="button"
                        onClick={() => openOrganizationModal("department")}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700"
                      >
                        <Plus size={14} />
                        Add Department
                      </button>
                    )}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="divide-y divide-slate-100">
                      {organization.departments.map((department) => {
                        const memberCount = users.filter(
                          (user) => user.department === department.name
                        ).length;

                        return (
                          <div
                            key={department.id}
                            className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-slate-50/70"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13px] font-semibold text-slate-800">
                                  {department.name}
                                </span>
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
                                  {department.code}
                                </span>
                                {department.system && (
                                  <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                                    Default
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-[11px] text-slate-400">
                                {memberCount} {memberCount === 1 ? "member" : "members"}
                              </div>
                            </div>

                            {!department.system && currentUser?.role === "CLIENT_ADMIN" && (
                              <button
                                type="button"
                                onClick={() => deleteOrganizationItem("department", department.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                title="Delete department"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {!organization.departments.length && (
                        <div className="px-4 py-12 text-center text-[13px] text-slate-400">
                          No departments yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {usersManagementTab === "roles" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[14px] font-bold text-slate-900">
                        Custom Roles
                      </div>
                      <div className="mt-0.5 text-[12px] text-slate-500">
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

                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="divide-y divide-slate-100">
                      {organization.roles.length ? (
                        organization.roles.map((role) => {
                          const memberCount = users.filter(
                            (user) => user.customRoleId === role.id || user.customRoleName === role.name
                          ).length;

                          return (
                            <div
                              key={role.id}
                              className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-slate-50/70"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[13px] font-semibold text-slate-800">
                                    {role.name}
                                  </span>
                                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
                                    {role.code}
                                  </span>
                                </div>
                                <div className="mt-1 text-[11px] text-slate-400">
                                  {memberCount} {memberCount === 1 ? "member" : "members"}
                                </div>
                              </div>

                              {currentUser?.role === "CLIENT_ADMIN" && (
                                <button
                                  type="button"
                                  onClick={() => deleteOrganizationItem("role", role.id)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                  title="Delete role"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-4 py-12 text-center">
                          <div className="text-[13px] font-semibold text-slate-500">
                            No custom roles yet
                          </div>
                          <div className="mt-1 text-[12px] text-slate-400">
                            Add a role when you need reusable access rules.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SOURCES */}

          {tab ===
            "sources" && (
            <div className="p-6 space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">
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

              {sourcesError && !sourceModalOpen && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-[13px]">
                  {sourcesError}
                </div>
              )}

              {sourcesLoading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-[15px] text-slate-500">
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Loading lead sources...
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[15px]">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">
                            Order
                          </th>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">
                            Source
                          </th>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">
                            Key
                          </th>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">
                            Active
                          </th>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">
                            Forms
                          </th>
                          <th className="px-4 py-3 text-right text-[13px] font-semibold text-slate-500">
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
                                  <span className="inline-flex mt-1.5 rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wide">
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
                                      ? "bg-emerald-600"
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
                              className="py-12 text-center text-[15px] text-slate-500"
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

          {/* FIELDS */}

          {tab ===
            "fields" && (
            <div className="p-6 space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">
                    Custom Fields
                  </h3>

                  <p className="text-[13px] text-slate-500 mt-1">
                    Create company-specific fields for lead forms and records without changing the database schema each time.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    openCreateCustomField
                  }
                  className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold rounded-lg inline-flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus size={14} />
                  Add Custom Field
                </button>
              </div>

              {customFieldsError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-[13px]">
                  {customFieldsError}
                </div>
              )}

              {customFieldsLoading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-[15px] text-slate-500">
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Loading custom fields...
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[15px]">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">
                            Field
                          </th>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">
                            Required
                          </th>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">
                            Forms
                          </th>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">
                            Active
                          </th>
                          <th className="px-4 py-3 text-right text-[13px] font-semibold text-slate-500">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {customFields.map(
                          (field) => (
                            <tr
                              key={
                                field.id
                              }
                              className="hover:bg-slate-50/70"
                            >
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">
                                  {field.name}
                                </div>

                                <div className="mt-1 flex items-center gap-2">
                                  <code className="text-[13px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                                    {field.key}
                                  </code>

                                  <span className="text-[13px] text-slate-400">
                                    Order {field.sortOrder}
                                  </span>
                                </div>

                                {field.description && (
                                  <div className="text-[13px] text-slate-500 mt-1.5 max-w-md">
                                    {field.description}
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <span className="inline-flex rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-1 text-[13px] font-semibold">
                                  {field.fieldType.replaceAll(
                                    "_",
                                    " "
                                  )}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-[13px] text-slate-600">
                                {field.required
                                  ? "Yes"
                                  : "No"}
                              </td>

                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleCustomField(
                                      field,
                                      "showInForms"
                                    )
                                  }
                                  className={`relative w-10 h-6 rounded-full transition-colors ${
                                    field.showInForms
                                      ? "bg-emerald-600"
                                      : "bg-slate-200"
                                  }`}
                                >
                                  <span
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                                      field.showInForms
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
                                    toggleCustomField(
                                      field,
                                      "active"
                                    )
                                  }
                                  className={`relative w-10 h-6 rounded-full transition-colors ${
                                    field.active
                                      ? "bg-indigo-600"
                                      : "bg-slate-200"
                                  }`}
                                >
                                  <span
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                                      field.active
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
                                      openEditCustomField(
                                        field
                                      )
                                    }
                                    className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center"
                                    title="Edit custom field"
                                  >
                                    <Pencil
                                      size={13}
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      deleteCustomField(
                                        field
                                      )
                                    }
                                    className="w-8 h-8 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center"
                                    title="Delete custom field"
                                  >
                                    <Trash2
                                      size={13}
                                    />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}

                        {!customFields.length && (
                          <tr>
                            <td
                              colSpan={6}
                              className="py-12 text-center text-[15px] text-slate-500"
                            >
                              No custom fields configured yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[13px] text-slate-500">
                Custom fields are isolated per company. For this step they apply to Leads. Disabling a field keeps existing stored values; deleting a field removes its stored values.
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}

          {tab ===
            "notifications" && (
            <div className="p-6 space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">
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

              {notificationPreferencesLoading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-[15px] text-slate-500">
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Loading notification preferences...
                </div>
              ) : (
                <>
                  <div>
                    <div className="text-[13px] font-bold text-slate-800 mb-3">
                      Delivery Channels
                    </div>

                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
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
                                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                                  <Icon
                                    size={16}
                                  />
                                </div>

                                <div>
                                  <div className="text-[15px] font-semibold text-slate-900">
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
                                onClick={() =>
                                  updateNotificationPreference(
                                    item.key,
                                    !enabled
                                  )
                                }
                                className={`relative w-10 h-6 rounded-full transition-colors ${
                                  enabled
                                    ? "bg-indigo-600"
                                    : "bg-slate-200"
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

                  <div>
                    <div className="text-[13px] font-bold text-slate-800 mb-3">
                      Notification Categories
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
                            className="border border-slate-200 rounded-xl p-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50/70"
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
                              className="mt-0.5"
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
                  <h3 className="text-[15px] font-bold text-slate-900">
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

              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
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
                    className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
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
                  className="h-9 px-3 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700"
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
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold shadow-sm transition-colors"
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
                <div className="py-16 flex items-center justify-center gap-2 text-[15px] text-slate-500">
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Loading activity...
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[15px]">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">
                            Date & Time
                          </th>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">
                            User
                          </th>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">
                            Action
                          </th>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-slate-500">
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
                              className="py-14 text-center text-[15px] text-slate-500"
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
            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">Communication Integrations</h3>
                <p className="text-[13px] text-slate-500 mt-1">
                  Connect your own communication accounts. Gmail is available now; WhatsApp and SMS are prepared for the next phase.
                </p>
              </div>

              {googleNotice && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-[13px] font-semibold text-indigo-700">
                  {googleNotice}
                </div>
              )}

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm xl:col-span-1">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                      <Mail size={20} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[15px] font-bold text-slate-900">Gmail</div>
                      <div className="mt-1 text-[13px] leading-5 text-slate-500">
                        Send one-to-one or bulk emails to leads directly from Lead Store using your connected Google account.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-[12px] text-slate-600">
                    {googleStatus.connected ? (
                      <>
                        <div className="font-semibold text-emerald-700">Connected · {googleStatus.email || "Google account"}</div>
                        <div className="mt-1">Gmail sending: {googleStatus.gmailEnabled ? "Ready" : "Reconnect required"}</div>
                      </>
                    ) : (
                      <div>Connect Google once to enable Gmail and Google Meet.</div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {googleStatusLoading ? (
                      <span className="inline-flex h-10 items-center gap-2 text-[12px] font-semibold text-slate-500">
                        <Loader2 size={14} className="animate-spin" /> Checking...
                      </span>
                    ) : googleStatusError ? (
                      <span className="text-[12px] font-semibold text-rose-600">{googleStatusError}</span>
                    ) : !googleStatus.configured ? (
                      <span className="text-[12px] font-semibold text-amber-600">Not set up on the server yet</span>
                    ) : !googleStatus.connected || !googleStatus.gmailEnabled ? (
                      <button type="button" onClick={connectGoogle} disabled={googleBusy} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                        <Globe2 size={15} /> {googleBusy ? "Opening Google..." : googleStatus.connected ? "Reconnect Google" : "Connect Google"}
                      </button>
                    ) : (
                      <>
                        <button type="button" onClick={sendGoogleTestEmail} disabled={googleBusy} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                          <Send size={14} /> {googleBusy ? "Sending..." : "Send test email"}
                        </button>
                        <button type="button" onClick={disconnectGoogle} disabled={googleBusy} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Disconnect</button>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200"><MessageCircle size={20} /></span>
                    <div><div className="text-[15px] font-bold text-slate-900">WhatsApp</div><p className="mt-1 text-[13px] leading-5 text-slate-500">Send approved WhatsApp messages and templates to leads.</p></div>
                  </div>
                  <span className="mt-4 inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600">Coming Soon</span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200"><Smartphone size={20} /></span>
                    <div><div className="text-[15px] font-bold text-slate-900">SMS</div><p className="mt-1 text-[13px] leading-5 text-slate-500">Send transactional and follow-up messages to lead phone numbers.</p></div>
                  </div>
                  <span className="mt-4 inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600">Coming Soon</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] leading-5 text-slate-500">
                Gmail uses the connected user&apos;s own Google account and Google&apos;s sending rules. Bispun records sent/failed communication history, but Google controls the actual daily sending limit.
              </div>
            </div>
          )}

        </section>
      </div>

      {organizationModal && (
        <div className="fixed inset-0 z-[105] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div><div className="text-[17px] font-bold text-slate-950">Add {organizationModal === "department" ? "Department" : "Role"}</div><div className="mt-1 text-[12px] text-slate-500">Set a short ID code and default permissions.</div></div>
              <button type="button" onClick={() => setOrganizationModal(null)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Name *</label><input value={organizationForm.name} onChange={(e)=>setOrganizationForm(c=>({...c,name:e.target.value}))} className="w-full h-10 px-3 rounded-lg border border-slate-200" placeholder={organizationModal === "department" ? "Technology" : "Team Lead"}/></div>
                <div><label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Code *</label><input value={organizationForm.code} onChange={(e)=>setOrganizationForm(c=>({...c,code:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,4)}))} className="w-full h-10 px-3 rounded-lg border border-slate-200 font-mono" placeholder={organizationModal === "department" ? "TEC" : "TLD"}/></div>
              </div>
              {organizationModal === "role" && <div><label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Base access level</label><select value={organizationForm.baseRole} onChange={(e)=>setOrganizationForm(c=>({...c,baseRole:e.target.value}))} className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white"><option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option></select></div>}
              <div><div className="text-[12px] font-bold text-slate-700">Default permissions</div><div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  ["canManageUsers","Manage Users"],["canManageSettings","Manage Settings"],["canManageBilling","Manage Billing"],["canViewAnalytics","View Analytics"],["canManageAdmissions","Manage Admissions"],["canManageRevenue","Manage Revenue"],["canManageLeads","Manage Leads"],["canManageSupport","Manage Support"],["canViewTeamTargets","View Team Targets"],
                ].map(([key,label])=><label key={key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"><span className="text-[12px] text-slate-700">{label}</span><input type="checkbox" checked={organizationForm.permissions[key]} onChange={(e)=>setOrganizationForm(c=>({...c,permissions:{...c.permissions,[key]:e.target.checked}}))}/></label>)}
              </div></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-4"><button type="button" onClick={()=>setOrganizationModal(null)} className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold">Cancel</button><button type="button" disabled={organizationSaving || !organizationForm.name.trim() || !organizationForm.code.trim()} onClick={saveOrganizationItem} className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-[12px] font-semibold disabled:opacity-50">{organizationSaving ? "Saving..." : "Create"}</button></div>
          </div>
        </div>
      )}

      {userModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[17px] font-bold text-slate-950">
                  {editingUser
                    ? "Edit User"
                    : "Add User"}
                </div>

                <div className="text-[13px] text-slate-500 mt-1">
                  Configure account details, role and permissions.
                </div>
              </div>

              <button
                type="button"
                onClick={closeUserModal}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-5">
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
                  ["jobTitle", "Job Title", "text", false],
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
                        className={`w-full h-10 px-3 border rounded-lg text-[15px] focus:outline-none focus:ring-2 ${
                          userFormErrors[key]
                            ? "border-rose-300 focus:ring-rose-100 focus:border-rose-400"
                            : "border-slate-200 focus:ring-indigo-100 focus:border-indigo-400"
                        }`}
                      />

                      {userFormErrors[key] && (
                        <p className="mt-1 text-[12px] text-rose-600">
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
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Department <span className="text-rose-500">*</span></label>
                  <select
                    required
                    aria-invalid={Boolean(userFormErrors.department)}
                    value={userForm.department}
                    onChange={(event) => setUserDepartment(event.target.value)}
                    className={`w-full h-10 px-3 border rounded-lg bg-white text-[15px] ${
                      userFormErrors.department
                        ? "border-rose-300 focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
                        : "border-slate-200"
                    }`}
                  >
                    <option value="">Select department</option>
                    {organization.departments.map((department) => <option key={department.id} value={department.name}>{department.name} ({department.code})</option>)}
                  </select>
                  {userFormErrors.department && (
                    <p className="mt-1 text-[12px] text-rose-600">
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

                    <input
                      type="password"
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
                      className={`w-full h-10 px-3 border rounded-lg text-[15px] focus:outline-none focus:ring-2 ${
                        userFormErrors.password
                          ? "border-rose-300 focus:ring-rose-100 focus:border-rose-400"
                          : "border-slate-200 focus:ring-indigo-100 focus:border-indigo-400"
                      }`}
                    />

                    {userFormErrors.password && (
                      <p className="mt-1 text-[12px] text-rose-600">
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
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
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
                        {organization.roles.map((role) => (
                          <option key={role.id} value={`CUSTOM:${role.id}`}>
                            {role.name} ({role.code})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {userForm.role === "EMPLOYEE" && (
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                      Reports to (Manager)
                    </label>
                    <select
                      value={userForm.managerId || ""}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          managerId: event.target.value,
                        }))
                      }
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
                    >
                      <option value="">— Select a manager —</option>
                      {users
                        .filter((u) => u.role === "MANAGER" && u.active)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                            {m.department ? ` · ${m.department}` : ""}
                          </option>
                        ))}
                    </select>
                    {users.filter((u) => u.role === "MANAGER" && u.active).length === 0 && (
                      <p className="mt-1 text-[12px] text-amber-600">
                        No managers yet — create a Manager first, then assign employees to them.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="text-[13px] font-semibold text-slate-700">
                  Permissions
                </div>
                <p className="mt-1 text-[12px] leading-5 text-slate-500">
                  Defaults follow the selected role. Choosing a department does not automatically grant extra access.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  {[
                    ["canManageUsers", "Manage Users"],
                    ["canManageSettings", "Manage Settings"],
                    ["canManageBilling", "Manage Billing"],
                    ["canManageLeads", "Manage Leads"],
                    ["canManageSupport", "Manage Support"],
                    ["canViewTeamTargets", "View Team Targets"],
                  ].map(
                    ([
                      key,
                      label,
                    ]) => (
                      <label
                        key={key}
                        className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2.5"
                      >
                        <span className="text-[13px] text-slate-700">
                          {label}
                        </span>

                        <input
                          type="checkbox"
                          checked={
                            userForm.permissions[
                              key
                            ]
                          }
                          disabled={
                            userForm.role ===
                            "CLIENT_ADMIN"
                          }
                          onChange={(
                            event
                          ) =>
                            setUserForm(
                              (
                                current
                              ) => ({
                                ...current,
                                permissions: {
                                  ...current.permissions,
                                  [key]:
                                    event.target
                                      .checked,
                                },
                              })
                            )
                          }
                        />
                      </label>
                    )
                  )}
                </div>

                <div className="mt-4">
                  <div className="text-[13px] font-semibold text-slate-700">
                    Page access (Admissions, Finance, Insights)
                  </div>
                  <p className="mt-1 mb-2 text-[12px] leading-5 text-slate-500">
                    Turn a page on, then expand it to grant access to specific
                    streams, colleges, branches or sections. New colleges appear
                    here automatically.
                  </p>
                  <PermissionTree
                    pageAccess={userForm.pageAccess}
                    onPageAccess={(next) =>
                      setUserForm((current) => ({ ...current, pageAccess: next }))
                    }
                    permissions={userForm.permissions}
                    onPermissions={(key, value) =>
                      setUserForm((current) => ({
                        ...current,
                        permissions: { ...current.permissions, [key]: value },
                      }))
                    }
                    tree={permissionTree}
                    actorPageAccess={actorPageAccess}
                    isAdminTarget={userForm.role === "CLIENT_ADMIN"}
                    loading={permissionTreeLoading}
                  />
                </div>
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
          </div>
        </div>
      )}

      {resetPasswordUser && (
        <div className="fixed inset-0 z-[110] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[17px] font-bold text-slate-950">
                  Reset Password
                </div>

                <div className="text-[13px] text-slate-500 mt-1">
                  Set a new password for {resetPasswordUser.name}.
                </div>
              </div>

              <button
                type="button"
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
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
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
          </div>
        </div>
      )}


      {sourceModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[17px] font-bold text-slate-950">
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
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
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
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
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
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
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
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
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
          </div>
        </div>
      )}


      {customFieldModalOpen && (
        <div className="fixed inset-0 z-[130] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[17px] font-bold text-slate-950">
                  {editingCustomField
                    ? "Edit Custom Field"
                    : "Add Custom Field"}
                </div>

                <div className="text-[13px] text-slate-500 mt-1">
                  Configure a field for this company’s lead records.
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCustomFieldModalOpen(false)
                }
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                    Field Name
                  </label>

                  <input
                    value={
                      customFieldForm.name
                    }
                    onChange={(
                      event
                    ) =>
                      setCustomFieldForm(
                        (current) => ({
                          ...current,
                          name:
                            event.target.value,
                          key:
                            editingCustomField
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
                    placeholder="Student College"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                    Field Key
                  </label>

                  <input
                    value={
                      customFieldForm.key
                    }
                    onChange={(
                      event
                    ) =>
                      setCustomFieldForm(
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
                    placeholder="STUDENT_COLLEGE"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                    Applies To
                  </label>

                  <select
                    value={
                      customFieldForm.entityType
                    }
                    disabled
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-slate-50 text-slate-600"
                  >
                    <option value="LEAD">
                      Leads
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                    Field Type
                  </label>

                  <select
                    value={
                      customFieldForm.fieldType
                    }
                    onChange={(
                      event
                    ) =>
                      setCustomFieldForm(
                        (current) => ({
                          ...current,
                          fieldType:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
                  >
                    <option value="TEXT">
                      Text
                    </option>
                    <option value="NUMBER">
                      Number
                    </option>
                    <option value="DROPDOWN">
                      Dropdown
                    </option>
                    <option value="DATE">
                      Date
                    </option>
                    <option value="CHECKBOX">
                      Checkbox
                    </option>
                    <option value="EMAIL">
                      Email
                    </option>
                    <option value="PHONE">
                      Phone
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                  Description
                </label>

                <textarea
                  rows={3}
                  value={
                    customFieldForm.description
                  }
                  onChange={(
                    event
                  ) =>
                    setCustomFieldForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Optional help text for this field"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              {customFieldForm.fieldType ===
                "DROPDOWN" && (
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                    Dropdown Options
                  </label>

                  <textarea
                    rows={5}
                    value={
                      customFieldForm.optionsText
                    }
                    onChange={(
                      event
                    ) =>
                      setCustomFieldForm(
                        (current) => ({
                          ...current,
                          optionsText:
                            event.target.value,
                        })
                      )
                    }
                    placeholder={"Option 1\nOption 2\nOption 3"}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />

                  <div className="text-[13px] text-slate-400 mt-1">
                    Enter one option per line.
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                  Sort Order
                </label>

                <input
                  type="number"
                  value={
                    customFieldForm.sortOrder
                  }
                  onChange={(
                    event
                  ) =>
                    setCustomFieldForm(
                      (current) => ({
                        ...current,
                        sortOrder:
                          Number(
                            event.target.value
                          ),
                      })
                    )
                  }
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {[
                  [
                    "required",
                    "Required",
                  ],
                  [
                    "showInForms",
                    "Show in Forms",
                  ],
                  [
                    "active",
                    "Active",
                  ],
                ].map(
                  ([
                    key,
                    label,
                  ]) => (
                    <label
                      key={key}
                      className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3"
                    >
                      <span className="text-[13px] font-semibold text-slate-700">
                        {label}
                      </span>

                      <input
                        type="checkbox"
                        checked={
                          customFieldForm[
                            key
                          ]
                        }
                        onChange={(
                          event
                        ) =>
                          setCustomFieldForm(
                            (
                              current
                            ) => ({
                              ...current,
                              [key]:
                                event.target.checked,
                            })
                          )
                        }
                      />
                    </label>
                  )
                )}
              </div>

              {customFieldsError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-[13px]">
                  {customFieldsError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setCustomFieldModalOpen(false)
                  }
                  className="h-9 px-4 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    saveCustomField
                  }
                  disabled={
                    customFieldSaving
                  }
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2"
                >
                  {customFieldSaving && (
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                  )}

                  {editingCustomField
                    ? "Save Field"
                    : "Create Field"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}




    </div>
  );
}
