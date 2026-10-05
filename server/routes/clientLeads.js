import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";

import prisma from "../lib/prisma.js";
import {
  requireClientUser,
  requireClientPermission,
} from "../middleware/clientAuth.js";

const router = Router();

router.use(requireClientUser);

router.use(
  requireClientPermission(
    "canManageLeads",
    "You do not have permission to access leads"
  )
);

const STAGE_LABELS = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  COUNSELLING: "Counselling",
  ADMITTED: "Admitted",
  LOST: "Lost",
};

const VALID_STAGES = Object.keys(STAGE_LABELS);

const VALID_TEMPERATURES = ["HOT", "WARM", "COLD"];

const STAGE_TO_LEAD_STATUS = {
  NEW: "Fresh",
  CONTACTED: "Call Initiated",
  QUALIFIED: "Call Initiated",
  COUNSELLING: "Call Initiated",
  ADMITTED: "Admission Done",
  LOST: "Lead Lost",
};

function leadStatusFor(lead) {
  return String(lead?.leadStatus || "").trim() ||
    STAGE_TO_LEAD_STATUS[lead?.stage] ||
    "Fresh";
}


function parseYear(value) {
  if (!value || value === "all") return null;

  const year = Number(value);

  return Number.isInteger(year) &&
    year >= 2000 &&
    year <= 2100
    ? year
    : null;
}

function yearRange(year) {
  if (!year) return null;

  return {
    gte: new Date(year, 0, 1),
    lt: new Date(year + 1, 0, 1),
  };
}

function slugUtm(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildUtmUrl(rawUrl, campaign, source, medium) {
  const parsed = new URL(rawUrl);

  parsed.searchParams.set(
    "utm_campaign",
    slugUtm(campaign)
  );

  parsed.searchParams.set(
    "utm_source",
    slugUtm(source)
  );

  parsed.searchParams.set(
    "utm_medium",
    slugUtm(medium)
  );

  return parsed.toString();
}

const FALLBACK_SOURCE_LABELS = {
  GOOGLE_FORM: "Google Form",
  WEBSITE_FORM: "Website Form",
  IM_LEADS: "IM Leads",
  DM_LEADS: "DM Leads",
  INTERNAL: "Internal Leads",
  REFERRAL: "Referral",
  OFFLINE: "Offline",
  OTHER: "Other",
};

const INTERNAL_MANAGED_SOURCE_CONFIGS = {
  INTERNAL: {
    name: "Internal Leads",
    description: "Leads added manually or imported internally",
    sortOrder: 50,
  },
  GOOGLE_FORM: {
    name: "Google Form",
    description: "Manually added or imported Google Form leads",
    sortOrder: 10,
  },
  WEBSITE_FORM: {
    name: "Website Form",
    description: "Manually added or imported website form leads",
    sortOrder: 20,
  },
  IM_LEADS: {
    name: "IM Leads",
    description: "Manually added or imported instant messaging leads",
    sortOrder: 30,
  },
  DM_LEADS: {
    name: "DM Leads",
    description: "Manually added or imported direct message leads",
    sortOrder: 40,
  },
};

const INTERNAL_MANAGED_SOURCE_KEYS = Object.keys(
  INTERNAL_MANAGED_SOURCE_CONFIGS
);

async function getSourceMap(
  companyId
) {
  const rows =
    await prisma.leadSourceConfig.findMany({
      where: {
        companyId,
      },
      select: {
        key: true,
        name: true,
      },
    });

  return new Map(
    rows.map(
      (row) => [
        row.key,
        row.name,
      ]
    )
  );
}

async function validateSource(
  companyId,
  sourceKey
) {
  return prisma.leadSourceConfig.findFirst({
    where: {
      companyId,
      key: sourceKey,
      active: true,
    },
  });
}


async function ensureInternalManagedSource(
  companyId,
  sourceKey
) {
  const config =
    INTERNAL_MANAGED_SOURCE_CONFIGS[sourceKey];

  if (!config) {
    return null;
  }

  return prisma.leadSourceConfig.upsert({
    where: {
      companyId_key: {
        companyId,
        key: sourceKey,
      },
    },
    update: {
      name: config.name,
      active: true,
      showInForms: true,
    },
    create: {
      companyId,
      key: sourceKey,
      name: config.name,
      description: config.description,
      active: true,
      showInForms: true,
      system: true,
      sortOrder: config.sortOrder,
    },
  });
}

async function ensureInternalSource(
  companyId
) {
  return ensureInternalManagedSource(
    companyId,
    "INTERNAL"
  );
}


function normalizeCustomFieldInput(value) {
  if (!value) {
    return {};
  }

  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .filter((item) => item && item.key)
        .map((item) => [
          String(item.key).trim().toUpperCase(),
          item.value,
        ])
    );
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, fieldValue]) => [
        String(key).trim().toUpperCase(),
        fieldValue,
      ])
    );
  }

  return {};
}

