import { Router } from "express";

import prisma from "../lib/prisma.js";
import {
  requireClientUser,
} from "../middleware/clientAuth.js";

const router = Router();

router.use(requireClientUser);

function normalizeAuditIp(value) {
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

function fallbackSessionIp(log, sessionsByUser) {
  if (!log?.actorUserId) {
    return null;
  }

  const sessions =
    sessionsByUser.get(log.actorUserId) || [];

  if (!sessions.length) {
    return null;
  }

  const logTime =
    new Date(log.createdAt).getTime();

  const coveringSession =
    sessions.find((session) => {
      const created =
        new Date(session.createdAt).getTime();

      const lastActive =
        new Date(
          session.lastActiveAt ||
            session.createdAt
        ).getTime();

      const expires =
        new Date(
          session.expiresAt ||
            session.lastActiveAt ||
            session.createdAt
        ).getTime();

      return (
        created <= logTime &&
        Math.max(
          lastActive,
          expires
        ) >= logTime &&
        normalizeAuditIp(
          session.ipAddress
        )
      );
    });

  if (coveringSession) {
    return normalizeAuditIp(
      coveringSession.ipAddress
    );
  }

  const nearestEarlierSession =
    sessions.find((session) => {
      const created =
        new Date(session.createdAt).getTime();

      return (
        created <= logTime &&
        normalizeAuditIp(
          session.ipAddress
        )
      );
    });

  return nearestEarlierSession
    ? normalizeAuditIp(
        nearestEarlierSession.ipAddress
      )
    : null;
}

async function canViewAuditLogs(req) {
  const actor =
    await prisma.user.findUnique({
      where: {
        id:
          req.clientUser.userId,
      },
    });

  if (
    !actor ||
    !actor.active ||
    actor.companyId !==
      req.clientUser.companyId
  ) {
    return null;
  }

  if (
    actor.role !==
      "CLIENT_ADMIN" &&
    !actor.canManageSettings &&
    !actor.canManageUsers
  ) {
    return null;
  }

  return actor;
}

router.get("/", async (req, res) => {
  try {
    const actor =
      await canViewAuditLogs(req);

    if (!actor) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to view activity logs",
      });
    }

    const companyId =
      req.clientUser.companyId;

    const limit =
      Math.min(
        Math.max(
          Number(req.query.limit) ||
            50,
          1
        ),
        200
      );

    const action =
      String(
        req.query.action || ""
      )
        .trim()
        .toUpperCase();

    const entityType =
      String(
        req.query.entityType || ""
      )
        .trim()
        .toUpperCase();

    const search =
      String(
        req.query.search || ""
      ).trim();

    const where = {
      companyId,
    };

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType =
        entityType;
    }

    if (search) {
      // Resolve matching company users as well as the denormalized audit fields.
      // This makes email searches work for:
      // 1) the actor who performed the activity, including older rows where
      //    actorEmail was not stored but actorUserId still exists, and
      // 2) the user targeted by USER_* activity, whose email is stored on the
      //    User record while the audit row points to that user through entityId.
      const matchingUsers =
        await prisma.user.findMany({
          where: {
            companyId,
            OR: [
              {
                name: {
                  contains:
                    search,
                  mode:
                    "insensitive",
                },
              },
              {
                email: {
                  contains:
                    search,
                  mode:
                    "insensitive",
                },
              },
            ],
          },
          select: {
            id: true,
          },
        });

      const matchingUserIds =
        matchingUsers.map(
          (user) => user.id
        );

      where.OR = [
        {
          summary: {
            contains:
              search,
            mode:
              "insensitive",
          },
        },
        {
          actorName: {
            contains:
              search,
            mode:
              "insensitive",
          },
        },
        {
          actorEmail: {
            contains:
              search,
            mode:
              "insensitive",
          },
        },
        {
          action: {
            contains:
              search,
            mode:
              "insensitive",
          },
        },
        ...(matchingUserIds.length
          ? [
              {
                actorUserId: {
                  in:
                    matchingUserIds,
                },
              },
              {
                entityId: {
                  in:
                    matchingUserIds,
                },
              },
            ]
          : []),
      ];
    }

    const [
      logs,
      total,
    ] =
      await Promise.all([
        prisma.auditLog.findMany({
          where,

          include: {
            actorUser: {
              select: {
                name: true,
                email: true,
                role: true,
              },
            },
          },

          orderBy: {
            createdAt:
              "desc",
          },

          take:
            limit,
        }),

        prisma.auditLog.count({
          where,
        }),
      ]);

    const fallbackUserIds = [
      ...new Set(
        logs
          .filter(
            (log) =>
              !normalizeAuditIp(
                log.ipAddress
              ) &&
              log.actorUserId
          )
          .map(
            (log) =>
              log.actorUserId
          )
      ),
    ];

    const fallbackSessions =
      fallbackUserIds.length
        ? await prisma.clientSession.findMany({
            where: {
              companyId,
              userId: {
                in:
                  fallbackUserIds,
              },
            },
            select: {
              userId:
                true,
              ipAddress:
                true,
              createdAt:
                true,
              lastActiveAt:
                true,
              expiresAt:
                true,
            },
            orderBy: {
              createdAt:
                "desc",
            },
          })
        : [];

    const sessionsByUser =
      new Map();

    fallbackSessions.forEach(
      (session) => {
        if (
          !sessionsByUser.has(
            session.userId
          )
        ) {
          sessionsByUser.set(
            session.userId,
            []
          );
        }

        sessionsByUser
          .get(
            session.userId
          )
          .push(
            session
          );
      }
    );

    return res.json({
      success: true,
      total,
      logs:
        logs.map((log) => ({
          ...log,
          actorName:
            log.actorName ||
            log.actorUser?.name ||
            null,
          actorEmail:
            log.actorEmail ||
            log.actorUser?.email ||
            null,
          actorRole:
            log.actorRole ||
            log.actorUser?.role ||
            null,
          ipAddress:
            normalizeAuditIp(
              log.ipAddress
            ) ||
            fallbackSessionIp(
              log,
              sessionsByUser
            ) ||
            null,
          actorUser:
            undefined,
        })),
    });
  } catch (error) {
    console.error(
      "Load audit logs failed:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load activity logs",
    });
  }
});

export default router;