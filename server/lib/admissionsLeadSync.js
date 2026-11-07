const ORIGIN_PREFIX = "Admissions origin:";

function clean(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function appendOriginMarker(notes, origin) {
  const marker = `${ORIGIN_PREFIX} ${origin}`;
  const lines = String(notes || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.includes(marker)) lines.push(marker);
  return lines.join("\n");
}

export function isAdmissionsSyncedLead(lead) {
  return String(lead?.notes || "").includes(ORIGIN_PREFIX);
}

export async function ensureAdmissionsLead(db, {
  companyId,
  origin,
  name,
  phone,
  email,
  course,
  assignedToName,
  stage = "NEW",
  extraNotes = null,
}) {
  const cleanName = clean(name);
  const cleanPhone = clean(phone);
  const cleanEmail = clean(email)?.toLowerCase() || null;
  const cleanCourse = clean(course);
  const cleanAssignee = clean(assignedToName);

  const matchers = [];
  if (cleanPhone) matchers.push({ phone: cleanPhone });
  if (cleanEmail) matchers.push({ email: cleanEmail });

  // Lead.phone is required in the current schema, so a brand-new CRM lead
  // can only be created when a phone number is available. Email-only records
  // can still reuse an existing CRM lead when one matches.
  if (!matchers.length) return null;

  const existing = await db.lead.findFirst({
    where: { companyId, OR: matchers },
  });

  const markerNotes = appendOriginMarker(extraNotes, origin);

  if (existing) {
    const mergedNotes = appendOriginMarker(
      [existing.notes, extraNotes].filter(Boolean).join("\n"),
      origin
    );

    return db.lead.update({
      where: { id: existing.id },
      data: {
        ...(existing.email || !cleanEmail ? {} : { email: cleanEmail }),
        ...(existing.course || !cleanCourse ? {} : { course: cleanCourse }),
        ...(existing.assignedToName || !cleanAssignee
          ? {}
          : { assignedToName: cleanAssignee }),
        notes: mergedNotes,
      },
    });
  }

  if (!cleanPhone || !cleanName) return null;

  await db.leadSourceConfig.upsert({
    where: { companyId_key: { companyId, key: "OFFLINE" } },
    update: { active: true, showInForms: true },
    create: {
      companyId,
      key: "OFFLINE",
      name: "Offline / Admissions",
      description: "Leads created from admissions, walk-ins and counselling",
      active: true,
      showInForms: true,
      system: true,
      sortOrder: 90,
    },
  });

  return db.lead.create({
    data: {
      companyId,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      course: cleanCourse,
      source: "OFFLINE",
      stage,
      leadStatus:
        stage === "ADMITTED"
          ? "Admission Done"
          : stage === "LOST"
          ? "Lead Lost"
          : stage === "CONTACTED"
          ? "Call Initiated"
          : "Fresh",
      campaign: `${origin} Lead`,
      medium: "INDIVIDUAL",
      assignedToName: cleanAssignee,
      notes: markerNotes,
    },
  });
}

export async function backfillAdmissionsLeads(db, companyId) {
  const admissions = await db.admission.findMany({
    where: {
      companyId,
      leadId: null,
      OR: [
        { studentPhone: { not: null } },
        { studentEmail: { not: null } },
      ],
    },
    select: {
      id: true,
      studentName: true,
      studentPhone: true,
      studentEmail: true,
      course: true,
      counsellorName: true,
      status: true,
      notes: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let linked = 0;
  let skipped = 0;

  for (const admission of admissions) {
    try {
      const didLink = await db.$transaction(async (tx) => {
        const lead = await ensureAdmissionsLead(tx, {
          companyId,
          origin: "Admission Backfill",
          name: admission.studentName,
          phone: admission.studentPhone,
          email: admission.studentEmail,
          course: admission.course,
          assignedToName: admission.counsellorName,
          stage: "NEW",
          extraNotes: admission.notes,
        });

        if (!lead) return false;

        const alreadyUsed = await tx.admission.findFirst({
          where: {
            companyId,
            leadId: lead.id,
            id: { not: admission.id },
          },
          select: { id: true },
        });

        if (alreadyUsed) return false;

        await tx.admission.update({
          where: { id: admission.id },
          data: {
            leadId: lead.id,
            leadStageBeforeAdmission: lead.stage,
          },
        });

        await tx.lead.update({
          where: { id: lead.id },
          data: {
            stage: admission.status === "CANCELLED" ? lead.stage : "ADMITTED",
            leadStatus:
              admission.status === "CANCELLED"
                ? lead.leadStatus || "Fresh"
                : "Admission Done",
          },
        });

        return true;
      });

      if (didLink) linked += 1;
      else skipped += 1;
    } catch (error) {
      // Backfill is best-effort for legacy rows. A single malformed/duplicate
      // admission must not block Dashboard or Admissions from loading.
      skipped += 1;
      console.warn(
        `[admissions] Unable to backfill lead for admission ${admission.id}:`,
        error?.message || error
      );
    }
  }

  return { linked, skipped };
}