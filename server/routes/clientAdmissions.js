import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";

import prisma from "../lib/prisma.js";
import { ensureAdmissionsLead } from "../lib/admissionsLeadSync.js";
import {
  requireClientUser,
  requireClientPermission,
} from "../middleware/clientAuth.js";

const router = Router();

function parseYear(value) {
  if (!value || value === "all") return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

function parseMarket(value, fallback = null) {
  const market = String(value || "").trim().toUpperCase();
  if (market === "DOMESTIC" || market === "INTERNATIONAL") return market;
  return fallback;
}

function yearRange(year) {
  if (!year) return null;
  return {
    gte: new Date(year, 0, 1),
    lt: new Date(year + 1, 0, 1),
  };
}


router.use(requireClientUser);
router.use(
  requireClientPermission(
    "canManageAdmissions",
    "You do not have permission to access admissions"
  )
);

const VALID_STATUSES = [
  "PENDING",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
];

const STATUS_LABELS = {
  PENDING: "Pending",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const VALID_REVENUE_STATUSES = ["IN_BUCKET", "BUFFER_ZONE"];
const VALID_AMOUNT_STATUSES = ["RECEIVED", "PENDING"];

const REVENUE_STATUS_LABELS = {
  IN_BUCKET: "In Bucket",
  BUFFER_ZONE: "Buffer Zone",
};

const AMOUNT_STATUS_LABELS = {
  RECEIVED: "Received",
  PENDING: "Pending",
};

const MAX_IMPORT_ROWS = 2000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    const name = String(file.originalname || "").toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      callback(new Error("Only CSV and XLSX files are supported"));
      return;
    }
    callback(null, true);
  },
});

function cleanOptional(value) {
  const clean = String(value ?? "").trim();
  return clean || null;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `partner-${Date.now()}`;
}

function inferStreamColor(name) {
  const value = String(name || "").trim().toLowerCase();

  if (
    value.includes("medical") ||
    value.includes("mbbs") ||
    value.includes("health")
  ) return "rose";

  if (
    value.includes("engineering") ||
    value.includes("technology") ||
    value.includes("btech") ||
    value.includes("tech")
  ) return "blue";

  if (
    value.includes("management") ||
    value.includes("mba") ||
    value.includes("business")
  ) return "amber";

  if (
    value.includes("pharmacy") ||
    value.includes("pharma")
  ) return "cyan";

  if (
    value.includes("law") ||
    value.includes("legal")
  ) return "emerald";

  if (
    value.includes("degree") ||
    value.includes("arts") ||
    value.includes("science")
  ) return "purple";

  return "blue";
}

function parseMoney(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(String(value).replace(/[,₹\s]/g, ""));
  return Number.isFinite(number) ? number : NaN;
}

function parseDate(value, fallback = new Date()) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatAdmission(admission) {
  const totalFee = Number(admission.totalFee) || 0;
  const paidAmount = Number(admission.paidAmount) || 0;

  return {
    id: admission.id,
    market: admission.market,
    leadId: admission.leadId,
    partnerId: admission.partnerId,
    partner: admission.partner
      ? {
          id: admission.partner.id,
          name: admission.partner.name,
          slug: admission.partner.slug,
          stream: admission.partner.stream
            ? {
                id: admission.partner.stream.id,
                name: admission.partner.stream.name,
                slug: admission.partner.stream.slug,
                color: admission.partner.stream.color || "blue",
              }
            : null,
        }
      : null,
    branchId: admission.branchId,
    branch: admission.branch
      ? {
          id: admission.branch.id,
          name: admission.branch.name,
          slug: admission.branch.slug,
        }
      : null,
    name: admission.studentName,
    phone: admission.studentPhone,
    email: admission.studentEmail,
    universityName: admission.universityName || "",
    studentLocation: admission.studentLocation || "",
    studentInterCollege: admission.studentInterCollege || "",
    college: admission.college,
    course: admission.course,
    counsellor: admission.counsellorName || "Unassigned",
    counsellorName: admission.counsellorName,
    // Database field names remain totalFee/paidAmount for backwards compatibility.
    incentiveAmount: totalFee,
    receivedAmount: paidAmount,
    pendingAmount: Math.max(totalFee - paidAmount, 0),
    total: totalFee,
    paid: paidAmount,
    pending: Math.max(totalFee - paidAmount, 0),
    revenueStatus: admission.revenueStatus || "BUFFER_ZONE",
    bufferStatus:
      REVENUE_STATUS_LABELS[admission.revenueStatus] ||
      REVENUE_STATUS_LABELS.BUFFER_ZONE,
    amountStatusKey: admission.amountStatus || null,
    amountStatus: admission.amountStatus
      ? AMOUNT_STATUS_LABELS[admission.amountStatus] || admission.amountStatus
      : "—",
    status: STATUS_LABELS[admission.status] || admission.status,
    statusKey: admission.status,
    admissionDate: admission.admissionDate,
    notes: admission.notes,
    createdAt: admission.createdAt,
    updatedAt: admission.updatedAt,
    lead: admission.lead
      ? {
          id: admission.lead.id,
          source: admission.lead.source,
          campaign: admission.lead.campaign,
        }
      : null,
  };
}