function serializeCustomFieldValue(field, value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (field.fieldType === "CHECKBOX") {
    return value === true ||
      String(value).toLowerCase() === "true"
      ? "true"
      : "false";
  }

  if (field.fieldType === "NUMBER") {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      throw new Error(`${field.name} must be a valid number`);
    }

    return String(number);
  }

  if (field.fieldType === "DROPDOWN") {
    const cleanValue = String(value).trim();
    const options = Array.isArray(field.options)
      ? field.options.map((item) => String(item))
      : [];

    if (!options.includes(cleanValue)) {
      throw new Error(`${field.name} has an invalid option`);
    }

    return cleanValue;
  }

  if (field.fieldType === "DATE") {
    const cleanValue = String(value).trim();

    if (
      cleanValue &&
      Number.isNaN(new Date(cleanValue).getTime())
    ) {
      throw new Error(`${field.name} must be a valid date`);
    }

    return cleanValue;
  }

  return String(value).trim();
}

async function prepareCustomFieldValues(
  companyId,
  customFields,
  { requireMissing = false } = {}
) {
  const input = normalizeCustomFieldInput(customFields);

  const fields = await prisma.customField.findMany({
    where: {
      companyId,
      entityType: "LEAD",
      active: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  const values = [];

  for (const field of fields) {
    const hasValue = Object.prototype.hasOwnProperty.call(
      input,
      field.key
    );

    const rawValue = input[field.key];

    if (
      field.required &&
      requireMissing &&
      (!hasValue ||
        rawValue === "" ||
        rawValue === null ||
        rawValue === undefined)
    ) {
      throw new Error(`${field.name} is required`);
    }

    if (!hasValue) {
      continue;
    }

    const value = serializeCustomFieldValue(
      field,
      rawValue
    );

    if (
      field.required &&
      (value === null || value === "")
    ) {
      throw new Error(`${field.name} is required`);
    }

    values.push({
      field,
      value,
    });
  }

  return values;
}

async function saveCustomFieldValues(
  leadId,
  preparedValues
) {
  for (const item of preparedValues) {
    if (item.value === null || item.value === "") {
      await prisma.customFieldValue.deleteMany({
        where: {
          leadId,
          customFieldId: item.field.id,
        },
      });

      continue;
    }

    await prisma.customFieldValue.upsert({
      where: {
        customFieldId_leadId: {
          customFieldId: item.field.id,
          leadId,
        },
      },
      update: {
        value: item.value,
      },
      create: {
        customFieldId: item.field.id,
        leadId,
        value: item.value,
      },
    });
  }
}

function formatLead(lead, sourceMap = new Map()) {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    course: lead.course,

    source: sourceMap.get(lead.source) || FALLBACK_SOURCE_LABELS[lead.source] || lead.source,
    sourceKey: lead.source,

    stage: STAGE_LABELS[lead.stage] || lead.stage,
    stageKey: lead.stage,
    temperature: lead.temperature || "WARM",
    leadStatus: leadStatusFor(lead),

    campaign: lead.campaign,
    medium: lead.medium,

    assigned:
      lead.assignedToName || "Unassigned",

    notes: lead.notes,

    utmLinkId: lead.utmLinkId,

    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,

    customFields: (lead.customFieldValues || []).map(
      (item) => ({
        id: item.customField.id,
        key: item.customField.key,
        name: item.customField.name,
        fieldType: item.customField.fieldType,
        value: item.value,
        options: Array.isArray(item.customField.options)
          ? item.customField.options
          : [],
      })
    ),
  };
}

function formatLink(link) {
  return {
    id: link.id,
    campaign: link.campaign,
    source: link.source,
    medium: link.medium,
    url: link.url,

    clicks: link.clicks,
    regs: link.registrations,

    leads: link._count?.leads || 0,

    conv: link.conversions,
    adm: link.admissions,

    rev: Number(link.revenue),
    cost: Number(link.cost || 0),

    active: link.active,

    createdAt: link.createdAt,
  };
}

/* =========================================================
   GET LEADS FOR LOGGED-IN COMPANY
========================================================= */

router.get("/", async (req, res) => {
  try {
    const companyId =
      req.clientUser.companyId;

    const source =
      String(req.query.source || "")
        .trim()
        .toUpperCase();

    const stage =
      String(req.query.stage || "")
        .trim()
        .toUpperCase();

    const temperature =
      String(req.query.temperature || "")
        .trim()
        .toUpperCase();

    const search =
      String(req.query.search || "")
        .trim();

    const selectedYear =
      parseYear(req.query.year);

    const where = {
      companyId,
      ...(selectedYear
        ? {
            createdAt:
              yearRange(
                selectedYear
              ),
          }
        : {}),
    };

    if (source) {
      where.source = source;
    }

    if (
      stage &&
      VALID_STAGES.includes(stage)
    ) {
      where.stage = stage;
    }

    if (
      temperature &&
      VALID_TEMPERATURES.includes(temperature)
    ) {
      where.temperature = temperature;
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          course: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          campaign: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    const leads =
      await prisma.lead.findMany({
        where,

        include: {
          customFieldValues: {
            include: {
              customField: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    const sourceMap =
      await getSourceMap(
        companyId
      );

    return res.json({
      success: true,
      leads:
        leads.map(
          (lead) =>
            formatLead(
              lead,
              sourceMap
            )
        ),
    });
  } catch (error) {
    console.error(
      "Failed to fetch client leads:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch leads",
    });
  }
});

/* =========================================================
   CREATE LEAD
========================================================= */

router.post("/", async (req, res) => {
  try {
    const companyId =
      req.clientUser.companyId;

    const {
      name,
      phone,
      email,
      course,
      source,
      stage,
      temperature,
      campaign,
      medium,
      assignedToName,
      notes,
      utmLinkId,
      customFields,
    } = req.body || {};

    const cleanName =
      String(name || "").trim();

    const cleanPhone =
      String(phone || "").trim();

    const sourceKey =
      String(source || "")
        .trim()
        .toUpperCase();

    const stageKey =
      String(stage || "NEW")
        .trim()
        .toUpperCase();

    const temperatureKey =
      String(temperature || "WARM")
        .trim()
        .toUpperCase();

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: "Lead name is required",
      });
    }

    if (!cleanPhone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const sourceConfig =
      INTERNAL_MANAGED_SOURCE_KEYS.includes(sourceKey)
        ? await ensureInternalManagedSource(
            companyId,
            sourceKey
          )
        : await validateSource(
            companyId,
            sourceKey
          );

    if (!sourceConfig) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or inactive lead source",
      });
    }

    if (
      !VALID_STAGES.includes(stageKey)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead stage",
      });
    }

    if (
      !VALID_TEMPERATURES.includes(temperatureKey)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead temperature",
      });
    }

    let validUtmLinkId = null;

    if (utmLinkId) {
      const link =
        await prisma.utmLink.findFirst({
          where: {
            id: String(utmLinkId),
            companyId,
          },
        });

      if (!link) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid UTM link for this company",
        });
      }

      validUtmLinkId = link.id;
    }

    let preparedCustomFields = [];

    try {
      preparedCustomFields =
        await prepareCustomFieldValues(
          companyId,
          customFields,
          {
            requireMissing: true,
          }
        );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error?.message ||
          "Invalid custom field values",
      });
    }

    const lead =
      await prisma.lead.create({
        data: {
          companyId,

          name: cleanName,
          phone: cleanPhone,

          email: email
            ? String(email)
                .trim()
                .toLowerCase()
            : null,

          course: course
            ? String(course).trim()
            : null,

          source: sourceKey,
          stage: stageKey,
          leadStatus: STAGE_TO_LEAD_STATUS[stageKey] || "Fresh",
          temperature: temperatureKey,

          campaign: campaign
            ? String(campaign).trim()
            : null,

          medium: medium
            ? String(medium).trim()
            : null,

          assignedToName:
            assignedToName
              ? String(
                  assignedToName
                ).trim()
              : null,

          notes: notes
            ? String(notes).trim()
            : null,

          utmLinkId:
            validUtmLinkId,
        },
      });

    await saveCustomFieldValues(
      lead.id,
      preparedCustomFields
    );

    const createdLead =
      await prisma.lead.findUnique({
        where: {
          id: lead.id,
        },
        include: {
          customFieldValues: {
            include: {
              customField: true,
            },
          },
        },
      });

    return res.status(201).json({
      success: true,
      message: "Lead created successfully",
      lead: formatLead(
        createdLead,
        new Map([
          [
            sourceConfig.key,
            sourceConfig.name,
          ],
        ])
      ),
    });
  } catch (error) {
    console.error(
      "Failed to create lead:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to create lead",
    });
  }
});

