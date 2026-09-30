import { useState } from "react";

/**
 * Granular per-page access editor used inside the Users & Roles modal.
 *
 *   Admissions -> Market -> Stream -> College -> Branch  (data-scoped)
 *   Finance    -> sections: Overview / Expenses / Incentives
 *   Insights   -> sections: Overview / Comparison
 *
 * Each page is an expandable button. The page toggle maps to the legacy boolean
 * permission (canManageAdmissions / canManageRevenue / canViewAnalytics); the
 * expanded tree edits `pageAccess`. A grant on a parent implies all descendants
 * (shown checked + locked). A granter (manager) can never exceed their own
 * access — nodes outside `actorPageAccess` are disabled.
 */

const EMPTY_ADMISSIONS = { all: false, markets: [], streamIds: [], collegeIds: [], branchIds: [] };

export function emptyPageAccess() {
  return {
    admissions: { ...EMPTY_ADMISSIONS },
    finance: { all: false, sections: [] },
    insights: { all: false, sections: [] },
  };
}

export function normalizeClientPageAccess(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const a = s.admissions && typeof s.admissions === "object" ? s.admissions : {};
  const f = s.finance && typeof s.finance === "object" ? s.finance : {};
  const i = s.insights && typeof s.insights === "object" ? s.insights : {};
  const arr = (v) => (Array.isArray(v) ? v.map(String) : []);
  return {
    admissions: {
      all: a.all === true,
      markets: arr(a.markets),
      streamIds: arr(a.streamIds),
      collegeIds: arr(a.collegeIds),
      branchIds: arr(a.branchIds),
    },
    finance: { all: f.all === true, sections: arr(f.sections) },
    insights: { all: i.all === true, sections: arr(i.sections) },
  };
}

/** Does `access` grant this admissions node (considering ancestors)? */
function admissionCovers(access, node) {
  if (access.all) return true;
  if (node.level === "market") return access.markets.includes(node.market);
  if (node.level === "stream")
    return access.markets.includes(node.market) || access.streamIds.includes(node.streamId);
  if (node.level === "college")
    return (
      admissionCovers(access, { level: "stream", market: node.market, streamId: node.streamId }) ||
      access.collegeIds.includes(node.collegeId)
    );
  if (node.level === "branch")
    return (
      admissionCovers(access, {
        level: "college",
        market: node.market,
        streamId: node.streamId,
        collegeId: node.collegeId,
      }) ||
      access.branchIds.includes(node.branchId)
    );
  return false;
}

/** Is this node granted purely by an ancestor (so it's locked/implied)? */
function impliedByAncestor(access, node) {
  if (node.level === "market") return access.all;
  if (node.level === "stream") return access.all || access.markets.includes(node.market);
  if (node.level === "college")
    return admissionCovers(access, { level: "stream", market: node.market, streamId: node.streamId });
  if (node.level === "branch")
    return admissionCovers(access, {
      level: "college",
      market: node.market,
      streamId: node.streamId,
      collegeId: node.collegeId,
    });
  return false;
}

function toggleInArray(list, id, on) {
  const set = new Set(list);
  if (on) set.add(id);
  else set.delete(id);
  return [...set];
}

function Chevron({ open }) {
  return <span className="inline-block w-3 text-slate-400">{open ? "▾" : "▸"}</span>;
}

function Row({ indent = 0, children }) {
  return (
    <div
      className="flex items-center gap-2 py-1.5"
      style={{ paddingLeft: `${indent * 16}px` }}
    >
      {children}
    </div>
  );
}

