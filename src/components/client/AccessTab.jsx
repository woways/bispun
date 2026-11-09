import { useMemo, useState } from "react";
import { Info, ChevronRight, Check, Minus } from "lucide-react";
import {
  ACTIONS,
  SCOPES,
  ACCESS_GROUPS,
  normalizeLevelPermissions,
  flagsFromComponents,
} from "./accessModel.js";

/**
 * Access editor — permissions are configured PER LEVEL (organizationConfig.levels[].permissions).
 * Every user inherits from their level by levelId; individuals are fine-tuned on the
 * People tab (reusing PermissionTree + clampPageAccessToActor for no-escalation).
 *
 * Props:
 *   levels          [{ id, name, rank, permissions }]
 *   admissionsTree  { markets: [{ key, label, streams: [{ id, name, colleges:[{id,name}] }] }] }
 *   canEdit         boolean  (Admins only; managers see read-only)
 *   saving          boolean
 *   onSave(levelId, permissions)
 */
export default function AccessTab({ levels = [], admissionsTree, canEdit = true, saving = false, onSave }) {
  const ordered = useMemo(
    () => [...levels].sort((a, b) => (a.rank || 0) - (b.rank || 0) || a.name.localeCompare(b.name)),
    [levels]
  );
  const [curId, setCurId] = useState(ordered[0]?.id || null);
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(levels.map((l) => [l.id, normalizeLevelPermissions(l.permissions)]))
  );
  const [openPages, setOpenPages] = useState(() => new Set(["dashboard", "lead-store"]));
  const [openStreams, setOpenStreams] = useState(() => new Set());
  const [dirty, setDirty] = useState(false);

  const cur = ordered.find((l) => l.id === curId) || ordered[0];
  const perms = cur ? drafts[cur.id] || normalizeLevelPermissions() : null;
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
    if (!canEdit) return;
    setDrafts((d) => {
      const next = { ...d, [cur.id]: structuredClone(d[cur.id] || normalizeLevelPermissions()) };
      fn(next[cur.id]);
      return next;
    });
    setDirty(true);
  }
  const setScope = (v) => mutate((p) => (p.scope = v));
  const toggleComp = (cid, act) =>
    mutate((p) => {
      p.components[cid] = p.components[cid] || {};
      if (p.components[cid][act]) delete p.components[cid][act];
      else p.components[cid][act] = true;
    });
  const bulkAction = (act, on) =>
    mutate((p) => {
      ACCESS_GROUPS.forEach((g) => {
        if (g.locked) return;
        g.pages.forEach((pg) =>
          pg.comps.forEach((c) => {
            if (!c.acts.includes(act) || act === "View") return;
            p.components[c.id] = p.components[c.id] || {};
            if (on) p.components[c.id][act] = true;
            else delete p.components[c.id][act];
          })
        );
      });
    });
  const toggleCollege = (streamId, collegeId) =>
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
  const anyAction = Object.fromEntries(
    ACTIONS.map((a) => [a, Object.values(perms.components).some((c) => c[a])])
  );
  const pageState = (page) => {
    let on = 0,
      tot = 0;
    page.comps.forEach((c) =>
      c.acts.forEach((a) => {
        tot++;
        if (perms.components[c.id]?.[a]) on++;
      })
    );
    return on === 0 ? "none" : on === tot ? "all" : "some";
  };
  const togglePage = (id) =>
    setOpenPages((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleStreamOpen = (id) =>
    setOpenStreams((s) => {
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
          Pick a level, then set three things. Permissions live on the level — every user
          inherits from their level. <b className="text-slate-700">Administrators always have full access.</b>{" "}
          Managers fine-tune individuals on the People tab.
        </p>
      </div>

      {!canEdit && (
        <div className="flex gap-2 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-[12.5px] leading-relaxed text-accent-800">
          <Info size={16} className="mt-0.5 shrink-0" />
          Level defaults are set by Administrators — shown read-only. Adjust your own team members on the People tab.
        </div>
      )}

      {/* level pills */}
      <div>
        <div className="mb-2 text-[12px] font-bold text-slate-500">Level</div>
        <div className="flex flex-wrap gap-2.5">
          {ordered.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setCurId(l.id)}
              className={`rounded-full border px-4 py-2 text-[13.5px] font-bold transition ${
                l.id === cur.id
                  ? "border-brand-600 bg-brand-600 text-white shadow-brand-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Q1 scope */}
      <Question n={1} title={`Whose data can ${levelName} see?`} sub="The data scope applied to leads, admissions & tasks.">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {SCOPES.map(([v, lbl, sub]) => {
            const sel = perms.scope === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setScope(v)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  sel ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300"
                } ${canEdit ? "" : "cursor-default opacity-80"}`}
              >
                <span
                  className={`flex shrink-0 items-center justify-center rounded-full border-2 ${
                    sel ? "border-brand-600" : "border-slate-300"
                  }`}
                  style={{ width: 18, height: 18 }}
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
      </Question>

      {/* Q2 action roll-up */}
      <Question
        n={2}
        title={`What can ${levelName} do?`}
        sub="A quick roll-up across everything they can see — or fine-tune per component below. View is always on. Everyone can still do their own daily work; Settings & Organization stay with Admins."
      >
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {ACTIONS.map((a) => {
            const locked = a === "View";
            const on = anyAction[a];
            return (
              <button
                key={a}
                type="button"
                disabled={locked || !canEdit}
                onClick={() => bulkAction(a, !on)}
                className={`flex items-center gap-2 text-[14px] ${
                  locked ? "cursor-not-allowed text-slate-400" : "text-slate-800"
                }`}
              >
                <CheckBox on={on} locked={locked} />
                {a}
              </button>
            );
          })}
        </div>
      </Question>

      {/* Q3 pages + components */}
      <Question
        n={3}
        title={`Which menus & components can ${levelName} open?`}
        sub="Expand a page to grant or remove each component's actions. The page circle shows all / some / none granted."
      >
        {ACCESS_GROUPS.map((grp) => (
          <div key={grp.g}>
            <div className="mb-2 mt-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 first:mt-1">
              {grp.g}
              {grp.flag && <span className="ml-1.5 font-mono text-[10px] font-semibold text-slate-400">· {grp.flag}</span>}
            </div>

            {grp.admissionsScope && <StreamTree
              streams={streams}
              perms={perms}
              openStreams={openStreams}
              onToggleOpen={toggleStreamOpen}
              onToggleCollege={toggleCollege}
              onToggleStreamAll={toggleStreamAll}
              canEdit={canEdit}
            />}

            {grp.pages.map((page) => {
              const st = grp.locked ? "none" : pageState(page);
              const open = openPages.has(page.id);
              return (
                <div key={page.id} className={`mb-2 overflow-hidden rounded-xl border border-slate-200 ${grp.locked ? "opacity-60" : ""}`}>
                  <button
                    type="button"
                    onClick={() => !grp.locked && togglePage(page.id)}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                  >
                    <PageCircle state={st} />
                    <span className="flex-1 text-[14.5px] font-bold text-slate-800">{page.name}</span>
                    <span className="flex items-center gap-1.5 text-[12px] text-slate-400">
                      {grp.locked ? "Admin only" : `${page.comps.length} components`}
                      {!grp.locked && <ChevronRight size={13} className={`transition ${open ? "rotate-90" : ""}`} />}
                    </span>
                  </button>

                  {open && !grp.locked && (
                    <div className="border-t border-slate-100 px-3.5 py-1">
                      {page.comps.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 border-t border-slate-50 py-2.5 first:border-t-0">
                          <span className="min-w-[120px] flex-1 text-[13.5px] text-slate-700">{c.name}</span>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {ACTIONS.filter((a) => c.acts.includes(a)).map((a) => {
                              const on = !!perms.components[c.id]?.[a] || (a === "View" && pageCompHasAny(perms, c.id));
                              const locked = a === "View";
                              return (
                                <ActionPill
                                  key={a}
                                  label={a}
                                  on={on}
                                  disabled={locked || !canEdit}
                                  onClick={() => toggleComp(c.id, a)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </Question>

      {/* save bar */}
      {canEdit && (
        <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <span className="text-[12.5px] text-slate-500">
            {dirty ? "Unsaved changes to " : "No unsaved changes · "}
            <b className="text-slate-700">{levelName}</b>
          </span>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => {
              onSave?.(cur.id, { ...perms, flags: flagsFromComponents(perms.components) });
              setDirty(false);
            }}
            className="rounded-lg bg-brand-600 px-5 py-2 text-[13.5px] font-bold text-white shadow-brand-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save level access"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- small pieces ---------- */
function pageCompHasAny(perms, cid) {
  return Object.values(perms.components[cid] || {}).some(Boolean);
}

function Question({ n, title, sub, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[15px] font-extrabold text-slate-900">
        <span className="flex h-5 w-5 items-center justify-center rounded-full border-[1.6px] border-slate-800 text-[11px]">{n}</span>
        {title}
      </div>
      {sub && <p className="mb-3.5 mt-1 text-[12.5px] leading-relaxed text-slate-500">{sub}</p>}
      {children}
    </div>
  );
}

function CheckBox({ on, locked }) {
  return (
    <span
      className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-2 ${
        locked
          ? on
            ? "border-slate-400 bg-slate-400"
            : "border-slate-300 bg-slate-200"
          : on
          ? "border-emerald-600 bg-emerald-600"
          : "border-slate-300 bg-white"
      }`}
    >
      {on && <Check size={12} strokeWidth={3.5} className="text-white" />}
    </span>
  );
}

function PageCircle({ state }) {
  const on = state !== "none";
  return (
    <span
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.6px] ${
        on ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-slate-300 text-slate-300"
      }`}
    >
      {state === "all" ? <Check size={13} strokeWidth={3} /> : state === "some" ? <Minus size={13} strokeWidth={3} /> : null}
    </span>
  );
}

function ActionPill({ label, on, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] transition ${
        on
          ? "border-emerald-200 bg-emerald-50 font-bold text-emerald-700"
          : "border-slate-200 bg-white text-slate-500"
      } ${disabled ? "opacity-40" : "hover:border-slate-300"}`}
    >
      <span
        className={`flex h-[13px] w-[13px] items-center justify-center rounded-[3px] border-[1.6px] ${
          on ? "border-emerald-600 bg-emerald-600" : "border-slate-300"
        }`}
      >
        {on && <Check size={9} strokeWidth={4} className="text-white" />}
      </span>
      {label}
    </button>
  );
}

function StreamTree({ streams, perms, openStreams, onToggleOpen, onToggleCollege, onToggleStreamAll, canEdit }) {
  if (!streams.length) {
    return (
      <div className="mb-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-400">
        No streams/colleges configured yet. Add them under Admissions to scope access per college.
      </div>
    );
  }
  return (
    <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-[13.5px] font-extrabold text-slate-800">
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.6px] border-slate-800 text-[10px]">◧</span>
        Streams & Colleges this level can see
      </div>
      <p className="mb-2 mt-1 text-[12px] leading-relaxed text-slate-500">
        Pick the streams &amp; colleges. A Manager can then grant employees only a subset — never more than they hold.
      </p>
      {streams.map((st) => {
        const ids = (st.colleges || []).map((c) => c.id);
        const on = ids.filter((id) => perms.admissions.collegeIds.includes(id)).length;
        const tot = ids.length;
        const state = on === 0 ? "none" : on === tot ? "all" : "some";
        const open = openStreams.has(st.id);
        return (
          <div key={st.id} className="mb-2 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <ActionPill label="" on={state !== "none"} disabled={!canEdit} onClick={() => onToggleStreamAll(st)} />
              <button type="button" onClick={() => onToggleOpen(st.id)} className="flex flex-1 items-center justify-between text-left">
                <span className="text-[14px] font-bold text-slate-800">{st.name}</span>
                <span className="flex items-center gap-1.5 text-[12px] text-slate-400">
                  {on}/{tot} colleges
                  <ChevronRight size={13} className={`transition ${open ? "rotate-90" : ""}`} />
                </span>
              </button>
            </div>
            {open && (
              <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2.5">
                {(st.colleges || []).map((c) => (
                  <ActionPill
                    key={c.id}
                    label={c.name}
                    on={perms.admissions.collegeIds.includes(c.id)}
                    disabled={!canEdit}
                    onClick={() => onToggleCollege(st.id, c.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
