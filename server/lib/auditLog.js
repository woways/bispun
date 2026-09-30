import prisma from "./prisma.js";

function normalizeClientIp(value) {
  if (Array.isArray(value)) {
    value = value[0];
  }

  let ip = String(value || "")
    .split(",")[0]
    .trim()
    .replace(/^for=/i, "")
    .replace(/^["']|["']$/g, "")
    .replace(/^::ffff:/, "");

  if (ip.startsWith("[") && ip.includes("]")) {
    ip = ip.slice(1, ip.indexOf("]"));
  }

  if (ip.includes("%")) {
    ip = ip.split("%")[0];
  }

  if (
    !ip ||
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.toLowerCase() === "localhost"
  ) {
    return null;
  }

  return ip.slice(0, 120);
}

function clientIp(req) {
  const headers = req?.headers || {};

  const candidates = [
    headers["cf-connecting-ip"],
    headers["true-client-ip"],
    headers["x-real-ip"],
    headers["x-forwarded-for"],
    req?.ip,
    req?.socket?.remoteAddress,
  ];

  for (const candidate of candidates) {
    const ip = normalizeClientIp(candidate);

    if (ip) {
      return ip;
    }
  }

  return null;
}

export async function writeAuditLog({
  req,
  companyId,
  actor,
  action,
  entityType,
  entityId = null,
  summary,
  metadata = null,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        companyId,

        actorUserId:
          actor?.id ||
          req?.clientUser?.userId ||
          null,

        actorName:
          actor?.name ||
          null,

        actorEmail:
          actor?.email ||
          null,

        actorRole:
          actor?.role ||
          req?.clientUser?.role ||
          null,

        action:
          String(action),

        entityType:
          String(entityType),

        entityId:
          entityId
            ? String(entityId)
            : null,

        summary:
          String(summary),

        metadata:
          metadata &&
          typeof metadata === "object"
            ? metadata
            : null,

        ipAddress:
          req
            ? clientIp(req)
            : null,

        userAgent:
          req?.headers?.[
            "user-agent"
          ]
            ? String(
                req.headers[
                  "user-agent"
                ]
              ).slice(0, 500)
            : null,
      },
    });
  } catch (error) {
    // Audit logging must never break the user's main action.
    console.error(
      "Audit log write failed:",
      error
    );
  }
}