function Check({ checked, disabled, onChange, label, muted }) {
  return (
    <label className={`flex items-center gap-2 text-[13px] ${muted ? "text-slate-400" : "text-slate-700"} ${disabled ? "cursor-default" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => !disabled && onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

const MARKET_LABELS = { DOMESTIC: "Domestic", INTERNATIONAL: "International" };
const FINANCE_SECTIONS = [
  ["overview", "Overview"],
  ["expenses", "Expenses"],
  ["incentives", "Incentives"],
];
const INSIGHTS_SECTIONS = [
  ["overview", "Overview"],
  ["comparison", "Comparison"],
];

export default function PermissionTree({
  pageAccess,
  onPageAccess,
  permissions,
  onPermissions,
  tree,
  actorPageAccess,
  isAdminTarget = false,
  loading = false,
}) {
  const [open, setOpen] = useState({});
  const access = normalizeClientPageAccess(pageAccess);
  const actor = actorPageAccess ? normalizeClientPageAccess(actorPageAccess) : null;

  const PAGES = [
    { key: "admissions", label: "Admissions", perm: "canManageAdmissions" },
    { key: "finance", label: "Finance", perm: "canManageRevenue" },
    { key: "insights", label: "Insights", perm: "canViewAnalytics" },
  ];

  // A granter can only assign what they hold (admin actor => everything).
  const actorCoversAdmission = (node) => (actor ? admissionCovers(actor.admissions, node) : true);
  const actorHasFinance = (sec) => (actor ? actor.finance.all || actor.finance.sections.includes(sec) : true);
  const actorHasInsights = (sec) => (actor ? actor.insights.all || actor.insights.sections.includes(sec) : true);

  function patchAdmissions(next) {
    onPageAccess({ ...access, admissions: { ...access.admissions, ...next } });
  }

  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  function renderAdmissions() {
    if (loading) return <div className="text-[12px] text-slate-400 py-2">Loading streams &amp; colleges…</div>;
    const markets = tree?.markets || [];

    return (
      <div className="mt-1">
        <Row indent={0}>
          <Check
            label="Allow all admissions"
            checked={access.admissions.all}
            disabled={actor ? !actor.admissions.all : false}
            onChange={(on) => patchAdmissions({ all: on })}
          />
        </Row>

        {markets.map((mk) => {
          const marketNode = { level: "market", market: mk.key };
          const mImplied = impliedByAncestor(access.admissions, marketNode);
          const mChecked = admissionCovers(access.admissions, marketNode);
          const oid = `mk-${mk.key}`;
          return (
            <div key={mk.key} className="border-t border-slate-100">
              <Row indent={1}>
                <button type="button" onClick={() => toggle(oid)} className="shrink-0">
                  <Chevron open={open[oid]} />
                </button>
                <Check
                  label={`Allow entire ${mk.label}`}
                  checked={mChecked}
                  disabled={mImplied || !actorCoversAdmission(marketNode)}
                  muted={!actorCoversAdmission(marketNode)}
                  onChange={(on) =>
                    patchAdmissions({ markets: toggleInArray(access.admissions.markets, mk.key, on) })
                  }
                />
              </Row>

              {open[oid] &&
                (mk.streams || []).map((s) => {
                  const streamNode = { level: "stream", market: mk.key, streamId: s.id };
                  const sImplied = impliedByAncestor(access.admissions, streamNode);
                  const sChecked = admissionCovers(access.admissions, streamNode);
                  const soid = `st-${s.id}`;
                  return (
                    <div key={s.id}>
                      <Row indent={2}>
                        <button type="button" onClick={() => toggle(soid)} className="shrink-0">
                          <Chevron open={open[soid]} />
                        </button>
                        <Check
                          label={`${s.name} — all colleges`}
                          checked={sChecked}
                          disabled={sImplied || !actorCoversAdmission(streamNode)}
                          muted={!actorCoversAdmission(streamNode)}
                          onChange={(on) =>
                            patchAdmissions({ streamIds: toggleInArray(access.admissions.streamIds, s.id, on) })
                          }
                        />
                      </Row>

                      {open[soid] &&
                        (s.colleges || []).map((c) => {
                          const collegeNode = {
                            level: "college",
                            market: mk.key,
                            streamId: s.id,
                            collegeId: c.id,
                          };
                          const cImplied = impliedByAncestor(access.admissions, collegeNode);
                          const cChecked = admissionCovers(access.admissions, collegeNode);
                          const coid = `co-${c.id}`;
                          const hasBranches = (c.branches || []).length > 0;
                          return (
                            <div key={c.id}>
                              <Row indent={3}>
                                {hasBranches ? (
                                  <button type="button" onClick={() => toggle(coid)} className="shrink-0">
                                    <Chevron open={open[coid]} />
                                  </button>
                                ) : (
                                  <span className="inline-block w-3" />
                                )}
                                <Check
                                  label={hasBranches ? `${c.name} — all branches` : c.name}
                                  checked={cChecked}
                                  disabled={cImplied || !actorCoversAdmission(collegeNode)}
                                  muted={!actorCoversAdmission(collegeNode)}
                                  onChange={(on) =>
                                    patchAdmissions({
                                      collegeIds: toggleInArray(access.admissions.collegeIds, c.id, on),
                                    })
                                  }
                                />
                              </Row>

                              {open[coid] &&
                                (c.branches || []).map((b) => {
                                  const branchNode = {
                                    level: "branch",
                                    market: mk.key,
                                    streamId: s.id,
                                    collegeId: c.id,
                                    branchId: b.id,
                                  };
                                  const bImplied = impliedByAncestor(access.admissions, branchNode);
                                  const bChecked = admissionCovers(access.admissions, branchNode);
                                  return (
                                    <Row key={b.id} indent={4}>
                                      <span className="inline-block w-3" />
                                      <Check
                                        label={b.name}
                                        checked={bChecked}
                                        disabled={bImplied || !actorCoversAdmission(branchNode)}
                                        muted={!actorCoversAdmission(branchNode)}
                                        onChange={(on) =>
                                          patchAdmissions({
                                            branchIds: toggleInArray(access.admissions.branchIds, b.id, on),
                                          })
                                        }
                                      />
                                    </Row>
                                  );
                                })}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
            </div>
          );
        })}
        {markets.every((m) => (m.streams || []).length === 0) && (
          <div className="text-[12px] text-slate-400 py-2">
            No streams/colleges configured yet. Add them under Admissions.
          </div>
        )}
      </div>
    );
  }

  function renderSections(pageKey, sections, actorHas) {
    const node = access[pageKey];
    const setSections = (next) => onPageAccess({ ...access, [pageKey]: { ...node, ...next } });
    return (
      <div className="mt-1">
        <Row indent={0}>
          <Check
            label={`Allow all ${pageKey === "finance" ? "Finance" : "Insights"}`}
            checked={node.all}
            disabled={actor ? !(pageKey === "finance" ? actor.finance.all : actor.insights.all) : false}
            onChange={(on) => setSections({ all: on })}
          />
        </Row>
        {sections.map(([key, label]) => {
          const implied = node.all;
          const checked = node.all || node.sections.includes(key);
          const grantable = actorHas(key);
          return (
            <Row key={key} indent={1}>
              <span className="inline-block w-3" />
              <Check
                label={label}
                checked={checked}
                disabled={implied || !grantable}
                muted={!grantable}
                onChange={(on) => setSections({ sections: toggleInArray(node.sections, key, on) })}
              />
            </Row>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {PAGES.map((page) => {
        const enabled = isAdminTarget || permissions?.[page.perm] === true;
        const oid = `page-${page.key}`;
        const expanded = open[oid];
        return (
          <div key={page.key} className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50">
              <button
                type="button"
                className="flex items-center gap-2 text-[13px] font-semibold text-slate-800"
                onClick={() => enabled && toggle(oid)}
                disabled={!enabled}
              >
                <Chevron open={expanded && enabled} />
                {page.label}
              </button>
              <label className="flex items-center gap-2 text-[12px] text-slate-500">
                <span>{enabled ? "Enabled" : "No access"}</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={isAdminTarget}
                  onChange={(e) => onPermissions(page.perm, e.target.checked)}
                />
              </label>
            </div>
            {enabled && expanded && (
              <div className="px-3 pb-3">
                {isAdminTarget ? (
                  <div className="text-[12px] text-slate-400 py-2">
                    Client Admin has full access to everything.
                  </div>
                ) : page.key === "admissions" ? (
                  renderAdmissions()
                ) : page.key === "finance" ? (
                  renderSections("finance", FINANCE_SECTIONS, actorHasFinance)
                ) : (
                  renderSections("insights", INSIGHTS_SECTIONS, actorHasInsights)
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