async function uniqueStreamSlug(companyId, name, excludeId = null) {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.admissionStream.findFirst({
      where: {
        companyId,
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function getStream(companyId, streamId) {
  if (!streamId) return null;

  return prisma.admissionStream.findFirst({
    where: {
      id: String(streamId),
      companyId,
      active: true,
    },
  });
}

async function ensureDefaultStream(companyId, market = "DOMESTIC") {
  const resolvedMarket = parseMarket(market, "DOMESTIC");
  const defaultName = resolvedMarket === "INTERNATIONAL" ? "General International" : "General";
  const defaultSlug = resolvedMarket === "INTERNATIONAL" ? "general-international" : "general";

  let stream = await prisma.admissionStream.findFirst({
    where: {
      companyId,
      market: resolvedMarket,
      slug: defaultSlug,
    },
  });

  if (!stream) {
    const existingFirst = await prisma.admissionStream.findFirst({
      where: { companyId, market: resolvedMarket, active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    stream =
      existingFirst ||
      (await prisma.admissionStream.create({
        data: {
          companyId,
          market: resolvedMarket,
          name: defaultName,
          slug: await uniqueStreamSlug(companyId, defaultName),
          description:
            resolvedMarket === "INTERNATIONAL"
              ? "Uncategorized international admission colleges"
              : "Existing colleges and uncategorized admission partners",
        },
      }));
  }

  await prisma.admissionPartner.updateMany({
    where: {
      companyId,
      market: resolvedMarket,
      streamId: null,
    },
    data: {
      streamId: stream.id,
    },
  });

  return stream;
}

function streamMetrics(stream) {
  const partners = stream.partners || [];
  const admissions = partners.flatMap((partner) => partner.admissions || []);
  const activeAdmissions = admissions.filter(
    (item) => item.status !== "CANCELLED"
  );

  return {
    id: stream.id,
    market: stream.market || "DOMESTIC",
    name: stream.name,
    slug: stream.slug,
    description: stream.description,
    color: stream.color || "blue",
    active: stream.active,
    sortOrder: stream.sortOrder,
    totalColleges: partners.length,
    totalBranches: partners.reduce(
      (sum, partner) => sum + Number(partner._count?.branches || partner.branches?.length || 0),
      0
    ),
    totalAdmissions: admissions.length,
    received: activeAdmissions.reduce(
      (sum, item) => sum + Number(item.paidAmount || 0),
      0
    ),
    pending: activeAdmissions.reduce(
      (sum, item) =>
        sum +
        Math.max(
          Number(item.totalFee || 0) - Number(item.paidAmount || 0),
          0
        ),
      0
    ),
    createdAt: stream.createdAt,
  };
}

async function uniquePartnerSlug(companyId, name, excludeId = null) {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.admissionPartner.findFirst({
      where: {
        companyId,
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function syncLegacyPartners(companyId) {
  const defaultStream = await ensureDefaultStream(companyId, "DOMESTIC");

  const legacy = await prisma.admission.findMany({
    where: {
      companyId,
      partnerId: null,
      college: { not: "" },
    },
    select: { college: true },
    distinct: ["college"],
  });

  for (const item of legacy) {
    const name = String(item.college || "").trim();
    if (!name) continue;

    const slug = slugify(name);
    let partner = await prisma.admissionPartner.findFirst({
      where: { companyId, slug },
    });

    if (!partner) {
      partner = await prisma.admissionPartner.create({
        data: {
          companyId,
          market: "DOMESTIC",
          streamId: defaultStream.id,
          name,
          slug,
        },
      });
    }

    if (!partner.streamId) {
      partner = await prisma.admissionPartner.update({
        where: { id: partner.id },
        data: { streamId: defaultStream.id },
      });
    }

    await prisma.admission.updateMany({
      where: {
        companyId,
        partnerId: null,
        college: name,
      },
      data: { partnerId: partner.id },
    });
  }
}

async function getPartner(companyId, partnerId) {
  if (!partnerId) return null;
  return prisma.admissionPartner.findFirst({
    where: {
      id: String(partnerId),
      companyId,
      active: true,
    },
    include: {
      stream: true,
    },
  });
}

function partnerMetrics(partner) {
  const admissions = partner.admissions || [];
  const active = admissions.filter((item) => item.status !== "CANCELLED");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    id: partner.id,
    market: partner.market || "DOMESTIC",
    name: partner.name,
    slug: partner.slug,
    description: partner.description,
    active: partner.active,
    sortOrder: partner.sortOrder,
    streamId: partner.streamId,
    stream: partner.stream
      ? {
          id: partner.stream.id,
          name: partner.stream.name,
          slug: partner.stream.slug,
          color: partner.stream.color || "blue",
        }
      : null,
    totalBranches: Number(partner._count?.branches || partner.branches?.length || 0),
    totalAdmissions: admissions.length,
    thisMonth: admissions.filter(
      (item) => new Date(item.admissionDate) >= monthStart
    ).length,
    totalFees: active.reduce((sum, item) => sum + Number(item.totalFee || 0), 0),
    received: active.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0),
    pending: active.reduce(
      (sum, item) =>
        sum + Math.max(Number(item.totalFee || 0) - Number(item.paidAmount || 0), 0),
      0
    ),
    createdAt: partner.createdAt,
  };
}

/* =========================================================
   ADMISSION STREAMS
========================================================= */

router.get("/streams", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;

    await syncLegacyPartners(companyId);

    const selectedYear = parseYear(req.query.year);
    const market = parseMarket(req.query.market);

    const streams = await prisma.admissionStream.findMany({
      where: {
        companyId,
        active: true,
        ...(market ? { market } : {}),
      },
      include: {
        partners: {
          where: {
            active: true,
          },
          include: {
            _count: {
              select: {
                branches: true,
              },
            },
            admissions: {
              ...(selectedYear
                ? { where: { admissionDate: yearRange(selectedYear) } }
                : {}),
              select: {
                status: true,
                totalFee: true,
                paidAmount: true,
                admissionDate: true,
              },
            },
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return res.json({
      success: true,
      streams: streams.map(streamMetrics),
    });
  } catch (error) {
    console.error("Failed to fetch admission streams:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch admission streams",
    });
  }
});

router.post("/streams", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const name = String(req.body?.name || "").trim();
    const description = cleanOptional(req.body?.description);
    const market = parseMarket(req.body?.market, "DOMESTIC");
    const requestedColor = cleanOptional(req.body?.color);
    const color = String(
      requestedColor || inferStreamColor(name)
    ).trim().toLowerCase();

    const allowedColors = [
      "blue",
      "orange",
      "purple",
      "green",
      "rose",
      "slate",
      "sky",
      "cyan",
      "teal",
      "lime",
      "yellow",
      "amber",
      "red",
      "pink",
      "fuchsia",
      "indigo",
      "navy",
      "black",
      "emerald",
    ];

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Stream name is required",
      });
    }

    if (!allowedColors.includes(color)) {
      return res.status(400).json({
        success: false,
        message: "Invalid stream color",
      });
    }

    const slug = await uniqueStreamSlug(companyId, name);

    const stream = await prisma.admissionStream.create({
      data: {
        companyId,
        market,
        name,
        slug,
        description,
        color,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Admission stream added successfully",
      stream: streamMetrics({
        ...stream,
        partners: [],
      }),
    });
  } catch (error) {
    console.error("Failed to create admission stream:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to add admission stream",
    });
  }
});

router.patch("/streams/:id", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;

    const existing = await prisma.admissionStream.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Stream not found",
      });
    }

    const data = {};

    if (req.body?.name !== undefined) {
      const name = String(req.body.name || "").trim();

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Stream name is required",
        });
      }

      data.name = name;
      data.slug = await uniqueStreamSlug(companyId, name, existing.id);
    }

    if (req.body?.description !== undefined) {
      data.description = cleanOptional(req.body.description);
    }

    if (req.body?.color !== undefined) {
      const color = String(req.body.color || "").trim().toLowerCase();
      const allowedColors = [
        "blue",
        "orange",
        "purple",
        "green",
        "rose",
        "slate",
        "sky",
        "cyan",
        "teal",
        "lime",
        "yellow",
        "amber",
        "red",
        "pink",
        "fuchsia",
        "indigo",
        "navy",
        "black",
        "emerald",
      ];

      if (!allowedColors.includes(color)) {
        return res.status(400).json({
          success: false,
          message: "Invalid stream color",
        });
      }

      data.color = color;
    }

    const updated = await prisma.admissionStream.update({
      where: {
        id: existing.id,
      },
      data,
    });

    return res.json({
      success: true,
      message: "Stream updated",
      stream: updated,
    });
  } catch (error) {
    console.error("Failed to update admission stream:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update stream",
    });
  }
});

