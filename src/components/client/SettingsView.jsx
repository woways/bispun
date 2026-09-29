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
  Puzzle,
  Bell,
  Save,
  ShieldCheck,
  Upload,
  Check,
  Globe2,
  Mail,
  Smartphone,
  Plus,
  Pencil,
  KeyRound,
  Loader2,
  X,
  Search,
  Trash2,
  GripVertical,
} from "lucide-react";

import {
  apiRequest,
} from "../../lib/api";

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
    k: "integrations",
    l: "Integrations",
    i: Puzzle,
  },
  {
    k: "notifications",
    l: "Notifications",
    i: Bell,
  },
];

const BRAND_COLORS = [
  {
    key: "indigo",
    className:
      "bg-indigo-600",
  },
  {
    key: "emerald",
    className:
      "bg-emerald-600",
  },
  {
    key: "amber",
    className:
      "bg-amber-600",
  },
  {
    key: "rose",
    className:
      "bg-rose-600",
  },
  {
    key: "purple",
    className:
      "bg-purple-600",
  },
  {
    key: "sky",
    className:
      "bg-sky-600",
  },
];

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
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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
        className={`w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-500 ${
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

        <h3 className="mt-4 text-base font-bold text-slate-900">
          {title}
        </h3>

        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {description}
        </p>

        <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5">
          <ShieldCheck size={12} />
          Production configuration
        </div>
      </div>
    </div>
  );
}

export default function SettingsView({
  tenant,
}) {
  const [
    tab,
    setTab,
  ] = useState(
    "company"
  );

  const [
    selectedColor,
    setSelectedColor,
  ] = useState(
    "indigo"
  );

  const [
    emailNotifications,
    setEmailNotifications,
  ] = useState(
    true
  );

  const [
    smsNotifications,
    setSmsNotifications,
  ] = useState(
    false
  );

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
    subdomain:
      tenant?.subdomain ||
      "",
    portalName:
      tenant?.brandName ||
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
    phone: "",
    jobTitle: "",
    department: "",
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
    },
  };

  const [
    userForm,
    setUserForm,
  ] = useState(
    emptyUserForm
  );

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
    };
  }

  function openCreateUser() {
    setEditingUser(null);
    setUserForm(
      emptyUserForm
    );
    setUsersError("");
    setUserModalOpen(true);
  }

  function openEditUser(user) {
    setEditingUser(user);

    setUserForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "EMPLOYEE",
      phone: user.phone || "",
      jobTitle: user.jobTitle || "",
      department:
        user.department || "",
      active: user.active,
      permissions: {
        ...emptyUserForm.permissions,
        ...(user.permissions || {}),
      },
    });

    setUsersError("");
    setUserModalOpen(true);
  }

  function setRole(role) {
    setUserForm(
      (current) => ({
        ...current,
        role,
        permissions:
          roleDefaults(role),
      })
    );
  }

  async function saveUser() {
    setUserSaving(true);
    setUsersError("");

    try {
      const payload = {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        phone: userForm.phone,
        jobTitle:
          userForm.jobTitle,
        department:
          userForm.department,
        active: userForm.active,
        permissions:
          userForm.permissions,
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

      setUserModalOpen(false);
      setEditingUser(null);
    } catch (error) {
      setUsersError(
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

  function openCreateSource() {
    setEditingSource(null);
    setSourceForm(
      emptySourceForm
    );
    setSourcesError("");
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
    setSourceModalOpen(true);
  }

  async function saveLeadSource() {
    setSourceSaving(true);
    setSourcesError("");

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

      setSourceModalOpen(false);
      setEditingSource(null);
    } catch (error) {
      setSourcesError(
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
    } catch (error) {
      setCustomFieldsError(
        error?.data?.message ||
          "Unable to delete custom field"
      );
    }
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
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Workspace / Configuration
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            Settings
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage company profile,
            branding, access,
            lead configuration and
            workspace preferences.
          </p>
        </div>

        <button
          type="button"
          className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 shadow-sm"
        >
          <Save size={14} />
          Save Changes
        </button>
      </div>

      {/* WORKSPACE SUMMARY */}

      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
            {
              tenant?.short ||
              "CB"
            }
          </div>

          <div>
            <div className="text-sm font-bold text-slate-900">
              {
                tenant
                  ?.brandName ||
                tenant?.name ||
                "CRM Workspace"
              }
            </div>

            <div className="text-xs text-slate-500 mt-0.5">
              {
                tenant
                  ?.subdomain ||
                "Workspace"
              }
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5 text-xs text-slate-500">
          <div>
            <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-slate-400">
              Business
            </div>

            <div className="mt-1 font-medium text-slate-700">
              {
                tenant
                  ?.business ||
                "—"
              }
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-slate-400">
              City
            </div>

            <div className="mt-1 font-medium text-slate-700">
              {
                tenant
                  ?.city ||
                "—"
              }
            </div>
          </div>
        </div>
      </div>

      {/* SETTINGS LAYOUT */}

      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-5">

        {/* LEFT SETTINGS NAV */}

        <aside className="bg-white border border-slate-200 rounded-xl p-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)] h-fit">
          <div className="px-3 pt-2 pb-3">
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400">
              Configuration
            </div>
          </div>

          <div className="space-y-1">
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      active
                        ? "bg-slate-950 text-white font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <Icon
                      size={
                        15
                      }
                      className={
                        active
                          ? "text-indigo-300"
                          : "text-slate-400"
                      }
                    />

                    <span className="flex-1 text-left">
                      {
                        item.l
                      }
                    </span>
                  </button>
                );
              }
            )}
          </div>
        </aside>

        {/* CONTENT */}

        <section className="bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              {activeTab && (
                <activeTab.i
                  size={16}
                  className="text-indigo-600"
                />
              )}

              <h2 className="text-base font-bold text-slate-950">
                {
                  activeTab
                    ?.l
                }
              </h2>
            </div>
          </div>

          {/* COMPANY */}

          {tab ===
            "company" && (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Company Profile
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Core workspace identity
                  shown throughout the CRM.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <Field
                  label="Portal Name"
                  value={
                    form.portalName
                  }
                  onChange={(
                    value
                  ) =>
                    update(
                      "portalName",
                      value
                    )
                  }
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-3">
                <Globe2
                  size={16}
                  className="text-slate-500 mt-0.5"
                />

                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    Workspace identity
                  </div>

                  <div className="text-xs text-slate-500 mt-1">
                    Company and portal
                    information is currently
                    displayed from your active
                    tenant configuration.
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
                <h3 className="text-sm font-bold text-slate-900">
                  Brand Appearance
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Configure the visual
                  identity used inside the
                  client portal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-3">
                  Primary Color
                </label>

                <div className="flex gap-3 flex-wrap">
                  {BRAND_COLORS.map(
                    (
                      color
                    ) => {
                      const selected =
                        selectedColor ===
                        color.key;

                      return (
                        <button
                          key={
                            color.key
                          }
                          type="button"
                          onClick={() =>
                            setSelectedColor(
                              color.key
                            )
                          }
                          className={`relative w-10 h-10 rounded-xl ${color.className} ring-offset-2 transition-all ${
                            selected
                              ? "ring-2 ring-slate-900"
                              : "ring-2 ring-transparent hover:ring-slate-300"
                          }`}
                        >
                          {selected && (
                            <Check
                              size={15}
                              className="absolute inset-0 m-auto text-white"
                            />
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Company Logo
                </label>

                <button
                  type="button"
                  className="w-full border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 rounded-xl p-8 text-center transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
                    <Upload
                      size={17}
                    />
                  </div>

                  <div className="mt-3 text-sm font-semibold text-slate-800">
                    Upload company logo
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    SVG or PNG recommended
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* USERS */}

          {tab ===
            "users" && (
            <div className="p-6 space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Users & Roles
                  </h3>

                  <p className="text-xs text-slate-500 mt-1">
                    Manage team members, account status and workspace permissions.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    openCreateUser
                  }
                  className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus size={14} />
                  Add User
                </button>
              </div>

              {usersError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs">
                  {usersError}
                </div>
              )}

              <div className="relative max-w-sm">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={
                    userSearch
                  }
                  onChange={(
                    event
                  ) =>
                    setUserSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search users..."
                  className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              {usersLoading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Loading users...
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            User
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Role
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Department
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map(
                          (user) => (
                            <tr
                              key={
                                user.id
                              }
                              className="hover:bg-slate-50/70"
                            >
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">
                                  {user.name}
                                </div>

                                <div className="text-xs text-slate-500 mt-0.5">
                                  {user.email}
                                </div>

                                {user.jobTitle && (
                                  <div className="text-[10px] text-slate-400 mt-1">
                                    {user.jobTitle}
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-1 text-[10px] font-semibold">
                                  {user.role.replaceAll(
                                    "_",
                                    " "
                                  )}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-xs text-slate-600">
                                {user.department ||
                                  "—"}
                              </td>

                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleUserActive(
                                      user
                                    )
                                  }
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                    user.active
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {user.active
                                    ? "Active"
                                    : "Inactive"}
                                </button>
                              </td>

                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditUser(
                                        user
                                      )
                                    }
                                    className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center"
                                    title="Edit user"
                                  >
                                    <Pencil
                                      size={13}
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setResetPasswordUser(
                                        user
                                      );
                                      setResetPassword(
                                        ""
                                      );
                                    }}
                                    className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center"
                                    title="Reset password"
                                  >
                                    <KeyRound
                                      size={13}
                                    />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}

                        {!filteredUsers.length && (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-12 text-center text-sm text-slate-500"
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

          {/* SOURCES */}

          {tab ===
            "sources" && (
            <div className="p-6 space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Lead Sources
                  </h3>

                  <p className="text-xs text-slate-500 mt-1">
                    Control which acquisition sources are available in this company workspace.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    openCreateSource
                  }
                  className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus size={14} />
                  Add Source
                </button>
              </div>

              {sourcesError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs">
                  {sourcesError}
                </div>
              )}

              {sourcesLoading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Loading lead sources...
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Order
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Source
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Key
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Active
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Forms
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">
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
                                <div className="inline-flex items-center gap-2 text-xs text-slate-500">
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

                                <div className="text-xs text-slate-500 mt-0.5 max-w-sm">
                                  {source.description ||
                                    "—"}
                                </div>

                                {source.system && (
                                  <span className="inline-flex mt-1.5 rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                                    Default
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <code className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1">
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
                              className="py-12 text-center text-sm text-slate-500"
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

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
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
                  <h3 className="text-sm font-bold text-slate-900">
                    Custom Fields
                  </h3>

                  <p className="text-xs text-slate-500 mt-1">
                    Create company-specific fields for lead forms and records without changing the database schema each time.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    openCreateCustomField
                  }
                  className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus size={14} />
                  Add Custom Field
                </button>
              </div>

              {customFieldsError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs">
                  {customFieldsError}
                </div>
              )}

              {customFieldsLoading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Loading custom fields...
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Field
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Required
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Forms
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Active
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">
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
                                  <code className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                                    {field.key}
                                  </code>

                                  <span className="text-[10px] text-slate-400">
                                    Order {field.sortOrder}
                                  </span>
                                </div>

                                {field.description && (
                                  <div className="text-xs text-slate-500 mt-1.5 max-w-md">
                                    {field.description}
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <span className="inline-flex rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-1 text-[10px] font-semibold">
                                  {field.fieldType.replaceAll(
                                    "_",
                                    " "
                                  )}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-xs text-slate-600">
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
                              className="py-12 text-center text-sm text-slate-500"
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

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
                Custom fields are isolated per company. For this step they apply to Leads. Disabling a field keeps existing stored values; deleting a field removes its stored values.
              </div>
            </div>
          )}

          {/* INTEGRATIONS */}

          {tab ===
            "integrations" && (
            <PlaceholderPanel
              title="Integrations"
              description="Connect external tools and services to extend the Bispun workflow."
              icon={Puzzle}
            />
          )}

          {/* NOTIFICATIONS */}

          {tab ===
            "notifications" && (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Notification Preferences
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Choose how workspace
                  activity notifications are
                  delivered.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                      <Mail
                        size={16}
                      />
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        Email Notifications
                      </div>

                      <div className="text-xs text-slate-500 mt-1">
                        Receive important
                        workspace updates by
                        email.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setEmailNotifications(
                        (
                          current
                        ) =>
                          !current
                      )
                    }
                    className={`relative w-10 h-6 rounded-full transition-colors ${
                      emailNotifications
                        ? "bg-indigo-600"
                        : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                        emailNotifications
                          ? "left-5"
                          : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center">
                      <Smartphone
                        size={16}
                      />
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        SMS Notifications
                      </div>

                      <div className="text-xs text-slate-500 mt-1">
                        Receive supported CRM
                        alerts by SMS.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSmsNotifications(
                        (
                          current
                        ) =>
                          !current
                      )
                    }
                    className={`relative w-10 h-6 rounded-full transition-colors ${
                      smsNotifications
                        ? "bg-indigo-600"
                        : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                        smsNotifications
                          ? "left-5"
                          : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {userModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-base font-bold text-slate-950">
                  {editingUser
                    ? "Edit User"
                    : "Add User"}
                </div>

                <div className="text-xs text-slate-500 mt-1">
                  Configure account details, role and permissions.
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setUserModalOpen(false)
                }
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ["name", "Name", "text"],
                  ["email", "Email", "email"],
                  ["phone", "Phone", "text"],
                  ["jobTitle", "Job Title", "text"],
                  ["department", "Department", "text"],
                ].map(
                  ([
                    key,
                    label,
                    type,
                  ]) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        {label}
                      </label>

                      <input
                        type={type}
                        value={
                          userForm[
                            key
                          ]
                        }
                        onChange={(
                          event
                        ) =>
                          setUserForm(
                            (
                              current
                            ) => ({
                              ...current,
                              [key]:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                      />
                    </div>
                  )
                )}

                {!editingUser && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Temporary Password
                    </label>

                    <input
                      type="password"
                      value={
                        userForm.password
                      }
                      onChange={(
                        event
                      ) =>
                        setUserForm(
                          (
                            current
                          ) => ({
                            ...current,
                            password:
                              event.target
                                .value,
                          })
                        )
                      }
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Role
                  </label>

                  <select
                    value={
                      userForm.role
                    }
                    onChange={(
                      event
                    ) =>
                      setRole(
                        event.target.value
                      )
                    }
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
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
                  </select>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700">
                  Permissions
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  {[
                    ["canManageUsers", "Manage Users"],
                    ["canManageSettings", "Manage Settings"],
                    ["canManageBilling", "Manage Billing"],
                    ["canViewAnalytics", "View Analytics"],
                    ["canManageAdmissions", "Manage Admissions"],
                    ["canManageRevenue", "Manage Revenue"],
                    ["canManageLeads", "Manage Leads"],
                    ["canManageSupport", "Manage Support"],
                  ].map(
                    ([
                      key,
                      label,
                    ]) => (
                      <label
                        key={key}
                        className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2.5"
                      >
                        <span className="text-xs text-slate-700">
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
              </div>

              {editingUser && (
                <label className="flex items-center gap-2 text-xs text-slate-700">
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
                  onClick={() =>
                    setUserModalOpen(false)
                  }
                  className="h-9 px-4 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveUser}
                  disabled={
                    userSaving
                  }
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2"
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
                <div className="text-base font-bold text-slate-950">
                  Reset Password
                </div>

                <div className="text-xs text-slate-500 mt-1">
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
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                Minimum 8 characters with uppercase, lowercase and a number.
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setResetPasswordUser(null)
                  }
                  className="h-9 px-4 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
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
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2"
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
                <div className="text-base font-bold text-slate-950">
                  {editingSource
                    ? "Edit Lead Source"
                    : "Add Lead Source"}
                </div>

                <div className="text-xs text-slate-500 mt-1">
                  Configure how this source appears across CRM forms and reporting.
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSourceModalOpen(false)
                }
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700">
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
                  <span className="text-xs font-semibold text-slate-700">
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

              {sourcesError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs">
                  {sourcesError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setSourceModalOpen(false)
                  }
                  className="h-9 px-4 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2"
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
                <div className="text-base font-bold text-slate-950">
                  {editingCustomField
                    ? "Edit Custom Field"
                    : "Add Custom Field"}
                </div>

                <div className="text-xs text-slate-500 mt-1">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Applies To
                  </label>

                  <select
                    value={
                      customFieldForm.entityType
                    }
                    disabled
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600"
                  >
                    <option value="LEAD">
                      Leads
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
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
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              {customFieldForm.fieldType ===
                "DROPDOWN" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />

                  <div className="text-[10px] text-slate-400 mt-1">
                    Enter one option per line.
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                      <span className="text-xs font-semibold text-slate-700">
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
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs">
                  {customFieldsError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setCustomFieldModalOpen(false)
                  }
                  className="h-9 px-4 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2"
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
