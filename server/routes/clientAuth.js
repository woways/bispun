import {
  Router,
} from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import prisma from "../lib/prisma.js";
import {
  lookupIpLocation,
} from "../lib/ipGeolocation.js";
import {
  requireClientUser,
} from "../middleware/clientAuth.js";
import {
  createRateLimiter,
} from "../middleware/rateLimit.js";

const router =
  Router();

const COOKIE_NAME =
  "cb_client_token";

const loginLimiter =
  createRateLimiter({
    windowMs:
      15 * 60 * 1000,
    max: 15,
    keyPrefix:
      "client-login",
    message:
      "Too many sign-in attempts. Please try again later.",
  });

const passwordLimiter =
  createRateLimiter({
    windowMs:
      15 * 60 * 1000,
    max: 8,
    keyPrefix:
      "client-password",
    message:
      "Too many password attempts. Please try again later.",
  });

function getJwtSecret() {
  const secret =
    process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not configured"
    );
  }

  return secret;
}

function cookieOptions() {
  const production =
    process.env.NODE_ENV ===
    "production";

  return {
    httpOnly:
      true,
    secure:
      production,
    sameSite:
      production
        ? "none"
        : "lax",
    maxAge:
      8 *
      60 *
      60 *
      1000,
    path:
      "/",
  };
}

function clearCookieOptions() {
  const {
    maxAge,
    ...rest
  } =
    cookieOptions();

  return rest;
}

function getClientIp(req) {
  const forwarded =
    req.headers["x-forwarded-for"];

  const raw =
    Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === "string"
      ? forwarded.split(",")[0]
      : req.ip ||
        req.socket?.remoteAddress ||
        "";

  return String(raw || "")
    .trim()
    .replace(/^::ffff:/, "")
    .slice(0, 120);
}

function parseClientDevice(userAgent = "") {
  const ua =
    String(userAgent || "");

  let os = "Unknown OS";

  if (/Windows NT/i.test(ua)) {
    os = "Windows";
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = "iOS";
  } else if (/Android/i.test(ua)) {
    os = "Android";
  } else if (/Mac OS X|Macintosh/i.test(ua)) {
    os = "macOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  let browser = "Unknown browser";

  if (/SamsungBrowser\//i.test(ua)) {
    browser = "Samsung Internet";
  } else if (/EdgA?\//i.test(ua) || /EdgiOS\//i.test(ua)) {
    browser = "Microsoft Edge";
  } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    browser = "Opera";
  } else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
    browser = "Chrome";
  } else if (/Firefox\//i.test(ua) || /FxiOS\//i.test(ua)) {
    browser = "Firefox";
  } else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) {
    browser = "Safari";
  }

  let deviceType = "Desktop";

  if (/iPad|Tablet/i.test(ua)) {
    deviceType = "Tablet";
  } else if (/Mobile|iPhone|Android/i.test(ua)) {
    deviceType = "Mobile";
  }

  let deviceName = `${browser} on ${os}`;

  if (/iPhone/i.test(ua)) {
    deviceName = `iPhone · ${browser}`;
  } else if (/iPad/i.test(ua)) {
    deviceName = `iPad · ${browser}`;
  } else if (/Android/i.test(ua)) {
    deviceName = `Android device · ${browser}`;
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    deviceName = `Mac · ${browser}`;
  } else if (/Windows NT/i.test(ua)) {
    deviceName = `Windows PC · ${browser}`;
  }

  return {
    os,
    browser,
    deviceType,
    deviceName,
  };
}

function serializeSession(
  session,
  currentSessionId
) {
  return {
    id:
      session.id,
    current:
      session.id ===
      currentSessionId,
    deviceType:
      session.deviceType ||
      "Desktop",
    deviceName:
      session.deviceName ||
      "Unknown device",
    browser:
      session.browser ||
      "Unknown browser",
    os:
      session.os ||
      "Unknown OS",
    ipAddress:
      session.ipAddress ||
      null,
    city:
      session.city ||
      null,
    country:
      session.country ||
      null,
    createdAt:
      session.createdAt,
    lastActiveAt:
      session.lastActiveAt,
    expiresAt:
      session.expiresAt,
    revokedAt:
      session.revokedAt ||
      null,
    endReason:
      session.endReason ||
      null,
  };
}