router.delete("/streams/:id", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;

    const existing = await prisma.admissionStream.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
      include: {
        _count: {
          select: {
            partners: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Stream not found",
      });
    }

    if (existing._count.partners > 0) {
      return res.status(409).json({
        success: false,
        message:
          "This stream contains colleges. Move or delete those colleges before removing the stream.",
      });
    }

    await prisma.admissionStream.delete({
      where: {
        id: existing.id,
      },
    });

    return res.json({
      success: true,
      message: "Stream removed",
    });
  } catch (error) {
    console.error("Failed to delete admission stream:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to remove stream",
    });
  }
});

/* =========================================================
   ADMISSION PARTNERS / COLLEGE CARDS
========================================================= */

router.get("/partners", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    await syncLegacyPartners(companyId);

    const streamId = cleanOptional(req.query.streamId);
    const market = parseMarket(req.query.market);

    const partners = await prisma.admissionPartner.findMany({
      where: {
        companyId,
        active: true,
        ...(market ? { market } : {}),
        ...(streamId ? { streamId } : {}),
      },
      include: {
        stream: true,
        _count: {
          select: {
            branches: true,
          },
        },
        admissions: {
          ...(parseYear(req.query.year) ? { where: { admissionDate: yearRange(parseYear(req.query.year)) } } : {}),
          select: {
            status: true,
            totalFee: true,
            paidAmount: true,
            admissionDate: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return res.json({
      success: true,
      partners: partners.map(partnerMetrics),
    });
  } catch (error) {
    console.error("Failed to fetch admission partners:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch admission colleges",
    });
  }
});

router.post("/partners", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const name = String(req.body?.name || "").trim();
    const description = cleanOptional(req.body?.description);
    const requestedStreamId = cleanOptional(req.body?.streamId);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "College / partner name is required",
      });
    }

    let stream = requestedStreamId
      ? await getStream(companyId, requestedStreamId)
      : null;

    if (requestedStreamId && !stream) {
      return res.status(400).json({
        success: false,
        message: "Selected stream is invalid",
      });
    }

    const requestedMarket = parseMarket(req.body?.market, "DOMESTIC");

    if (!stream) {
      stream = await ensureDefaultStream(companyId, requestedMarket);
    }

    if (stream.market !== requestedMarket) {
      return res.status(400).json({
        success: false,
        message: "Selected stream belongs to a different admissions category",
      });
    }

    const market = requestedMarket;

    const slug = await uniquePartnerSlug(companyId, name);
    const partner = await prisma.admissionPartner.create({
      data: {
        companyId,
        market,
        streamId: stream.id,
        name,
        slug,
        description,
      },
      include: {
        stream: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Admission college added successfully",
      partner: partnerMetrics({ ...partner, admissions: [] }),
    });
  } catch (error) {
    console.error("Failed to create admission partner:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to add admission college",
    });
  }
});

router.patch("/partners/:id", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const existing = await prisma.admissionPartner.findFirst({
      where: { id: req.params.id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "College not found" });
    }

    const data = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) {
        return res.status(400).json({ success: false, message: "College name is required" });
      }
      data.name = name;
      data.slug = await uniquePartnerSlug(companyId, name, existing.id);
    }
    if (req.body?.description !== undefined) {
      data.description = cleanOptional(req.body.description);
    }

    if (req.body?.streamId !== undefined) {
      const stream = await getStream(companyId, req.body.streamId);

      if (!stream) {
        return res.status(400).json({
          success: false,
          message: "Selected stream is invalid",
        });
      }

      data.streamId = stream.id;
      data.market = stream.market;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.admissionPartner.update({
        where: { id: existing.id },
        data,
        include: {
          stream: true,
        },
      });

      if (data.name && data.name !== existing.name) {
        await tx.admission.updateMany({
          where: { companyId, partnerId: existing.id },
          data: { college: data.name },
        });
      }

      if (data.market && data.market !== existing.market) {
        await tx.admissionBranch.updateMany({
          where: { companyId, partnerId: existing.id },
          data: { market: data.market },
        });
        await tx.admission.updateMany({
          where: { companyId, partnerId: existing.id },
          data: { market: data.market },
        });
      }

      return saved;
    });

    return res.json({ success: true, message: "College updated", partner: updated });
  } catch (error) {
    console.error("Failed to update admission partner:", error);
    return res.status(500).json({ success: false, message: "Unable to update college" });
  }
});

router.delete("/partners/:id", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const existing = await prisma.admissionPartner.findFirst({
      where: { id: req.params.id, companyId },
      include: { _count: { select: { admissions: true } } },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "College not found" });
    }

    if (existing._count.admissions > 0) {
      return res.status(409).json({
        success: false,
        message: "This college has admissions. Delete or move those admissions before removing the card.",
      });
    }

    await prisma.admissionPartner.delete({ where: { id: existing.id } });
    return res.json({ success: true, message: "College removed" });
  } catch (error) {
    console.error("Failed to delete admission partner:", error);
    return res.status(500).json({ success: false, message: "Unable to remove college" });
  }
});

/* =========================================================
   ADMISSION BRANCHES
========================================================= */

