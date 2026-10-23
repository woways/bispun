import { Router } from "express";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import prisma from "../lib/prisma.js";
import { requireClientUser } from "../middleware/clientAuth.js";
import { buildObjectKey, putObject, fileProxyUrl } from "../lib/s3Storage.js";

const router = Router();

router.use(requireClientUser);

/*
 * =============================================================================
 * QUOTA — the per-client image limit lives HERE, in your own code.
 * Ideogram has no concept of your tenants; it only sees ONE account (yours)
 * with one shared balance. So we cap each company here, counting the images
 * they generated this calendar month against a limit.
 *
 * To make the limit per-plan later, replace DEFAULT_MONTHLY_LIMIT with a
 * lookup (e.g. from the company's plan or a field on CompanySettings).
 * =============================================================================
 */
const DEFAULT_MONTHLY_LIMIT = 30;

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function getUsage(companyId) {
  const used = await prisma.storeAsset.count({
    where: {
      companyId,
      type: "IMAGE",
      createdAt: { gte: startOfMonth() },
    },
  });

  const limit = DEFAULT_MONTHLY_LIMIT;

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    month: startOfMonth().toISOString().slice(0, 7),
  };
}

/*
 * =============================================================================
 * TEMPLATES — zero-cost content. Promo + message + ready design cards.
 * {Company} is replaced server-side with the tenant's real name.
 * These need NO Ideogram key and work immediately.
 * =============================================================================
 */
const OCCASIONS = [
  {
    id: "teachers-day",
    label: "Teachers' Day",
    emoji: "🍎",
    promo:
      "🎉 Teachers' Day Special! Enrol this week and get 20% off your first course — because great teachers deserve great students. Offer ends soon.",
    message:
      "🍎 Happy Teachers' Day! To every teacher who lights the path of learning — thank you for shaping futures. Wishing you a wonderful day. — Team {Company}",
    designs: [
      { emoji: "🍎", title: "Happy\nTeachers' Day", gradient: "from-sky-400 to-indigo-600" },
      { emoji: "🌸", title: "Thank You", gradient: "from-pink-400 to-rose-600" },
      { emoji: "🎓", title: "To Our\nMentors", gradient: "from-amber-400 to-orange-600" },
      { emoji: "📚", title: "Wisdom", gradient: "from-violet-500 to-purple-700" },
    ],
  },
  {
    id: "diwali",
    label: "Diwali",
    emoji: "🪔",
    promo:
      "🪔 Diwali Dhamaka! Light up your career this festive season — special admission offers now open at {Company}. Limited seats.",
    message:
      "✨ Happy Diwali from {Company}! May this festival of lights bring you success, knowledge and bright new beginnings. 🪔",
    designs: [
      { emoji: "🪔", title: "Happy\nDiwali", gradient: "from-amber-400 to-orange-600" },
      { emoji: "✨", title: "Festival\nof Lights", gradient: "from-yellow-400 to-red-600" },
      { emoji: "🎆", title: "Shine\nBright", gradient: "from-fuchsia-500 to-purple-700" },
      { emoji: "🌟", title: "Prosperity", gradient: "from-rose-400 to-pink-600" },
    ],
  },
  {
    id: "new-year",
    label: "New Year",
    emoji: "🎊",
    promo:
      "🎊 New Year, New Goals! Kickstart {Year} with {Company}. Enrol in January and unlock exclusive early-bird pricing.",
    message:
      "🎉 Happy New Year from all of us at {Company}! Here's to a year of learning, growth and achieving your dreams.",
    designs: [
      { emoji: "🎊", title: "Happy\nNew Year", gradient: "from-indigo-500 to-purple-700" },
      { emoji: "🎆", title: "New\nBeginnings", gradient: "from-sky-400 to-blue-700" },
      { emoji: "🌟", title: "Dream\nBig", gradient: "from-amber-400 to-orange-600" },
      { emoji: "🚀", title: "Level Up", gradient: "from-emerald-400 to-teal-600" },
    ],
  },
  {
    id: "independence-day",
    label: "Independence Day",
    emoji: "🏵️",
    promo:
      "🇮🇳 Freedom to Learn! Celebrate Independence Day with {Company} — special scholarships and offers on all courses this week.",
    message:
      "🇮🇳 Happy Independence Day! {Company} salutes the spirit of freedom. Let's build a brighter, educated tomorrow together.",
    designs: [
      { emoji: "🏵️", title: "Happy\nIndependence Day", gradient: "from-orange-400 to-green-600" },
      { emoji: "🕊️", title: "Freedom", gradient: "from-sky-400 to-indigo-600" },
      { emoji: "🎖️", title: "Proud\nNation", gradient: "from-amber-400 to-orange-600" },
      { emoji: "🌏", title: "Unity", gradient: "from-emerald-400 to-teal-600" },
    ],
  },
  {
    id: "childrens-day",
    label: "Children's Day",
    emoji: "🎈",
    promo:
      "🎈 Children's Day Special! Invest in your child's future with {Company}. Enrol now and get a free counselling session.",
    message:
      "🎈 Happy Children's Day! Every child holds a spark. {Company} is here to help it shine. 🌟",
    designs: [
      { emoji: "🎈", title: "Happy\nChildren's Day", gradient: "from-pink-400 to-rose-600" },
      { emoji: "🧸", title: "Bright\nFutures", gradient: "from-sky-400 to-indigo-600" },
      { emoji: "🌈", title: "Dream", gradient: "from-fuchsia-500 to-purple-700" },
      { emoji: "⭐", title: "Every\nChild Shines", gradient: "from-amber-400 to-orange-600" },
    ],
  },
  {
    id: "generic",
    label: "General Greeting",
    emoji: "✨",
    promo:
      "✨ Special offer from {Company}! Enrol this week and take the next step in your career journey. Limited-time pricing.",
    message:
      "Warm greetings from {Company}! We're here to guide you every step of the way. Reach out anytime. 🌟",
    designs: [
      { emoji: "✨", title: "Greetings", gradient: "from-indigo-500 to-purple-700" },
      { emoji: "🎓", title: "Your\nJourney", gradient: "from-sky-400 to-blue-700" },
      { emoji: "🌟", title: "Achieve\nMore", gradient: "from-amber-400 to-orange-600" },
      { emoji: "📚", title: "Learn", gradient: "from-emerald-400 to-teal-600" },
    ],
  },
];