/* =========================================================
   UPDATE LEAD
========================================================= */

router.patch("/:id", async (req, res) => {
  try {
    const companyId =
      req.clientUser.companyId;

    const lead =
      await prisma.lead.findFirst({
        where: {
          id: req.params.id,
          companyId,
        },
      });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const data = {};

    if (req.body.name !== undefined) {
      const name = String(
        req.body.name || ""
      ).trim();

      if (!name) {
        return res.status(400).json({
          success: false,
          message:
            "Lead name cannot be empty",
        });
      }

      data.name = name;
    }

    if (req.body.phone !== undefined) {
      const phone = String(
        req.body.phone || ""
      ).trim();

      if (!phone) {
        return res.status(400).json({
          success: false,
          message:
            "Phone number cannot be empty",
        });
      }

      data.phone = phone;
    }

    if (req.body.email !== undefined) {
      data.email = req.body.email
        ? String(req.body.email)
            .trim()
            .toLowerCase()
        : null;
    }

    if (req.body.course !== undefined) {
      data.course = req.body.course
        ? String(req.body.course).trim()
        : null;
    }

    if (req.body.campaign !== undefined) {
      data.campaign =
        req.body.campaign
          ? String(
              req.body.campaign
            ).trim()
          : null;
    }

    if (req.body.medium !== undefined) {
      data.medium = req.body.medium
        ? String(req.body.medium).trim()
        : null;
    }

    if (
      req.body.assignedToName !==
      undefined
    ) {
      data.assignedToName =
        req.body.assignedToName
          ? String(
              req.body.assignedToName
            ).trim()
          : null;
    }

    if (req.body.notes !== undefined) {
      data.notes = req.body.notes
        ? String(req.body.notes).trim()
        : null;
    }

    if (req.body.source !== undefined) {
      const source =
        String(req.body.source)
          .trim()
          .toUpperCase();

      const sourceConfig =
        source === "INTERNAL"
          ? await ensureInternalSource(
              companyId
            )
          : await validateSource(
              companyId,
              source
            );

      if (!sourceConfig) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid or inactive lead source",
        });
      }

      data.source = source;
    }

    if (req.body.stage !== undefined) {
      const stage =
        String(req.body.stage)
          .trim()
          .toUpperCase();

      if (
        !VALID_STAGES.includes(stage)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid lead stage",
        });
      }

      data.stage = stage;
      data.leadStatus = STAGE_TO_LEAD_STATUS[stage] || data.leadStatus;
    }

    if (req.body.temperature !== undefined) {
      const temperature =
        String(req.body.temperature)
          .trim()
          .toUpperCase();

      if (!VALID_TEMPERATURES.includes(temperature)) {
        return res.status(400).json({
          success: false,
          message: "Invalid lead temperature",
        });
      }

      data.temperature = temperature;
    }

    let preparedCustomFields = [];

    if (req.body.customFields !== undefined) {
      try {
        preparedCustomFields =
          await prepareCustomFieldValues(
            companyId,
            req.body.customFields
          );
      } catch (error) {
        return res.status(400).json({
          success: false,
          message:
            error?.message ||
            "Invalid custom field values",
        });
      }
    }

    const updated =
      await prisma.lead.update({
        where: {
          id: lead.id,
        },

        data,
      });

    if (req.body.customFields !== undefined) {
      await saveCustomFieldValues(
        updated.id,
        preparedCustomFields
      );
    }

    const updatedWithCustomFields =
      await prisma.lead.findUnique({
        where: {
          id: updated.id,
        },
        include: {
          customFieldValues: {
            include: {
              customField: true,
            },
          },
        },
      });

    const sourceMap =
      await getSourceMap(
        companyId
      );

    return res.json({
      success: true,
      message:
        "Lead updated successfully",
      lead:
        formatLead(
          updatedWithCustomFields,
          sourceMap
        ),
    });
  } catch (error) {
    console.error(
      "Failed to update lead:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to update lead",
    });
  }
});