async function uniqueBranchSlug(
  companyId,
  partnerId,
  name,
  excludeId = null
) {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;

  while (true) {
    const existing =
      await prisma.admissionBranch.findFirst({
        where: {
          companyId,
          partnerId,
          slug,
          ...(excludeId
            ? {
                id: {
                  not: excludeId,
                },
              }
            : {}),
        },
        select: {
          id: true,
        },
      });

    if (!existing) {
      return slug;
    }

    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function getBranch(
  companyId,
  branchId
) {
  if (!branchId) {
    return null;
  }

  return prisma.admissionBranch.findFirst({
    where: {
      id: String(branchId),
      companyId,
      active: true,
    },
    include: {
      partner: {
        include: {
          stream: true,
        },
      },
    },
  });
}

function branchMetrics(branch) {
  const admissions =
    branch.admissions || [];

  const active =
    admissions.filter(
      (item) =>
        item.status !== "CANCELLED"
    );

  return {
    id: branch.id,
    market: branch.market || "DOMESTIC",
    partnerId: branch.partnerId,
    name: branch.name,
    slug: branch.slug,
    description: branch.description,
    active: branch.active,
    sortOrder: branch.sortOrder,
    totalAdmissions:
      admissions.length,
    received:
      active.reduce(
        (sum, item) =>
          sum +
          Number(
            item.paidAmount || 0
          ),
        0
      ),
    pending:
      active.reduce(
        (sum, item) =>
          sum +
          Math.max(
            Number(
              item.totalFee || 0
            ) -
              Number(
                item.paidAmount || 0
              ),
            0
          ),
        0
      ),
    createdAt:
      branch.createdAt,
  };
}

router.get(
  "/branches",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const partnerId =
        cleanOptional(
          req.query.partnerId
        );

      if (!partnerId) {
        return res.status(400).json({
          success: false,
          message:
            "College is required",
        });
      }

      const partner =
        await getPartner(
          companyId,
          partnerId
        );

      if (!partner) {
        return res.status(404).json({
          success: false,
          message:
            "College not found",
        });
      }

      const requestedMarket = parseMarket(req.query.market);

      if (requestedMarket && partner.market !== requestedMarket) {
        return res.json({ success: true, branches: [] });
      }

      const selectedYear =
        parseYear(
          req.query.year
        );

      const branches =
        await prisma.admissionBranch.findMany({
          where: {
            companyId,
            partnerId:
              partner.id,
            market: partner.market,
            active: true,
          },
          include: {
            admissions: {
              ...(selectedYear
                ? {
                    where: {
                      admissionDate:
                        yearRange(
                          selectedYear
                        ),
                    },
                  }
                : {}),
              select: {
                status: true,
                totalFee: true,
                paidAmount: true,
                admissionDate: true,
              },
            },
          },
          orderBy: [
            {
              sortOrder:
                "asc",
            },
            {
              name:
                "asc",
            },
          ],
        });

      return res.json({
        success: true,
        branches:
          branches.map(
            branchMetrics
          ),
      });
    } catch (error) {
      console.error(
        "Failed to fetch admission branches:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to fetch admission branches",
      });
    }
  }
);

router.post(
  "/branches",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const partnerId =
        cleanOptional(
          req.body?.partnerId
        );

      const name =
        String(
          req.body?.name || ""
        ).trim();

      const description =
        cleanOptional(
          req.body?.description
        );

      if (!partnerId) {
        return res.status(400).json({
          success: false,
          message:
            "College is required",
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          message:
            "Branch name is required",
        });
      }

      const partner =
        await getPartner(
          companyId,
          partnerId
        );

      if (!partner) {
        return res.status(404).json({
          success: false,
          message:
            "College not found",
        });
      }

      const slug =
        await uniqueBranchSlug(
          companyId,
          partner.id,
          name
        );

      const branch =
        await prisma.admissionBranch.create({
          data: {
            companyId,
            market: partner.market,
            partnerId:
              partner.id,
            name,
            slug,
            description,
          },
        });

      return res.status(201).json({
        success: true,
        message:
          "Branch added successfully",
        branch:
          branchMetrics({
            ...branch,
            admissions: [],
          }),
      });
    } catch (error) {
      console.error(
        "Failed to create admission branch:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to add branch",
      });
    }
  }
);

router.patch(
  "/branches/:id",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const existing =
        await prisma.admissionBranch.findFirst({
          where: {
            id:
              req.params.id,
            companyId,
          },
        });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message:
            "Branch not found",
        });
      }

      const data = {};

      if (
        req.body?.name !==
        undefined
      ) {
        const name =
          String(
            req.body.name ||
              ""
          ).trim();

        if (!name) {
          return res.status(400).json({
            success: false,
            message:
              "Branch name is required",
          });
        }

        data.name = name;
        data.slug =
          await uniqueBranchSlug(
            companyId,
            existing.partnerId,
            name,
            existing.id
          );
      }

      if (
        req.body?.description !==
        undefined
      ) {
        data.description =
          cleanOptional(
            req.body.description
          );
      }

      const updated =
        await prisma.$transaction(
          async (tx) => {
            const saved =
              await tx.admissionBranch.update({
                where: {
                  id:
                    existing.id,
                },
                data,
              });

            if (
              data.name &&
              data.name !==
                existing.name
            ) {
              await tx.admission.updateMany({
                where: {
                  companyId,
                  branchId:
                    existing.id,
                },
                data: {
                  course:
                    data.name,
                },
              });
            }

            return saved;
          }
        );

      return res.json({
        success: true,
        message:
          "Branch updated",
        branch: updated,
      });
    } catch (error) {
      console.error(
        "Failed to update admission branch:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update branch",
      });
    }
  }
);

router.delete(
  "/branches/:id",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const existing =
        await prisma.admissionBranch.findFirst({
          where: {
            id:
              req.params.id,
            companyId,
          },
          include: {
            _count: {
              select: {
                admissions:
                  true,
              },
            },
          },
        });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message:
            "Branch not found",
        });
      }

      if (
        existing._count
          .admissions > 0
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This branch has admissions. Move or delete those admissions before removing the branch.",
        });
      }

      await prisma.admissionBranch.delete({
        where: {
          id:
            existing.id,
        },
      });

      return res.json({
        success: true,
        message:
          "Branch removed",
      });
    } catch (error) {
      console.error(
        "Failed to delete admission branch:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to remove branch",
      });
    }
  }
);

/* =========================================================
   BULK IMPORT INTO A COLLEGE
========================================================= */

const HEADER_ALIASES = {
  studentName: ["name", "student", "student name", "student_name", "lead name", "lead_name"],
  studentPhone: ["phone", "mobile", "mobile number", "phone number", "contact", "contact number"],
  studentEmail: ["email", "email id", "email address"],
  universityName: ["university", "university name", "university_name"],
  studentLocation: ["student location", "location", "city", "student_location"],
  studentInterCollege: ["student inter college", "inter college", "intermediate college", "student_inter_college"],
  course: ["course", "program", "programme", "interest", "branch"],
  counsellorName: ["counsellor", "counselor", "counsellor name", "counselor name"],
  totalFee: ["incentive amount", "incentive_amount", "total fee", "total_fee", "fee", "amount"],
  paidAmount: ["received amount", "received_amount", "paid amount", "paid_amount", "paid", "received"],
  revenueStatus: ["buffer status", "revenue status", "revenue_status", "bucket status"],
  amountStatus: ["amount status", "amount_status", "payment status"],
  status: ["status", "admission status"],
  admissionDate: ["admission date", "admission_date", "date", "date of admission"],
  notes: ["notes", "remarks", "comments"],
};

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function headerIndex(headers, field) {
  const aliases = HEADER_ALIASES[field] || [];
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
}