function getActiveSubscription(
  subscriptions = []
) {
  return (
    subscriptions.find(
      (
        subscription
      ) =>
        subscription.status ===
          "ACTIVE" ||
        subscription.status ===
          "TRIAL"
    ) ||
    subscriptions[0] ||
    null
  );
}

function buildClientSession(user) {
  const company =
    user.company;

  const activeSubscription =
    getActiveSubscription(
      company
        ?.subscriptions ||
        []
    );

  const modules =
    (
      company
        ?.companyModules ||
      []
    )
      .slice()
      .sort(
        (a, b) =>
          a.module
            .sortOrder -
          b.module
            .sortOrder
      )
      .map(
        (
          companyModule
        ) => ({
          id:
            companyModule
              .module.id,
          key:
            companyModule
              .module.key,
          name:
            companyModule
              .module.name,
          description:
            companyModule
              .module
              .description,
          icon:
            companyModule
              .module.icon,
          route:
            companyModule
              .module.route,
          enabled:
            companyModule
              .enabled,
        })
      );

  return {
    user: {
      id:
        user.id,
      name:
        user.name,
      email:
        user.email,
      avatarUrl:
        user.avatarUrl || null,
      role:
        user.role,
      phone:
        user.phone,
      jobTitle:
        user.jobTitle,
      department:
        user.department,
      sidebarOrder:
        user.sidebarOrder || [],

      permissions: {
        canManageUsers:
          user.role ===
            "CLIENT_ADMIN" ||
          user.canManageUsers,

        canManageSettings:
          user.role ===
            "CLIENT_ADMIN" ||
          user.canManageSettings,

        canManageBilling:
          user.role ===
            "CLIENT_ADMIN" ||
          user.canManageBilling,

        canViewAnalytics:
          user.role ===
            "CLIENT_ADMIN" ||
          user.canViewAnalytics,

        canManageAdmissions:
          user.role ===
            "CLIENT_ADMIN" ||
          user.canManageAdmissions,

        canManageRevenue:
          user.role ===
            "CLIENT_ADMIN" ||
          user.canManageRevenue,

        canManageLeads:
          user.role ===
            "CLIENT_ADMIN" ||
          user.canManageLeads,

        canManageSupport:
          user.role ===
            "CLIENT_ADMIN" ||
          user.canManageSupport,
      },
    },

    company: {
      id:
        company.id,
      slug:
        company.slug,
      name:
        company.name,

      brandName:
        company.settings
          ?.portalName ||
        company.brandName ||
        company.name,

      shortName:
        company.shortName ||
        company.name
          .split(" ")
          .filter(
            Boolean
          )
          .slice(
            0,
            2
          )
          .map(
            (word) =>
              word[0]
          )
          .join("")
          .toUpperCase(),

      business:
        company.business,
      ownerName:
        company.ownerName,
      city:
        company.city,
      email:
        company.email,
      phone:
        company.phone,

      logoUrl:
        company.settings
          ?.logoUrl ||
        company.logoUrl,

      primaryColor:
        company.settings
          ?.primaryColor ||
        company.primaryColor ||
        "indigo",

      secondaryColor:
        company.settings
          ?.secondaryColor ||
        null,

      subdomain:
        company.subdomain,
      status:
        company.status,

      timezone:
        company.settings
          ?.timezone ||
        "Asia/Kolkata",

      currency:
        company.settings
          ?.currency ||
        "INR",

      dateFormat:
        company.settings
          ?.dateFormat ||
        "DD/MM/YYYY",

      modules,

      subscription:
        activeSubscription
          ? {
              id:
                activeSubscription.id,

              status:
                activeSubscription.status,

              billingCycle:
                "YEARLY",

              startDate:
                activeSubscription.startDate,

              renewalDate:
                activeSubscription.renewalDate,

              endDate:
                activeSubscription.endDate,

              amount:
                activeSubscription.amount
                  ? Number(
                      activeSubscription.amount
                    )
                  : 0,

              plan: {
                id:
                  activeSubscription.plan.id,

                key:
                  activeSubscription.plan.key,

                name:
                  activeSubscription.plan.name,

                tagline:
                  activeSubscription.plan.tagline,

                yearlyPrice:
                  activeSubscription.plan.yearlyPrice
                    ? Number(
                        activeSubscription.plan.yearlyPrice
                      )
                    : null,
              },
            }
          : null,
    },
  };
}

