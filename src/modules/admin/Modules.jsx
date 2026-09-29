import {

  useEffect,

  useMemo,

  useState,

} from "react";



import {

  Puzzle,

  Save,

  RefreshCw,

  Loader2,

  CheckCircle2,

  XCircle,

  Users,

  Layers,

  AlertCircle,

} from "lucide-react";



import {

  Badge,

  StatCard,

} from "../../components/ui";



import {

  apiRequest,

} from "../../lib/api";



function ModuleEditor({

  module,

  onUpdated,

}) {

  const [form, setForm] =

    useState({

      name:

        module.name,

      description:

        module.description ||

        "",

      icon:

        module.icon || "",

      route:

        module.route || "",

      sortOrder:

        String(

          module.sortOrder

        ),

      active:

        module.active,

    });



  const [saving, setSaving] =

    useState(false);



  const [message, setMessage] =

    useState("");



  const [error, setError] =

    useState("");



  useEffect(() => {

    setForm({

      name:

        module.name,

      description:

        module.description ||

        "",

      icon:

        module.icon || "",

      route:

        module.route || "",

      sortOrder:

        String(

          module.sortOrder

        ),

      active:

        module.active,

    });

  }, [module]);



  async function save() {

    setSaving(true);

    setMessage("");

    setError("");



    try {

      const data =

        await apiRequest(

          `/api/admin/modules/${module.id}`,

          {

            method: "PATCH",



            body: JSON.stringify({

              name:

                form.name,

              description:

                form.description,

              icon:

                form.icon,

              route:

                form.route,

              sortOrder:

                Number(

                  form.sortOrder

                ),

              active:

                form.active,

            }),

          }

        );



      onUpdated(

        data.module

      );



      setMessage(

        data.message ||

          "Module updated successfully"

      );

    } catch (error) {

      setError(

        error?.data?.message ||

          "Unable to update module"

      );

    } finally {

      setSaving(false);

    }

  }



  return (

    <div className="min-w-0 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-shadow">

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">

        <div className="min-w-0 flex-1">

          <div className="flex min-w-0 items-start gap-2">

            <Puzzle

              size={16}

              className="mt-0.5 flex-shrink-0 text-indigo-600"

            />



            <h3 className="min-w-0 break-words text-base font-bold tracking-tight text-slate-950">

              {module.name}

            </h3>

          </div>



          <div className="text-xs font-mono text-slate-400 mt-1">

            {module.key}

          </div>

        </div>



        <div className="flex-shrink-0">

        <Badge

          tone={

            module.active

              ? "emerald"

              : "slate"

          }

        >

          {module.active

            ? "Active"

            : "Inactive"}

        </Badge>

        </div>

      </div>



      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3 mt-5">

        <div>

          <label className="text-xs font-medium text-slate-600">

            Module Name

          </label>



          <input

            value={

              form.name

            }

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

            className="min-w-0 w-full mt-1 h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"

          />

        </div>



        <div>

          <label className="text-xs font-medium text-slate-600">

            Route

          </label>



          <input

            value={

              form.route

            }

            onChange={(

              event

            ) =>

              setForm(

                (current) => ({

                  ...current,

                  route:

                    event.target

                      .value,

                })

              )

            }

            placeholder="/dashboard"

            className="min-w-0 w-full mt-1 h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"

          />

        </div>



        <div>

          <label className="text-xs font-medium text-slate-600">

            Icon Name

          </label>



          <input

            value={

              form.icon

            }

            onChange={(

              event

            ) =>

              setForm(

                (current) => ({

                  ...current,

                  icon:

                    event.target

                      .value,

                })

              )

            }

            placeholder="LayoutDashboard"

            className="min-w-0 w-full mt-1 h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"

          />

        </div>



        <div>

          <label className="text-xs font-medium text-slate-600">

            Sort Order

          </label>



          <input

            type="number"

            min="0"

            value={

              form.sortOrder

            }

            onChange={(

              event

            ) =>

              setForm(

                (current) => ({

                  ...current,

                  sortOrder:

                    event.target

                      .value,

                })

              )

            }

            className="min-w-0 w-full mt-1 h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"

          />

        </div>

      </div>



      <div className="mt-3">

        <label className="text-xs font-medium text-slate-600">

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

          className="min-w-0 w-full mt-1 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"

        />

      </div>



      <div className="flex items-start justify-between gap-4 mt-4 bg-slate-50/80 border border-slate-200 rounded-xl p-4">

        <div className="min-w-0 flex-1">

          <div className="text-sm font-medium text-slate-800">

            Global Module Active

          </div>



          <div className="text-xs text-slate-500 mt-0.5">

            Inactive modules remain

            stored but are treated as

            globally unavailable.

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



      <div className="mt-4">

        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">

          Included In Plans

        </div>



        <div className="flex gap-2 flex-wrap mt-2">

          {module.plans?.length ? (

            module.plans.map(

              (plan) => (

                <Badge

                  key={

                    plan.id

                  }

                  tone={

                    plan.key ===

                    "advanced"

                      ? "amber"

                      : plan.key ===

                        "pro"

                      ? "indigo"

                      : "slate"

                  }

                >

                  {plan.name}

                </Badge>

              )

            )

          ) : (

            <span className="text-xs text-slate-400">

              Not included in any

              plan

            </span>

          )}

        </div>

      </div>



      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">

        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5">

          <div className="text-[10px] uppercase text-slate-500">

            Client Records

          </div>



          <div className="text-lg font-semibold text-slate-900 mt-1">

            {module.clientCount}

          </div>

        </div>



        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5">

          <div className="text-[10px] uppercase text-slate-500">

            Enabled Clients

          </div>



          <div className="text-lg font-semibold text-slate-900 mt-1">

            {module.enabledClientCount}

          </div>

        </div>

      </div>



      {message && (

        <div className="mt-4 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 p-2.5 rounded-lg">

          {message}

        </div>

      )}



      {error && (

        <div className="mt-4 text-xs bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg">

          {error}

        </div>

      )}



      <button

        type="button"

        onClick={save}

        disabled={saving}

        className="w-full mt-4 h-10 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"

      >

        {saving ? (

          <Loader2

            size={14}

            className="animate-spin"

          />

        ) : (

          <Save size={14} />

        )}



        Save Module

      </button>

    </div>

  );

}