async function parseAdmissionFile(file) {
  if (!file) throw new Error("CSV or XLSX file is required");

  const workbook = new ExcelJS.Workbook();
  const filename = String(file.originalname || "").toLowerCase();

  if (filename.endsWith(".csv")) {
    const { Readable } = await import("node:stream");
    await workbook.csv.read(Readable.from(file.buffer));
  } else {
    await workbook.xlsx.load(file.buffer);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Spreadsheet does not contain a worksheet");

  const headerRow = sheet.getRow(1);
  const headers = [];
  for (let i = 1; i <= headerRow.cellCount; i += 1) {
    headers.push(String(headerRow.getCell(i).text || "").trim());
  }

  const indexes = {};
  for (const field of Object.keys(HEADER_ALIASES)) {
    indexes[field] = headerIndex(headers, field);
  }

  if (indexes.studentName < 0) {
    throw new Error('Spreadsheet must contain a "Name" column');
  }

  const rows = [];
  const maxRow = Math.min(sheet.rowCount, MAX_IMPORT_ROWS + 1);

  for (let rowNumber = 2; rowNumber <= maxRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const valueAt = (field) =>
      indexes[field] >= 0 ? row.getCell(indexes[field] + 1).text : "";

    const studentName = cleanOptional(valueAt("studentName"));
    const course = cleanOptional(valueAt("course"));
    const phone = cleanOptional(valueAt("studentPhone"));
    const email = cleanOptional(valueAt("studentEmail"));
    const universityName = cleanOptional(valueAt("universityName"));
    const studentLocation = cleanOptional(valueAt("studentLocation"));
    const studentInterCollege = cleanOptional(valueAt("studentInterCollege"));
    const counsellorName = cleanOptional(valueAt("counsellorName"));
    const totalFee = parseMoney(valueAt("totalFee"), 0);
    const paidAmount = parseMoney(valueAt("paidAmount"), 0);
    const rawRevenueStatus = String(valueAt("revenueStatus") || "BUFFER_ZONE")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
    const rawAmountStatus = String(valueAt("amountStatus") || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
    const rawStatus = String(valueAt("status") || "ONGOING").trim().toUpperCase().replace(/\s+/g, "_");
    const admissionDate = valueAt("admissionDate")
      ? parseDate(valueAt("admissionDate"), null)
      : new Date();

    if (!studentName && !course && !phone && !email) continue;

    const parsedRevenueStatus = VALID_REVENUE_STATUSES.includes(rawRevenueStatus)
      ? rawRevenueStatus
      : "BUFFER_ZONE";

    rows.push({
      rowNumber,
      studentName,
      studentPhone: phone,
      studentEmail: email ? email.toLowerCase() : null,
      universityName,
      studentLocation,
      studentInterCollege,
      course,
      counsellorName,
      totalFee,
      paidAmount,
      revenueStatus: parsedRevenueStatus,
      amountStatus:
        parsedRevenueStatus === "BUFFER_ZONE"
          ? null
          : VALID_AMOUNT_STATUSES.includes(rawAmountStatus)
            ? rawAmountStatus
            : "PENDING",
      status: VALID_STATUSES.includes(rawStatus) ? rawStatus : "ONGOING",
      admissionDate,
      notes: cleanOptional(valueAt("notes")),
    });
  }

  return rows;
}

router.post(
  "/partners/:id/import",
  upload.single("file"),
  async (req, res) => {
    try {
      const companyId = req.clientUser.companyId;
      const partner = await getPartner(companyId, req.params.id);

      if (!partner) {
        return res.status(404).json({ success: false, message: "College not found" });
      }

      const rows = await parseAdmissionFile(req.file);
      if (!rows.length) {
        return res.status(400).json({ success: false, message: "No admission rows found" });
      }

      const valid = [];
      let invalid = 0;
      let duplicates = 0;
      const seenPhones = new Set();

      const phones = rows.map((row) => row.studentPhone).filter(Boolean);
      const existingPhones = phones.length
        ? await prisma.admission.findMany({
            where: {
              companyId,
              partnerId: partner.id,
              studentPhone: { in: phones },
            },
            select: { studentPhone: true },
          })
        : [];
      const existingPhoneSet = new Set(
        existingPhones.map((item) => item.studentPhone).filter(Boolean)
      );

      for (const row of rows) {
        if (
          !row.studentName ||
          !row.course ||
          !Number.isFinite(row.totalFee) ||
          row.totalFee < 0 ||
          !Number.isFinite(row.paidAmount) ||
          row.paidAmount < 0 ||
          row.paidAmount > row.totalFee ||
          !row.admissionDate
        ) {
          invalid += 1;
          continue;
        }

        if (
          row.studentPhone &&
          (seenPhones.has(row.studentPhone) || existingPhoneSet.has(row.studentPhone))
        ) {
          duplicates += 1;
          continue;
        }

        if (row.studentPhone) seenPhones.add(row.studentPhone);
        valid.push(row);
      }

      if (!valid.length) {
        return res.status(400).json({
          success: false,
          message: "No new valid admission records were found to import",
          importSummary: { imported: 0, duplicates, invalid },
        });
      }

      await prisma.admission.createMany({
        data: valid.map((row) => ({
          companyId,
          market: partner.market || "DOMESTIC",
          partnerId: partner.id,
          studentName: row.studentName,
          studentPhone: row.studentPhone,
          studentEmail: row.studentEmail,
          universityName: row.universityName,
          studentLocation: row.studentLocation,
          studentInterCollege: row.studentInterCollege,
          college: partner.name,
          course: row.course,
          counsellorName: row.counsellorName,
          totalFee: row.totalFee,
          paidAmount: row.paidAmount,
          revenueStatus: row.revenueStatus,
          amountStatus: row.amountStatus,
          status: row.status,
          admissionDate: row.admissionDate,
          notes: row.notes,
        })),
      });

      return res.status(201).json({
        success: true,
        message: `${valid.length} admissions imported into ${partner.name}`,
        importSummary: {
          imported: valid.length,
          duplicates,
          invalid,
        },
      });
    } catch (error) {
      console.error("Admission import failed:", error);
      return res.status(400).json({
        success: false,
        message: error?.message || "Unable to import admissions",
      });
    }
  }
);

router.post(
  "/branches/:id/import",
  upload.single("file"),
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const branch =
        await getBranch(
          companyId,
          req.params.id
        );

      if (!branch) {
        return res.status(404).json({
          success: false,
          message:
            "Branch not found",
        });
      }

      const partner =
        branch.partner;

      const rows =
        await parseAdmissionFile(
          req.file
        );

      if (!rows.length) {
        return res.status(400).json({
          success: false,
          message:
            "No admission rows found",
        });
      }

      const valid = [];
      let invalid = 0;
      let duplicates = 0;
      const seenPhones =
        new Set();

      const phones =
        rows
          .map(
            (row) =>
              row.studentPhone
          )
          .filter(Boolean);

      const existingPhones =
        phones.length
          ? await prisma.admission.findMany({
              where: {
                companyId,
                branchId:
                  branch.id,
                studentPhone: {
                  in: phones,
                },
              },
              select: {
                studentPhone:
                  true,
              },
            })
          : [];

      const existingPhoneSet =
        new Set(
          existingPhones
            .map(
              (item) =>
                item.studentPhone
            )
            .filter(Boolean)
        );

      for (const row of rows) {
        if (
          !row.studentName ||
          !Number.isFinite(
            row.totalFee
          ) ||
          row.totalFee < 0 ||
          !Number.isFinite(
            row.paidAmount
          ) ||
          row.paidAmount < 0 ||
          row.paidAmount >
            row.totalFee ||
          !row.admissionDate
        ) {
          invalid += 1;
          continue;
        }

        if (
          row.studentPhone &&
          (
            seenPhones.has(
              row.studentPhone
            ) ||
            existingPhoneSet.has(
              row.studentPhone
            )
          )
        ) {
          duplicates += 1;
          continue;
        }

        if (
          row.studentPhone
        ) {
          seenPhones.add(
            row.studentPhone
          );
        }

        valid.push(row);
      }

      if (!valid.length) {
        return res.status(400).json({
          success: false,
          message:
            "No new valid admission records were found to import",
          importSummary: {
            imported: 0,
            duplicates,
            invalid,
          },
        });
      }

      await prisma.admission.createMany({
        data:
          valid.map(
            (row) => ({
              companyId,
              market: partner.market || "DOMESTIC",
              partnerId:
                partner.id,
              branchId:
                branch.id,
              studentName:
                row.studentName,
              studentPhone:
                row.studentPhone,
              studentEmail:
                row.studentEmail,
              universityName:
                row.universityName,
              studentLocation:
                row.studentLocation,
              studentInterCollege:
                row.studentInterCollege,
              college:
                partner.name,
              course:
                branch.name,
              counsellorName:
                row.counsellorName,
              totalFee:
                row.totalFee,
              paidAmount:
                row.paidAmount,
              revenueStatus:
                row.revenueStatus,
              amountStatus:
                row.amountStatus,
              status:
                row.status,
              admissionDate:
                row.admissionDate,
              notes:
                row.notes,
            })
          ),
      });

      return res.status(201).json({
        success: true,
        message:
          `${valid.length} admissions imported into ${branch.name}`,
        importSummary: {
          imported:
            valid.length,
          duplicates,
          invalid,
        },
      });
    } catch (error) {
      console.error(
        "Branch admission import failed:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error?.message ||
          "Unable to import admissions",
      });
    }
  }
);