/* =========================================================
   GET ACTIVE LEAD SOURCES FOR FORMS
========================================================= */

router.get(
  "/meta/sources",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const sources =
        await prisma.leadSourceConfig.findMany({
          where: {
            companyId,
            active: true,
            showInForms: true,
          },
          orderBy: [
            {
              sortOrder: "asc",
            },
            {
              name: "asc",
            },
          ],
          select: {
            id: true,
            key: true,
            name: true,
          },
        });

      return res.json({
        success: true,
        sources,
      });
    } catch (error) {
      console.error(
        "Failed to load active lead sources:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load lead sources",
      });
    }
  }
);


/* =========================================================
   GET ACTIVE CUSTOM FIELDS FOR LEAD FORMS
========================================================= */

router.get(
  "/meta/custom-fields",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const fields =
        await prisma.customField.findMany({
          where: {
            companyId,
            entityType: "LEAD",
            active: true,
            showInForms: true,
          },
          orderBy: [
            {
              sortOrder: "asc",
            },
            {
              name: "asc",
            },
          ],
        });

      return res.json({
        success: true,
        fields: fields.map((field) => ({
          id: field.id,
          key: field.key,
          name: field.name,
          description: field.description,
          fieldType: field.fieldType,
          required: field.required,
          options: Array.isArray(field.options)
            ? field.options
            : [],
          sortOrder: field.sortOrder,
        })),
      });
    } catch (error) {
      console.error(
        "Failed to load lead custom fields:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load custom fields",
      });
    }
  }
);


/* =========================================================
   IMPORT INTERNAL LEADS
========================================================= */

const internalLeadUpload =
  multer({
    storage:
      multer.memoryStorage(),
    limits: {
      fileSize:
        5 * 1024 * 1024,
      files: 1,
    },
    fileFilter(
      req,
      file,
      callback
    ) {
      const name =
        String(
          file.originalname ||
            ""
        ).toLowerCase();

      if (
        !name.endsWith(
          ".csv"
        ) &&
        !name.endsWith(
          ".xlsx"
        )
      ) {
        callback(
          new Error(
            "Only CSV and XLSX files are supported"
          )
        );
        return;
      }

      callback(
        null,
        true
      );
    },
  });

function normalizeLeadHeader(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}

const INTERNAL_LEAD_HEADERS = {
  name: [
    "name",
    "lead name",
    "student name",
  ],
  phone: [
    "phone",
    "mobile",
    "mobile number",
    "phone number",
    "contact",
  ],
  email: [
    "email",
    "email id",
    "email address",
  ],
  course: [
    "course",
    "interest",
    "course / interest",
    "program",
    "programme",
  ],
  campaign: [
    "campaign",
    "campaign name",
  ],
  medium: [
    "medium",
  ],
  assignedToName: [
    "assigned to",
    "assigned",
    "counsellor",
    "counselor",
  ],
  notes: [
    "notes",
    "remarks",
    "comments",
  ],
};

