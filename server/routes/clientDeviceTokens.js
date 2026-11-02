import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireClientUser } from "../middleware/clientAuth.js";
import { maskToken } from "../lib/pushService.js";

// Mobile device-token registration for push notifications.
// All routes are authenticated. The owning userId + companyId are taken ONLY
// from the verified session (req.clientUser) — never from the request body —
// so a client cannot register a token against another user or tenant.
const router = Router();

router.use(requireClientUser);

const ALLOWED_PLATFORMS = new Set(["android", "ios"]);

function normalizePlatform(value) {
  const platform = String(value || "android").trim().toLowerCase();
  return ALLOWED_PLATFORMS.has(platform) ? platform : "android";
}

// Register (or refresh) the current device's push token for this user.
router.post("/register", async (req, res) => {
  const { userId, companyId } = req.clientUser;
  const token = String(req.body?.token || "").trim();
  const platform = normalizePlatform(req.body?.platform);

  if (!token || token.length < 20) {
    return res
      .status(400)
      .json({ success: false, message: "A valid device token is required." });
  }

  try {
    // Token is globally unique. If it already exists (e.g. the device was
    // previously signed in as another user), reassign it to the current
    // authenticated user/company and reactivate it.
    await prisma.deviceToken.upsert({
      where: { token },
      create: { token, platform, userId, companyId, active: true },
      update: {
        userId,
        companyId,
        platform,
        active: true,
        lastSeenAt: new Date(),
      },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error(
      `[push] register failed user=${userId} token=${maskToken(token)}:`,
      error?.message || error
    );
    return res
      .status(500)
      .json({ success: false, message: "Could not register device." });
  }
});

// Unregister the current device (called on logout). Scoped to the owning
// user AND company, so a user can only ever deactivate their own device token
// (never another user's, even within the same company).
router.post("/unregister", async (req, res) => {
  const { userId, companyId } = req.clientUser;
  const token = String(req.body?.token || "").trim();

  if (!token) {
    return res.json({ success: true }); // nothing to do
  }

  try {
    await prisma.deviceToken.updateMany({
      where: { token, companyId, userId },
      data: { active: false },
    });
    return res.json({ success: true });
  } catch (error) {
    console.error(
      `[push] unregister failed token=${maskToken(token)}:`,
      error?.message || error
    );
    return res
      .status(500)
      .json({ success: false, message: "Could not unregister device." });
  }
});

export default router;
