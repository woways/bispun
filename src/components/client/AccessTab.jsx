import { useMemo, useState } from "react";
import {
  Info,
  ChevronRight,
  Check,
  LockKeyhole,
  LayoutGrid,
  MessageSquare,
  Target,
  Users,
  Share2,
  GraduationCap,
  DoorOpen,
  ClipboardList,
  CheckCircle2,
  Banknote,
  BarChart3,
  Store,
  Gift,
  LifeBuoy,
} from "lucide-react";
import {
  SCOPES,
  ACCESS_GROUPS,
  normalizeLevelPermissions,
  flagsFromComponents,
} from "./accessModel.js";

/**
 * Access editor — permissions are configured PER LEVEL. This is the artifact's
 * single permission MATRIX: modules × the 11 actions, split Core / Extended,
 * with expandable object (component) sub-rows. Toggles follow the brand theme.
 * Admissions stream/college scoping is kept as a section below the matrix.
 */

const CORE = ["View", "Create", "Edit", "Delete"];
const EXT = ["Assign", "Review", "Approve", "Comment", "Import", "Message", "Export"];
const COLS = [...CORE, ...EXT];

const PAGE_ICON = {
  dashboard: LayoutGrid,
  chats: MessageSquare,
  "goals-and-targets": Target,
  "lead-store": Users,
  "utm-leads": Share2,
  admissions: GraduationCap,
  walkins: DoorOpen,
  counselling: ClipboardList,
  "admissions-done": CheckCircle2,
  revenue: Banknote,
  analytics: BarChart3,
  "my-store": Store,
  "my-referrals": Gift,
  help: LifeBuoy,
};

// Pages shown in the matrix: every page in a non-locked, non-personal group.
const MATRIX_PAGES = ACCESS_GROUPS.filter((g) => !g.locked && !/^Personal/.test(g.g)).flatMap(
  (g) => g.pages
);

const isAdminLevel = (l) =>
  String(l?.name || "").trim().toLowerCase() === "admin" ||
  String(l?.code || "").trim().toUpperCase() === "ADM";

