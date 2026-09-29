import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Globe,
  Users,
  TrendingUp,
  CheckCircle2,
  DollarSign,
  LayoutDashboard,
  Link2,
  UserCheck,
  Database,
  UserPlus,
  Video,
  FileText,
  Handshake,
  BarChart3,
  HelpCircle,
  Settings,
  Loader2,
  AlertCircle,
  RefreshCw,
  CalendarDays,
  CreditCard,
  UserRound,
  Mail,
  Save,
  Activity,
  Ticket,
  Sliders,
  History,
  ShieldCheck,
} from "lucide-react";

import {
  StatCard,
  Badge,
  PlanPill,
  statusTone,
} from "../../components/ui";

import { apiRequest } from "../../lib/api";

const MODULE_ICONS = {
  LayoutDashboard,
  Link2,
  UserCheck,
  DollarSign,
  Database,
  UserPlus,
  Video,
  FileText,
  Handshake,
  BarChart3,
  HelpCircle,
  Settings,
};

function getAccent(primaryColor) {
  const colors = {
    indigo: "bg-indigo-600",
    emerald: "bg-emerald-600",
    amber: "bg-amber-600",
    rose: "bg-rose-600",
    purple: "bg-purple-600",
    blue: "bg-blue-600",
    slate: "bg-slate-700",
  };

  return (
    colors[primaryColor] ||
    "bg-indigo-600"
  );
}

function getInitials(client) {
  if (client?.shortName) {
    return client.shortName
      .slice(0, 2)
      .toUpperCase();
  }

  return String(client?.name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(date) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString(
    "en-IN"
  )}`;
}

function roleLabel(role) {
  const labels = {
    SUPER_ADMIN: "Super Admin",
    CLIENT_ADMIN: "Client Admin",
    MANAGER: "Manager",
    EMPLOYEE: "Employee",
  };

  return labels[role] || role;
}


function ClientStatusControl({ client, setClient }) {
  const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  async function updateStatus(status){setSaving(true);setError("");try{const data=await apiRequest(`/api/admin/clients/${client.id}/status`,{method:"PATCH",body:JSON.stringify({status})});setClient((c)=>({...c,status:data.status}));}catch(e){setError(e?.data?.message||"Unable to update client status");}finally{setSaving(false);}}
  return <div className="bg-white border border-slate-200 rounded-xl p-5"><div className="flex items-center gap-2"><ShieldCheck size={16} className="text-indigo-600"/><h3 className="text-sm font-semibold text-slate-900">Client Access Status</h3></div><p className="text-xs text-slate-500 mt-1">Suspended or inactive clients are blocked from the client portal.</p>{error&&<div className="mt-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs">{error}</div>}<div className="mt-4 flex items-center gap-3"><select value={String(client.status||"active").toUpperCase()} disabled={saving} onChange={(e)=>updateStatus(e.target.value)} className="h-9 px-3 border border-slate-200 rounded-lg bg-white text-xs"><option value="TRIAL">Trial</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="INACTIVE">Inactive</option></select>{saving&&<Loader2 size={14} className="animate-spin text-indigo-600"/>}</div></div>;
}

function OverviewTab({ client, setClient }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Users"
          value={client.users}
          icon={Users}
        />

        <StatCard
          label="Leads"
          value={Number(
            client.leads || 0
          ).toLocaleString("en-IN")}
          icon={TrendingUp}
          tone="emerald"
        />

        <StatCard
          label="Admissions"
          value={Number(
            client.admissions || 0
          ).toLocaleString("en-IN")}
          icon={CheckCircle2}
          tone="emerald"
        />

        <StatCard
          label="Annual Plan"
          value={formatMoney(
            client.yearlyPrice
          )}
          icon={DollarSign}
          tone="indigo"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <h3 className="text-sm font-semibold text-slate-900">
            Company Information
          </h3>

          <div className="mt-4 space-y-3">
            <InfoRow
              label="Company"
              value={client.name}
            />

            <InfoRow
              label="Brand Name"
              value={
                client.brandName || "—"
              }
            />

            <InfoRow
              label="Business"
              value={
                client.business || "—"
              }
            />

            <InfoRow
              label="Owner"
              value={
                client.ownerName || "—"
              }
            />

            <InfoRow
              label="City"
              value={client.city || "—"}
            />

            <InfoRow
              label="Email"
              value={
                client.email || "—"
              }
            />

            <InfoRow
              label="Phone"
              value={
                client.phone || "—"
              }
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <h3 className="text-sm font-semibold text-slate-900">
            Portal Information
          </h3>

          <div className="mt-4 space-y-3">
            <InfoRow
              label="Subdomain"
              value={
                client.subdomain || "—"
              }
            />

            <InfoRow
              label="Plan"
              value={
                client.planName || "—"
              }
            />

            <InfoRow
              label="Status"
              value={client.status}
            />

            <InfoRow
              label="Renewal"
              value={formatDate(
                client.renewalDate
              )}
            />

            <InfoRow
              label="Billing"
              value={
                "Annual"
              }
            />

            <InfoRow
              label="Created"
              value={formatDate(
                client.createdAt
              )}
            />
          </div>
        </div>
      </div>

      <ClientStatusControl client={client} setClient={setClient} />
    </div>
  );
}

function InfoRow({
  label,
  value,
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span className="text-sm font-medium text-slate-800 text-right">
        {value}
      </span>
    </div>
  );
}

function ModulesTab({
  client,
  setClient,
}) {
  const [savingModule, setSavingModule] =
    useState(null);

  const [error, setError] =
    useState("");

  async function toggleModule(
    module
  ) {
    if (savingModule) {
      return;
    }

    setSavingModule(module.id);
    setError("");

    const newEnabled =
      !module.enabled;

    try {
      const data =
        await apiRequest(
          `/api/admin/clients/${client.id}/modules/${module.id}`,
          {
            method: "PATCH",

            body: JSON.stringify({
              enabled: newEnabled,
            }),
          }
        );

      setClient((current) => ({
        ...current,

        modules:
          current.modules.map(
            (item) =>
              item.id === module.id
                ? {
                    ...item,
                    enabled:
                      data.module.enabled,
                  }
                : item
          ),
      }));
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to update module"
      );
    } finally {
      setSavingModule(null);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <h3 className="text-sm font-semibold text-slate-900">
        Feature Access
      </h3>

      <p className="text-xs text-slate-500 mt-1">
        Enable or disable individual
        modules for this client. Changes
        are saved directly to the
        database.
      </p>

      {error && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 border border-rose-200 bg-rose-50 rounded-md text-sm text-rose-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="mt-4 divide-y divide-slate-100">
        {client.modules?.map(
          (module) => {
            const Icon =
              MODULE_ICONS[
                module.icon
              ] || LayoutDashboard;

            const saving =
              savingModule ===
              module.id;

            return (
              <div
                key={module.id}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                    <Icon size={15} />
                  </div>

                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {module.name}
                    </div>

                    <div className="text-xs text-slate-500 mt-0.5">
                      {module.description ||
                        module.route}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    toggleModule(
                      module
                    )
                  }
                  className={`relative w-11 h-6 rounded-full transition ${
                    module.enabled
                      ? "bg-indigo-600"
                      : "bg-slate-300"
                  } ${
                    saving
                      ? "opacity-50"
                      : ""
                  }`}
                >
                  {saving ? (
                    <Loader2
                      size={14}
                      className="absolute left-3.5 top-1 animate-spin text-white"
                    />
                  ) : (
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition ${
                        module.enabled
                          ? "left-6"
                          : "left-1"
                      }`}
                    />
                  )}
                </button>
              </div>
            );
          }
        )}

        {!client.modules?.length && (
          <div className="py-8 text-center text-sm text-slate-500">
            No modules configured.
          </div>
        )}
      </div>
    </div>
  );
}