async function getClientUser(
  userId
) {
  return prisma.user.findUnique({
    where: {
      id:
        userId,
    },

    include: {
      company: {
        include: {
          settings:
            true,

          subscriptions: {
            include: {
              plan:
                true,
            },

            orderBy: {
              createdAt:
                "desc",
            },
          },

          companyModules: {
            include: {
              module:
                true,
            },
          },
        },
      },
    },
  });
}

router.post(
  "/login",
  loginLimiter,
  async (
    req,
    res
  ) => {
    try {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.set("Pragma", "no-cache");

      const email =
        String(
          req.body
            ?.email ||
            ""
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body
            ?.password ||
            ""
        );

      if (
        !email ||
        !password
      ) {
        return res
          .status(400)
          .json({
            success:
              false,
            message:
              "Email and password are required",
          });
      }

      const user =
        await prisma.user.findUnique({
          where: {
            email,
          },

          include: {
            company: {
              include: {
                settings:
                  true,

                subscriptions: {
                  include: {
                    plan:
                      true,
                  },

                  orderBy: {
                    createdAt:
                      "desc",
                  },
                },

                companyModules: {
                  include: {
                    module:
                      true,
                  },
                },
              },
            },
          },
        });

      if (
        !user ||
        !user.active ||
        user.role ===
          "SUPER_ADMIN" ||
        !user.company
      ) {
        return res
          .status(401)
          .json({
            success:
              false,
            message:
              "Invalid email or password",
          });
      }

      if (
        [
          "SUSPENDED",
          "INACTIVE",
        ].includes(
          user.company
            .status
        )
      ) {
        return res
          .status(403)
          .json({
            success:
              false,
            message:
              "Your company account is currently unavailable. Please contact Bispun support.",
          });
      }

      const passwordMatches =
        await bcrypt.compare(
          password,
          user.passwordHash
        );

      if (
        !passwordMatches
      ) {
        return res
          .status(401)
          .json({
            success:
              false,
            message:
              "Invalid email or password",
          });
      }

      const expiresAt =
        new Date(
          Date.now() +
            8 *
              60 *
              60 *
              1000
        );

      const userAgent =
        String(
          req.headers[
            "user-agent"
          ] || ""
        ).slice(
          0,
          1000
        );

      const device =
        parseClientDevice(
          userAgent
        );

      const ipAddress =
        getClientIp(
          req
        );

      const location =
        await lookupIpLocation(
          ipAddress
        );

      const clientSession =
        await prisma.clientSession.create({
          data: {
            userId:
              user.id,
            companyId:
              user.companyId,
            ipAddress:
              ipAddress ||
              null,
            userAgent:
              userAgent ||
              null,
            deviceType:
              device.deviceType,
            deviceName:
              device.deviceName,
            browser:
              device.browser,
            os:
              device.os,
            city:
              location?.city ||
              null,
            country:
              location?.country ||
              null,
            expiresAt,
          },
        });

      // CA-010: concurrent sessions are allowed, but alert the account when a
      // new sign-in happens while another session is still active, so the user
      // sees that a different tab/browser/device logged in with their account.
      try {
        const otherActiveSessions =
          await prisma.clientSession.count({
            where: {
              userId: user.id,
              revokedAt: null,
              expiresAt: {
                gt: new Date(),
              },
              id: {
                not: clientSession.id,
              },
            },
          });

        if (otherActiveSessions > 0) {
          const place = location?.city
            ? ` from ${location.city}${
                location.country
                  ? ", " + location.country
                  : ""
              }`
            : "";

          await prisma.notification.create({
            data: {
              companyId: user.companyId,
              userId: user.id,
              title:
                "New sign-in to your account",
              message: `Your account was just signed in on ${device.deviceName}${place}. If this wasn't you, change your password and review your active sessions.`,
              type: "USER",
              actionModule: "settings",
              actionLabel:
                "Review sessions",
            },
          });
        }
      } catch (notifyError) {
        console.error(
          "Login notification failed:",
          notifyError
        );
      }

      const token =
        jwt.sign(
          {
            sub:
              user.id,
            companyId:
              user.companyId,
            role:
              user.role,
            sid:
              clientSession.id,
          },
          getJwtSecret(),
          {
            expiresIn:
              "8h",
            algorithm:
              "HS256",
          }
        );

      res.cookie(
        COOKIE_NAME,
        token,
        cookieOptions()
      );

      return res.json({
        success:
          true,
        ...buildClientSession(
          user
        ),
      });
    } catch (error) {
      console.error(
        "Client login failed:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,
          message:
            "Unable to sign in",
        });
    }
  }
);

