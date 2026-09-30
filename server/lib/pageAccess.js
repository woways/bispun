/**
 * Granular page/component access control.
 *
 * Legacy access is a flat set of boolean columns on User (canManageAdmissions,
 * canManageRevenue, canViewAnalytics, ...). Those still act as the page-level
 * ON/OFF switch. This module adds a finer JSON layer, stored on User.pageAccess,
 * that scopes *inside* three pages:
 *
 *   admissions -> Market (DOMESTIC/INTERNATIONAL) -> Stream -> College(Partner) -> Branch
 *   finance    -> sections: overview | expenses | incentives
 *   insights   -> sections: overview | comparison
 *
 * CLIENT_ADMIN always has unrestricted access and pageAccess is ignored for them.
 * A missing / empty admissions scope with the page turned ON means "everything"
 * ONLY when `all` is true; otherwise the explicit allow-lists apply.
 */

export const FINANCE_SECTIONS = ["overview", "expenses", "incentives"];
export const INSIGHTS_SECTIONS = ["overview", "comparison"];
export const ADMISSION_MARKETS = ["DOMESTIC", "INTERNATIONAL"];

function strArray(value, allowed = null) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const item of value) {
    const s = String(item || "").trim();
    if (!s) continue;
    if (allowed && !allowed.includes(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Coerce any stored/incoming blob into the canonical pageAccess shape. */
export function normalizePageAccess(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};

  const adm = source.admissions && typeof source.admissions === "object" ? source.admissions : {};
  const fin = source.finance && typeof source.finance === "object" ? source.finance : {};
  const ins = source.insights && typeof source.insights === "object" ? source.insights : {};

  return {
    admissions: {
      all: adm.all === true,
      markets: strArray(adm.markets, ADMISSION_MARKETS),
      streamIds: strArray(adm.streamIds),
      collegeIds: strArray(adm.collegeIds),
      branchIds: strArray(adm.branchIds),
    },
    finance: {
      all: fin.all === true,
      sections: strArray(fin.sections, FINANCE_SECTIONS),
    },
    insights: {
      all: ins.all === true,
      sections: strArray(ins.sections, INSIGHTS_SECTIONS),
    },
  };
}

/** A full-access spec (used for CLIENT_ADMIN and role "grant everything"). */
export function fullPageAccess() {
  return {
    admissions: { all: true, markets: [], streamIds: [], collegeIds: [], branchIds: [] },
    finance: { all: true, sections: [...FINANCE_SECTIONS] },
    insights: { all: true, sections: [...INSIGHTS_SECTIONS] },
  };
}

function isAdmin(role) {
  return role === "CLIENT_ADMIN";
}

/* ------------------------------------------------------------------ *
 * ADMISSIONS: record-level data scoping
 * ------------------------------------------------------------------ */

/**
 * Build a Prisma `where` fragment restricting Admission rows to the scope.
 * Returns:
 *   null                  -> no restriction (admin, or admissions.all)
 *   { OR: [...] }         -> union of allowed markets/streams/colleges/branches
 *   { id: DENY_SENTINEL } -> page ON but nothing granted => match nothing
 */
export const DENY_SENTINEL = "__no_admission_access__";

export function admissionWhereFragment(pageAccess, role) {
  if (isAdmin(role)) return null;
  const a = normalizePageAccess(pageAccess).admissions;
  if (a.all) return null;

  const or = [];
  if (a.markets.length) or.push({ market: { in: a.markets } });
  if (a.streamIds.length) or.push({ partner: { is: { streamId: { in: a.streamIds } } } });
  if (a.collegeIds.length) or.push({ partnerId: { in: a.collegeIds } });
  if (a.branchIds.length) or.push({ branchId: { in: a.branchIds } });

  if (!or.length) return { id: DENY_SENTINEL };
  return { OR: or };
}

/** Merge the admissions fragment into an existing where object (AND semantics). */
export function applyAdmissionScope(where, pageAccess, role) {
  const fragment = admissionWhereFragment(pageAccess, role);
  if (!fragment) return where;
  const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  return { ...where, AND: [...existingAnd, fragment] };
}

/**
 * Resolve the concrete sets of stream/college IDs a user may SEE, expanding
 * higher-level grants (market -> its streams/partners, stream -> its partners,
 * branch -> its parent partner). Used to filter the streams/partners/branches
 * listing endpoints so the Admissions UI only renders permitted nodes.
 *
 * `prisma` is injected to avoid a hard import cycle.
 */
export async function resolveVisibleScope(prisma, companyId, pageAccess, role) {
  if (isAdmin(role)) return { all: true };
  const a = normalizePageAccess(pageAccess).admissions;
  if (a.all) return { all: true };

  const markets = new Set(a.markets);
  const streamIds = new Set(a.streamIds);
  const collegeIds = new Set(a.collegeIds);
  const branchIds = new Set(a.branchIds);

  // Nothing granted at all -> visible nothing.
  if (!markets.size && !streamIds.size && !collegeIds.size && !branchIds.size) {
    return { all: false, markets, streamIds: new Set(), collegeIds: new Set(), branchIds: new Set(), empty: true };
  }

  // Expand branch grants up to their parent college, and college grants up to
  // their parent stream, so the tree renders a navigable path to each leaf.
  if (branchIds.size) {
    const branches = await prisma.admissionBranch.findMany({
      where: { companyId, id: { in: [...branchIds] } },
      select: { id: true, partnerId: true },
    });
    for (const b of branches) if (b.partnerId) collegeIds.add(b.partnerId);
  }

  if (collegeIds.size) {
    const partners = await prisma.admissionPartner.findMany({
      where: { companyId, id: { in: [...collegeIds] } },
      select: { id: true, streamId: true },
    });
    for (const p of partners) if (p.streamId) streamIds.add(p.streamId);
  }

  // A granted market makes every stream/partner of that market visible.
  if (markets.size) {
    const marketStreams = await prisma.admissionStream.findMany({
      where: { companyId, market: { in: [...markets] } },
      select: { id: true },
    });
    for (const s of marketStreams) streamIds.add(s.id);
    const marketPartners = await prisma.admissionPartner.findMany({
      where: { companyId, market: { in: [...markets] } },
      select: { id: true },
    });
    for (const p of marketPartners) collegeIds.add(p.id);
  }

  // A granted stream makes every partner in that stream visible.
  if (streamIds.size) {
    const streamPartners = await prisma.admissionPartner.findMany({
      where: { companyId, streamId: { in: [...streamIds] } },
      select: { id: true },
    });
    for (const p of streamPartners) collegeIds.add(p.id);
  }

  return { all: false, markets, streamIds, collegeIds, branchIds };
}

export function scopeAllowsStream(scope, stream) {
  if (scope.all) return true;
  if (scope.empty) return false;
  if (stream.market && scope.markets.has(stream.market)) return true;
  return scope.streamIds.has(stream.id);
}

export function scopeAllowsCollege(scope, partner) {
  if (scope.all) return true;
  if (scope.empty) return false;
  if (partner.market && scope.markets.has(partner.market)) return true;
  if (partner.streamId && scope.streamIds.has(partner.streamId)) return true;
  return scope.collegeIds.has(partner.id);
}

export function scopeAllowsBranch(scope, branch, partner) {
  if (scope.all) return true;
  if (scope.empty) return false;
  if (partner && scopeAllowsCollege(scope, partner)) return true;
  return scope.branchIds.has(branch.id);
}

/* ------------------------------------------------------------------ *
 * FINANCE / INSIGHTS: section gating
 * ------------------------------------------------------------------ */

export function financeSectionAllowed(pageAccess, role, section) {
  if (isAdmin(role)) return true;
  const f = normalizePageAccess(pageAccess).finance;
  return f.all || f.sections.includes(section);
}

export function insightsSectionAllowed(pageAccess, role, section) {
  if (isAdmin(role)) return true;
  const i = normalizePageAccess(pageAccess).insights;
  return i.all || i.sections.includes(section);
}

export function allowedFinanceSections(pageAccess, role) {
  if (isAdmin(role)) return [...FINANCE_SECTIONS];
  const f = normalizePageAccess(pageAccess).finance;
  return f.all ? [...FINANCE_SECTIONS] : FINANCE_SECTIONS.filter((s) => f.sections.includes(s));
}

export function allowedInsightsSections(pageAccess, role) {
  if (isAdmin(role)) return [...INSIGHTS_SECTIONS];
  const i = normalizePageAccess(pageAccess).insights;
  return i.all ? [...INSIGHTS_SECTIONS] : INSIGHTS_SECTIONS.filter((s) => i.sections.includes(s));
}

/* ------------------------------------------------------------------ *
 * GRANTING: clamp what a non-admin may hand out to <= their own access
 * ------------------------------------------------------------------ */

function intersectArrays(requested, ownAll, ownSet) {
  if (ownAll) return [...requested];
  const own = new Set(ownSet);
  return requested.filter((id) => own.has(id));
}

/**
 * Clamp a requested pageAccess so a granting MANAGER can never assign more than
 * they themselves hold. CLIENT_ADMIN passes through unchanged.
 * `actorAccess` is the granter's own normalized pageAccess (or full for admin).
 */
export function clampPageAccessToActor(requested, actorAccess, actorRole) {
  const req = normalizePageAccess(requested);
  if (isAdmin(actorRole)) return req;

  const own = normalizePageAccess(actorAccess);

  const admAll = own.admissions.all && req.admissions.all;
  const admissions = own.admissions.all
    ? req.admissions
    : {
        all: false,
        markets: intersectArrays(req.admissions.markets, false, own.admissions.markets),
        streamIds: intersectArrays(req.admissions.streamIds, false, own.admissions.streamIds),
        collegeIds: intersectArrays(req.admissions.collegeIds, false, own.admissions.collegeIds),
        branchIds: intersectArrays(req.admissions.branchIds, false, own.admissions.branchIds),
      };
  admissions.all = admAll;

  const finance = {
    all: own.finance.all && req.finance.all,
    sections: intersectArrays(req.finance.sections, own.finance.all, own.finance.sections),
  };
  const insights = {
    all: own.insights.all && req.insights.all,
    sections: intersectArrays(req.insights.sections, own.insights.all, own.insights.sections),
  };

  return normalizePageAccess({ admissions, finance, insights });
}