/* =========================================================
   GET LEADS AVAILABLE FOR ADMISSION
========================================================= */

router.get("/eligible-leads", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const leads = await prisma.lead.findMany({
      where: {
        companyId,
        admission: { is: null },
        stage: { not: "LOST" },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        course: true,
        assignedToName: true,
        source: true,
        campaign: true,
        stage: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, leads });
  } catch (error) {
    console.error("Failed to fetch eligible leads:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch eligible leads" });
  }
});

/* =========================================================
   GET ADMISSIONS
========================================================= */

router.get("/", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    await syncLegacyPartners(companyId);

    const partnerId = cleanOptional(req.query.partnerId);
    const streamId = cleanOptional(req.query.streamId);
    const branchId = cleanOptional(req.query.branchId);
    const selectedYear = parseYear(req.query.year);
    const market = parseMarket(req.query.market);

    const where = {
      companyId,
      ...(market ? { market } : {}),
      ...(selectedYear ? { admissionDate: yearRange(selectedYear) } : {}),
    };

    if (branchId) {
      where.branchId = branchId;
    } else if (partnerId) {
      where.partnerId = partnerId;
    } else if (streamId) {
      where.partner = {
        is: {
          streamId,
        },
      };
    }

    const admissions = await prisma.admission.findMany({
      where,
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            slug: true,
            stream: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        lead: { select: { id: true, source: true, campaign: true } },
      },
      orderBy: { admissionDate: "desc" },
    });

    const formatted = admissions.map(formatAdmission);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const financial = formatted.filter((item) => item.statusKey !== "CANCELLED");

    return res.json({
      success: true,
      admissions: formatted,
      summary: {
        totalAdmissions: formatted.length,
        thisMonth: admissions.filter(
          (item) => new Date(item.admissionDate) >= monthStart
        ).length,
        totalFees: financial.reduce((sum, item) => sum + item.total, 0),
        received: financial.reduce((sum, item) => sum + item.paid, 0),
        pending: financial.reduce((sum, item) => sum + item.pending, 0),
      },
    });
  } catch (error) {
    console.error("Failed to fetch admissions:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch admissions" });
  }
});

/* =========================================================
   CREATE ADMISSION
========================================================= */