export default function AccessTab({ levels = [], admissionsTree, canEdit = true, saving = false, onSave }) {
  const ordered = useMemo(
    () => [...levels].sort((a, b) => (a.rank || 0) - (b.rank || 0) || a.name.localeCompare(b.name)),
    [levels]
  );
  const [curId, setCurId] = useState(ordered[0]?.id || null);
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(levels.map((l) => [l.id, normalizeLevelPermissions(l.permissions)]))
  );
  const [openPages, setOpenPages] = useState(() => new Set(["lead-store", "admissions"]));
  const [dirty, setDirty] = useState(false);

  const cur = ordered.find((l) => l.id === curId) || ordered[0];
  const perms = cur ? drafts[cur.id] || normalizeLevelPermissions() : null;
  const adminLevel = isAdminLevel(cur);
  const editable = canEdit && !adminLevel;

  const streams = useMemo(() => {
    const out = [];
    (admissionsTree?.markets || []).forEach((m) => (m.streams || []).forEach((s) => out.push(s)));
    return out;
  }, [admissionsTree]);

  if (!cur) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-[13px] text-slate-500">
        No levels defined yet. Add levels under the <b>Levels</b> tab, then set their access here.
      </div>
    );
  }

  /* ---------- mutators ---------- */
  function mutate(fn) {
    if (!editable) return;
    setDrafts((d) => {
      const next = { ...d, [cur.id]: structuredClone(d[cur.id] || normalizeLevelPermissions()) };
      fn(next[cur.id]);
      return next;
    });
    setDirty(true);
  }
  const setScope = (v) => mutate((p) => (p.scope = v));
  const setObjAction = (compId, act, val) =>
    mutate((p) => {
      p.components[compId] = p.components[compId] || {};
      if (val) p.components[compId][act] = true;
      else {
        delete p.components[compId][act];
        if (!Object.keys(p.components[compId]).length) delete p.components[compId];
      }
    });
  const setModuleAction = (page, act, val) =>
    mutate((p) => {
      page.comps.forEach((c) => {
        if (!c.acts.includes(act)) return;
        p.components[c.id] = p.components[c.id] || {};
        if (val) p.components[c.id][act] = true;
        else {
          delete p.components[c.id][act];
          if (!Object.keys(p.components[c.id]).length) delete p.components[c.id];
        }
      });
    });
  const toggleCollege = (collegeId) =>
    mutate((p) => {
      const set = new Set(p.admissions.collegeIds);
      set.has(collegeId) ? set.delete(collegeId) : set.add(collegeId);
      p.admissions.collegeIds = [...set];
    });
  const toggleStreamAll = (stream) =>
    mutate((p) => {
      const ids = stream.colleges.map((c) => c.id);
      const anyOff = ids.some((id) => !p.admissions.collegeIds.includes(id));
      const set = new Set(p.admissions.collegeIds);
      ids.forEach((id) => (anyOff ? set.add(id) : set.delete(id)));
      p.admissions.collegeIds = [...set];
    });

  /* ---------- derived ---------- */
  const appliesPage = (page, act) => page.comps.some((c) => c.acts.includes(act));
  const moduleState = (page, act) => {
    const supporting = page.comps.filter((c) => c.acts.includes(act));
    if (!supporting.length) return "na";
    const on = supporting.filter((c) => perms.components[c.id]?.[act]).length;
    return on === supporting.length ? "on" : "off";
  };
  const objState = (comp, act) =>
    comp.acts.includes(act) ? (perms.components[comp.id]?.[act] ? "on" : "off") : "na";

  const toggleOpen = (id) =>
    setOpenPages((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const levelName = cur.name;

  return (
    <div className="space-y-5">
      {/* header */}
      <div>
        <h3 className="text-[20px] font-extrabold text-slate-900">Access</h3>
        <p className="mt-1 max-w-[760px] text-[13px] leading-relaxed text-slate-500">
          Pick a level, then set its data scope and module permissions. Permissions live on the level — every user
          inherits from their level. <b className="text-slate-700">Administrators always have full access.</b>{" "}
          Managers fine-tune individuals on the People tab.
        </p>
      </div>

      {!canEdit && (
        <div className="flex gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-[12.5px] leading-relaxed text-indigo-800">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Level defaults are set by Administrators — shown read-only. Adjust your own team members on the People tab.
        </div>
      )}
      {adminLevel && (
        <div className="flex gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-[12.5px] leading-relaxed text-indigo-800">
          <LockKeyhole size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Admin access is protected and always ON. It cannot be reduced or overridden.
        </div>
      )}

      {/* level pills */}
      <div>
        <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-500">Level</div>
        <div className="flex flex-wrap gap-2.5">
          {ordered.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={l.id === cur.id}
              onClick={() => setCurId(l.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                l.id === cur.id
                  ? "border-brand-600 bg-brand-600 text-white shadow-brand-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {isAdminLevel(l) && <LockKeyhole size={13} aria-hidden="true" />}
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* scope */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h4 className="text-[15px] font-extrabold text-slate-900">Whose data can {levelName} see?</h4>
        <p className="mb-3.5 mt-1 text-[12.5px] leading-relaxed text-slate-500">
          The data scope applied to leads, admissions &amp; tasks.
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Data scope">
          {SCOPES.map(([v, lbl, sub]) => {
            const sel = (adminLevel ? "everyone" : perms.scope) === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={sel}
                aria-label={`${lbl} — ${sub}`}
                disabled={!editable}
                onClick={() => setScope(v)}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                  sel ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300"
                } ${editable ? "" : "cursor-default opacity-80"}`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                    sel ? "border-brand-600" : "border-slate-300"
                  }`}
                >
                  {sel && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
                </span>
                <span className="text-[14px] text-slate-800">
                  {lbl}
                  <span className="mt-0.5 block text-[11.5px] text-slate-400">{sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* matrix */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="p-4 sm:p-5">
          <h4 className="text-[15px] font-extrabold text-slate-900">Module &amp; Object Permissions</h4>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
            {adminLevel
              ? "Admin has full access to every module and object — protected."
              : "Toggle any cell; expand a module to set each object."}
          </p>
        </div>
        <div className="overflow-x-auto native:[-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[940px] border-collapse text-left">
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  scope="col"
                  className="sticky left-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500"
                  style={{ minWidth: 230 }}
                >
                  Module / Object
                </th>
                <th
                  colSpan={CORE.length}
                  scope="colgroup"
                  className="bg-slate-50 px-2 pb-1 pt-3 text-center text-[10.5px] font-bold uppercase tracking-wider text-brand-600"
                >
                  Core Access
                </th>
                <th
                  colSpan={EXT.length}
                  scope="colgroup"
                  className="border-l-2 border-slate-200 bg-slate-50 px-2 pb-1 pt-3 text-center text-[10.5px] font-bold uppercase tracking-wider text-slate-500"
                >
                  Extended Access
                </th>
              </tr>
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className={`border-b border-slate-200 bg-slate-50 px-2 pb-3 text-center text-[11.5px] font-semibold text-slate-600 ${
                      c === EXT[0] ? "border-l-2" : ""
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_PAGES.map((page) => {
                const Icon = PAGE_ICON[page.id] || LayoutGrid;
                const expandable = page.comps.length > 1;
                const isOpen = openPages.has(page.id);
                return (
                  <ModuleRows
                    key={page.id}
                    page={page}
                    Icon={Icon}
                    expandable={expandable}
                    isOpen={isOpen}
                    onToggleOpen={() => toggleOpen(page.id)}
                    adminLevel={adminLevel}
                    editable={editable}
                    appliesPage={appliesPage}
                    moduleState={moduleState}
                    objState={objState}
                    setModuleAction={setModuleAction}
                    setObjAction={setObjAction}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 px-4 py-3 text-[12px] text-slate-500">
          <span className="inline-flex items-center gap-2"><Toggle state="off" disabled decorative label="Off (example)" /> Off</span>
          <span className="inline-flex items-center gap-2"><Toggle state="on" disabled decorative label="Granted (example)" /> Granted</span>
          <span className="inline-flex items-center gap-2"><span className="text-[11px] font-bold text-slate-300">NA</span> Not applicable</span>
        </div>
      </section>

      {/* admissions college scope (kept; not in the artifact) */}
      {streams.length > 0 && (
        <StreamScope
          streams={streams}
          perms={perms}
          editable={editable}
          onToggleCollege={toggleCollege}
          onToggleStreamAll={toggleStreamAll}
        />
      )}

      {/* save bar */}
      {editable && (
        <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <span className="text-[12.5px] text-slate-500">
            {dirty ? "Unsaved changes to " : "No unsaved changes · "}
            <b className="text-slate-700">{levelName}</b>
          </span>
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={!dirty}
              onClick={() => {
                setDrafts((d) => ({ ...d, [cur.id]: normalizeLevelPermissions(cur.permissions) }));
                setDirty(false);
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13.5px] font-bold text-slate-700 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => {
                onSave?.(cur.id, { ...perms, flags: flagsFromComponents(perms.components) });
                setDirty(false);
              }}
              className="rounded-lg bg-brand-600 px-5 py-2 text-[13.5px] font-bold text-white shadow-brand-sm transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save level access"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- rows ---------- */
function ModuleRows({
  page,
  Icon,
  expandable,
  isOpen,
  onToggleOpen,
  adminLevel,
  editable,
  appliesPage,
  moduleState,
  objState,
  setModuleAction,
  setObjAction,
}) {
  return (
    <>
      <tr className="border-t border-slate-100">
        <th scope="row" className="sticky left-0 z-10 bg-white text-left font-normal" style={{ minWidth: 230 }}>
          <div className="flex items-center gap-2.5 px-4 py-2.5">
            {expandable ? (
              <button
                type="button"
                onClick={onToggleOpen}
                aria-expanded={isOpen}
                aria-label={`${isOpen ? "Collapse" : "Expand"} ${page.name}`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <ChevronRight size={14} className={`transition ${isOpen ? "rotate-90" : ""}`} aria-hidden="true" />
              </button>
            ) : (
              <span className="w-6 shrink-0" />
            )}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Icon size={15} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-bold text-slate-800">{page.name}</span>
              <span className="block text-[11px] font-normal text-slate-400">
                {page.comps.length} object{page.comps.length > 1 ? "s" : ""}
              </span>
            </span>
          </div>
        </th>
        {COLS.map((c) => {
          const sup = page.comps.filter((x) => x.acts.includes(c));
          const grantedN = adminLevel ? sup.length : sup.filter((x) => perms.components[x.id]?.[c]).length;
          const st = adminLevel ? "on" : appliesPage(page, c) ? moduleState(page, c) : "na";
          return (
            <td key={c} className={`px-2 py-2 text-center ${c === EXT[0] ? "border-l-2 border-slate-200" : ""}`}>
              {st === "na" ? (
                <span className="text-[11px] font-bold text-slate-300">NA</span>
              ) : (
                <div className="flex justify-center">
                  <Toggle
                    state={st}
                    disabled={!editable}
                    label={`${page.name} — ${c}, ${grantedN} of ${sup.length} granted`}
                    onClick={() => setModuleAction(page, c, st !== "on")}
                  />
                </div>
              )}
            </td>
          );
        })}
      </tr>
      {isOpen &&
        page.comps.map((comp) => (
          <tr key={comp.id} className="bg-slate-50/60">
            <th scope="row" className="sticky left-0 z-10 bg-slate-50/60 text-left font-normal" style={{ minWidth: 230 }}>
              <div className="py-2 pl-[60px] pr-4 text-[13px] text-slate-600">{comp.name}</div>
            </th>
            {COLS.map((c) => {
              const st = adminLevel ? (comp.acts.includes(c) ? "on" : "na") : objState(comp, c);
              return (
                <td key={c} className={`px-2 py-1.5 text-center ${c === EXT[0] ? "border-l-2 border-slate-200" : ""}`}>
                  {st === "na" ? (
                    <span className="text-[11px] font-bold text-slate-300">NA</span>
                  ) : (
                    <div className="flex justify-center">
                      <Toggle
                        state={st}
                        disabled={!editable}
                        label={`${comp.name} — ${c}`}
                        onClick={() => setObjAction(comp.id, c, st !== "on")}
                      />
                    </div>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
    </>
  );
}

/* ---------- brand-color toggle (binary on/off checkbox) ---------- */
function Toggle({ state, disabled = false, decorative = false, label, onClick }) {
  const on = state === "on";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      aria-hidden={decorative || undefined}
      tabIndex={decorative ? -1 : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-[23px] w-[42px] shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
        on ? "border-brand-600 bg-brand-600" : "border-slate-300 bg-slate-200"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-1/2 h-[17px] w-[17px] -translate-y-1/2 rounded-full border border-slate-300 bg-white shadow transition-all ${
          on ? "left-[22px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}

/* ---------- admissions college scope ---------- */
function StreamScope({ streams, perms, editable, onToggleCollege, onToggleStreamAll }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h4 className="text-[15px] font-extrabold text-slate-900">Streams &amp; Colleges this level can see</h4>
      <p className="mb-3 mt-1 text-[12.5px] leading-relaxed text-slate-500">
        Pick the streams &amp; colleges. A Manager can then grant employees only a subset — never more than they hold.
      </p>
      <div className="space-y-2">
        {streams.map((st) => {
          const ids = (st.colleges || []).map((c) => c.id);
          const on = ids.filter((id) => perms.admissions.collegeIds.includes(id)).length;
          const tot = ids.length;
          const state = tot > 0 && on === tot ? "on" : "off";
          const isOpen = open.has(st.id);
          return (
            <div key={st.id} className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Toggle
                  state={state}
                  disabled={!editable}
                  label={`All colleges in ${st.name} — ${on} of ${tot} selected`}
                  onClick={() => onToggleStreamAll(st)}
                />
                <button
                  type="button"
                  onClick={() => toggle(st.id)}
                  aria-expanded={isOpen}
                  className="flex flex-1 items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                >
                  <span className="text-[14px] font-bold text-slate-800">{st.name}</span>
                  <span className="flex items-center gap-1.5 text-[12px] text-slate-400">
                    {on}/{tot} colleges
                    <ChevronRight size={13} className={`transition ${isOpen ? "rotate-90" : ""}`} aria-hidden="true" />
                  </span>
                </button>
              </div>
              {isOpen && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-2.5">
                  {(st.colleges || []).map((c) => {
                    const sel = perms.admissions.collegeIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="checkbox"
                        aria-checked={sel}
                        disabled={!editable}
                        onClick={() => onToggleCollege(c.id)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                          sel
                            ? "border-brand-200 bg-brand-50 text-brand-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        {sel && <Check size={12} aria-hidden="true" />}
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