function internalHeaderIndex(
  headers,
  field
) {
  const aliases =
    INTERNAL_LEAD_HEADERS[
      field
    ] || [];

  return headers.findIndex(
    (header) =>
      aliases.includes(
        normalizeLeadHeader(
          header
        )
      )
  );
}

async function parseInternalLeadFile(
  file
) {
  if (!file) {
    throw new Error(
      "CSV or XLSX file is required"
    );
  }

  const workbook =
    new ExcelJS.Workbook();

  const filename =
    String(
      file.originalname ||
        ""
    ).toLowerCase();

  if (
    filename.endsWith(
      ".csv"
    )
  ) {
    await workbook.csv.read(
      file.buffer
    );
  } else {
    await workbook.xlsx.load(
      file.buffer
    );
  }

  const sheet =
    workbook.worksheets[0];

  if (!sheet) {
    throw new Error(
      "Spreadsheet does not contain a worksheet"
    );
  }

  const headerRow =
    sheet.getRow(1);

  const headers = [];

  for (
    let i = 1;
    i <=
    headerRow.cellCount;
    i += 1
  ) {
    headers.push(
      String(
        headerRow.getCell(i)
          .text || ""
      ).trim()
    );
  }

  const indexes = {};

  for (
    const field of
    Object.keys(
      INTERNAL_LEAD_HEADERS
    )
  ) {
    indexes[field] =
      internalHeaderIndex(
        headers,
        field
      );
  }

  if (
    indexes.name < 0 ||
    indexes.phone < 0
  ) {
    throw new Error(
      'Spreadsheet must contain "Name" and "Phone" columns'
    );
  }

  const rows = [];
  const maxRow =
    Math.min(
      sheet.rowCount,
      2001
    );

  for (
    let rowNumber = 2;
    rowNumber <= maxRow;
    rowNumber += 1
  ) {
    const row =
      sheet.getRow(
        rowNumber
      );

    const valueAt =
      (field) =>
        indexes[field] >= 0
          ? row.getCell(
              indexes[field] +
                1
            ).text
          : "";

    const name =
      String(
        valueAt(
          "name"
        ) || ""
      ).trim();

    const phone =
      String(
        valueAt(
          "phone"
        ) || ""
      ).trim();

    if (
      !name &&
      !phone
    ) {
      continue;
    }

    rows.push({
      name,
      phone,
      email:
        String(
          valueAt(
            "email"
          ) || ""
        )
          .trim()
          .toLowerCase() ||
        null,
      course:
        String(
          valueAt(
            "course"
          ) || ""
        ).trim() ||
        null,
      campaign:
        String(
          valueAt(
            "campaign"
          ) || ""
        ).trim() ||
        null,
      medium:
        String(
          valueAt(
            "medium"
          ) || ""
        ).trim() ||
        null,
      assignedToName:
        String(
          valueAt(
            "assignedToName"
          ) || ""
        ).trim() ||
        null,
      notes:
        String(
          valueAt(
            "notes"
          ) || ""
        ).trim() ||
        null,
    });
  }

  return rows;
}

router.post(
  "/internal/import",
  internalLeadUpload.single(
    "file"
  ),
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const sourceKey = String(
        req.body?.source || "INTERNAL"
      )
        .trim()
        .toUpperCase();

      if (
        !INTERNAL_MANAGED_SOURCE_KEYS.includes(
          sourceKey
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Choose Internal, Google Form, Website Form, IM Leads or DM Leads as the import source",
        });
      }

      const sourceConfig =
        await ensureInternalManagedSource(
          companyId,
          sourceKey
        );

      const rows =
        await parseInternalLeadFile(
          req.file
        );

      if (!rows.length) {
        return res.status(400).json({
          success: false,
          message:
            "No lead rows found in the uploaded file",
        });
      }

      const valid = [];
      let invalid = 0;
      let duplicates = 0;

      const seenPhones = new Set();

      const phones = rows
        .map((row) => row.phone)
        .filter(Boolean);

      const existing = phones.length
        ? await prisma.lead.findMany({
            where: {
              companyId,
              phone: {
                in: phones,
              },
            },
            select: {
              phone: true,
            },
          })
        : [];

      const existingPhones = new Set(
        existing.map((item) => item.phone)
      );

      for (const row of rows) {
        if (!row.name || !row.phone) {
          invalid += 1;
          continue;
        }

        if (
          seenPhones.has(row.phone) ||
          existingPhones.has(row.phone)
        ) {
          duplicates += 1;
          continue;
        }

        seenPhones.add(row.phone);
        valid.push(row);
      }

      if (!valid.length) {
        return res.status(400).json({
          success: false,
          message:
            "No new valid leads were found",
          importSummary: {
            imported: 0,
            duplicates,
            invalid,
          },
        });
      }

      await prisma.lead.createMany({
        data: valid.map((row) => ({
          companyId,
          name: row.name,
          phone: row.phone,
          email: row.email,
          course: row.course,
          source: sourceKey,
          stage: "NEW",
          leadStatus: "Fresh",
          temperature: "WARM",
          campaign: row.campaign,
          medium: row.medium,
          assignedToName:
            row.assignedToName,
          notes: row.notes,
        })),
      });

      return res.status(201).json({
        success: true,
        message: `${valid.length} ${sourceConfig?.name || "internal"} leads imported`,
        source: sourceKey,
        importSummary: {
          imported: valid.length,
          duplicates,
          invalid,
        },
      });
    } catch (error) {
      console.error(
        "Internal leads import failed:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error?.message ||
          "Unable to import internal leads",
      });
    }
  }
);

