import {

  useEffect,

  useState,

} from "react";



import {

  Check,

  X,

  Package,

  Zap,

  Crown,

  AlertCircle,

  Loader2,

  Save,

  RefreshCw,

} from "lucide-react";



import {

  SectionHeader,

  Badge,

} from "../../components/ui";



import { apiRequest } from "../../lib/api";



function formatMoney(value) {

  return `₹${Number(

    value || 0

  ).toLocaleString("en-IN")}`;

}



function planIcon(key) {

  if (key === "pro") {

    return Zap;

  }



  if (key === "advanced") {

    return Crown;

  }



  return Package;

}



function planTone(key) {

  if (key === "pro") {

    return "border-indigo-400 ring-2 ring-indigo-100";

  }



  if (key === "advanced") {

    return "border-amber-300";

  }



  return "border-slate-200";

}



function PlanCard({

  plan,

  onUpdated,

}) {

  const [form, setForm] =

    useState({

      name: plan.name,

      tagline:

        plan.tagline || "",

      description:

        plan.description || "",



      yearlyPrice:

        plan.yearlyPrice !==

        null

          ? String(

              plan.yearlyPrice

            )

          : "",



      active:

        plan.active,

    });



  const [saving, setSaving] =

    useState(false);



  const [moduleSaving, setModuleSaving] =

    useState(null);



  const [message, setMessage] =

    useState("");



  const [error, setError] =

    useState("");



  useEffect(() => {

    setForm({ name: plan.name, tagline: plan.tagline || "", description: plan.description || "", yearlyPrice: plan.yearlyPrice !== null ? String(plan.yearlyPrice) : "", active: plan.active });

  }, [plan]);



  const Icon =

    planIcon(plan.key);



  async function savePlan() {

    setSaving(true);

    setMessage("");

    setError("");



    try {

      const data =

        await apiRequest(

          `/api/admin/plans/${plan.id}`,

          {

            method: "PATCH",



            body: JSON.stringify({

              name:

                form.name,



              tagline:

                form.tagline,



              description:

                form.description,



              yearlyPrice:

                form.yearlyPrice,



              active:

                form.active,

            }),

          }

        );



      setMessage(

        data.message ||

          "Plan updated successfully"

      );



      onUpdated(

        data.plan

      );

    } catch (error) {

      setError(

        error?.data?.message ||

          "Unable to update plan"

      );

    } finally {

      setSaving(false);

    }

  }



  async function toggleModule(

    module

  ) {

    if (moduleSaving) {

      return;

    }



    setModuleSaving(

      module.id

    );



    setMessage("");

    setError("");



    try {

      const data =

        await apiRequest(

          `/api/admin/plans/${plan.id}/modules/${module.id}`,

          {

            method: "PATCH",



            body: JSON.stringify({

              enabled:

                !module.enabled,

            }),

          }

        );



      onUpdated(

        data.plan

      );



      setMessage(

        data.message

      );

    } catch (error) {

      setError(

        error?.data?.message ||

          "Unable to update module"

      );

    } finally {

      setModuleSaving(

        null

      );

    }

  }



  return (

    <div

      className={`min-w-0 bg-white border rounded-2xl p-4 sm:p-5 relative shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition-shadow ${planTone(

        plan.key

      )}`}

    >

      {plan.key === "pro" && (

        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-indigo-600 text-white text-[10px] font-bold tracking-[0.08em] px-3 py-1 rounded-full uppercase shadow-sm">

          Most Popular

        </div>

      )}



      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

        <div className="flex min-w-0 items-start gap-2">

          <Icon

            size={16}

            className={`mt-0.5 flex-shrink-0 ${

              plan.key ===

              "advanced"

                ? "text-amber-600"

                : plan.key ===

                  "pro"

                ? "text-indigo-600"

                : "text-slate-500"

            }`}

          />



          <h3 className="min-w-0 break-words text-lg font-bold tracking-tight text-slate-950">

            {plan.name}

          </h3>

        </div>



        <div className="flex-shrink-0">

        <Badge

          tone={

            form.active

              ? "emerald"

              : "slate"

          }

        >

          {form.active

            ? "Active"

            : "Inactive"}

        </Badge>

        </div>

      </div>



      <div className="mt-5 space-y-4">

        <div>

          <label className="block text-xs font-medium text-slate-600 mb-1">

            Plan Name

          </label>



          <input

            value={form.name}

            onChange={(

              event

            ) =>

              setForm(

                (current) => ({

                  ...current,

                  name:

                    event.target

                      .value,

                })

              )

            }

            className="min-w-0 w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"

          />

        </div>



        <div>

          <label className="block text-xs font-medium text-slate-600 mb-1">

            Tagline

          </label>



          <textarea

            rows={2}

            value={

              form.tagline

            }

            onChange={(

              event

            ) =>

              setForm(

                (current) => ({

                  ...current,

                  tagline:

                    event.target

                      .value,

                })

              )

            }

            className="min-w-0 w-full min-h-[64px] px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"

          />

        </div>



        <div>

          <label className="block text-xs font-medium text-slate-600 mb-1">

            Annual Price

          </label>



          <input

            type="number"

            min="0"

            value={

              form.yearlyPrice

            }

            onChange={(

              event

            ) =>

              setForm(

                (current) => ({

                  ...current,

                  yearlyPrice:

                    event.target

                      .value,

                })

              )

            }

            placeholder="Annual subscription price"

            className="min-w-0 w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"

          />

        </div>



        <div>

          <label className="block text-xs font-medium text-slate-600 mb-1">

            Description

          </label>



          <textarea

            rows={3}

            value={

              form.description

            }

            onChange={(

              event

            ) =>

              setForm(

                (current) => ({

                  ...current,

                  description:

                    event.target

                      .value,

                })

              )

            }

            className="min-w-0 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"

          />

        </div>



        <div className="flex items-start justify-between gap-4 bg-slate-50/80 border border-slate-200 rounded-xl px-4 py-3">

          <div className="min-w-0 flex-1">

            <div className="text-sm font-medium text-slate-800">

              Plan Active

            </div>



            <div className="text-xs text-slate-500">

              Inactive plans cannot be

              assigned to new clients.

            </div>

          </div>



          <button

            type="button"

            onClick={() =>

              setForm(

                (current) => ({

                  ...current,

                  active:

                    !current.active,

                })

              )

            }

            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition ${

              form.active

                ? "bg-indigo-600"

                : "bg-slate-300"

            }`}

          >

            <div

              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition ${

                form.active

                  ? "left-6"

                  : "left-1"

              }`}

            />

          </button>

        </div>



        <button

          type="button"

          onClick={savePlan}

          disabled={saving}

          className="w-full h-10 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-colors"

        >

          {saving ? (

            <Loader2

              size={14}

              className="animate-spin"

            />

          ) : (

            <Save size={14} />

          )}



          Save Plan

        </button>



        {message && (

          <div className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-2.5">

            {message}

          </div>

        )}



        {error && (

          <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-2.5">

            {error}

          </div>

        )}

      </div>



      <div className="border-t border-slate-200 mt-5 pt-4">

        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">

          Module Access

        </h4>



        <div className="mt-3 grid grid-cols-1 gap-1">

          {plan.modules.map(

            (module) => (

              <button

                key={

                  module.id

                }

                type="button"

                disabled={

                  moduleSaving ===

                    module.id ||

                  (!module.active &&

                    !module.enabled)

                }

                onClick={() =>

                  toggleModule(

                    module

                  )

                }

                className="w-full min-w-0 flex items-start gap-2.5 text-sm text-left px-2 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"

              >

                {moduleSaving ===

                module.id ? (

                  <Loader2

                    size={14}

                    className="mt-0.5 flex-shrink-0 animate-spin text-indigo-500"

                  />

                ) : module.enabled ? (

                  <Check

                    size={14}

                    className="mt-0.5 flex-shrink-0 text-emerald-600"

                  />

                ) : (

                  <X

                    size={14}

                    className="mt-0.5 flex-shrink-0 text-slate-300"

                  />

                )}



                <span

                  className={

                    module.enabled

                      ? "min-w-0 break-words text-slate-700"

                      : "min-w-0 break-words text-slate-400"

                  }

                >

                  {module.name}

                </span>

              </button>

            )

          )}

        </div>

      </div>



      <div className="mt-5 pt-4 border-t border-slate-200 text-xs text-slate-500">

        Current annual value:{" "}

        <strong>

          {formatMoney(

            plan.yearlyPrice

          )}

        </strong>

      </div>

    </div>

  );

}