router.post("/", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const {
      partnerId,
      branchId,
      leadId,
      studentName,
      studentPhone,
      studentEmail,
      universityName,
      studentLocation,
      studentInterCollege,
      college,
      course,
      counsellorName,
      totalFee,
      paidAmount,
      revenueStatus,
      amountStatus,
      status,
      admissionDate,
      notes,
    } = req.body || {};

    const requestedMarket = parseMarket(req.body?.market, "DOMESTIC");

    const partner = await getPartner(companyId, partnerId);
    if (partnerId && !partner) {
      return res.status(404).json({ success: false, message: "Admission college not found" });
    }

    const branch = await getBranch(companyId, branchId);

    if (branchId && !branch) {
      return res.status(404).json({
        success: false,
        message: "Admission branch not found",
      });
    }

    if (
      branch &&
      partner &&
      branch.partnerId !== partner.id
    ) {
      return res.status(400).json({
        success: false,
        message: "Selected branch does not belong to this college",
      });
    }

    if (partner && partner.market !== requestedMarket) {
      return res.status(400).json({
        success: false,
        message: `Selected college is not part of ${requestedMarket === "INTERNATIONAL" ? "International" : "Domestic"} admissions`,
      });
    }

    if (branch && branch.market !== requestedMarket) {
      return res.status(400).json({
        success: false,
        message: `Selected branch is not part of ${requestedMarket === "INTERNATIONAL" ? "International" : "Domestic"} admissions`,
      });
    }

    let cleanStudentName = String(studentName || "").trim();
    let cleanStudentPhone = cleanOptional(studentPhone);
    let cleanStudentEmail = cleanOptional(studentEmail)?.toLowerCase() || null;
    const cleanUniversityName = cleanOptional(universityName);
    const cleanStudentLocation = cleanOptional(studentLocation);
    const cleanStudentInterCollege = cleanOptional(studentInterCollege);
    let cleanCourse =
      branch?.name ||
      String(course || "").trim();
    let cleanCounsellor = cleanOptional(counsellorName);
    let cleanCollege = partner?.name || String(college || "").trim();

    const statusKey = String(status || "ONGOING").trim().toUpperCase();
    const revenueStatusKey = String(revenueStatus || "BUFFER_ZONE")
      .trim()
      .toUpperCase();
    let amountStatusKey = cleanOptional(amountStatus)?.toUpperCase() || null;
    const parsedTotalFee = Number(totalFee || 0);
    const parsedPaidAmount = Number(paidAmount || 0);

    if (!cleanCollege) {
      return res.status(400).json({ success: false, message: "College is required" });
    }

    if (!cleanUniversityName) {
      return res.status(400).json({
        success: false,
        message: "University name is required",
      });
    }

    if (!VALID_REVENUE_STATUSES.includes(revenueStatusKey)) {
      return res.status(400).json({
        success: false,
        message: "Invalid buffer status",
      });
    }

    if (revenueStatusKey === "BUFFER_ZONE") {
      amountStatusKey = null;
    } else if (!amountStatusKey) {
      amountStatusKey = "PENDING";
    } else if (!VALID_AMOUNT_STATUSES.includes(amountStatusKey)) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount status",
      });
    }

    if (partner && !branch) {
      return res.status(400).json({
        success: false,
        message: "Branch is required for this admission",
      });
    }
    if (!Number.isFinite(parsedTotalFee) || parsedTotalFee < 0) {
      return res.status(400).json({ success: false, message: "Incentive amount must be a valid amount" });
    }
    if (!Number.isFinite(parsedPaidAmount) || parsedPaidAmount < 0) {
      return res.status(400).json({ success: false, message: "Received amount must be a valid amount" });
    }
    if (parsedPaidAmount > parsedTotalFee) {
      return res.status(400).json({ success: false, message: "Received amount cannot exceed incentive amount" });
    }
    if (!VALID_STATUSES.includes(statusKey)) {
      return res.status(400).json({ success: false, message: "Invalid admission status" });
    }

    let selectedLead = null;
    if (leadId) {
      selectedLead = await prisma.lead.findFirst({
        where: { id: String(leadId), companyId },
        include: { admission: true },
      });

      if (!selectedLead) {
        return res.status(404).json({ success: false, message: "Lead not found for this company" });
      }
      if (selectedLead.admission) {
        return res.status(409).json({ success: false, message: "This lead already has an admission" });
      }

      cleanStudentName = cleanStudentName || selectedLead.name;
      cleanStudentPhone = cleanStudentPhone || selectedLead.phone;
      cleanStudentEmail = cleanStudentEmail || selectedLead.email;
      cleanCourse = cleanCourse || selectedLead.course || "";
      cleanCounsellor = cleanCounsellor || selectedLead.assignedToName;
    }

    if (!cleanStudentName) {
      return res.status(400).json({ success: false, message: "Student name is required" });
    }
    if (!cleanCourse) {
      return res.status(400).json({ success: false, message: "Course is required" });
    }

    const parsedAdmissionDate = admissionDate
      ? parseDate(admissionDate, null)
      : new Date();
    if (!parsedAdmissionDate) {
      return res.status(400).json({ success: false, message: "Invalid admission date" });
    }

    let resolvedPartner = partner;
    if (!resolvedPartner) {
      const slug = slugify(cleanCollege);
      resolvedPartner = await prisma.admissionPartner.findFirst({
        where: { companyId, slug },
        include: { stream: true },
      });

      if (!resolvedPartner) {
        const defaultStream = await ensureDefaultStream(companyId, requestedMarket);

        resolvedPartner = await prisma.admissionPartner.create({
          data: {
            companyId,
            market: requestedMarket,
            streamId: defaultStream.id,
            name: cleanCollege,
            slug: await uniquePartnerSlug(companyId, cleanCollege),
          },
          include: { stream: true },
        });
      }
    }

    const admission = await prisma.$transaction(async (tx) => {
      const admissionLead = selectedLead || await ensureAdmissionsLead(tx, {
        companyId,
        origin: "Direct Admission",
        name: cleanStudentName,
        phone: cleanStudentPhone,
        email: cleanStudentEmail,
        course: cleanCourse,
        assignedToName: cleanCounsellor,
        stage: statusKey === "CANCELLED" ? "NEW" : "ADMITTED",
        extraNotes: cleanOptional(notes),
      });

      if (selectedLead) {
        await ensureAdmissionsLead(tx, {
          companyId,
          origin: "Direct Admission",
          name: selectedLead.name,
          phone: selectedLead.phone,
          email: selectedLead.email,
          course: selectedLead.course || cleanCourse,
          assignedToName: selectedLead.assignedToName || cleanCounsellor,
          stage: selectedLead.stage,
          extraNotes: cleanOptional(notes),
        });
      }

      const created = await tx.admission.create({
        data: {
          companyId,
          market: requestedMarket,
          partnerId: resolvedPartner.id,
          branchId: branch?.id || null,
          leadId: admissionLead?.id || null,
          leadStageBeforeAdmission: admissionLead?.stage || null,
          studentName: cleanStudentName,
          studentPhone: cleanStudentPhone,
          studentEmail: cleanStudentEmail,
          universityName: cleanUniversityName,
          studentLocation: cleanStudentLocation,
          studentInterCollege: cleanStudentInterCollege,
          college: resolvedPartner.name,
          course: cleanCourse,
          counsellorName: cleanCounsellor,
          totalFee: parsedTotalFee,
          paidAmount: parsedPaidAmount,
          revenueStatus: revenueStatusKey,
          amountStatus: amountStatusKey,
          status: statusKey,
          admissionDate: parsedAdmissionDate,
          notes: cleanOptional(notes),
        },
        include: {
          partner: {
          select: {
            id: true,
            name: true,
            slug: true,
            stream: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
          branch: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          lead: { select: { id: true, source: true, campaign: true } },
        },
      });

      if (admissionLead) {
        await tx.lead.update({
          where: { id: admissionLead.id },
          data: {
            stage: statusKey === "CANCELLED" ? admissionLead.stage : "ADMITTED",
          },
        });
      }
      return created;
    });

    return res.status(201).json({
      success: true,
      message: "Admission created successfully",
      admission: formatAdmission(admission),
    });
  } catch (error) {
    console.error("Failed to create admission:", error);
    return res.status(500).json({ success: false, message: "Unable to create admission" });
  }
});