router.get("/utm/links", async (req, res) => {
  try {
    const companyId =
      req.clientUser.companyId;

    const selectedYear =
      parseYear(
        req.query.year
      );

    const search =
      String(
        req.query.search ||
          ""
      ).trim();

    const source =
      String(
        req.query.source ||
          ""
      ).trim();

    const medium =
      String(
        req.query.medium ||
          ""
      ).trim();

    const campaign =
      String(
        req.query.campaign ||
          ""
      ).trim();

    const sort =
      String(
        req.query.sort ||
          "newest"
      );

    const where = {
      companyId,
      ...(selectedYear
        ? {
            createdAt:
              yearRange(
                selectedYear
              ),
          }
        : {}),
    };

    if (source) {
      where.source = {
        equals:
          source,
        mode:
          "insensitive",
      };
    }

    if (medium) {
      where.medium = {
        equals:
          medium,
        mode:
          "insensitive",
      };
    }

    if (campaign) {
      where.campaign = {
        contains:
          campaign,
        mode:
          "insensitive",
      };
    }

    if (search) {
      where.OR = [
        {
          campaign: {
            contains:
              search,
            mode:
              "insensitive",
          },
        },
        {
          source: {
            contains:
              search,
            mode:
              "insensitive",
          },
        },
        {
          medium: {
            contains:
              search,
            mode:
              "insensitive",
          },
        },
        {
          url: {
            contains:
              search,
            mode:
              "insensitive",
          },
        },
      ];
    }

    const links =
      await prisma.utmLink.findMany({
        where,
        include: {
          leads: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              campaign: true,
              source: true,
              medium: true,
              createdAt: true,
              admission: {
                select: {
                  status: true,
                  paidAmount: true,
                },
              },
            },
          },
        },
      });

    let formatted =
      links.map(
        (link) => {
          const validLeads =
            selectedYear
              ? link.leads.filter(
                  (lead) =>
                    new Date(
                      lead.createdAt
                    ).getFullYear() ===
                    selectedYear
                )
              : link.leads;

          const admissions =
            validLeads.filter(
              (lead) =>
                lead.admission &&
                lead.admission
                  .status !==
                  "CANCELLED"
            );

          const revenue =
            admissions.reduce(
              (
                sum,
                lead
              ) =>
                sum +
                Number(
                  lead.admission
                    ?.paidAmount ||
                    0
                ),
              0
            );

          return {
            id: link.id,
            campaign:
              link.campaign,
            source:
              link.source,
            medium:
              link.medium,
            url: link.url,
            clicks:
              Number(
                link.clicks ||
                  0
              ),
            regs:
              Number(
                link.registrations ||
                  validLeads.length
              ),
            leads:
              validLeads.length,
            conv:
              Number(
                link.conversions ||
                  admissions.length
              ),
            adm:
              admissions.length,
            rev:
              revenue ||
              Number(
                link.revenue ||
                  0
              ),
            cost:
              Number(
                link.cost ||
                  0
              ),
            costPerLead:
              validLeads.length > 0
                ? Number(
                    (
                      Number(
                        link.cost ||
                          0
                      ) /
                      validLeads.length
                    ).toFixed(2)
                  )
                : 0,
            latestLead:
              validLeads
                .slice()
                .sort(
                  (a, b) =>
                    new Date(
                      b.createdAt
                    ) -
                    new Date(
                      a.createdAt
                    )
                )[0] || null,
            active:
              link.active,
            createdAt:
              link.createdAt,
          };
        }
      );

    formatted.sort(
      (a, b) => {
        if (
          sort ===
          "oldest"
        ) {
          return (
            new Date(
              a.createdAt
            ) -
            new Date(
              b.createdAt
            )
          );
        }

        if (
          sort ===
          "leads"
        ) {
          return (
            b.leads -
            a.leads
          );
        }

        if (
          sort ===
          "admissions"
        ) {
          return (
            b.adm -
            a.adm
          );
        }

        if (
          sort ===
          "revenue"
        ) {
          return (
            b.rev -
            a.rev
          );
        }

        return (
          new Date(
            b.createdAt
          ) -
          new Date(
            a.createdAt
          )
        );
      }
    );

    return res.json({
      success: true,
      links: formatted,
      total:
        formatted.length,
    });
  } catch (error) {
    console.error(
      "Failed to fetch UTM links:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch UTM links",
    });
  }
});

/* =========================================================
   CREATE UTM LINK
========================================================= */