function UsersTab({ client }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Users
            size={15}
            className="text-indigo-600"
          />

          <h3 className="text-sm font-semibold text-slate-900">
            Client Users
          </h3>
        </div>

        <p className="text-xs text-slate-500 mt-1">
          Users belonging only to{" "}
          {client.name}.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[
                "User",
                "Email",
                "Role",
                "Status",
                "Created",
              ].map((heading) => (
                <th
                  key={heading}
                  className="text-left px-4 py-2.5 text-xs font-medium text-slate-500"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {client.usersList?.map(
              (user) => (
                <tr
                  key={user.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center">
                        <UserRound
                          size={14}
                        />
                      </div>

                      <span className="text-sm font-medium text-slate-900">
                        {user.name}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail size={13} />
                      {user.email}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <Badge tone="indigo">
                      {roleLabel(
                        user.role
                      )}
                    </Badge>
                  </td>

                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        user.active
                          ? "emerald"
                          : "slate"
                      }
                    >
                      {user.active
                        ? "Active"
                        : "Inactive"}
                    </Badge>
                  </td>

                  <td className="px-4 py-3 text-sm text-slate-500">
                    {formatDate(
                      user.createdAt
                    )}
                  </td>
                </tr>
              )
            )}

            {!client.usersList?.length && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubscriptionTab({
  client,
  onClientRefresh,
}) {
  const [plans, setPlans] =
    useState([]);

  const [loadingPlans, setLoadingPlans] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [form, setForm] =
    useState({
      planKey:
        client.plan || "",

      billingCycle:
        "YEARLY",
    });

  useEffect(() => {
    setForm({
      planKey:
        client.plan || "",

      billingCycle:
        "YEARLY",
    });
  }, [
    client.plan,
    client.billingCycle,
  ]);

  useEffect(() => {
    async function loadPlans() {
      setLoadingPlans(true);
      setError("");

      try {
        const data =
          await apiRequest(
            "/api/admin/clients/plans/available"
          );

        setPlans(
          data.plans || []
        );
      } catch (error) {
        setError(
          error?.data?.message ||
            "Unable to load plans"
        );
      } finally {
        setLoadingPlans(false);
      }
    }

    loadPlans();
  }, []);

  const selectedPlan =
    plans.find(
      (plan) =>
        plan.key ===
        form.planKey
    ) || null;

  async function saveSubscription(
    event
  ) {
    event.preventDefault();

    if (!form.planKey) {
      setError(
        "Please select a plan"
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data =
        await apiRequest(
          `/api/admin/clients/${client.id}/subscription`,
          {
            method: "PATCH",

            body: JSON.stringify({
              planKey:
                form.planKey,

              billingCycle:
                "YEARLY",
            }),
          }
        );

      setMessage(
        data.message ||
          "Subscription updated successfully."
      );

      if (onClientRefresh) {
        await onClientRefresh();
      }
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to update subscription"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-sm">
          {message}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2">
            <CreditCard
              size={16}
              className="text-indigo-600"
            />

            <h3 className="text-sm font-semibold text-slate-900">
              Current Subscription
            </h3>
          </div>

          <div className="mt-5">
            {client.plan ? (
              <PlanPill
                plan={client.plan}
              />
            ) : (
              <Badge tone="slate">
                No Plan
              </Badge>
            )}
          </div>

          <div className="mt-5 space-y-3">
            <InfoRow
              label="Plan"
              value={
                client.planName || "—"
              }
            />

            <InfoRow
              label="Billing Cycle"
              value={
                "Annual"
              }
            />

            <InfoRow
              label="Subscription Status"
              value={
                client.subscriptionStatus ||
                "—"
              }
            />

            <InfoRow
              label="Subscription Amount"
              value={formatMoney(
                client.subscriptionAmount
              )}
            />

            <InfoRow
              label="Renewal Date"
              value={formatDate(
                client.renewalDate
              )}
            />
          </div>
        </div>

        <form
          onSubmit={saveSubscription}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
        >
          <h3 className="text-sm font-semibold text-slate-900">
            Change Client Plan
          </h3>

          <p className="text-xs text-slate-500 mt-1">
            Change Basic / Pro /
            Advanced. Module access
            updates automatically.
          </p>

          <div className="space-y-4 mt-5">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Plan
              </label>

              <select
                value={
                  form.planKey
                }
                disabled={
                  loadingPlans ||
                  saving
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (current) => ({
                      ...current,

                      planKey:
                        event.target
                          .value,
                    })
                  )
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                <option value="">
                  Select plan
                </option>

                {plans.map(
                  (plan) => (
                    <option
                      key={
                        plan.id
                      }
                      value={
                        plan.key
                      }
                    >
                      {plan.name} —{" "}
                      {formatMoney(
                        plan.yearlyPrice
                      )}
                      /year
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Billing Cycle
              </label>

              <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                Annual only
              </div>
            </div>

            {selectedPlan && (
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-2">
                <InfoRow
                  label="Annual Price"
                  value={
                    selectedPlan.yearlyPrice
                      ? formatMoney(
                          selectedPlan.yearlyPrice
                        )
                      : "—"
                  }
                />

                <InfoRow
                  label="Included Modules"
                  value={
                    selectedPlan.modules
                      ?.length || 0
                  }
                />
              </div>
            )}

            {form.planKey ===
              "advanced" && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <div className="text-xs font-medium text-amber-900">
                  Advanced access
                </div>

                <div className="text-xs text-amber-800 mt-1">
                  After saving, this
                  client becomes eligible
                  for Advanced-only
                  customization requests.
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={
                saving ||
                loadingPlans ||
                !form.planKey
              }
              className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md text-sm inline-flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <Save size={14} />
              )}

              {saving
                ? "Updating..."
                : "Save Plan"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2">
          <CalendarDays
            size={16}
            className="text-indigo-600"
          />

          <h3 className="text-sm font-semibold text-slate-900">
            Subscription Dates & Pricing
          </h3>
        </div>

        <div className="grid md:grid-cols-2 gap-x-8 gap-y-3 mt-5">
          <InfoRow
            label="Start Date"
            value={formatDate(
              client.subscriptionStartDate
            )}
          />

          <InfoRow
            label="Renewal Date"
            value={formatDate(
              client.renewalDate
            )}
          />

          <InfoRow
            label="End Date"
            value={formatDate(
              client.subscriptionEndDate
            )}
          />

          <InfoRow
            label="Annual Plan Value"
            value={formatMoney(
              client.yearlyPrice
            )}
          />
        </div>
      </div>
    </div>
  );
}

function SettingsTab({
  client,
  setClient,
}) {
  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [form, setForm] =
    useState({
      portalName:
        client.settings?.portalName ||
        client.brandName ||
        "",

      primaryColor:
        client.settings
          ?.primaryColor ||
        client.primaryColor ||
        "indigo",

      secondaryColor:
        client.settings
          ?.secondaryColor || "",

      timezone:
        client.settings?.timezone ||
        "Asia/Kolkata",

      currency:
        client.settings?.currency ||
        "INR",

      dateFormat:
        client.settings?.dateFormat ||
        "DD/MM/YYYY",

      emailNotifications:
        client.settings
          ?.emailNotifications ??
        true,

      smsNotifications:
        client.settings
          ?.smsNotifications ??
        false,
    });

  function updateField(
    field,
    value
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveSettings(
    event
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data =
        await apiRequest(
          `/api/admin/clients/${client.id}/settings`,
          {
            method: "PATCH",

            body: JSON.stringify(
              form
            ),
          }
        );

      setClient((current) => ({
        ...current,

        primaryColor:
          data.settings
            .primaryColor ||
          current.primaryColor,

        settings:
          data.settings,
      }));

      setMessage(
        "Settings saved successfully."
      );
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to save settings"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={saveSettings}
      className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Portal Settings
          </h3>

          <p className="text-xs text-slate-500 mt-1">
            Configure branding and
            default company settings.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md text-sm inline-flex items-center gap-1.5"
        >
          {saving ? (
            <Loader2
              size={14}
              className="animate-spin"
            />
          ) : (
            <Save size={14} />
          )}

          Save
        </button>
      </div>

      {error && (
        <div className="mt-4 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-4 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-sm">
          {message}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mt-5">
        <SettingInput
          label="Portal Name"
          value={form.portalName}
          onChange={(value) =>
            updateField(
              "portalName",
              value
            )
          }
        />

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Primary Color
          </label>

          <select
            value={form.primaryColor}
            onChange={(event) =>
              updateField(
                "primaryColor",
                event.target.value
              )
            }
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
          >
            <option value="indigo">
              Indigo
            </option>

            <option value="blue">
              Blue
            </option>

            <option value="emerald">
              Emerald
            </option>

            <option value="amber">
              Amber
            </option>

            <option value="rose">
              Rose
            </option>

            <option value="purple">
              Purple
            </option>

            <option value="slate">
              Slate
            </option>
          </select>
        </div>

        <SettingInput
          label="Secondary Color"
          value={
            form.secondaryColor
          }
          onChange={(value) =>
            updateField(
              "secondaryColor",
              value
            )
          }
          placeholder="Optional"
        />

        <SettingInput
          label="Timezone"
          value={form.timezone}
          onChange={(value) =>
            updateField(
              "timezone",
              value
            )
          }
        />

        <SettingInput
          label="Currency"
          value={form.currency}
          onChange={(value) =>
            updateField(
              "currency",
              value
            )
          }
        />

        <SettingInput
          label="Date Format"
          value={form.dateFormat}
          onChange={(value) =>
            updateField(
              "dateFormat",
              value
            )
          }
        />
      </div>

      <div className="border-t border-slate-100 mt-5 pt-5 space-y-3">
        <ToggleSetting
          label="Email Notifications"
          description="Allow email notifications for this client."
          enabled={
            form.emailNotifications
          }
          onChange={(value) =>
            updateField(
              "emailNotifications",
              value
            )
          }
        />

        <ToggleSetting
          label="SMS Notifications"
          description="Allow SMS notifications for this client."
          enabled={
            form.smsNotifications
          }
          onChange={(value) =>
            updateField(
              "smsNotifications",
              value
            )
          }
        />
      </div>
    </form>
  );
}

function SettingInput({
  label,
  value,
  onChange,
  placeholder,
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </label>

      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
      />
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  enabled,
  onChange,
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-slate-800">
          {label}
        </div>

        <div className="text-xs text-slate-500">
          {description}
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          onChange(!enabled)
        }
        className={`relative w-11 h-6 rounded-full transition ${
          enabled
            ? "bg-indigo-600"
            : "bg-slate-300"
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition ${
            enabled
              ? "left-6"
              : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

/* =========================================
   REAL CLIENT USAGE TAB
========================================= */

function UsageTab({ clientId }) {
  const [usage, setUsage] =
    useState(null);

  const [company, setCompany] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadUsage() {
    setLoading(true);
    setError("");

    try {
      const data =
        await apiRequest(
          `/api/admin/usage/${clientId}`
        );

      setUsage(data.usage);
      setCompany(data.company);
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load client usage"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsage();
  }, [clientId]);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-16 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col items-center justify-center gap-3">
        <Loader2
          size={22}
          className="animate-spin text-indigo-600"
        />

        <div className="text-sm text-slate-500">
          Loading real usage data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-rose-200 rounded-xl p-8 shadow-[0_1px_2px_rgba(15,23,42,0.03)] text-center">
        <AlertCircle
          size={22}
          className="mx-auto text-rose-500"
        />

        <div className="mt-2 text-sm text-rose-700">
          {error}
        </div>

        <button
          type="button"
          onClick={loadUsage}
          className="mt-4 px-3 py-2 border border-slate-200 rounded-md text-sm inline-flex items-center gap-1.5 hover:bg-slate-50"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  const totalUsers =
    Number(usage?.users || 0);

  const activeUsers =
    Number(
      usage?.activeUsers || 0
    );

  const inactiveUsers =
    Math.max(
      totalUsers - activeUsers,
      0
    );

  const cards = [
    {
      label: "Total Users",
      value: totalUsers,
      icon: Users,
      tone: "indigo",
    },
    {
      label: "Active Users",
      value: activeUsers,
      icon: UserCheck,
      tone: "emerald",
    },
    {
      label: "Total Leads",
      value: Number(
        usage?.leads || 0
      ).toLocaleString("en-IN"),
      icon: TrendingUp,
      tone: "indigo",
    },
    {
      label: "Admissions",
      value: Number(
        usage?.admissions || 0
      ).toLocaleString("en-IN"),
      icon: CheckCircle2,
      tone: "emerald",
    },
    {
      label: "UTM Links",
      value: Number(
        usage?.utmLinks || 0
      ).toLocaleString("en-IN"),
      icon: Link2,
      tone: "indigo",
    },
    {
      label: "Lead Datasets",
      value: Number(
        usage?.leadDatasets || 0
      ).toLocaleString("en-IN"),
      icon: Database,
      tone: "indigo",
    },
    {
      label: "Support Tickets",
      value: Number(
        usage?.supportTickets || 0
      ).toLocaleString("en-IN"),
      icon: Ticket,
      tone: "amber",
    },
    {
      label: "Open Tickets",
      value: Number(
        usage?.openSupportTickets ||
          0
      ).toLocaleString("en-IN"),
      icon: AlertCircle,
      tone: "amber",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Activity
                size={16}
                className="text-indigo-600"
              />

              <h3 className="text-sm font-semibold text-slate-900">
                Client Usage
              </h3>
            </div>

            <p className="text-xs text-slate-500 mt-1">
              Real usage information
              calculated from the
              Bispun database for{" "}
              {company?.name ||
                "this client"}.
            </p>
          </div>

          <button
            type="button"
            onClick={loadUsage}
            className="px-3 py-1.5 border border-slate-200 rounded-md text-sm inline-flex items-center gap-1.5 hover:bg-slate-50"
          >
            <RefreshCw size={13} />
            Refresh Usage
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={Icon}
              tone={card.tone}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2">
            <Users
              size={15}
              className="text-indigo-600"
            />

            <h3 className="text-sm font-semibold text-slate-900">
              User Usage
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            <InfoRow
              label="Total Users"
              value={totalUsers}
            />

            <InfoRow
              label="Active Users"
              value={activeUsers}
            />

            <InfoRow
              label="Inactive Users"
              value={inactiveUsers}
            />

            <InfoRow
              label="Active Rate"
              value={
                totalUsers > 0
                  ? `${Math.round(
                      (activeUsers /
                        totalUsers) *
                        100
                    )}%`
                  : "0%"
              }
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2">
            <Database
              size={15}
              className="text-indigo-600"
            />

            <h3 className="text-sm font-semibold text-slate-900">
              CRM Data Usage
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            <InfoRow
              label="Leads"
              value={Number(
                usage?.leads || 0
              ).toLocaleString(
                "en-IN"
              )}
            />

            <InfoRow
              label="Admissions"
              value={Number(
                usage?.admissions || 0
              ).toLocaleString(
                "en-IN"
              )}
            />

            <InfoRow
              label="UTM Links"
              value={Number(
                usage?.utmLinks || 0
              ).toLocaleString(
                "en-IN"
              )}
            />

            <InfoRow
              label="Lead Datasets"
              value={Number(
                usage?.leadDatasets ||
                  0
              ).toLocaleString(
                "en-IN"
              )}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2">
            <Ticket
              size={15}
              className="text-indigo-600"
            />

            <h3 className="text-sm font-semibold text-slate-900">
              Support Usage
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            <InfoRow
              label="Total Tickets"
              value={Number(
                usage?.supportTickets ||
                  0
              ).toLocaleString(
                "en-IN"
              )}
            />

            <InfoRow
              label="Open Tickets"
              value={Number(
                usage?.openSupportTickets ||
                  0
              ).toLocaleString(
                "en-IN"
              )}
            />

            <InfoRow
              label="Closed / Resolved"
              value={Math.max(
                Number(
                  usage?.supportTickets ||
                    0
                ) -
                  Number(
                    usage?.openSupportTickets ||
                      0
                  ),
                0
              ).toLocaleString(
                "en-IN"
              )}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2">
            <Activity
              size={15}
              className="text-indigo-600"
            />

            <h3 className="text-sm font-semibold text-slate-900">
              Usage Summary
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            <InfoRow
              label="Company"
              value={
                company?.name || "—"
              }
            />

            <InfoRow
              label="Status"
              value={
                company?.status || "—"
              }
            />

            <InfoRow
              label="Created"
              value={formatDate(
                company?.createdAt
              )}
            />

            <InfoRow
              label="Database"
              value="Live"
            />
          </div>
        </div>
      </div>
    </div>
  );
}


/* =========================================
   REAL CLIENT CUSTOMIZATION TAB
========================================= */

function CustomizationTab({
  client,
}) {
  const [tickets, setTickets] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [savingId, setSavingId] =
    useState(null);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [selectedTicket, setSelectedTicket] =
    useState(null);

  const [status, setStatus] =
    useState("NEW");

  const [adminRemarks, setAdminRemarks] =
    useState("");

  const isAdvanced =
    client.plan === "advanced";

  function isCustomizationType(type) {
    return [
      "CUSTOMIZATION",
      "FEATURE_REQUEST",
      "INTEGRATION",
    ].includes(type);
  }

  function ticketStatusTone(statusValue) {
    if (
      ["COMPLETED", "CLOSED"].includes(
        statusValue
      )
    ) {
      return "emerald";
    }

    if (
      [
        "APPROVED",
        "IN_PROGRESS",
        "DEVELOPMENT",
      ].includes(statusValue)
    ) {
      return "sky";
    }

    if (statusValue === "REJECTED") {
      return "rose";
    }

    return "amber";
  }

  function priorityTone(priority) {
    if (
      priority === "HIGH" ||
      priority === "URGENT"
    ) {
      return "rose";
    }

    if (priority === "MEDIUM") {
      return "amber";
    }

    return "slate";
  }

  async function loadCustomization() {
    setLoading(true);
    setError("");

    try {
      const data =
        await apiRequest(
          `/api/admin/support?companyId=${encodeURIComponent(
            client.id
          )}`
        );

      const customizationTickets =
        (data.tickets || []).filter(
          (ticket) =>
            isCustomizationType(
              ticket.type
            )
        );

      setTickets(
        customizationTickets
      );

      if (selectedTicket) {
        const refreshed =
          customizationTickets.find(
            (ticket) =>
              ticket.id ===
              selectedTicket.id
          );

        if (refreshed) {
          setSelectedTicket(
            refreshed
          );
          setStatus(
            refreshed.status
          );
          setAdminRemarks(
            refreshed.adminRemarks ||
              ""
          );
        }
      }
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load customization requests"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomization();
  }, [client.id]);

  function openTicket(ticket) {
    setSelectedTicket(ticket);
    setStatus(ticket.status);
    setAdminRemarks(
      ticket.adminRemarks || ""
    );
    setMessage("");
    setError("");
  }

  async function saveTicket() {
    if (!selectedTicket) {
      return;
    }

    setSavingId(
      selectedTicket.id
    );

    setError("");
    setMessage("");

    try {
      const data =
        await apiRequest(
          `/api/admin/support/${selectedTicket.id}`,
          {
            method: "PATCH",

            body: JSON.stringify({
              status,
              adminRemarks,
            }),
          }
        );

      const updated =
        data.ticket;

      setTickets(
        (current) =>
          current.map(
            (ticket) =>
              ticket.id ===
              updated.id
                ? updated
                : ticket
          )
      );

      setSelectedTicket(
        updated
      );

      setStatus(
        updated.status
      );

      setAdminRemarks(
        updated.adminRemarks ||
          ""
      );

      setMessage(
        "Customization request updated successfully."
      );
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to update customization request"
      );
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-16 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col items-center justify-center gap-3">
        <Loader2
          size={22}
          className="animate-spin text-indigo-600"
        />

        <div className="text-sm text-slate-500">
          Loading customization requests...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Sliders
                size={16}
                className="text-indigo-600"
              />

              <h3 className="text-sm font-semibold text-slate-900">
                Customization Requests
              </h3>
            </div>

            <p className="text-xs text-slate-500 mt-1">
              Feature additions, workflow changes,
              workflow changes, reports, UI changes, API/WhatsApp integrations
              requests and UI changes are handled
              here.
            </p>
          </div>

          <button
            type="button"
            onClick={
              loadCustomization
            }
            className="px-3 py-1.5 border border-slate-200 rounded-md text-sm inline-flex items-center gap-1.5 hover:bg-slate-50"
          >
            <RefreshCw
              size={13}
            />
            Refresh
          </button>
        </div>
      </div>

      {!isAdvanced && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-sm font-medium text-amber-900">
            Advanced-plan feature
          </div>

          <div className="text-xs text-amber-800 mt-1">
            {client.name} is currently on the{" "}
            <strong>
              {client.planName ||
                client.plan ||
                "current"}
            </strong>{" "}
            plan. New customization requests can
            only be raised by Advanced-plan clients.
          </div>
        </div>
      )}

      {error && (
        <div className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-sm">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">
              Request History
            </h3>

            <p className="text-xs text-slate-500 mt-1">
              Existing customization requests for{" "}
              {client.name}.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {[
                    "Ticket",
                    "Title",
                    "Priority",
                    "Status",
                    "Created",
                  ].map(
                    (heading) => (
                      <th
                        key={
                          heading
                        }
                        className="text-left px-4 py-2.5 text-xs font-medium text-slate-500"
                      >
                        {
                          heading
                        }
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {tickets.map(
                  (ticket) => (
                    <tr
                      key={
                        ticket.id
                      }
                      onClick={() =>
                        openTicket(
                          ticket
                        )
                      }
                      className={`cursor-pointer hover:bg-slate-50 ${
                        selectedTicket?.id ===
                        ticket.id
                          ? "bg-indigo-50/50"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-xs font-mono text-slate-600">
                        {
                          ticket.ticketNumber
                        }
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-slate-900">
                          {
                            ticket.title
                          }
                        </div>

                        <div className="text-xs text-slate-500 mt-0.5">
                          Customization Request
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          tone={priorityTone(
                            ticket.priority
                          )}
                        >
                          {
                            ticket.priorityLabel
                          }
                        </Badge>
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          tone={ticketStatusTone(
                            ticket.status
                          )}
                        >
                          {
                            ticket.statusLabel
                          }
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDate(
                          ticket.createdAt
                        )}
                      </td>
                    </tr>
                  )
                )}

                {!tickets.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No customization requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          {!selectedTicket ? (
            <div className="h-full min-h-64 flex flex-col items-center justify-center text-center">
              <Sliders
                size={24}
                className="text-slate-300"
              />

              <div className="text-sm font-medium text-slate-700 mt-2">
                Select a request
              </div>

              <div className="text-xs text-slate-500 mt-1">
                Choose a customization request to
                review its details and update its
                status.
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-mono text-slate-500">
                  {
                    selectedTicket.ticketNumber
                  }
                </div>

                <h3 className="text-base font-semibold text-slate-900 mt-1">
                  {
                    selectedTicket.title
                  }
                </h3>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Client Request
                </div>

                <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-md p-3">
                  {
                    selectedTicket.description
                  }
                </div>
              </div>

              <InfoRow
                label="Submitted By"
                value={
                  selectedTicket.submittedByName ||
                  "—"
                }
              />

              <InfoRow
                label="Email"
                value={
                  selectedTicket.submittedByEmail ||
                  "—"
                }
              />

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Status
                </label>

                <select
                  value={
                    status
                  }
                  onChange={(
                    event
                  ) =>
                    setStatus(
                      event.target.value
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
                >
                  <option value="NEW">
                    New
                  </option>
                  <option value="UNDER_REVIEW">
                    Under Review
                  </option>
                  <option value="APPROVED">
                    Approved
                  </option>
                  <option value="IN_PROGRESS">
                    In Progress
                  </option>
                  <option value="DEVELOPMENT">
                    Development
                  </option>
                  <option value="COMPLETED">
                    Completed
                  </option>
                  <option value="REJECTED">
                    Rejected
                  </option>
                  <option value="CLOSED">
                    Closed
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Bispun Remarks
                </label>

                <textarea
                  rows={5}
                  value={
                    adminRemarks
                  }
                  onChange={(
                    event
                  ) =>
                    setAdminRemarks(
                      event.target.value
                    )
                  }
                  placeholder="Add status notes, scope clarification or implementation remarks..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <button
                type="button"
                onClick={
                  saveTicket
                }
                disabled={
                  savingId ===
                  selectedTicket.id
                }
                className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md text-sm inline-flex items-center justify-center gap-1.5"
              >
                {savingId ===
                selectedTicket.id ? (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <Save
                    size={14}
                  />
                )}

                Save Request
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="text-xs font-medium text-slate-700">
          Privacy boundary
        </div>

        <div className="text-xs text-slate-500 mt-1">
          Bispun sees only the customization
          request submitted by the client and the
          client's subscription context. This area
          does not expose their leads, admissions,
          revenue, expenses or other private CRM
          records.
        </div>
      </div>
    </div>
  );
}


function SupportTab({client}){const[tickets,setTickets]=useState([]);const[loading,setLoading]=useState(true);const[error,setError]=useState("");const[selected,setSelected]=useState(null);const[status,setStatus]=useState("NEW");const[remarks,setRemarks]=useState("");const[saving,setSaving]=useState(false);async function load(){setLoading(true);setError("");try{const d=await apiRequest(`/api/admin/support?companyId=${encodeURIComponent(client.id)}&scope=support`);setTickets(d.tickets||[]);}catch(e){setError(e?.data?.message||"Unable to load support tickets");}finally{setLoading(false);}}useEffect(()=>{load();},[client.id]);function open(t){setSelected(t);setStatus(t.status);setRemarks(t.adminRemarks||"");}async function save(){if(!selected)return;setSaving(true);try{const d=await apiRequest(`/api/admin/support/${selected.id}`,{method:"PATCH",body:JSON.stringify({status,adminRemarks:remarks})});setSelected(d.ticket);setTickets(c=>c.map(t=>t.id===d.ticket.id?d.ticket:t));}catch(e){setError(e?.data?.message||"Unable to update support ticket");}finally{setSaving(false);}}if(loading)return <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-sm text-slate-500">Loading support...</div>;return <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{error&&<div className="lg:col-span-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs">{error}</div>}<div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden"><div className="px-5 py-4 border-b border-slate-200"><h3 className="text-sm font-semibold">Support Tickets</h3></div><div className="divide-y divide-slate-100">{tickets.map(t=><button key={t.id} type="button" onClick={()=>open(t)} className="w-full px-4 py-3 text-left hover:bg-slate-50"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-medium text-slate-900">{t.title}</div><div className="text-xs text-slate-500 mt-1">{t.ticketNumber} · {t.typeLabel}</div></div><Badge tone="indigo">{t.statusLabel}</Badge></div></button>)}{!tickets.length&&<div className="py-10 text-center text-sm text-slate-500">No technical or billing tickets.</div>}</div></div><div className="bg-white border border-slate-200 rounded-xl p-5">{!selected?<div className="text-sm text-slate-500 text-center py-12">Select a ticket</div>:<div className="space-y-4"><div className="text-base font-semibold">{selected.title}</div><div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap">{selected.description}</div><select value={status} onChange={e=>setStatus(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">{["NEW","UNDER_REVIEW","APPROVED","IN_PROGRESS","DEVELOPMENT","COMPLETED","REJECTED","CLOSED"].map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select><textarea rows={5} value={remarks} onChange={e=>setRemarks(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Admin remarks"/><button type="button" onClick={save} disabled={saving} className="w-full h-9 bg-indigo-600 text-white rounded-lg text-xs font-semibold">{saving?"Saving...":"Save Ticket"}</button></div>}</div></div>}

function ClientActivityTab({client}){const[logs,setLogs]=useState([]);const[loading,setLoading]=useState(true);const[error,setError]=useState("");async function load(){setLoading(true);setError("");try{const p=new URLSearchParams({companyId:client.id,includeClient:"true",limit:"150"});const d=await apiRequest(`/api/admin/audit-logs?${p.toString()}`);setLogs(d.logs||[]);}catch(e){setError(e?.data?.message||"Unable to load client activity");}finally{setLoading(false);}}useEffect(()=>{load();},[client.id]);if(loading)return <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-sm text-slate-500">Loading client activity...</div>;return <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">{error&&<div className="m-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs">{error}</div>}<div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2"><History size={15} className="text-indigo-600"/><h3 className="text-sm font-semibold">Client Activity</h3></div><div className="overflow-x-auto"><table className="w-full"><thead className="bg-slate-50"><tr>{["Time","Source","User","Action","Activity"].map(h=><th key={h} className="text-left px-4 py-2.5 text-xs text-slate-500">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{logs.map(l=><tr key={`${l.source}-${l.id}`}><td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(l.createdAt).toLocaleString("en-IN")}</td><td className="px-4 py-3"><Badge tone={l.source==="SUPER_ADMIN"?"rose":"indigo"}>{l.source==="SUPER_ADMIN"?"Admin":"Client"}</Badge></td><td className="px-4 py-3 text-xs">{l.actorName||"System"}</td><td className="px-4 py-3 text-xs">{String(l.action||"").replaceAll("_"," ")}</td><td className="px-4 py-3 text-xs text-slate-700">{l.summary}</td></tr>)}{!logs.length&&<tr><td colSpan={5} className="py-10 text-center text-sm text-slate-500">No activity yet.</td></tr>}</tbody></table></div></div>}

function BillingTab({
  clientId,
  onClientRefresh,
}) {
  const [billing, setBilling] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    status: "ACTIVE",
    renewalDate: "",
    endDate: "",
  });

  function dateInputValue(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  async function loadBilling() {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(`/api/admin/billing/${clientId}`);
      setCompany(data.company);
      setBilling(data.subscription);

      if (data.subscription) {
        setForm({
          status: data.subscription.status,
          renewalDate: dateInputValue(data.subscription.renewalDate),
          endDate: dateInputValue(data.subscription.endDate),
        });
      }
    } catch (error) {
      setError(error?.data?.message || "Unable to load billing");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBilling();
  }, [clientId]);

  async function saveBilling(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await apiRequest(`/api/admin/billing/${clientId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: form.status,
          renewalDate: form.renewalDate || null,
          endDate: form.endDate || null,
        }),
      });

      setBilling(data.subscription);
      setCompany(data.company);
      setMessage("Billing updated successfully.");

      if (onClientRefresh) {
        await onClientRefresh();
      }
    } catch (error) {
      setError(error?.data?.message || "Unable to update billing");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-16 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col items-center justify-center gap-3">
        <Loader2 size={22} className="animate-spin text-indigo-600" />
        <div className="text-sm text-slate-500">Loading billing...</div>
      </div>
    );
  }

  if (error && !billing) {
    return (
      <div className="bg-white border border-rose-200 rounded-xl p-8 shadow-[0_1px_2px_rgba(15,23,42,0.03)] text-center">
        <AlertCircle size={22} className="mx-auto text-rose-500" />
        <div className="mt-2 text-sm text-rose-700">{error}</div>
        <button
          type="button"
          onClick={loadBilling}
          className="mt-4 px-3 py-2 border border-slate-200 rounded-md text-sm inline-flex items-center gap-1.5 hover:bg-slate-50"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 shadow-[0_1px_2px_rgba(15,23,42,0.03)] text-center">
        <CreditCard size={24} className="mx-auto text-slate-400" />
        <div className="text-sm font-medium text-slate-700 mt-2">
          No subscription found
        </div>
        <div className="text-xs text-slate-500 mt-1">
          This client does not currently have a Bispun subscription.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Subscription Amount"
          value={formatMoney(billing.amount)}
          icon={DollarSign}
          tone="indigo"
        />
        <StatCard
          label="Annual Price"
          value={
            billing.plan?.yearlyPrice
              ? formatMoney(billing.plan.yearlyPrice)
              : "—"
          }
          icon={CalendarDays}
        />
        <StatCard
          label="Billing Cycle"
          value="Annual"
          icon={RefreshCw}
        />
      </div>

      {error && (
        <div className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-sm">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <h3 className="text-sm font-semibold text-slate-900">
            SaaS Billing Details
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Bispun subscription information for {company?.name || "this client"}.
          </p>

          <div className="mt-5 space-y-3">
            <InfoRow label="Plan" value={billing.plan?.name || "—"} />
            <InfoRow label="Billing Cycle" value="Annual" />
            <InfoRow
              label="Original Price"
              value={formatMoney(
                billing.listPrice ??
                  billing.plan?.yearlyPrice ??
                  billing.amount
              )}
            />
            <InfoRow
              label="Discount"
              value={
                Number(billing.discountAmount || 0) > 0
                  ? `− ${formatMoney(billing.discountAmount)}`
                  : "No discount"
              }
            />
            <InfoRow
              label="Total Payable"
              value={formatMoney(
                billing.finalAmount ?? billing.amount
              )}
            />
            <InfoRow label="Start Date" value={formatDate(billing.startDate)} />
            <InfoRow label="Created" value={formatDate(billing.createdAt)} />
          </div>
        </div>

        <form
          onSubmit={saveBilling}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Manage Subscription
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Update subscription status and dates.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-md inline-flex items-center gap-1.5"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save
            </button>
          </div>

          <div className="space-y-4 mt-5">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Subscription Status
              </label>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
              >
                <option value="TRIAL">Trial</option>
                <option value="ACTIVE">Active</option>
                <option value="PAST_DUE">Past Due</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Renewal Date
              </label>
              <input
                type="date"
                value={form.renewalDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    renewalDate: event.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
              />
            </div>
          </div>
        </form>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="text-xs font-medium text-slate-700">
          Privacy boundary
        </div>
        <div className="text-xs text-slate-500 mt-1">
          This Billing section manages only the Bispun SaaS subscription.
          It does not expose the client's admissions revenue, expenses,
          incentives or other private financial records.
        </div>
      </div>
    </div>
  );
}

export default function Client360({
  clientId,
  onBack,
}) {
  const [tab, setTab] =
    useState("overview");

  const [client, setClient] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadClient() {
    setLoading(true);
    setError("");

    try {
      const data =
        await apiRequest(
          `/api/admin/clients/${clientId}`
        );

      setClient(data.client);
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load client"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClient();
  }, [clientId]);

  const tabs = useMemo(
    () => [
      "overview",
      "modules",
      "users",
      "subscription",
      "settings",
      "usage",
      "customization",
      "billing",
      "support",
      "activity",
    ],
    []
  );

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-20 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col items-center justify-center gap-3">
        <Loader2
          size={22}
          className="animate-spin text-indigo-600"
        />

        <span className="text-sm text-slate-500">
          Loading client...
        </span>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="space-y-5">
        <button
          onClick={onBack}
          className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} />
          Back to clients
        </button>

        <div className="bg-white border border-rose-200 rounded-xl p-8 shadow-[0_1px_2px_rgba(15,23,42,0.03)] text-center">
          <AlertCircle
            size={22}
            className="text-rose-500 mx-auto"
          />

          <div className="text-sm text-rose-700 mt-2">
            {error ||
              "Client not found"}
          </div>

          <button
            type="button"
            onClick={loadClient}
            className="mt-4 px-3 py-2 border border-slate-200 rounded-md text-sm inline-flex items-center gap-1.5"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
      >
        <ArrowLeft size={14} />
        Back to clients
      </button>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl shadow-sm ${getAccent(
                client.primaryColor
              )} text-white font-semibold flex items-center justify-center`}
            >
              {getInitials(client)}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-slate-950">
                  {client.name}
                </h2>

                {client.plan && (
                  <PlanPill
                    plan={client.plan}
                  />
                )}

                <Badge
                  tone={statusTone(
                    client.status
                  )}
                >
                  {client.status}
                </Badge>
              </div>

              <div className="text-sm text-slate-500 mt-0.5">
                {client.business ||
                  "Business not specified"}

                {client.city
                  ? ` · ${client.city}`
                  : ""}

                {client.ownerName
                  ? ` · Owner: ${client.ownerName}`
                  : ""}
              </div>

              <div className="text-xs text-slate-400 mt-0.5 inline-flex items-center gap-1">
                <Globe size={11} />

                {client.subdomain ||
                  "No subdomain"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadClient}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-md inline-flex items-center gap-1.5 hover:bg-slate-50"
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl px-3 flex gap-1 overflow-x-auto shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {tabs.map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() =>
              setTab(tabKey)
            }
            className={`px-3 py-3 text-sm font-medium capitalize whitespace-nowrap border-b-2 transition-colors ${
              tab === tabKey
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tabKey}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab
          client={client}
          setClient={setClient}
        />
      )}

      {tab === "modules" && (
        <ModulesTab
          client={client}
          setClient={setClient}
        />
      )}

      {tab === "users" && (
        <UsersTab
          client={client}
        />
      )}

      {tab === "subscription" && (
        <SubscriptionTab
          client={client}
          onClientRefresh={loadClient}
        />
      )}

      {tab === "settings" && (
        <SettingsTab
          client={client}
          setClient={setClient}
        />
      )}

      {tab === "usage" && (
        <UsageTab
          clientId={client.id}
        />
      )}

      {tab === "customization" && (
        <CustomizationTab
          client={client}
        />
      )}

      {tab === "billing" && (
        <BillingTab
          clientId={client.id}
          onClientRefresh={loadClient}
        />
      )}

      {tab === "support" && <SupportTab client={client} />}
      {tab === "activity" && <ClientActivityTab client={client} />}
    </div>
  );
}