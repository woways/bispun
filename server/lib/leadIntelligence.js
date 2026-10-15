function safeDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(from, to = new Date()) {
  const start = safeDate(from);
  const end = safeDate(to);
  if (!start || !end) return null;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

export function buildLeadIntelligence({
  lead = {},
  communicationSummary = {},
  counsellingSessions = [],
  now = new Date(),
} = {}) {
  const stage = String(lead.stage || "NEW").toUpperCase();
  const temperature = String(lead.temperature || "WARM").toUpperCase();
  const leadStatus = normalizeStatus(lead.leadStatus);
  const communicationCount = Number(communicationSummary.count || 0);
  const lastContactAt = safeDate(communicationSummary.lastAt);
  const leadAgeDays = daysBetween(lead.createdAt, now) ?? 0;
  const lastContactDays = lastContactAt ? daysBetween(lastContactAt, now) : null;

  const sessions = Array.isArray(counsellingSessions)
    ? counsellingSessions.filter(Boolean)
    : [];

  const activeStatuses = new Set(["SCHEDULED", "FOLLOW_UP"]);
  const activeSessions = sessions.filter((session) =>
    activeStatuses.has(String(session.status || "").toUpperCase())
  );

  const futureFollowUps = activeSessions
    .map((session) => safeDate(session.followUpAt))
    .filter((date) => date && date >= now)
    .sort((a, b) => a - b);

  const overdueFollowUps = activeSessions
    .map((session) => safeDate(session.followUpAt))
    .filter((date) => date && date < now)
    .sort((a, b) => a - b);

  const futureSessions = activeSessions
    .map((session) => safeDate(session.scheduledAt))
    .filter((date) => date && date >= now)
    .sort((a, b) => a - b);

  const hasAdmission = Boolean(lead.admission?.id) || stage === "ADMITTED";
  const isLost = stage === "LOST" || leadStatus === "lead lost";
  const isNotAnswering = ["not answering", "not reachable"].includes(leadStatus);

  if (hasAdmission) {
    return {
      score: 100,
      conversionChance: "Converted",
      conversionPercent: 100,
      reasons: [
        "Admission is already recorded for this lead.",
        communicationCount > 0
          ? `${communicationCount} tracked communication${communicationCount === 1 ? "" : "s"} in CRM.`
          : "Admission is the strongest conversion signal.",
      ],
      nextBestAction: "Continue admission servicing and collect any pending payment.",
      lastContactAt,
      nextFollowUpAt: futureFollowUps[0] || futureSessions[0] || null,
      overdueFollowUp: overdueFollowUps[0] || null,
      communicationCount,
    };
  }

  if (isLost) {
    return {
      score: 8,
      conversionChance: "Low",
      conversionPercent: 8,
      reasons: [
        "Lead is currently marked as lost.",
        communicationCount > 0
          ? "Past communication is available for re-engagement review."
          : "No tracked communication is available yet.",
      ],
      nextBestAction: "Review the lost reason before deciding whether to re-engage this lead.",
      lastContactAt,
      nextFollowUpAt: futureFollowUps[0] || futureSessions[0] || null,
      overdueFollowUp: overdueFollowUps[0] || null,
      communicationCount,
    };
  }

  let score = 35;
  const positiveReasons = [];
  const cautionReasons = [];

  if (temperature === "HOT") {
    score += 24;
    positiveReasons.push("Marked as a Hot lead.");
  } else if (temperature === "WARM") {
    score += 11;
    positiveReasons.push("Marked as a Warm lead.");
  } else if (temperature === "COLD") {
    score -= 8;
    cautionReasons.push("Currently marked as a Cold lead.");
  }

  const stageWeights = {
    NEW: 0,
    CONTACTED: 7,
    QUALIFIED: 18,
    COUNSELLING: 23,
  };
  score += stageWeights[stage] || 0;

  if (stage === "QUALIFIED") {
    positiveReasons.push("Lead is already qualified.");
  } else if (stage === "COUNSELLING") {
    positiveReasons.push("Lead has progressed to counselling.");
  } else if (stage === "CONTACTED") {
    positiveReasons.push("Initial contact has been recorded.");
  }

  if (leadStatus === "call initiated") {
    score += 5;
    positiveReasons.push("Call activity has been initiated.");
  }

  if (isNotAnswering) {
    score -= 6;
    cautionReasons.push("Recent status indicates the lead was not reachable.");
  }

  if (lead.assignedToName) {
    score += 4;
    positiveReasons.push("A team member is assigned.");
  } else {
    score -= 5;
    cautionReasons.push("No owner is assigned yet.");
  }

  if (communicationCount > 0) {
    score += 7;
    positiveReasons.push(
      `${communicationCount} tracked communication${communicationCount === 1 ? "" : "s"} in CRM.`
    );

    if (lastContactDays !== null && lastContactDays <= 7) {
      score += 7;
      positiveReasons.push("The lead was contacted within the last 7 days.");
    } else if (lastContactDays !== null && lastContactDays > 30) {
      score -= 7;
      cautionReasons.push("No tracked contact in the last 30 days.");
    }
  } else {
    score -= leadAgeDays >= 7 ? 8 : 3;
    cautionReasons.push("No tracked communication yet.");
  }

  if (futureFollowUps.length || futureSessions.length) {
    score += 8;
    positiveReasons.push("A next follow-up or counselling step is scheduled.");
  }

  if (overdueFollowUps.length) {
    score -= 7;
    cautionReasons.push("A follow-up is overdue.");
  }

  if (lead.phone && lead.email) {
    score += 3;
    positiveReasons.push("Both phone and email are available.");
  }

  if (leadAgeDays > 45 && communicationCount === 0) {
    score -= 8;
    cautionReasons.push("This lead has been inactive for more than 45 days.");
  }

  score = Math.round(clamp(score, 5, 96));

  let conversionChance = "Low";
  if (score >= 80) conversionChance = "Very High";
  else if (score >= 65) conversionChance = "High";
  else if (score >= 45) conversionChance = "Medium";

  let nextBestAction = "Follow up and confirm the next decision date.";

  if (overdueFollowUps.length) {
    nextBestAction = "Complete the overdue follow-up today and record the outcome.";
  } else if (!lead.assignedToName) {
    nextBestAction = "Assign this lead to a counsellor or owner before the next contact.";
  } else if (temperature === "HOT" && communicationCount === 0) {
    nextBestAction = "Contact this Hot lead now and record the outcome in CRM.";
  } else if (communicationCount === 0) {
    nextBestAction = "Make the first contact today and schedule the next follow-up.";
  } else if (isNotAnswering) {
    nextBestAction = "Try an alternate channel and schedule a retry instead of repeated calls.";
  } else if (["QUALIFIED", "COUNSELLING"].includes(stage) && !futureFollowUps.length && !futureSessions.length) {
    nextBestAction = "Schedule the next counselling or follow-up step so the lead does not go cold.";
  } else if (lastContactDays !== null && lastContactDays > 14) {
    nextBestAction = "Re-engage this lead now; the last tracked contact is getting old.";
  }

  const reasons = [...positiveReasons, ...cautionReasons].slice(0, 4);

  return {
    score,
    conversionChance,
    conversionPercent: score,
    reasons: reasons.length ? reasons : ["Score is based on the lead's current CRM activity."],
    nextBestAction,
    lastContactAt,
    nextFollowUpAt: futureFollowUps[0] || futureSessions[0] || null,
    overdueFollowUp: overdueFollowUps[0] || null,
    communicationCount,
  };
}

export function isPriorityLeadForFollowUp(lead, intelligence) {
  if (!lead || !intelligence) return false;
  const stage = String(lead.stage || "").toUpperCase();
  const temperature = String(lead.temperature || "").toUpperCase();
  return (
    intelligence.score >= 65 ||
    temperature === "HOT" ||
    ["QUALIFIED", "COUNSELLING"].includes(stage)
  );
}