function fillTemplateTokens(text, { companyName, year }) {
  return String(text || "")
    .replaceAll("{Company}", companyName || "our team")
    .replaceAll("{Year}", String(year || datePartsInTimezone().year));
}

async function companyBranding(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      brandName: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      settings: {
        select: { logoUrl: true, primaryColor: true },
      },
    },
  });

  const rawName = company?.name || company?.brandName || "our team";
  return {
    name: String(rawName).replace(/\s*CRM$/i, "").trim() || "our team",
    logoUrl: String(company?.settings?.logoUrl || company?.logoUrl || "").trim(),
    primaryColor: String(
      company?.settings?.primaryColor || company?.primaryColor || "indigo"
    ).trim(),
  };
}

async function companyName(companyId) {
  return (await companyBranding(companyId)).name;
}

const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);
const MAX_BRANDING_LOGO_BYTES = 1024 * 1024;

function isPrivateIpAddress(address) {
  const value = String(address || "").toLowerCase();
  if (!value) return true;

  if (value.includes(":")) {
    return (
      value === "::1" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe80:") ||
      value.startsWith("::ffff:127.") ||
      value.startsWith("::ffff:10.") ||
      value.startsWith("::ffff:192.168.")
    );
  }

  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return true;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

async function assertSafeRemoteLogoUrl(value) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Branding logo URL must use HTTP or HTTPS");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Local branding logo URLs are not supported");
  }

  if (isIP(hostname)) {
    if (isPrivateIpAddress(hostname)) throw new Error("Private branding logo URLs are not supported");
    return parsed;
  }

  const resolved = await lookup(hostname, { all: true });
  if (!resolved.length || resolved.some((item) => isPrivateIpAddress(item.address))) {
    throw new Error("Branding logo URL must resolve to a public address");
  }

  return parsed;
}

function normalizeDataLogo(value) {
  const match = String(value || "").match(
    /^data:(image\/(?:png|jpeg|webp|svg\+xml));(base64)?,(.*)$/is
  );
  if (!match) return null;

  const contentType = match[1].toLowerCase();
  const buffer = match[2]
    ? Buffer.from(match[3], "base64")
    : Buffer.from(decodeURIComponent(match[3]), "utf8");

  if (!ALLOWED_LOGO_TYPES.has(contentType) || buffer.length > MAX_BRANDING_LOGO_BYTES) {
    throw new Error("Branding logo is not a supported image or is too large");
  }

  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

async function brandingLogoDataUri(logoValue) {
  const value = String(logoValue || "").trim();
  if (!value) return "";

  if (value.startsWith("data:image/")) {
    return normalizeDataLogo(value) || "";
  }

  let current = value;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    await assertSafeRemoteLogoUrl(current);
    const response = await fetch(current, { redirect: "manual" });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Branding logo redirect is missing a location");
      current = new URL(location, current).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`Unable to download branding logo (${response.status})`);
    }

    const contentType = String(response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_LOGO_TYPES.has(contentType)) {
      throw new Error("Branding logo URL did not return a supported image");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BRANDING_LOGO_BYTES) {
      throw new Error("Branding logo is too large");
    }

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }

  throw new Error("Branding logo redirected too many times");
}