router.get(
  "/me",
  requireClientUser,
  async (
    req,
    res
  ) => {
    try {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.set("Pragma", "no-cache");
      const user =
        await getClientUser(
          req.clientUser
            .userId
        );

      if (
        !user ||
        !user.active ||
        !user.company ||
        user.companyId !==
          req.clientUser
            .companyId ||
        user.role ===
          "SUPER_ADMIN"
      ) {
        return res
          .status(401)
          .json({
            success:
              false,
            message:
              "Unauthorized",
          });
      }

      if (
        [
          "SUSPENDED",
          "INACTIVE",
        ].includes(
          user.company
            .status
        )
      ) {
        return res
          .status(403)
          .json({
            success:
              false,
            message:
              "Your company account is currently unavailable.",
          });
      }

      return res.json({
        success:
          true,
        ...buildClientSession(
          user
        ),
      });
    } catch (error) {
      console.error(
        "Client session check failed:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,
          message:
            "Unable to verify session",
        });
    }
  }
);


router.get(
  "/sessions",
  requireClientUser,
  async (
    req,
    res
  ) => {
    try {
      const now =
        new Date();

      const historyCutoff =
        new Date(
          now.getTime() -
            90 *
              24 *
              60 *
              60 *
              1000
        );

      // Keep session history bounded.
      // Active sessions are never deleted by this cleanup.
      await prisma.clientSession.deleteMany({
        where: {
          userId:
            req.clientUser.userId,
          companyId:
            req.clientUser.companyId,
          OR: [
            {
              revokedAt: {
                lt:
                  historyCutoff,
              },
            },
            {
              revokedAt:
                null,
              expiresAt: {
                lt:
                  historyCutoff,
              },
            },
          ],
        },
      });

      const [
        activeSessions,
        endedSessions,
        expiredSessions,
      ] =
        await Promise.all([
          prisma.clientSession.findMany({
            where: {
              userId:
                req.clientUser.userId,
              companyId:
                req.clientUser.companyId,
              revokedAt:
                null,
              expiresAt: {
                gt:
                  now,
              },
            },
            orderBy: [
              {
                lastActiveAt:
                  "desc",
              },
              {
                createdAt:
                  "desc",
              },
            ],
            take:
              50,
          }),

          prisma.clientSession.findMany({
            where: {
              userId:
                req.clientUser.userId,
              companyId:
                req.clientUser.companyId,
              revokedAt: {
                not:
                  null,
              },
            },
            orderBy: {
              revokedAt:
                "desc",
            },
            take:
              50,
          }),

          prisma.clientSession.findMany({
            where: {
              userId:
                req.clientUser.userId,
              companyId:
                req.clientUser.companyId,
              revokedAt:
                null,
              expiresAt: {
                lte:
                  now,
              },
            },
            orderBy: {
              expiresAt:
                "desc",
            },
            take:
              50,
          }),
        ]);

      const history =
        [
          ...endedSessions.map(
            (session) => ({
              ...serializeSession(
                session,
                req.clientUser.sessionId
              ),
              historyStatus:
                session.endReason ||
                "SIGNED_OUT",
              endedAt:
                session.revokedAt,
            })
          ),

          ...expiredSessions.map(
            (session) => ({
              ...serializeSession(
                session,
                req.clientUser.sessionId
              ),
              historyStatus:
                "EXPIRED",
              endedAt:
                session.expiresAt,
            })
          ),
        ]
          .sort(
            (a, b) =>
              new Date(
                b.endedAt ||
                  0
              ).getTime() -
              new Date(
                a.endedAt ||
                  0
              ).getTime()
          )
          .slice(
            0,
            50
          );

      return res.json({
        success:
          true,
        activeSessions:
          activeSessions.map(
            (session) =>
              serializeSession(
                session,
                req.clientUser.sessionId
              )
          ),
        history,
      });
    } catch (error) {
      console.error(
        "Load client sessions failed:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,
          message:
            "Unable to load sessions",
        });
    }
  }
);