export default function Modules() {

  const [modules, setModules] =

    useState([]);



  const [loading, setLoading] =

    useState(true);



  const [error, setError] =

    useState("");



  async function loadModules() {

    setLoading(true);

    setError("");



    try {

      const data =

        await apiRequest(

          "/api/admin/modules"

        );



      setModules(

        data.modules || []

      );

    } catch (error) {

      setError(

        error?.data?.message ||

          "Unable to load modules"

      );

    } finally {

      setLoading(false);

    }

  }



  useEffect(() => {

    loadModules();

  }, []);



  function updateModule(

    updated

  ) {

    setModules(

      (current) =>

        current.map(

          (module) =>

            module.id ===

            updated.id

              ? updated

              : module

        )

    );

  }



  const summary =

    useMemo(() => {

      return {

        total:

          modules.length,



        active:

          modules.filter(

            (module) =>

              module.active

          ).length,



        inactive:

          modules.filter(

            (module) =>

              !module.active

          ).length,



        planLinked:

          modules.filter(

            (module) =>

              module.plans

                ?.length > 0

          ).length,

      };

    }, [modules]);



  return (

    <div className="space-y-5">

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">

        <div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-950">

            Modules

          </h1>



          <p className="text-sm text-slate-500 mt-1">

            Manage the global

            Bispun module catalogue.

          </p>

        </div>



        <button

          type="button"

          onClick={

            loadModules

          }

          disabled={loading}

          className="h-9 flex-shrink-0 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-colors"

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

      </div>



      {error && (

        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-sm text-rose-700">

          {error}

        </div>

      )}



      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        <StatCard

          label="Total Modules"

          value={

            summary.total

          }

          icon={Layers}

          tone="indigo"

        />



        <StatCard

          label="Active"

          value={

            summary.active

          }

          icon={

            CheckCircle2

          }

          tone="emerald"

        />



        <StatCard

          label="Inactive"

          value={

            summary.inactive

          }

          icon={XCircle}

        />



        <StatCard

          label="Linked to Plans"

          value={

            summary.planLinked

          }

          icon={Puzzle}

          tone="indigo"

        />

      </div>



      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">

        <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">

          <AlertCircle

            size={14}

          />



          Global configuration

        </div>



        <div className="text-xs text-amber-800 mt-1">

          Plan membership should be

          managed from Plans &

          Subscriptions. Client-specific

          module overrides should be

          managed from Client 360.

        </div>

      </div>



      {loading ? (

        <div className="bg-white border border-slate-200 rounded-xl py-20 flex items-center justify-center gap-2 text-sm text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">

          <Loader2

            size={16}

            className="animate-spin"

          />



          Loading modules...

        </div>

      ) : (

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {modules.map(

            (module) => (

              <ModuleEditor

                key={

                  module.id

                }

                module={

                  module

                }

                onUpdated={

                  updateModule

                }

              />

            )

          )}

        </div>

      )}

    </div>

  );

}