function buildBrandedPosterSvg({ imageBuffer, imageContentType, logoDataUri }) {
  const background = `data:${imageContentType};base64,${imageBuffer.toString("base64")}`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
      <image href="${background}" x="0" y="0" width="1200" height="1200" preserveAspectRatio="xMidYMid slice"/>
      <rect x="54" y="48" width="330" height="138" rx="24" fill="#ffffff" fill-opacity="0.94"/>
      <image href="${logoDataUri}" x="78" y="67" width="282" height="100" preserveAspectRatio="xMinYMid meet"/>
    </svg>`,
    "utf8"
  );
}

// GET /api/client/store/occasions  → static event choices for client-driven generation
router.get("/occasions", async (req, res) => {
  try {
    res.json({
      success: true,
      occasions: OCCASIONS.map((o) => ({
        id: o.id,
        label: o.label,
        emoji: o.emoji,
      })),
    });
  } catch (error) {
    console.error("store/occasions failed:", error?.message || error);
    res.status(500).json({ success: false, message: "Unable to load occasions" });
  }
});

// GET /api/client/store/templates/:occasionId  → promo, message, designs (company-filled)
router.get("/templates/:occasionId", async (req, res) => {
  try {
    const occasion =
      OCCASIONS.find((o) => o.id === req.params.occasionId) ||
      OCCASIONS.find((o) => o.id === "generic");

    const name = await companyName(req.clientUser.companyId);
    const year = new Date().getFullYear();

    res.json({
      success: true,
      occasion: {
        id: occasion.id,
        label: occasion.label,
        emoji: occasion.emoji,
        year,
      },
      promo: fillTemplateTokens(occasion.promo, { companyName: name, year }),
      message: fillTemplateTokens(occasion.message, { companyName: name, year }),
      designs: occasion.designs,
    });
  } catch (error) {
    console.error("store/templates failed:", error?.message || error);
    res.status(500).json({ success: false, message: "Unable to load templates" });
  }
});

// GET /api/client/store/usage  → this company's monthly image quota
router.get("/usage", async (req, res) => {
  try {
    const usage = await getUsage(req.clientUser.companyId);
    res.json({ success: true, ...usage });
  } catch (error) {
    console.error("store/usage failed:", error?.message || error);
    res.status(500).json({ success: false, message: "Unable to load usage" });
  }
});

// GET /api/client/store/assets  → recently generated images for this company
router.get("/assets", async (req, res) => {
  try {
    const assets = await prisma.storeAsset.findMany({
      where: { companyId: req.clientUser.companyId, type: "IMAGE" },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: { id: true, occasion: true, imageUrl: true, prompt: true, createdAt: true },
    });
    res.json({ success: true, assets });
  } catch (error) {
    console.error("store/assets failed:", error?.message || error);
    res.status(500).json({ success: false, message: "Unable to load assets" });
  }
});

/*
 * =============================================================================
 * POST /api/client/store/generate  → LIVE image generation (Ideogram).
 *
 * Order of checks, deliberately:
 *   1) Is the Ideogram key configured?  If not → 503 IMAGE_GEN_DISABLED.
 *      (This is the templates-first state: page works, image button dark.)
 *   2) Is this company within its monthly quota? If not → 429 QUOTA_EXCEEDED.
 *   3) Call Ideogram, SAVE THE IMAGE TO S3 (Ideogram's own URLs expire),
 *      create a StoreAsset row (this is what counts toward quota),
 *      return the permanent S3 proxy URL.
 *
 * Ideogram v2 uses JSON for this endpoint. Nothing is generated or billed
 * unless IDEOGRAM_API_KEY is configured and the Ideogram account has credits.
 * =============================================================================
 */
async function callIdeogram(prompt, { companyId, occasionId, logoDataUri }) {
  const apiKey = String(process.env.IDEOGRAM_API_KEY || "").trim();
  if (!apiKey) return { disabled: true };

  // --- 1) Generate the image on Ideogram -----------------------------------
  const response = await fetch(
    "https://api.ideogram.ai/v2/image/generate/ideogram-4-5",
    {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        rendering_speed: "turbo",
        num_images: 1,
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Ideogram request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  const srcUrl =
    data?.data?.[0]?.url ||
    data?.images?.[0]?.url ||
    data?.data?.[0]?.image_url ||
    null;
  if (!srcUrl) throw new Error("Ideogram returned no image URL");

  // --- 2) Download the artwork. If the tenant has a Branding logo, overlay
  // that exact file after generation; otherwise store the generated artwork as-is.
  // The AI never receives logo pixels, so it cannot redraw/distort an uploaded logo.
  const imgRes = await fetch(srcUrl);
  if (!imgRes.ok) {
    throw new Error(`Could not download generated image (${imgRes.status})`);
  }
  const imageBuffer = Buffer.from(await imgRes.arrayBuffer());
  const downloadedContentType = String(
    imgRes.headers.get("content-type") || "image/png"
  )
    .split(";")[0]
    .trim()
    .toLowerCase();
  const imageContentType = downloadedContentType.startsWith("image/")
    ? downloadedContentType
    : "image/png";
  const hasBrandingLogo = Boolean(String(logoDataUri || "").trim());
  const outputBuffer = hasBrandingLogo
    ? buildBrandedPosterSvg({ imageBuffer, imageContentType, logoDataUri })
    : imageBuffer;
  const outputContentType = hasBrandingLogo ? "image/svg+xml" : imageContentType;
  const extension = hasBrandingLogo
    ? "svg"
    : imageContentType === "image/jpeg"
      ? "jpg"
      : imageContentType === "image/webp"
        ? "webp"
        : "png";

  const key = buildObjectKey(
    ["store-assets", String(companyId || "unknown"), String(occasionId || "generic")],
    `generated-poster.${extension}`
  );
  await putObject({ buffer: outputBuffer, key, contentType: outputContentType });

  // Stable, permanent proxy URL stored in the DB (never expires)
  return { disabled: false, url: fileProxyUrl(key), key };
}

router.post("/generate", async (req, res) => {
  try {
    const { occasionId, prompt } = req.body || {};

    const occasion =
      OCCASIONS.find((o) => o.id === occasionId) ||
      OCCASIONS.find((o) => o.id === "generic");

    // 1) key configured?
    const keyPresent = Boolean(String(process.env.IDEOGRAM_API_KEY || "").trim());
    if (!keyPresent) {
      return res.status(503).json({
        success: false,
        code: "IMAGE_GEN_DISABLED",
        message:
          "Live image generation is coming soon. Your ready designs, promo and message are available now.",
      });
    }

    // 2) quota
    const usage = await getUsage(req.clientUser.companyId);
    if (usage.remaining <= 0) {
      return res.status(429).json({
        success: false,
        code: "QUOTA_EXCEEDED",
        message: `You've used all ${usage.limit} image generations for this month. It resets on the 1st.`,
        ...usage,
      });
    }

    // 3) Load tenant branding. A logo is optional: if one exists and can be
    // loaded, Bispun overlays that exact file; otherwise generation continues
    // without any logo. The AI is still told not to invent a fake brand mark.
    const branding = await companyBranding(req.clientUser.companyId);
    let logoDataUri = "";
    if (branding.logoUrl) {
      try {
        logoDataUri = await brandingLogoDataUri(branding.logoUrl);
      } catch (logoError) {
        console.warn(
          "store/generate branding logo unavailable; continuing without logo:",
          logoError?.message || logoError
        );
      }
    }

    const requestedPrompt = String(prompt || "").trim().slice(0, 1800);
    const defaultPrompt = `Create a beautiful, professional ${occasion.label} greeting poster for a modern education consultancy. Clean modern design, high quality and ready for social media.`;
    const userPrompt = requestedPrompt || defaultPrompt;
    const finalPrompt = [
      userPrompt,
      "IMPORTANT BRANDING RULE: Do not generate, imitate, draw, invent or render any logo, emblem, badge, watermark or brand mark.",
      "Do not add any company, school, institute, consultancy or organization name as branding, footer text, signature, creator credit or watermark.",
      "Do not invent brand text. Branding will be applied separately by Bispun using the tenant's exact uploaded Settings > Branding logo.",
      "Keep the top-left area clean, low-detail and free of important text or faces so the exact uploaded branding logo can be overlaid there when available.",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await callIdeogram(finalPrompt, {
      companyId: req.clientUser.companyId,
      occasionId: occasion.id,
      logoDataUri,
    });
    if (result.disabled) {
      return res.status(503).json({
        success: false,
        code: "IMAGE_GEN_DISABLED",
        message: "Live image generation is coming soon.",
      });
    }

    const asset = await prisma.storeAsset.create({
      data: {
        companyId: req.clientUser.companyId,
        occasion: occasion.id,
        type: "IMAGE",
        prompt: userPrompt,
        imageUrl: result.url,
        createdByUserId: req.clientUser.userId || null,
      },
      select: { id: true, imageUrl: true, occasion: true, prompt: true, createdAt: true },
    });

    const after = await getUsage(req.clientUser.companyId);
    res.json({ success: true, asset, usage: after });
  } catch (error) {
    console.error("store/generate failed:", error?.message || error);
    res.status(502).json({
      success: false,
      code: "GENERATION_FAILED",
      message: "Image generation failed. Please try again.",
    });
  }
});

export default router;