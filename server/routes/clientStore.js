import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireClientUser } from "../middleware/clientAuth.js";

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
    date: "09-05",
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
    date: "10-20",
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
    date: "01-01",
    promo:
      "🎊 New Year, New Goals! Kickstart 2026 with {Company}. Enrol in January and unlock exclusive early-bird pricing.",
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
    date: "08-15",
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
    date: "11-14",
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
    date: null,
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

function spotlight() {
  const now = new Date();
  const mmdd = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  const today = OCCASIONS.find((o) => o.date === mmdd);
  if (today) return { ...today, live: true };

  // else next upcoming dated occasion
  const dated = OCCASIONS.filter((o) => o.date)
    .map((o) => ({ o, key: o.date }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));

  const upcoming = dated.find(({ key }) => key >= mmdd) || dated[0];
  return upcoming ? { ...upcoming.o, live: false } : { ...OCCASIONS[0], live: false };
}

function fillCompany(text, companyName) {
  return String(text || "").replaceAll("{Company}", companyName || "our team");
}

async function companyName(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { brandName: true, name: true },
  });
  // CA-030: greetings sent to students should read the plain company name,
  // not the internal "… CRM" brand label. Prefer name, and strip a trailing "CRM".
  const raw = company?.name || company?.brandName || "our team";
  return String(raw).replace(/\s*CRM$/i, "").trim() || "our team";
}

// GET /api/client/store/occasions  → list + today's spotlight
router.get("/occasions", async (req, res) => {
  try {
    const spot = spotlight();
    res.json({
      success: true,
      spotlight: { id: spot.id, label: spot.label, emoji: spot.emoji, live: spot.live },
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

    res.json({
      success: true,
      occasion: { id: occasion.id, label: occasion.label, emoji: occasion.emoji },
      promo: fillCompany(occasion.promo, name),
      message: fillCompany(occasion.message, name),
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
      select: { id: true, occasion: true, imageUrl: true, createdAt: true },
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
 *   3) Call Ideogram, save a StoreAsset row (this is what counts toward quota),
 *      return the image URL.
 *
 * NOTE [confirm before enabling]: the exact Ideogram request shape below is the
 * commonly documented v3 form. Once you fund the API and add the key, run one
 * test and we adjust the endpoint/fields against developer.ideogram.ai if
 * needed. Nothing here charges money until IDEOGRAM_API_KEY is set AND funded.
 * =============================================================================
 */
async function callIdeogram(prompt) {
  const apiKey = String(process.env.IDEOGRAM_API_KEY || "").trim();
  if (!apiKey) return { disabled: true };

  const form = new FormData();
  form.append("prompt", prompt);
  form.append("rendering_speed", "TURBO"); // cheapest tier
  form.append("num_images", "1"); // 1 image = 1 charge; never default to 4

  const response = await fetch("https://api.ideogram.ai/v1/ideogram-v3/generate", {
    method: "POST",
    headers: { "Api-Key": apiKey },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Ideogram request failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const data = await response.json();
  const url = data?.data?.[0]?.url || data?.images?.[0]?.url || null;
  if (!url) throw new Error("Ideogram returned no image URL");
  return { disabled: false, url };
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

    // 3) generate
    const name = await companyName(req.clientUser.companyId);
    const finalPrompt =
      String(prompt || "").trim() ||
      `A beautiful, professional ${occasion.label} greeting poster for an education brand named "${name}". Clean modern design, festive, high quality, with elegant space for a logo.`;

    const result = await callIdeogram(finalPrompt);
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
        prompt: finalPrompt,
        imageUrl: result.url,
        createdByUserId: req.clientUser.userId || null,
      },
      select: { id: true, imageUrl: true, occasion: true, createdAt: true },
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