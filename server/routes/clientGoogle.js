import { Router } from "express";
import jwt from "jsonwebtoken";

import prisma from "../lib/prisma.js";
import { requireClientUser } from "../middleware/clientAuth.js";
import {
  isGoogleConfigured,
  getAuthUrl,
  exchangeCodeForTokens,
  encryptToken,
  createMeetEvent,
  hasGmailSendScope,
  sendGmailMessage,
} from "../lib/google.js";

const router = Router();

function frontendBase() {
  const origins = String(process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return origins[0] || "http://localhost:5173";
}

function parseIdTokenEmail(idToken) {
  try {
    const payload = JSON.parse(
      Buffer.from(String(idToken).split(".")[1], "base64").toString("utf8")
    );
    return payload.email || null;
  } catch {
    return null;
  }
}

// Is Google connected for the logged-in user?
router.get("/status", requireClientUser, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.clientUser.userId },
      select: {
        googleRefreshToken: true,
        googleEmail: true,
        googleConnectedAt: true,
        googleScopes: true,
      },
    });
    return res.json({
      success: true,
      configured: isGoogleConfigured(),
      connected: Boolean(user?.googleRefreshToken),
      email: user?.googleEmail || null,
      connectedAt: user?.googleConnectedAt || null,
      gmailEnabled: hasGmailSendScope(user?.googleScopes || []),
    });
  } catch (error) {
    console.error("Google status failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to load Google status" });
  }
});

// Start the connect flow: returns the Google consent URL.
// The user's identity is carried in a short-lived signed `state` token, so the
// public callback below can attribute the tokens without a cookie.
router.get("/connect", requireClientUser, async (req, res) => {
  if (!isGoogleConfigured()) {
    return res.status(400).json({
      success: false,
      message: "Google is not configured on the server",
    });
  }
  const state = jwt.sign(
    { sub: req.clientUser.userId, companyId: req.clientUser.companyId },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
  return res.json({ success: true, url: getAuthUrl(state) });
});

// OAuth callback — Google redirects the browser here. Public route.
router.get("/callback", async (req, res) => {
  const base = frontendBase();
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !state) return res.redirect(`${base}/?google=error`);

    let decoded;
    try {
      decoded = jwt.verify(state, process.env.JWT_SECRET);
    } catch {
      return res.redirect(`${base}/?google=error`);
    }

    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      return res.redirect(`${base}/?google=norefresh`);
    }

    await prisma.user.update({
      where: { id: decoded.sub },
      data: {
        googleRefreshToken: encryptToken(tokens.refresh_token),
        googleEmail: parseIdTokenEmail(tokens.id_token),
        googleConnectedAt: new Date(),
        googleScopes: String(tokens.scope || "").split(/\s+/).filter(Boolean),
      },
    });

    return res.redirect(`${base}/?google=connected`);
  } catch (error) {
    console.error("Google callback failed:", error);
    return res.redirect(`${base}/?google=error`);
  }
});

// Create a Google Meet link (on the logged-in user's calendar) and return it.
router.post("/meet", requireClientUser, async (req, res) => {
  try {
    const now = Date.now();
    const startISO =
      req.body?.startISO || new Date(now).toISOString();
    const endISO =
      req.body?.endISO || new Date(now + 60 * 60 * 1000).toISOString();
    const result = await createMeetEvent(req.clientUser.userId, {
      summary: req.body?.summary || "Meeting",
      description: req.body?.description || "",
      startISO,
      endISO,
      attendees: Array.isArray(req.body?.attendees) ? req.body.attendees : [],
    });
    if (!result.meetLink) {
      return res.status(502).json({
        success: false,
        message: "Google did not return a Meet link. Try again.",
      });
    }
    return res.json({ success: true, meetLink: result.meetLink });
  } catch (error) {
    const notConnected = /not connected/i.test(String(error?.message || ""));
    console.error("Create Meet failed:", error?.message || error);
    return res.status(400).json({
      success: false,
      message: notConnected
        ? "Connect your Google account in Settings → Integrations first."
        : "Unable to create a Google Meet link. Try reconnecting Google.",
    });
  }
});

// Send a test email to the connected Gmail account.
router.post("/test-email", requireClientUser, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.clientUser.userId },
      select: { googleEmail: true },
    });
    if (!user?.googleEmail) {
      return res.status(400).json({ success: false, message: "Connect Google first." });
    }
    await sendGmailMessage(req.clientUser.userId, {
      to: user.googleEmail,
      subject: "Bispun Gmail integration test",
      text: "Your Gmail integration is working. You can now send emails to leads from Lead Store.",
    });
    return res.json({ success: true, message: `Test email sent to ${user.googleEmail}` });
  } catch (error) {
    console.error("Gmail test failed:", error?.message || error);
    return res.status(400).json({
      success: false,
      message: /permission|scope/i.test(String(error?.message || ""))
        ? "Reconnect Google in Settings → Integrations to grant Gmail permission."
        : "Unable to send the Gmail test email.",
    });
  }
});

// Disconnect the logged-in user's Google account.
router.post("/disconnect", requireClientUser, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.clientUser.userId },
      data: {
        googleRefreshToken: null,
        googleEmail: null,
        googleConnectedAt: null,
        googleScopes: [],
      },
    });
    return res.json({ success: true });
  } catch (error) {
    console.error("Google disconnect failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to disconnect Google" });
  }
});

export default router;