router.post("/utm/links", async (req, res) => {
  try {
    const companyId =
      req.clientUser.companyId;

    const mode =
      String(
        req.body?.mode ||
          "generate"
      )
        .trim()
        .toLowerCase();

    const campaign =
      String(
        req.body?.campaign ||
          ""
      ).trim();

    const source =
      String(
        req.body?.source ||
          ""
      ).trim();

    const medium =
      String(
        req.body?.medium ||
          ""
      ).trim();

    const rawUrl =
      String(
        req.body?.url ||
          ""
      ).trim();

    const cost =
      Number(
        req.body?.cost ||
          0
      );

    if (
      !campaign ||
      !source ||
      !medium ||
      !rawUrl
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Campaign, source, medium and URL are required",
      });
    }

    if (
      !Number.isFinite(cost) ||
      cost < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Campaign cost must be a valid non-negative amount",
      });
    }

    let url;

    try {
      if (
        mode ===
        "manual"
      ) {
        const parsed =
          new URL(
            rawUrl
          );

        if (
          !parsed.searchParams.get(
            "utm_campaign"
          )
        ) {
          parsed.searchParams.set(
            "utm_campaign",
            slugUtm(
              campaign
            )
          );
        }

        if (
          !parsed.searchParams.get(
            "utm_source"
          )
        ) {
          parsed.searchParams.set(
            "utm_source",
            slugUtm(
              source
            )
          );
        }

        if (
          !parsed.searchParams.get(
            "utm_medium"
          )
        ) {
          parsed.searchParams.set(
            "utm_medium",
            slugUtm(
              medium
            )
          );
        }

        url =
          parsed.toString();
      } else {
        url =
          buildUtmUrl(
            rawUrl,
            campaign,
            source,
            medium
          );
      }
    } catch {
      return res.status(400).json({
        success: false,
        message:
          "Please enter a valid URL",
      });
    }

    const link =
      await prisma.utmLink.create({
        data: {
          companyId,
          campaign,
          source,
          medium,
          url,
          cost,
        },
      });

    return res.status(201).json({
      success: true,
      message:
        "UTM link created successfully",
      link: {
        id: link.id,
        campaign:
          link.campaign,
        source:
          link.source,
        medium:
          link.medium,
        url: link.url,
        clicks:
          link.clicks,
        regs:
          link.registrations,
        leads: 0,
        conv:
          link.conversions,
        adm:
          link.admissions,
        rev:
          Number(
            link.revenue ||
              0
          ),
        cost:
          Number(
            link.cost ||
              0
          ),
        costPerLead: 0,
        latestLead: null,
        active:
          link.active,
        createdAt:
          link.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Failed to create UTM link:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create UTM link",
    });
  }
});

/* =========================================================
   UPDATE UTM LINK
========================================================= */

router.patch("/utm/links/:id", async (req, res) => {
  try {
    const companyId =
      req.clientUser.companyId;

    const existing =
      await prisma.utmLink.findFirst({
        where: {
          id: req.params.id,
          companyId,
        },
      });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message:
          "UTM link not found",
      });
    }

    const data = {};

    for (const field of [
      "campaign",
      "source",
      "medium",
    ]) {
      if (
        req.body?.[
          field
        ] !== undefined
      ) {
        const value =
          String(
            req.body[
              field
            ] || ""
          ).trim();

        if (!value) {
          return res.status(400).json({
            success: false,
            message:
              `${field} cannot be empty`,
          });
        }

        data[field] =
          value;
      }
    }

    if (
      req.body?.cost !==
      undefined
    ) {
      const cost =
        Number(
          req.body.cost ||
            0
        );

      if (
        !Number.isFinite(
          cost
        ) ||
        cost < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Campaign cost must be a valid non-negative amount",
        });
      }

      data.cost =
        cost;
    }

    if (
      req.body?.url !==
      undefined
    ) {
      const rawUrl =
        String(
          req.body.url ||
            ""
        ).trim();

      try {
        data.url =
          buildUtmUrl(
            rawUrl,
            data.campaign ||
              existing.campaign,
            data.source ||
              existing.source,
            data.medium ||
              existing.medium
          );
      } catch {
        return res.status(400).json({
          success: false,
          message:
            "Please enter a valid URL",
        });
      }
    }

    const updated =
      await prisma.utmLink.update({
        where: {
          id:
            existing.id,
        },
        data,
      });

    return res.json({
      success: true,
      message:
        "UTM link updated",
      link: {
        id:
          updated.id,
        campaign:
          updated.campaign,
        source:
          updated.source,
        medium:
          updated.medium,
        url:
          updated.url,
        clicks:
          updated.clicks,
        regs:
          updated.registrations,
        leads: 0,
        conv:
          updated.conversions,
        adm:
          updated.admissions,
        rev:
          Number(
            updated.revenue ||
              0
          ),
        cost:
          Number(
            updated.cost ||
              0
          ),
        costPerLead: 0,
        latestLead: null,
        active:
          updated.active,
        createdAt:
          updated.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Failed to update UTM link:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update UTM link",
    });
  }
});

/* =========================================================
   DELETE UTM LINK
========================================================= */