router.delete(
  "/sessions/history",
  requireClientUser,
  async (
    req,
    res
  ) => {
    try {
      const now =
        new Date();

      const result =
        await prisma.clientSession.deleteMany({
          where: {
            userId:
              req.clientUser.userId,
            companyId:
              req.clientUser.companyId,
            OR: [
              {
                revokedAt: {
                  not:
                    null,
                },
              },
              {
                revokedAt:
                  null,
                expiresAt: {
                  lte:
                    now,
                },
              },
            ],
          },
        });

      return res.json({
        success:
          true,
        deletedCount:
          result.count,
        message:
          result.count === 1
            ? "1 session history record cleared"
            : `${result.count} session history records cleared`,
      });
    } catch (error) {
      console.error(
        "Clear client session history failed:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,
          message:
            "Unable to clear session history",
        });
    }
  }
);

router.delete(
  "/sessions/:sessionId",
  requireClientUser,
  async (
    req,
    res
  ) => {
    try {
      const sessionId =
        String(
          req.params
            ?.sessionId ||
            ""
        );

      const session =
        await prisma.clientSession.findFirst({
          where: {
            id:
              sessionId,
            userId:
              req.clientUser.userId,
            companyId:
              req.clientUser.companyId,
            revokedAt:
              null,
          },
          select: {
            id:
              true,
          },
        });

      if (!session) {
        return res
          .status(404)
          .json({
            success:
              false,
            message:
              "Session not found",
          });
      }

      const current =
        session.id ===
        req.clientUser
          .sessionId;

      const endedAt =
        new Date();

      await prisma.clientSession.update({
        where: {
          id:
            session.id,
        },
        data: {
          revokedAt:
            endedAt,
          endReason:
            current
              ? "LOGOUT"
              : "REMOTE_SIGN_OUT",
          ...(current
            ? {
                lastActiveAt:
                  endedAt,
              }
            : {}),
        },
      });

      if (current) {
        res.clearCookie(
          COOKIE_NAME,
          clearCookieOptions()
        );
      }

      return res.json({
        success:
          true,
        current,
        message:
          current
            ? "Current session signed out"
            : "Device signed out",
      });
    } catch (error) {
      console.error(
        "Revoke client session failed:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,
          message:
            "Unable to sign out this device",
        });
    }
  }
);

router.post(
  "/sessions/revoke-others",
  requireClientUser,
  async (
    req,
    res
  ) => {
    try {
      const result =
        await prisma.clientSession.updateMany({
          where: {
            userId:
              req.clientUser.userId,
            companyId:
              req.clientUser.companyId,
            id: {
              not:
                req.clientUser.sessionId,
            },
            revokedAt:
              null,
          },
          data: {
            revokedAt:
              new Date(),
            endReason:
              "REMOTE_SIGN_OUT",
          },
        });

      return res.json({
        success:
          true,
        revokedCount:
          result.count,
        message:
          "Other devices signed out",
      });
    } catch (error) {
      console.error(
        "Revoke other client sessions failed:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,
          message:
            "Unable to sign out other devices",
        });
    }
  }
);