/* =========================================================
   UPDATE ADMISSION
========================================================= */

router.patch("/:id", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const existing = await prisma.admission.findFirst({
      where: { id: req.params.id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Admission not found" });
    }

    const data = {};

    if (req.body?.partnerId !== undefined) {
      const partner = await getPartner(companyId, req.body.partnerId);
      if (!partner) {
        return res.status(400).json({ success: false, message: "Selected college is invalid" });
      }
      data.partnerId = partner.id;
      data.college = partner.name;
    }

    if (req.body?.branchId !== undefined) {
      const branch = await getBranch(companyId, req.body.branchId);

      if (!branch) {
        return res.status(400).json({
          success: false,
          message: "Selected branch is invalid",
        });
      }

      const finalPartnerId =
        data.partnerId ||
        existing.partnerId;

      if (
        finalPartnerId &&
        branch.partnerId !==
          finalPartnerId
      ) {
        return res.status(400).json({
          success: false,
          message: "Selected branch does not belong to this college",
        });
      }

      data.branchId =
        branch.id;
      data.course =
        branch.name;
    }

    const stringFields = [
      ["studentName", true],
      ["studentPhone", false],
      ["studentEmail", false],
      ["universityName", true],
      ["studentLocation", false],
      ["studentInterCollege", false],
      ["counsellorName", false],
      ["notes", false],
    ];

    for (const [field, required] of stringFields) {
      if (req.body?.[field] !== undefined) {
        const value = String(req.body[field] || "").trim();
        if (required && !value) {
          return res.status(400).json({ success: false, message: `${field} is required` });
        }
        data[field] = value || null;
      }
    }

    if (data.studentEmail) data.studentEmail = data.studentEmail.toLowerCase();

    const nextTotalFee =
      req.body?.totalFee !== undefined ? Number(req.body.totalFee) : Number(existing.totalFee);
    const nextPaidAmount =
      req.body?.paidAmount !== undefined ? Number(req.body.paidAmount) : Number(existing.paidAmount);

    if (!Number.isFinite(nextTotalFee) || nextTotalFee < 0) {
      return res.status(400).json({ success: false, message: "Incentive amount must be a valid amount" });
    }
    if (!Number.isFinite(nextPaidAmount) || nextPaidAmount < 0) {
      return res.status(400).json({ success: false, message: "Received amount must be a valid amount" });
    }
    if (nextPaidAmount > nextTotalFee) {
      return res.status(400).json({ success: false, message: "Received amount cannot exceed incentive amount" });
    }

    if (req.body?.totalFee !== undefined) data.totalFee = nextTotalFee;
    if (req.body?.paidAmount !== undefined) data.paidAmount = nextPaidAmount;

    let nextRevenueStatus =
      req.body?.revenueStatus !== undefined
        ? String(req.body.revenueStatus || "").trim().toUpperCase()
        : existing.revenueStatus || "BUFFER_ZONE";

    if (!VALID_REVENUE_STATUSES.includes(nextRevenueStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid buffer status",
      });
    }

    let nextAmountStatus =
      req.body?.amountStatus !== undefined
        ? cleanOptional(req.body.amountStatus)?.toUpperCase() || null
        : existing.amountStatus || null;

    if (nextRevenueStatus === "BUFFER_ZONE") {
      nextAmountStatus = null;
    } else if (!nextAmountStatus) {
      nextAmountStatus = "PENDING";
    } else if (!VALID_AMOUNT_STATUSES.includes(nextAmountStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount status",
      });
    }

    if (req.body?.revenueStatus !== undefined) {
      data.revenueStatus = nextRevenueStatus;
    }
    if (
      req.body?.amountStatus !== undefined ||
      req.body?.revenueStatus !== undefined
    ) {
      data.amountStatus = nextAmountStatus;
    }

    let nextStatus = existing.status;
    if (req.body?.status !== undefined) {
      nextStatus = String(req.body.status || "").trim().toUpperCase();
      if (!VALID_STATUSES.includes(nextStatus)) {
        return res.status(400).json({ success: false, message: "Invalid admission status" });
      }
      data.status = nextStatus;
    }

    if (req.body?.admissionDate !== undefined) {
      const date = parseDate(req.body.admissionDate, null);
      if (!date) {
        return res.status(400).json({ success: false, message: "Invalid admission date" });
      }
      data.admissionDate = date;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.admission.update({
        where: { id: existing.id },
        data,
        include: {
          partner: {
          select: {
            id: true,
            name: true,
            slug: true,
            stream: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
          branch: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          lead: { select: { id: true, source: true, campaign: true } },
        },
      });

      if (existing.leadId) {
        await tx.lead.update({
          where: { id: existing.leadId },
          data: {
            stage:
              nextStatus === "CANCELLED"
                ? existing.leadStageBeforeAdmission || "COUNSELLING"
                : "ADMITTED",
          },
        });
      }

      return saved;
    });

    return res.json({
      success: true,
      message: "Admission updated successfully",
      admission: formatAdmission(updated),
    });
  } catch (error) {
    console.error("Failed to update admission:", error);
    return res.status(500).json({ success: false, message: "Unable to update admission" });
  }
});

/* =========================================================
   DELETE ADMISSION
========================================================= */

router.delete("/:id", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const existing = await prisma.admission.findFirst({
      where: { id: req.params.id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Admission not found" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.admission.delete({ where: { id: existing.id } });

      if (existing.leadId) {
        await tx.lead.update({
          where: { id: existing.leadId },
          data: {
            stage: existing.leadStageBeforeAdmission || "COUNSELLING",
          },
        });
      }
    });

    return res.json({ success: true, message: "Admission deleted successfully" });
  } catch (error) {
    console.error("Failed to delete admission:", error);
    return res.status(500).json({ success: false, message: "Unable to delete admission" });
  }
});

export default router;