router.delete("/utm/links/:id", async (req, res) => {
  try {
    const companyId =
      req.clientUser.companyId;

    const existing =
      await prisma.utmLink.findFirst({
        where: {
          id: req.params.id,
          companyId,
        },
      });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message:
          "UTM link not found",
      });
    }

    await prisma.utmLink.delete({
      where: {
        id:
          existing.id,
      },
    });

    return res.json({
      success: true,
      message:
        "UTM link deleted",
    });
  } catch (error) {
    console.error(
      "Failed to delete UTM link:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to delete UTM link",
    });
  }
});

/* =========================================================
   UTM ANALYTICS
========================================================= */

router.get("/utm/analytics", async (req, res) => {
  try {
    const companyId =
      req.clientUser.companyId;

    const selectedYear =
      parseYear(
        req.query.year
      );

    const links =
      await prisma.utmLink.findMany({
        where: {
          companyId,
          ...(selectedYear
            ? {
                createdAt:
                  yearRange(
                    selectedYear
                  ),
              }
            : {}),
        },
        include: {
          leads: {
            select: {
              id: true,
              createdAt: true,
              admission: {
                select: {
                  status: true,
                  paidAmount: true,
                },
              },
            },
          },
        },
      });

    let totalRegistrations =
      0;
    let totalLeads = 0;
    let totalAdmissions = 0;
    let totalRevenue = 0;

    const campaignMap =
      new Map();

    const sourceMap =
      new Map();

    const mediumMap =
      new Map();

    for (const link of links) {
      const validLeads =
        selectedYear
          ? link.leads.filter(
              (lead) =>
                new Date(
                  lead.createdAt
                ).getFullYear() ===
                selectedYear
            )
          : link.leads;

      const admissions =
        validLeads.filter(
          (lead) =>
            lead.admission &&
            lead.admission
              .status !==
              "CANCELLED"
        );

      const revenue =
        admissions.reduce(
          (
            sum,
            lead
          ) =>
            sum +
            Number(
              lead.admission
                ?.paidAmount ||
                0
            ),
          0
        );

      const registrations =
        Number(
          link.registrations ||
            validLeads.length
        );

      totalRegistrations +=
        registrations;

      totalLeads +=
        validLeads.length;

      totalAdmissions +=
        admissions.length;

      totalRevenue +=
        revenue;

      const campaignRow =
        campaignMap.get(
          link.campaign
        ) || {
          campaign:
            link.campaign,
          leads: 0,
          admissions: 0,
          revenue: 0,
        };

      campaignRow.leads +=
        validLeads.length;

      campaignRow.admissions +=
        admissions.length;

      campaignRow.revenue +=
        revenue;

      campaignMap.set(
        link.campaign,
        campaignRow
      );

      // CA-016: group by a case-insensitive key so "LinkedIn" and "linkedin"
      // count as one platform in reports.
      const sourceKeyNorm = String(
        link.source || ""
      )
        .trim()
        .toLowerCase();

      const sourceRow =
        sourceMap.get(
          sourceKeyNorm
        ) || {
          source:
            link.source,
          leads: 0,
          admissions: 0,
          revenue: 0,
        };

      sourceRow.leads +=
        validLeads.length;

      sourceRow.admissions +=
        admissions.length;

      sourceRow.revenue +=
        revenue;

      sourceMap.set(
        sourceKeyNorm,
        sourceRow
      );

      const mediumKeyNorm = String(
        link.medium || ""
      )
        .trim()
        .toLowerCase();

      const mediumRow =
        mediumMap.get(
          mediumKeyNorm
        ) || {
          medium:
            link.medium,
          leads: 0,
          admissions: 0,
          revenue: 0,
        };

      mediumRow.leads +=
        validLeads.length;

      mediumRow.admissions +=
        admissions.length;

      mediumRow.revenue +=
        revenue;

      mediumMap.set(
        mediumKeyNorm,
        mediumRow
      );
    }

    const campaignPerformance =
      Array.from(
        campaignMap.values()
      ).sort(
        (a, b) =>
          b.leads -
          a.leads
      );

    const sourcePerformance =
      Array.from(
        sourceMap.values()
      ).sort(
        (a, b) =>
          b.leads -
          a.leads
      );

    const mediumPerformance =
      Array.from(
        mediumMap.values()
      ).sort(
        (a, b) =>
          b.leads -
          a.leads
      );

    const topCampaign =
      campaignPerformance[
        0
      ]?.campaign ||
      "—";

    const topSource =
      sourcePerformance[
        0
      ]?.source ||
      "—";

    const conversionRate =
      totalLeads > 0
        ? Number(
            (
              (totalAdmissions /
                totalLeads) *
              100
            ).toFixed(1)
          )
        : 0;

    return res.json({
      success: true,
      summary: {
        totalUtmLinks:
          links.length,
        totalRegistrations,
        totalLeads,
        totalAdmissions,
        totalRevenue,
        topCampaign,
        topSource,
        conversionRate,
      },
      campaignPerformance,
      sourcePerformance,
      mediumPerformance,
    });
  } catch (error) {
    console.error(
      "Failed to load UTM analytics:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load UTM analytics",
    });
  }
});

export default router;