router.patch(
  "/change-password",
  requireClientUser,
  passwordLimiter,
  async (
    req,
    res
  ) => {
    try {
      const currentPassword =
        String(
          req.body
            ?.currentPassword ||
            ""
        );

      const newPassword =
        String(
          req.body
            ?.newPassword ||
            ""
        );

      const confirmPassword =
        String(
          req.body
            ?.confirmPassword ||
            ""
        );

      if (
        !currentPassword ||
        !newPassword ||
        !confirmPassword
      ) {
        return res
          .status(400)
          .json({
            success:
              false,
            message:
              "Current password, new password and confirmation are required",
          });
      }

      if (
        newPassword.length <
          8 ||
        !/[A-Z]/.test(
          newPassword
        ) ||
        !/[a-z]/.test(
          newPassword
        ) ||
        !/[0-9]/.test(
          newPassword
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,
            message:
              "New password must be at least 8 characters and include uppercase, lowercase and a number",
          });
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        return res
          .status(400)
          .json({
            success:
              false,
            message:
              "New password and confirmation do not match",
          });
      }

      const user =
        await prisma.user.findUnique({
          where: {
            id:
              req.clientUser.userId,
          },

          select: {
            id:
              true,
            companyId:
              true,
            role:
              true,
            active:
              true,
            passwordHash:
              true,
          },
        });

      if (
        !user ||
        !user.active ||
        !user.companyId ||
        user.companyId !==
          req.clientUser
            .companyId ||
        user.role ===
          "SUPER_ADMIN"
      ) {
        return res
          .status(401)
          .json({
            success:
              false,
            message:
              "Unauthorized",
          });
      }

      const currentMatches =
        await bcrypt.compare(
          currentPassword,
          user.passwordHash
        );

      if (
        !currentMatches
      ) {
        return res
          .status(400)
          .json({
            success:
              false,
            message:
              "Current password is incorrect",
          });
      }

      const isSameAsOld =
        await bcrypt.compare(
          newPassword,
          user.passwordHash
        );

      if (
        isSameAsOld
      ) {
        return res
          .status(400)
          .json({
            success:
              false,
            message:
              "New password must be different from the current password",
          });
      }

      const passwordHash =
        await bcrypt.hash(
          newPassword,
          12
        );

      await prisma.$transaction([
        prisma.user.update({
          where: {
            id:
              user.id,
          },

          data: {
            passwordHash,
          },
        }),

        prisma.clientSession.updateMany({
          where: {
            userId:
              user.id,
            revokedAt:
              null,
          },
          data: {
            revokedAt:
              new Date(),
            endReason:
              "PASSWORD_CHANGED",
          },
        }),
      ]);

      res.clearCookie(
        COOKIE_NAME,
        clearCookieOptions()
      );

      return res.json({
        success:
          true,
        message:
          "Password changed successfully. Please sign in again.",
        signedOut:
          true,
      });
    } catch (error) {
      console.error(
        "Client password change failed:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,
          message:
            "Unable to change password",
        });
    }
  }
);

router.post(
  "/logout",
  async (
    req,
    res
  ) => {
    const token =
      req.cookies?.[
        COOKIE_NAME
      ];

    if (token) {
      try {
        const payload =
          jwt.verify(
            token,
            getJwtSecret(),
            {
              algorithms: [
                "HS256",
              ],
            }
          );

        if (
          payload &&
          typeof payload ===
            "object" &&
          payload.sid
        ) {
          const endedAt =
            new Date();

          await prisma.clientSession.updateMany({
            where: {
              id:
                String(
                  payload.sid
                ),
              userId:
                String(
                  payload.sub ||
                    ""
                ),
              revokedAt:
                null,
            },
            data: {
              revokedAt:
                endedAt,
              lastActiveAt:
                endedAt,
              endReason:
                "LOGOUT",
            },
          });
        }
      } catch {
        // Always clear the cookie even if the token is already invalid.
      }
    }

    res.clearCookie(
      COOKIE_NAME,
      clearCookieOptions()
    );

    return res.json({
      success:
        true,
      message:
        "Signed out",
    });
  }
);

export default router;