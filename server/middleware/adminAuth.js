import jwt from "jsonwebtoken";

import prisma from "../lib/prisma.js";
import { getBearerToken } from "../lib/authToken.js";
import { isTransientDbError, withDbRetry } from "../lib/dbRetry.js";

const COOKIE_NAME =
  "cb_admin_token";

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

export async function requireSuperAdmin(
  req,
  res,
  next
) {
  try {
    const token =
      req.cookies?.[
        COOKIE_NAME
      ] ||
      getBearerToken(req);

    if (!token) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Unauthorized",
        });
    }

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
      !payload ||
      typeof payload !==
        "object" ||
      payload.role !==
        "SUPER_ADMIN" ||
      !payload.sub
    ) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Unauthorized",
        });
    }

    const admin =
      await withDbRetry(() =>
        prisma.user.findUnique({
          where: {
            id:
              payload.sub,
          },

          select: {
            id: true,
            role: true,
            active: true,
          },
        })
      );

    if (
      !admin ||
      !admin.active ||
      admin.role !==
        "SUPER_ADMIN"
    ) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Unauthorized",
        });
    }

    req.admin = {
      userId:
        admin.id,
      role:
        admin.role,
    };

    return next();
  } catch (error) {
    // A transient DB failure (e.g. Neon cold-start) is NOT an auth failure —
    // return 503 so the client retries rather than being logged out. JWT/
    // validation failures are not transient, so they still return 401 below.
    if (isTransientDbError(error)) {
      return res
        .status(503)
        .json({
          success: false,
          message:
            "Service temporarily unavailable. Please try again.",
        });
    }

    return res
      .status(401)
      .json({
        success: false,
        message:
          "Session expired or invalid",
      });
  }
}