export default function Plans() {

  const [plans, setPlans] =

    useState([]);



  const [loading, setLoading] =

    useState(true);



  const [error, setError] =

    useState("");



  async function loadPlans() {

    setLoading(true);

    setError("");



    try {

      const data =

        await apiRequest(

          "/api/admin/plans"

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

      setLoading(false);

    }

  }



  useEffect(() => {

    loadPlans();

  }, []);



  function updatePlan(

    updated

  ) {

    setPlans(

      (current) =>

        current.map(

          (plan) =>

            plan.id ===

            updated.id

              ? updated

              : plan

        )

    );

  }



  return (

    <div className="space-y-5">

      <SectionHeader

        title="Plans & Subscriptions"

        subtitle="Control subscription pricing, plan availability and default module access across Bispun."

        action={

          <button

            type="button"

            onClick={loadPlans}

            disabled={loading}

            className="h-9 px-3.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-colors"

          >

            <RefreshCw

              size={13}

              className={

                loading

                  ? "animate-spin"

                  : ""

              }

            />



            Refresh

          </button>

        }

      />



      {error && (

        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">

          {error}

        </div>

      )}



      {loading ? (

        <div className="bg-white border border-slate-200 rounded-xl p-16 text-sm text-slate-500 flex items-center justify-center gap-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">

          <Loader2

            size={16}

            className="animate-spin"

          />



          Loading real plans...

        </div>

      ) : (

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">

          {plans.map(

            (plan) => (

              <PlanCard

                key={

                  plan.id

                }

                plan={plan}

                onUpdated={

                  updatePlan

                }

              />

            )

          )}

        </div>

      )}



      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">

        <div className="font-semibold flex items-center gap-1.5">

          <AlertCircle

            size={14}

          />



          Plan configuration

        </div>



        <div className="mt-1 text-amber-800">

          Changes here affect plan

          pricing and default module

          access. Existing client-specific

          module overrides are not

          automatically rewritten until

          that client's plan is changed

          or modules are managed from

          Client 360.

        </div>

      </div>

    </div>

  );

}
