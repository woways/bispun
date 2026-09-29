import {
  useEffect,
  useState,
} from "react";

import {
  Settings,
  Save,
  Loader2,
  RefreshCw,
  AlertCircle,
  Mail,
  Phone,
  CalendarDays,
  CreditCard,
  Bell,
  ShieldAlert,
  Building2,
} from "lucide-react";

import {
  apiRequest,
} from "../../lib/api";

function Toggle({
  label,
  description,
  enabled,
  onChange,
}) {
  return (
    <div className="flex items-center justify-between gap-4 border border-slate-200 rounded-xl p-4 bg-slate-50/60 hover:bg-slate-50 transition-colors">
      <div>
        <div className="text-sm font-medium text-slate-900">
          {label}
        </div>

        <div className="text-xs text-slate-500 mt-1">
          {description}
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          onChange(!enabled)
        }
        className={`relative w-11 h-6 rounded-full transition-colors shadow-inner ${
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
      />
    </div>
  );
}

export default function SystemSettings() {
  const [form, setForm] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  async function loadSettings() {
    setLoading(true);
    setError("");

    try {
      const data =
        await apiRequest(
          "/api/admin/system-settings"
        );

      setForm({
        platformName:
          data.settings.platformName ||
          "Bispun",

        supportEmail:
          data.settings.supportEmail ||
          "",

        supportPhone:
          data.settings.supportPhone ||
          "",

        defaultTimezone:
          data.settings
            .defaultTimezone ||
          "Asia/Kolkata",

        defaultCurrency:
          data.settings
            .defaultCurrency ||
          "INR",

        defaultDateFormat:
          data.settings
            .defaultDateFormat ||
          "DD/MM/YYYY",

        defaultTrialDays:
          String(
            data.settings
              .defaultTrialDays ??
              14
          ),

        defaultBillingCycle:
          "YEARLY",

        defaultEmailNotifications:
          data.settings
            .defaultEmailNotifications ??
          true,

        defaultSmsNotifications:
          data.settings
            .defaultSmsNotifications ??
          false,

        maintenanceMode:
          data.settings
            .maintenanceMode ??
          false,

        allowNewClientOnboarding:
          data.settings
            .allowNewClientOnboarding ??
          true,

        defaultPrimaryColor:
          data.settings
            .defaultPrimaryColor ||
          "indigo",
      });
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load system settings"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  function setField(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]:
          value,
      })
    );
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
          "/api/admin/system-settings",
          {
            method: "PATCH",

            body: JSON.stringify({
              ...form,

              defaultTrialDays:
                Number(
                  form.defaultTrialDays
                ),
            }),
          }
        );

      setMessage(
        data.message ||
          "System settings updated successfully"
      );
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to save system settings"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-20 flex items-center justify-center gap-2 text-sm text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <Loader2
          size={17}
          className="animate-spin"
        />

        Loading system settings...
      </div>
    );
  }

  if (!form) {
    return (
      <div className="bg-white border border-rose-200 rounded-xl p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <AlertCircle
          size={22}
          className="mx-auto text-rose-500"
        />

        <div className="text-sm text-rose-700 mt-2">
          {error ||
            "Unable to load settings"}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={
        saveSettings
      }
      className="space-y-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Settings
              size={18}
              className="text-indigo-600"
            />

            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              System Settings
            </h1>
          </div>

          <p className="text-sm text-slate-500 mt-1">
            Global Bispun
            platform defaults and
            operational controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={
              loadSettings
            }
            className="h-9 px-3.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <RefreshCw
              size={13}
            />

            Refresh
          </button>

          <button
            type="submit"
            disabled={saving}
            className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-colors"
          >
            {saving ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <Save
                size={14}
              />
            )}

            Save Settings
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-4 text-sm">
          {message}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2">
          <Building2
            size={15}
            className="text-indigo-600"
          />

          <h3 className="text-sm font-bold tracking-tight text-slate-950">
            Platform Identity
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <Field
            label="Platform Name"
            value={
              form.platformName
            }
            onChange={(value) =>
              setField(
                "platformName",
                value
              )
            }
          />

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Default Primary Color
            </label>

            <select
              value={
                form.defaultPrimaryColor
              }
              onChange={(event) =>
                setField(
                  "defaultPrimaryColor",
                  event.target.value
                )
              }
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
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
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2">
          <Mail
            size={15}
            className="text-indigo-600"
          />

          <h3 className="text-sm font-bold tracking-tight text-slate-950">
            Support Contact
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <Field
            label="Support Email"
            type="email"
            value={
              form.supportEmail
            }
            onChange={(value) =>
              setField(
                "supportEmail",
                value
              )
            }
            placeholder="support@consulbuzz.com"
          />

          <Field
            label="Support Phone"
            value={
              form.supportPhone
            }
            onChange={(value) =>
              setField(
                "supportPhone",
                value
              )
            }
            placeholder="+91..."
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2">
          <CalendarDays
            size={15}
            className="text-indigo-600"
          />

          <h3 className="text-sm font-bold tracking-tight text-slate-950">
            Default Client Settings
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <Field
            label="Timezone"
            value={
              form.defaultTimezone
            }
            onChange={(value) =>
              setField(
                "defaultTimezone",
                value
              )
            }
          />

          <Field
            label="Currency"
            value={
              form.defaultCurrency
            }
            onChange={(value) =>
              setField(
                "defaultCurrency",
                value
              )
            }
          />

          <Field
            label="Date Format"
            value={
              form.defaultDateFormat
            }
            onChange={(value) =>
              setField(
                "defaultDateFormat",
                value
              )
            }
          />

          <Field
            label="Default Trial Days"
            type="number"
            value={
              form.defaultTrialDays
            }
            onChange={(value) =>
              setField(
                "defaultTrialDays",
                value
              )
            }
          />

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Billing Cycle
            </label>

            <div className="flex h-10 w-full items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
              Annual only
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2">
          <Bell
            size={15}
            className="text-indigo-600"
          />

          <h3 className="text-sm font-bold tracking-tight text-slate-950">
            Notification Defaults
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <Toggle
            label="Email Notifications"
            description="Default email notification preference for newly onboarded clients."
            enabled={
              form.defaultEmailNotifications
            }
            onChange={(value) =>
              setField(
                "defaultEmailNotifications",
                value
              )
            }
          />

          <Toggle
            label="SMS Notifications"
            description="Default SMS notification preference for newly onboarded clients."
            enabled={
              form.defaultSmsNotifications
            }
            onChange={(value) =>
              setField(
                "defaultSmsNotifications",
                value
              )
            }
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2">
          <ShieldAlert
            size={15}
            className="text-amber-600"
          />

          <h3 className="text-sm font-bold tracking-tight text-slate-950">
            Operational Controls
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <Toggle
            label="Maintenance Mode"
            description="Blocks client-portal API access while enabled. Super Admin remains available so maintenance can be turned off."
            enabled={
              form.maintenanceMode
            }
            onChange={(value) =>
              setField(
                "maintenanceMode",
                value
              )
            }
          />

          <Toggle
            label="Allow New Client Onboarding"
            description="When disabled, the backend rejects new client onboarding until this switch is enabled again."
            enabled={
              form.allowNewClientOnboarding
            }
            onChange={(value) =>
              setField(
                "allowNewClientOnboarding",
                value
              )
            }
          />
        </div>
      </div>

      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4">
        <div className="text-xs font-medium text-slate-700">
          Platform-level settings
        </div>

        <div className="text-xs text-slate-500 mt-1">
          These settings belong to
          Bispun itself. They do
          not expose or modify client
          CRM leads, admissions,
          revenue, expenses or other
          operational records.
        </div>
      </div>
    </form>
  );
}
