import {

  Router,

} from "express";

import multer from "multer";

import ExcelJS from "exceljs";
import { Readable } from "node:stream";



import prisma from "../lib/prisma.js";

import { buildLeadIntelligence } from "../lib/leadIntelligence.js";

import {

  requireClientUser,

  requireClientPermission,

} from "../middleware/clientAuth.js";

import {
  getLeadVisibilityScope,
  leadVisibilityWhere,
  datasetVisibilityWhere,
  canViewLead,
} from "../lib/leadVisibility.js";



const router =

  Router();

/* =========================================================
   LEAD FOLLOW-UP + REMARK HELPERS (restored feature)
========================================================= */

function parseLeadFollowUpAt(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid follow-up date or time");
  }

  return date;
}

function legacyLeadRemarkText(notes) {
  return String(notes || "")
    .split("\n")
    .filter((line) =>
      !line.startsWith("Lead Store source: ") &&
      !line.startsWith("Lead Store type: ") &&
      !line.startsWith("Imported from ") &&
      line !== "Added individually from Lead Store" &&
      !line.startsWith("Admissions origin:")
    )
    .join("\n")
    .trim();
}

async function clearPendingLeadFollowUpNotifications(
  client,
  companyId,
  leadId
) {
  await client.notification.deleteMany({
    where: {
      companyId,
      read: false,
      message: {
        contains: `LEAD_FOLLOWUP:${leadId}:`,
      },
    },
  });
}

async function getLatestLeadRemarks(client, companyId, leadId) {
  const remarks = await client.leadRemark.findMany({
    where: { companyId, leadId },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  });

  return remarks.map((remark) => ({
    id: remark.id,
    text: remark.text,
    createdAt: remark.createdAt,
    updatedAt: remark.updatedAt,
    createdBy: remark.user?.name || "Unknown user",
    userId: remark.userId || null,
    legacy: false,
  }));
}



function parseYear(value) {

  if (!value || value === "all") return null;

  const year = Number(value);

  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;

}



function yearRange(year) {

  if (!year) return null;

  return {

    gte: new Date(year, 0, 1),

    lt: new Date(year + 1, 0, 1),

  };

}





/**
 * Security guard for single-lead actions: confirms the acting user is
 * allowed to see this lead under the visibility scope. Responds with 404
 * (not 403) so out-of-scope leads are indistinguishable from missing ones.
 * Returns true when access is allowed.
 */
async function ensureLeadInScope(req, res, lead) {
  const scope = await getLeadVisibilityScope(
    prisma,
    req.clientUser.companyId,
    req.clientUser
  );
  if (!canViewLead(scope, lead)) {
    res
      .status(404)
      .json({ success: false, message: "Lead not found" });
    return false;
  }
  return true;
}

/**
 * Same idea for lead datasets (import batches). Datasets carry a single
 * assignedToUserId; non-admins may only manage datasets within their scope.
 */
async function ensureDatasetInScope(req, res, dataset) {
  const scope = await getLeadVisibilityScope(
    prisma,
    req.clientUser.companyId,
    req.clientUser
  );
  if (scope.isAdmin) return true;
  const allowed =
    dataset?.assignedToUserId &&
    scope.visibleUserIds?.has(dataset.assignedToUserId);
  if (!allowed) {
    res
      .status(404)
      .json({ success: false, message: "Dataset not found" });
    return false;
  }
  return true;
}

router.use(

  requireClientUser

);



router.use(

  requireClientPermission(

    "canManageLeads",

    "You do not have permission to manage Lead Store"

  )

);



const TYPE_LABELS = {

  INDIVIDUAL:

    "Individual Leads",

  EXTERNAL_DATA:

    "External Data",

  OFFLINE_LEADGEN:

    "Offline LeadGen",

  PURCHASED:

    "Purchased",

  UPLOADED:

    "Uploaded",

  ASSIGNED:

    "Assigned",

};

const LEAD_STORE_COLUMN_KEYS = [
  "leadId",
  "name",
  "phone",
  "alternatePhone",
  "email",
  "course",
  "assignedTo",
  "temperature",
  "status",
  "intelligence",
  "created",
];

function normalizeLeadStoreColumnOrder(value) {
  const requested = Array.isArray(value) ? value : [];
  const valid = requested
    .map((key) => String(key || "").trim())
    .filter(
      (key, index, items) =>
        LEAD_STORE_COLUMN_KEYS.includes(key) && items.indexOf(key) === index
    );

  return [
    ...valid,
    ...LEAD_STORE_COLUMN_KEYS.filter((key) => !valid.includes(key)),
  ];
}

router.get("/column-preferences", async (req, res) => {
  try {
    const role = String(req.clientUser.role || "").toUpperCase();
    const canReorder = role === "CLIENT_ADMIN" || role === "MANAGER";

    if (!canReorder) {
      return res.json({
        success: true,
        canReorder: false,
        columnOrder: LEAD_STORE_COLUMN_KEYS,
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: req.clientUser.userId,
        companyId: req.clientUser.companyId,
        active: true,
      },
      select: { leadStoreColumnOrder: true },
    });

    return res.json({
      success: true,
      canReorder: true,
      columnOrder: normalizeLeadStoreColumnOrder(user?.leadStoreColumnOrder),
    });
  } catch (error) {
    console.error("Unable to load Lead Store column preferences:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load column arrangement",
    });
  }
});

router.patch("/column-preferences", async (req, res) => {
  try {
    const role = String(req.clientUser.role || "").toUpperCase();
    if (role !== "CLIENT_ADMIN" && role !== "MANAGER") {
      return res.status(403).json({
        success: false,
        message: "Only admins and managers can rearrange Lead Store columns",
      });
    }

    const requested = req.body?.columnOrder;
    if (!Array.isArray(requested)) {
      return res.status(400).json({
        success: false,
        message: "Column order must be a list",
      });
    }

    const columnOrder = normalizeLeadStoreColumnOrder(requested);
    await prisma.user.updateMany({
      where: {
        id: req.clientUser.userId,
        companyId: req.clientUser.companyId,
        active: true,
      },
      data: { leadStoreColumnOrder: columnOrder },
    });

    return res.json({
      success: true,
      message: "Column arrangement saved",
      columnOrder,
    });
  } catch (error) {
    console.error("Unable to save Lead Store column preferences:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to save column arrangement",
    });
  }
});



const VALID_TYPES =

  Object.keys(

    TYPE_LABELS

  );


const VALID_TEMPERATURES = [

  "HOT",

  "WARM",

  "COLD",

];

const FIXED_LEAD_STATUSES = [
  "Fresh",
  "Call Initiated",
  "Not Answering",
  "Not Reachable",
  "Lead Lost",
  "Admission Done",
];

const STAGE_TO_LEAD_STATUS = {
  NEW: "Fresh",
  CONTACTED: "Call Initiated",
  QUALIFIED: "Call Initiated",
  COUNSELLING: "Call Initiated",
  ADMITTED: "Admission Done",
  LOST: "Lead Lost",
};

const LEAD_STATUS_TO_STAGE = {
  Fresh: "NEW",
  "Call Initiated": "CONTACTED",
  "Not Answering": "CONTACTED",
  "Not Reachable": "CONTACTED",
  "Lead Lost": "LOST",
  "Admission Done": "ADMITTED",
};

function cleanLeadStatus(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeLeadStatus(value) {
  return cleanLeadStatus(value).toLowerCase();
}

function leadStatusFor(lead) {
  return cleanLeadStatus(lead?.leadStatus) ||
    STAGE_TO_LEAD_STATUS[lead?.stage] ||
    "Fresh";
}



const VALID_DATASET_TYPES =

  VALID_TYPES.filter(

    (type) =>

      type !== "INDIVIDUAL"

  );



const MAX_IMPORT_ROWS =

  5000;



const upload =

  multer({

    storage:

      multer.memoryStorage(),



    limits: {

      fileSize:

        5 *

        1024 *

        1024,

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



      const allowed =

        name.endsWith(

          ".csv"

        ) ||

        name.endsWith(

          ".xlsx"

        );



      if (!allowed) {

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



function leadFileUpload(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    let message = error?.message || "Unable to upload spreadsheet";

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        message = "Lead file must be 5 MB or smaller";
      } else if (error.code === "LIMIT_FILE_COUNT") {
        message = "Upload one lead file at a time";
      } else {
        message = "Unable to read the uploaded lead file";
      }
    }

    res.status(400).json({
      success: false,
      message,
    });
  });
}

const HEADER_ALIASES = {

  name: [

    "name",

    "student",

    "student name",

    "student_name",

    "lead name",

    "lead_name",

    "full name",

    "full_name",

  ],



  phone: [

    "phone",

    "mobile",

    "mobile number",

    "mobile_number",

    "phone number",

    "phone_number",

    "contact",

    "contact number",

    "contact_number",

  ],


  alternatePhone: [

    "alternate phone",

    "alternative phone",

    "alternate phone number",

    "alternative phone number",

    "alt phone",

    "alt mobile",

    "secondary phone",

    "secondary mobile",

  ],


  email: [

    "email",

    "email id",

    "email_id",

    "email address",

    "email_address",

  ],



  course: [

    "course",

    "interest",

    "program",

    "programme",

    "course interest",

    "course_interest",

  ],



  notes: [

    "notes",

    "note",

    "remarks",

    "remark",

    "comments",

    "comment",

  ],

};



function normalizeHeader(

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



function cleanString(

  value

) {

  const clean =

    String(

      value ?? ""

    ).trim();



  return clean ||

    null;

}



function normalizeCustomFieldInput(value) {

  if (!value || typeof value !== "object" || Array.isArray(value)) {

    return {};

  }



  return Object.fromEntries(

    Object.entries(value).map(([key, fieldValue]) => [

      String(key).trim().toUpperCase(),

      fieldValue,

    ])

  );

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



    if (cleanValue && Number.isNaN(new Date(cleanValue).getTime())) {

      throw new Error(`${field.name} must be a valid date`);

    }



    return cleanValue;

  }



  if (field.fieldType === "EMAIL") {

    const cleanValue = String(value).trim();



    if (cleanValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanValue)) {

      throw new Error(`${field.name} must be a valid email`);

    }



    return cleanValue;

  }



  if (field.fieldType === "PHONE") {

    const cleanValue = String(value).trim();

    const digits = cleanValue.replace(/\D/g, "");



    if (cleanValue && digits.length < 7) {

      throw new Error(`${field.name} must be a valid phone number`);

    }



    return cleanValue;

  }



  return String(value).trim();

}



async function prepareCustomFieldValues(companyId, customFields) {

  const input = normalizeCustomFieldInput(customFields);



  const fields = await prisma.customField.findMany({

    where: {

      companyId,

      entityType: "LEAD",

      active: true,

      showInForms: true,

    },

    orderBy: [

      { sortOrder: "asc" },

      { name: "asc" },

    ],

  });



  return fields.map((field) => {

    const hasValue = Object.prototype.hasOwnProperty.call(

      input,

      field.key

    );



    const rawValue = input[field.key];



    if (

      field.required &&

      (!hasValue ||

        rawValue === "" ||

        rawValue === null ||

        rawValue === undefined)

    ) {

      throw new Error(`${field.name} is required`);

    }



    return {

      field,

      value: hasValue

        ? serializeCustomFieldValue(field, rawValue)

        : null,

    };

  });

}



function normalizePhone(

  value

) {

  const raw =

    String(

      value ?? ""

    ).trim();



  if (!raw) {

    return "";

  }



  const digits =

    raw.replace(

      /\D/g,

      ""

    );



  if (

    digits.length >

      10 &&

    digits.startsWith(

      "91"

    )

  ) {

    return digits.slice(

      -10

    );

  }



  return digits;

}



function normalizeManualLeadPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  return digits;
}

function isValidManualLeadPhone(value) {
  return /^[6-9]\d{9}$/.test(String(value ?? ""));
}

function isValidManualLeadName(value) {
  const name = String(value ?? "").trim();

  return (
    name.length >= 2 &&
    /\p{L}/u.test(name) &&
    /^[\p{L}\s.'’-]+$/u.test(name)
  );
}



function normalizeEmail(

  value

) {

  return String(

    value ?? ""

  )

    .trim()

    .toLowerCase();

}



function formatDataset(

  dataset,

  conversionCount =

    0

) {

  const assignee =

    dataset.assignedToUser

      ? {

          id:

            dataset.assignedToUser.id,

          name:

            dataset.assignedToUser.name,

          email:

            dataset.assignedToUser.email,

          role:

            dataset.assignedToUser.role,

        }

      : null;



  return {

    id:

      dataset.id,

    name:

      dataset.name,

    type:

      dataset.type,

    typeLabel:

      TYPE_LABELS[

        dataset.type

      ] ||

      dataset.type,

    sourceName:

      dataset.sourceName,

    sourceFileName:

      dataset.sourceFileName,

    count:

      dataset.leadCount,

    importedCount:

      dataset.importedCount,

    duplicateCount:

      dataset.duplicateCount,

    failedCount:

      dataset.failedCount,

    assignedTo:

      assignee?.name ||

      "Unassigned",

    assignedToUser:

      assignee,

    converted:

      conversionCount,

    notes:

      dataset.notes,

    uploadedAt:

      dataset.uploadedAt,

    createdAt:

      dataset.createdAt,

    updatedAt:

      dataset.updatedAt,

  };

}



function findHeaderIndex(

  headers,

  field

) {

  const aliases =

    HEADER_ALIASES[

      field

    ] ||

    [];



  return headers.findIndex(

    (header) =>

      aliases.includes(

        normalizeHeader(

          header

        )

      )

  );

}



async function parseSpreadsheet(

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
      Readable.from([file.buffer])
    );

  } else {

    await workbook.xlsx.load(

      file.buffer

    );

  }



  const worksheet =

    workbook.worksheets[

      0

    ];



  if (!worksheet) {

    throw new Error(

      "The spreadsheet does not contain a worksheet"

    );

  }



  const headerRow =

    worksheet.getRow(

      1

    );



  const headers = [];



  for (

    let column = 1;

    column <=

    headerRow.cellCount;

    column += 1

  ) {

    headers.push(

      String(

        headerRow.getCell(

          column

        ).text ||

          ""

      ).trim()

    );

  }



  const indexes = {

    name:

      findHeaderIndex(

        headers,

        "name"

      ),

    phone:

      findHeaderIndex(

        headers,

        "phone"

      ),

    alternatePhone:

      findHeaderIndex(

        headers,

        "alternatePhone"

      ),

    email:

      findHeaderIndex(

        headers,

        "email"

      ),

    course:

      findHeaderIndex(

        headers,

        "course"

      ),

    notes:

      findHeaderIndex(

        headers,

        "notes"

      ),

  };



  if (

    indexes.name <

      0 ||

    indexes.phone <

      0

  ) {

    throw new Error(

      'Spreadsheet must contain "Name" and "Phone" columns'

    );

  }



  const rows = [];



  const limit =

    Math.min(

      worksheet.rowCount,

      MAX_IMPORT_ROWS +

        1

    );



  for (

    let rowNumber = 2;

    rowNumber <=

    limit;

    rowNumber += 1

  ) {

    const row =

      worksheet.getRow(

        rowNumber

      );



    const valueAt =

      (index) =>

        index >= 0

          ? row.getCell(

              index +

                1

            ).text

          : "";



    const raw = {

      rowNumber,

      name:

        cleanString(

          valueAt(

            indexes.name

          )

        ),

      phone:

        normalizePhone(

          valueAt(

            indexes.phone

          )

        ),

      alternatePhone:

        normalizePhone(

          valueAt(

            indexes.alternatePhone

          )

        ),

      email:

        normalizeEmail(

          valueAt(

            indexes.email

          )

        ),

      course:

        cleanString(

          valueAt(

            indexes.course

          )

        ),

      notes:

        cleanString(

          valueAt(

            indexes.notes

          )

        ),

    };



    const hasContent =

      raw.name ||

      raw.phone ||
      raw.alternatePhone ||

      raw.email ||

      raw.course ||

      raw.notes;



    if (

      hasContent

    ) {

      rows.push(

        raw

      );

    }

  }



  if (

    rows.length >

    MAX_IMPORT_ROWS

  ) {

    throw new Error(

      `A maximum of ${MAX_IMPORT_ROWS} lead rows can be imported at once`

    );

  }



  return {

    headers,

    rows,

  };

}



function validateRows(

  rows

) {

  const valid = [];

  const invalid = [];

  const seenPhones =

    new Set();

  const seenEmails =

    new Set();

  let duplicateInFile =

    0;



  for (const row of rows) {

    if (

      !row.name ||

      !row.phone

    ) {

      invalid.push({

        ...row,

        reason:

          !row.name

            ? "Name is required"

            : "Phone is required",

      });

      continue;

    }



    if (

      row.phone.length <

      7

    ) {

      invalid.push({

        ...row,

        reason:

          "Phone number is invalid",

      });

      continue;

    }

    if (row.alternatePhone && row.alternatePhone.length < 7) {

      invalid.push({

        ...row,

        reason:

          "Alternative phone number is invalid",

      });

      continue;

    }

    if (row.alternatePhone && row.alternatePhone === row.phone) {

      invalid.push({

        ...row,

        reason:

          "Alternative phone must be different from the primary phone",

      });

      continue;

    }



    const emailKey =

      row.email ||

      null;



    if (

      seenPhones.has(

        row.phone

      ) ||
      (row.alternatePhone && seenPhones.has(row.alternatePhone)) ||

      (

        emailKey &&

        seenEmails.has(

          emailKey

        )

      )

    ) {

      duplicateInFile +=

        1;

      continue;

    }



    seenPhones.add(

      row.phone

    );

    if (row.alternatePhone) {

      seenPhones.add(row.alternatePhone);

    }



    if (emailKey) {

      seenEmails.add(

        emailKey

      );

    }



    valid.push(

      row

    );

  }



  return {

    valid,

    invalid,

    duplicateInFile,

  };

}



async function getExistingDuplicateSets(

  companyId,

  rows

) {

  const phones =

    [

      ...new Set(

        rows

          .flatMap(

            (row) =>

              [row.phone, row.alternatePhone]

          )

          .filter(

            Boolean

          )

      ),

    ];



  const emails =

    [

      ...new Set(

        rows

          .map(

            (row) =>

              row.email

          )

          .filter(

            Boolean

          )

      ),

    ];



  if (

    phones.length ===

      0 &&

    emails.length ===

      0

  ) {

    return {

      phones:

        new Set(),

      emails:

        new Set(),

    };

  }



  const OR = [];



  if (

    phones.length

  ) {

    OR.push(

      {

        phone: {

          in:

            phones,

        },

      },

      {

        alternatePhone: {

          in:

            phones,

        },

      }

    );

  }



  if (

    emails.length

  ) {

    OR.push({

      email: {

        in:

          emails,

      },

    });

  }



  const existing =

    await prisma.lead.findMany({

      where: {

        companyId,

        OR,

      },



      select: {

        phone:

          true,

        alternatePhone:

          true,

        email:

          true,

      },

    });



  return {

    phones:

      new Set(

        existing

          .flatMap(

            (lead) =>

              [

                normalizePhone(lead.phone),

                normalizePhone(lead.alternatePhone),

              ]

          )

          .filter(

            Boolean

          )

      ),



    emails:

      new Set(

        existing

          .map(

            (lead) =>

              normalizeEmail(

                lead.email

              )

          )

          .filter(

            Boolean

          )

      ),

  };

}



async function getAssignee(

  companyId,

  assignedToUserId

) {

  if (

    !assignedToUserId

  ) {

    return null;

  }



  return prisma.user.findFirst({

    where: {

      id:

        String(

          assignedToUserId

        ),

      companyId,

      active:

        true,

      role: {

        not:

          "SUPER_ADMIN",

      },

    },



    select: {

      id:

        true,

      name:

        true,

      email:

        true,

      role:

        true,

    },

  });

}



/* =========================================================

   LIST DATASETS

========================================================= */



router.get(

  "/",

  async (

    req,

    res

  ) => {

    try {

      const companyId =

        req.clientUser.companyId;



      const type =

        String(

          req.query.type ||

            ""

        )

          .trim()

          .toUpperCase();



      const search =

        String(

          req.query.search ||

            ""

        ).trim();



      const selectedYear = parseYear(req.query.year);

      // Security: non-admins only see datasets assigned within their scope.
      const scope = await getLeadVisibilityScope(
        prisma,
        companyId,
        req.clientUser
      );

      const where = {

        companyId,

        ...(selectedYear ? { createdAt: yearRange(selectedYear) } : {}),

        ...(datasetVisibilityWhere(scope) || {}),

      };



      if (

        type &&

        VALID_DATASET_TYPES.includes(

          type

        )

      ) {

        where.type =

          type;

      }



      if (search) {

        where.OR = [

          {

            name: {

              contains:

                search,

              mode:

                "insensitive",

            },

          },

          {

            sourceName: {

              contains:

                search,

              mode:

                "insensitive",

            },

          },

          {

            sourceFileName: {

              contains:

                search,

              mode:

                "insensitive",

            },

          },

          {

            notes: {

              contains:

                search,

              mode:

                "insensitive",

            },

          },

        ];

      }



      const [

        datasets,

        conversionGroups,

      ] =

        await Promise.all([

          prisma.leadDataset.findMany({

            where,



            include: {

              assignedToUser: {

                select: {

                  id:

                    true,

                  name:

                    true,

                  email:

                    true,

                  role:

                    true,

                },

              },

            },



            orderBy: {

              uploadedAt:

                "desc",

            },

          }),



          prisma.lead.groupBy({

            by: [

              "leadDatasetId",

              "stage",

            ],



            where: {

              companyId,

              leadDatasetId: {

                not:

                  null,

              },

              stage:

                "ADMITTED",

            },



            _count: {

              _all:

                true,

            },

          }),

        ]);



      const convertedMap =

        new Map();



      for (

        const item of

        conversionGroups

      ) {

        convertedMap.set(

          item.leadDatasetId,

          item._count

            ?._all ||

            0

        );

      }



      return res.json({

        success:

          true,



        datasets:

          datasets.map(

            (dataset) =>

              formatDataset(

                dataset,

                convertedMap.get(

                  dataset.id

                ) ||

                  0

              )

          ),

      });

    } catch (error) {

      console.error(

        "Failed to fetch lead datasets:",

        error

      );



      return res

        .status(500)

        .json({

          success:

            false,

          message:

            "Unable to fetch Lead Store",

        });

    }

  }

);



/* =========================================================

   ASSIGNEES

========================================================= */



router.get(

  "/meta/assignees",

  async (

    req,

    res

  ) => {

    try {

      const users =

        await prisma.user.findMany({

          where: {

            companyId:

              req.clientUser.companyId,

            active:

              true,

            role: {

              not:

                "SUPER_ADMIN",

            },

          },



          select: {

            id:

              true,

            name:

              true,

            email:

              true,

            role:

              true,

            department:

              true,

          },



          orderBy: {

            name:

              "asc",

          },

        });



      return res.json({

        success:

          true,

        users,

      });

    } catch (error) {

      console.error(

        "Failed to load Lead Store assignees:",

        error

      );



      return res

        .status(500)

        .json({

          success:

            false,

          message:

            "Unable to load users",

        });

    }

  }

);





/* =========================================================

   LIST INDIVIDUAL LEADS

========================================================= */



router.get(

  "/manual",

  async (req, res) => {

    try {

      const companyId = req.clientUser.companyId;

      const selectedYear = parseYear(req.query.year);
      const requestedLeadId = String(req.query.leadId || "").trim();

      const search = String(req.query.search || "").trim();

      // Security: scope leads so Employees only see their assigned leads
      // (Managers see their team, Client Admin sees all). Enforced here in
      // the backend query, not just the UI.
      const scope = await getLeadVisibilityScope(
        prisma,
        companyId,
        req.clientUser
      );

      const where = {

        companyId,

        OR: [
          { source: "LEAD_STORE" },
          { notes: { contains: "Admissions origin:" } },
        ],

        ...(requestedLeadId
          ? { id: requestedLeadId }
          : selectedYear
            ? { createdAt: yearRange(selectedYear) }
            : {}),

        AND: [],

      };

      const visibilityWhere = leadVisibilityWhere(scope);
      if (visibilityWhere) {
        where.AND.push(visibilityWhere);
      }

      if (search) {

        where.AND.push({
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { alternatePhone: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { course: { contains: search, mode: "insensitive" } },
            { assignedToName: { contains: search, mode: "insensitive" } },
          ],
        });

      }



      const leadNumberRows = await prisma.lead.findMany({
        where: { companyId },
        select: { id: true, source: true, notes: true },
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
      });

      const previouslyNumbered = leadNumberRows.filter(
        (lead) =>
          lead.source === "LEAD_STORE" ||
          String(lead.notes || "").includes("Admissions origin:")
      );
      const previouslyNumberedIds = new Set(
        previouslyNumbered.map((lead) => lead.id)
      );
      const newlyNumbered = leadNumberRows.filter(
        (lead) => !previouslyNumberedIds.has(lead.id)
      );
      const orderedLeadNumbers = [...previouslyNumbered, ...newlyNumbered];

      const leadNumberById = new Map(
        orderedLeadNumbers.map((lead, index) => [lead.id, index + 1])
      );

      const leads = await prisma.lead.findMany({

        where,

        include: {

          customFieldValues: {

            include: {

              customField: {

                select: { id: true, name: true, key: true, fieldType: true },

              },

            },

          },

          leadDataset: {

            select: {

              id: true,

              name: true,

              type: true,

            },

          },

          remarks: {
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
              user: {
                select: { id: true, name: true },
              },
            },
          },

        },

        orderBy: { createdAt: "desc" },

      });

      const leadIds = leads.map((lead) => lead.id);

      const [communicationGroups, counsellingRows] = leadIds.length
        ? await Promise.all([
            prisma.leadCommunication.groupBy({
              by: ["leadId"],
              where: {
                companyId,
                leadId: { in: leadIds },
              },
              _count: { _all: true },
              _max: { createdAt: true },
            }),
            prisma.counsellingSession.findMany({
              where: {
                companyId,
                leadId: { in: leadIds },
              },
              select: {
                leadId: true,
                status: true,
                scheduledAt: true,
                followUpAt: true,
              },
            }),
          ])
        : [[], []];

      const communicationByLead = new Map(
        communicationGroups
          .filter((item) => item.leadId)
          .map((item) => [
            item.leadId,
            {
              count: item._count?._all || 0,
              lastAt: item._max?.createdAt || null,
            },
          ])
      );

      const counsellingByLead = new Map();

      for (const session of counsellingRows) {
        if (!session.leadId) continue;
        if (!counsellingByLead.has(session.leadId)) {
          counsellingByLead.set(session.leadId, []);
        }
        counsellingByLead.get(session.leadId).push(session);
      }



      return res.json({

        success: true,

        leads: leads.map((lead) => ({

          id: lead.id,
          leadNumber: leadNumberById.get(lead.id) || null,

          name: lead.name,

          phone: lead.phone,

          alternatePhone: lead.alternatePhone,

          email: lead.email,

          course: lead.course,

          source: lead.source,

          stage: lead.stage,

          temperature: lead.temperature || "WARM",
          leadStatus: leadStatusFor(lead),

          type:

            String(lead.notes || "").includes("Admissions origin:")
              ? "INDIVIDUAL"
              : lead.medium ||

                (

                  lead.campaign === "Individual Lead"

                    ? "INDIVIDUAL"

                    : lead.leadDataset?.type ||

                      null

                ),

          assignedToName: lead.assignedToName,
          assignedToUserId: lead.assignedToUserId || null,
          followUpAt: lead.followUpAt || null,

          createdAt: lead.createdAt,

          isManual:

            lead.campaign === "Individual Lead",
          isAdmissionsSynced:
            String(lead.notes || "").includes("Admissions origin:"),

          datasetId:

            lead.leadDataset?.id ||

            null,

          datasetName:

            lead.leadDataset?.name ||

            null,

          sourceName: (lead.notes || "")

            .split("\n")

            .find((line) => line.startsWith("Lead Store source: "))

            ?.replace("Lead Store source: ", "") || "",

          notes: (lead.notes || "")

            .split("\n")

            .filter((line) =>

              !line.startsWith("Lead Store source: ") &&

              !line.startsWith("Lead Store type: ") &&

              !line.startsWith("Imported from ") &&

              line !== "Added individually from Lead Store"

            )

            .join("\n"),

          remarks: lead.remarks?.length
            ? lead.remarks.map((remark) => ({
                id: remark.id,
                text: remark.text,
                createdAt: remark.createdAt,
                updatedAt: remark.updatedAt,
                createdBy: remark.user?.name || "Unknown user",
                userId: remark.userId || null,
                legacy: false,
              }))
            : (legacyLeadRemarkText(lead.notes)
                ? [{
                    id: `legacy-${lead.id}`,
                    text: legacyLeadRemarkText(lead.notes),
                    createdAt: lead.createdAt,
                    updatedAt: lead.updatedAt,
                    createdBy: "Existing lead note",
                    userId: null,
                    legacy: true,
                  }]
                : []),

          intelligence: buildLeadIntelligence({
            lead,
            communicationSummary: communicationByLead.get(lead.id) || {},
            counsellingSessions: counsellingByLead.get(lead.id) || [],
          }),

          customFields: lead.customFieldValues.map((item) => ({

            id: item.customField.id,

            name: item.customField.name,

            key: item.customField.key,

            fieldType: item.customField.fieldType,

            value: item.value,

          })),

        })),

      });

    } catch (error) {

      console.error("Failed to fetch individual Lead Store leads:", error);

      return res.status(500).json({

        success: false,

        message: "Unable to fetch individual leads",

      });

    }

  }

);



/* =========================================================

   BULK ASSIGN LEADS

========================================================= */



router.patch(

  "/manual/bulk-assign",

  async (req, res) => {

    try {

      const companyId =

        req.clientUser.companyId;



      const leadIds =

        Array.isArray(req.body?.leadIds)

          ? Array.from(

              new Set(

                req.body.leadIds

                  .map((value) =>

                    String(value || "").trim()

                  )

                  .filter(Boolean)

              )

            )

          : [];



      const assignedToUserId =

        cleanString(

          req.body?.assignedToUserId

        );



      if (!leadIds.length) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Select at least one lead",

          });

      }



      if (leadIds.length > 5000) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Bulk assignment supports up to 5000 leads at a time",

          });

      }



      const assignee =

        await getAssignee(

          companyId,

          assignedToUserId

        );



      if (!assignee) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Select a valid team member",

          });

      }



      // Security: a user can only (re)assign leads that are within their
      // own visibility scope. Employees therefore cannot pull unassigned or
      // other people's leads to themselves via bulk-assign.
      const bulkScope = await getLeadVisibilityScope(
        prisma,
        companyId,
        req.clientUser
      );
      const bulkVisibilityWhere = leadVisibilityWhere(bulkScope);

      const eligible =

        await prisma.lead.findMany({

          where: {

            companyId,

            source:

              "LEAD_STORE",

            id: {

              in: leadIds,

            },

            ...(bulkVisibilityWhere
              ? { AND: [bulkVisibilityWhere] }
              : {}),

          },

          select: {

            id: true,

          },

        });



      const eligibleIds =

        eligible.map(

          (lead) => lead.id

        );



      if (!eligibleIds.length) {

        return res

          .status(404)

          .json({

            success: false,

            message:

              "No matching Lead Store leads were found",

          });

      }



      const result =

        await prisma.lead.updateMany({

          where: {

            companyId,

            source:

              "LEAD_STORE",

            id: {

              in: eligibleIds,

            },

          },

          data: {

            assignedToName:

              assignee.name,

          },

        });



      return res.json({

        success: true,

        assignedCount:

          result.count,

        assignee: {

          id: assignee.id,

          name: assignee.name,

        },

        message:

          `${result.count} lead${result.count === 1 ? "" : "s"} assigned to ${assignee.name}`,

      });

    } catch (error) {

      console.error(

        "Failed to bulk assign Lead Store leads:",

        error

      );



      return res

        .status(500)

        .json({

          success: false,

          message:

            "Unable to assign selected leads",

        });

    }

  }

);



/* =========================================================

   EDIT INDIVIDUAL LEAD

========================================================= */



router.patch(

  "/manual/:id",

  async (req, res) => {

    try {

      const companyId = req.clientUser.companyId;

      const leadId = String(req.params.id || "").trim();



      const existing = await prisma.lead.findFirst({

        where: {

          id: leadId,

          companyId,

          source: "LEAD_STORE",

        },

      });



      if (!existing) {

        return res.status(404).json({ success: false, message: "Lead not found" });

      }

      if (!(await ensureLeadInScope(req, res, existing))) return;



      const name = String(req.body?.name || "").trim();

      const rawPhone = String(req.body?.phone ?? "").trim();
      const phone = normalizeManualLeadPhone(rawPhone);
      const existingPhone = normalizeManualLeadPhone(existing.phone);

      const rawAlternatePhone = String(req.body?.alternatePhone ?? "").trim();
      const requestedAlternatePhone = rawAlternatePhone
        ? normalizeManualLeadPhone(rawAlternatePhone)
        : "";
      const existingAlternatePhone = existing.alternatePhone
        ? normalizeManualLeadPhone(existing.alternatePhone)
        : "";
      const alternatePhone = existingAlternatePhone || requestedAlternatePhone || null;

      const email = normalizeEmail(req.body?.email);

      const course = cleanString(req.body?.course);

      const temperature = String(
        req.body?.temperature || existing.temperature || "WARM"
      ).trim().toUpperCase();

      const type = String(
        req.body?.type ||
          existing.medium ||
          (
            existing.campaign === "Individual Lead"
              ? "INDIVIDUAL"
              : "EXTERNAL_DATA"
          )
      ).trim().toUpperCase();

      const sourceName = cleanString(req.body?.sourceName);

      const notes = cleanString(req.body?.notes);

      const assignedToUserId = cleanString(req.body?.assignedToUserId);

      const customFields = req.body?.customFields || {};



      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Lead name is required",
        });
      }

      if (!isValidManualLeadName(name)) {
        return res.status(400).json({
          success: false,
          message:
            "Lead name can contain only letters, spaces, apostrophes, periods and hyphens",
        });
      }

      if (!rawPhone) {
        return res.status(400).json({
          success: false,
          message: "Phone number is required",
        });
      }

      if (!isValidManualLeadPhone(phone)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid 10-digit Indian mobile number",
        });
      }

      if (phone !== existingPhone) {
        return res.status(400).json({
          success: false,
          message: "Primary phone number cannot be changed after the lead is created",
        });
      }

      if (requestedAlternatePhone && !isValidManualLeadPhone(requestedAlternatePhone)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid 10-digit alternative mobile number",
        });
      }

      if (requestedAlternatePhone && requestedAlternatePhone === existingPhone) {
        return res.status(400).json({
          success: false,
          message: "Alternative phone must be different from the primary phone",
        });
      }

      if (
        existingAlternatePhone &&
        requestedAlternatePhone &&
        requestedAlternatePhone !== existingAlternatePhone
      ) {
        return res.status(400).json({
          success: false,
          message: "Alternative phone number cannot be changed after it is saved",
        });
      }

      if (!VALID_TYPES.includes(type)) return res.status(400).json({ success: false, message: "Invalid lead type" });

      if (!VALID_TEMPERATURES.includes(temperature)) {
        return res.status(400).json({ success: false, message: "Invalid lead temperature" });
      }

      let followUpAt;
      try {
        followUpAt = parseLeadFollowUpAt(req.body?.followUpAt);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: error?.message || "Invalid follow-up date or time",
        });
      }



      const assignee = await getAssignee(companyId, assignedToUserId);

      if (assignedToUserId && !assignee) {

        return res.status(400).json({ success: false, message: "Selected assignee is invalid" });

      }



      let preparedCustomFields;

      try {

        preparedCustomFields = await prepareCustomFieldValues(companyId, customFields);

      } catch (error) {

        return res.status(400).json({ success: false, message: error?.message || "Invalid custom field value" });

      }



      const duplicate = await prisma.lead.findFirst({

        where: {

          companyId,

          id: { not: leadId },

          OR: [

            { phone },

            { alternatePhone: phone },

            ...(alternatePhone
              ? [{ phone: alternatePhone }, { alternatePhone }]
              : []),

            ...(email ? [{ email }] : []),

          ],

        },

        select: { id: true, phone: true, alternatePhone: true, email: true },

      });



      if (duplicate) {

        return res.status(409).json({

          success: false,

          duplicate: true,

          message: `A lead already exists with this ${
            duplicate.email === email && email
              ? "email address"
              : "phone number"
          }`,

        });

      }



      const originMarker =

        existing.campaign === "Individual Lead"

          ? "Added individually from Lead Store"

          : (existing.notes || "")

              .split("\n")

              .find((line) =>

                line.startsWith("Imported from ")

              ) ||

            null;



      const updated = await prisma.$transaction(async (tx) => {

        const lead = await tx.lead.update({

          where: { id: leadId },

          data: {

            name,

            phone: existing.phone,

            alternatePhone,

            email: email || null,

            course,

            temperature,

            medium: type,

            assignedToName: assignee?.name || null,

            followUpAt,

            notes: [

              notes,

              sourceName ? `Lead Store source: ${sourceName}` : null,

              `Lead Store type: ${TYPE_LABELS[type] || type}`,

              originMarker,

            ].filter(Boolean).join("\n"),

          },

        });



        await tx.customFieldValue.deleteMany({ where: { leadId } });

        const values = preparedCustomFields.filter((item) => item.value !== null && item.value !== "");

        if (values.length) {

          await tx.customFieldValue.createMany({

            data: values.map((item) => ({

              customFieldId: item.field.id,

              leadId,

              value: item.value,

            })),

          });

        }

        return lead;

      });

      if (
        (existing.followUpAt?.getTime?.() || null) !==
          (followUpAt?.getTime?.() || null)
      ) {
        await clearPendingLeadFollowUpNotifications(
          prisma,
          companyId,
          leadId
        );
      }

      return res.json({

        success: true,

        message:

          "Lead updated successfully",

        lead: {

          id: updated.id,

          name: updated.name,

          phone: updated.phone,

          alternatePhone: updated.alternatePhone,

          email: updated.email,

          course: updated.course,

          source: updated.source,

          stage: updated.stage,

          temperature: updated.temperature || "WARM",
          leadStatus: leadStatusFor(updated),

          type:

            updated.medium ||

            "INDIVIDUAL",

          assignedToName:

            updated.assignedToName,

          followUpAt: updated.followUpAt || null,

          createdAt:

            updated.createdAt,

        },

      });

    } catch (error) {

      console.error("Failed to update individual Lead Store lead:", error);

      return res.status(500).json({ success: false, message: "Unable to update lead" });

    }

  }

);



/* =========================================================

   LEAD STATUS OPTIONS + UPDATE

========================================================= */

router.get(
  "/status-options",
  async (req, res) => {
    try {
      const companyId = req.clientUser.companyId;
      const custom = await prisma.leadStatusOption.findMany({
        where: { companyId },
        orderBy: { createdAt: "asc" },
        select: { id: true, label: true },
      });

      return res.json({
        success: true,
        fixed: FIXED_LEAD_STATUSES,
        custom: custom.map((item) => item.label),
        options: [
          ...FIXED_LEAD_STATUSES,
          ...custom.map((item) => item.label),
        ],
      });
    } catch (error) {
      console.error("Failed to load Lead Store status options:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load lead statuses",
      });
    }
  }
);

router.patch(
  "/manual/:id/status",
  async (req, res) => {
    try {
      const companyId = req.clientUser.companyId;
      const leadId = String(req.params.id || "").trim();
      const status = cleanLeadStatus(req.body?.status);

      if (!status) {
        return res.status(400).json({
          success: false,
          message: "Choose or enter a lead status",
        });
      }

      if (status.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Custom status can be up to 50 characters",
        });
      }

      if (normalizeLeadStatus(status) === "other") {
        return res.status(400).json({
          success: false,
          message: "Enter a custom status name instead of Other",
        });
      }

      const lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          companyId,
          OR: [
            { source: "LEAD_STORE" },
            { notes: { contains: "Admissions origin:" } },
          ],
        },
        select: {
          id: true,
          name: true,
          stage: true,
          assignedToUserId: true,
          assignedToName: true,
        },
      });

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: "Lead not found",
        });
      }

      if (!(await ensureLeadInScope(req, res, lead))) return;

      const fixedStatus = FIXED_LEAD_STATUSES.find(
        (item) => normalizeLeadStatus(item) === normalizeLeadStatus(status)
      );
      const finalStatus = fixedStatus || status;

      if (!fixedStatus) {
        await prisma.leadStatusOption.upsert({
          where: {
            companyId_normalized: {
              companyId,
              normalized: normalizeLeadStatus(finalStatus),
            },
          },
          update: { label: finalStatus },
          create: {
            companyId,
            label: finalStatus,
            normalized: normalizeLeadStatus(finalStatus),
          },
        });
      }

      const stage = LEAD_STATUS_TO_STAGE[finalStatus];
      const updated = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          leadStatus: finalStatus,
          ...(stage ? { stage } : {}),
        },
        select: {
          id: true,
          leadStatus: true,
          stage: true,
          updatedAt: true,
        },
      });

      return res.json({
        success: true,
        message: `${lead.name} status changed to ${finalStatus}`,
        lead: {
          ...updated,
          leadStatus: leadStatusFor(updated),
        },
        customStatus: fixedStatus ? null : finalStatus,
      });
    } catch (error) {
      console.error("Failed to update Lead Store status:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to update lead status",
      });
    }
  }
);

/* =========================================================

   UPDATE LEAD TEMPERATURE

========================================================= */

router.patch(
  "/manual/:id/temperature",
  async (req, res) => {
    try {
      const companyId = req.clientUser.companyId;
      const leadId = String(req.params.id || "").trim();
      const temperature = String(req.body?.temperature || "")
        .trim()
        .toUpperCase();

      if (!VALID_TEMPERATURES.includes(temperature)) {
        return res.status(400).json({
          success: false,
          message: "Temperature must be HOT, WARM or COLD",
        });
      }

      const lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          companyId,
          OR: [
            { source: "LEAD_STORE" },
            { notes: { contains: "Admissions origin:" } },
          ],
        },
        select: {
          id: true,
          name: true,
          assignedToUserId: true,
          assignedToName: true,
        },
      });

      if (!lead) {
        return res.status(404).json({ success: false, message: "Lead not found" });
      }

      if (!(await ensureLeadInScope(req, res, lead))) return;

      const updated = await prisma.lead.update({
        where: { id: lead.id },
        data: { temperature },
        select: { id: true, temperature: true, updatedAt: true },
      });

      return res.json({
        success: true,
        message: `${lead.name} marked as ${temperature.toLowerCase()}`,
        lead: updated,
      });
    } catch (error) {
      console.error("Failed to update Lead Store temperature:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to update lead temperature",
      });
    }
  }
);



/* =========================================================

   DELETE INDIVIDUAL LEAD

========================================================= */



router.delete(

  "/manual/:id",

  async (req, res) => {

    try {

      const companyId = req.clientUser.companyId;

      const leadId = String(req.params.id || "").trim();



      const lead = await prisma.lead.findFirst({

        where: {

          id: leadId,

          companyId,

          source: "LEAD_STORE",

        },

        select: {

          id: true,

          name: true,

          leadDatasetId: true,

          assignedToUserId: true,

          assignedToName: true,

        },

      });



      if (!lead) {

        return res.status(404).json({ success: false, message: "Lead not found" });

      }

      if (!(await ensureLeadInScope(req, res, lead))) return;



      await prisma.$transaction(

        async (tx) => {

          await tx.lead.delete({

            where: {

              id: leadId,

            },

          });



          if (lead.leadDatasetId) {

            const remainingCount =

              await tx.lead.count({

                where: {

                  companyId,

                  leadDatasetId:

                    lead.leadDatasetId,

                },

              });



            await tx.leadDataset.update({

              where: {

                id:

                  lead.leadDatasetId,

              },

              data: {

                leadCount:

                  remainingCount,

                importedCount:

                  remainingCount,

              },

            });

          }

        }

      );



      return res.json({

        success: true,

        message:

          "Lead deleted successfully",

        lead,

      });

    } catch (error) {

      console.error("Failed to delete individual Lead Store lead:", error);

      return res.status(500).json({ success: false, message: "Unable to delete lead" });

    }

  }

);



/* =========================================================

   LEAD REMARKS (restored feature)

========================================================= */

router.post(
  "/manual/:id/remarks",
  async (req, res) => {
    try {
      const companyId = req.clientUser.companyId;
      const leadId = String(req.params.id || "").trim();
      const text = cleanString(req.body?.text ?? req.body?.remark);

      if (!text) {
        return res.status(400).json({
          success: false,
          message: "Remark is required",
        });
      }

      const lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          companyId,
          source: "LEAD_STORE",
        },
        select: {
          id: true,
          notes: true,
          assignedToUserId: true,
          assignedToName: true,
        },
      });

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: "Lead not found",
        });
      }

      if (!(await ensureLeadInScope(req, res, lead))) return;

      await prisma.$transaction(async (tx) => {
        const count = await tx.leadRemark.count({
          where: { companyId, leadId },
        });
        const legacyRemark = legacyLeadRemarkText(lead.notes);

        if (!count && legacyRemark) {
          await tx.leadRemark.create({
            data: {
              companyId,
              leadId,
              userId: req.clientUser.userId,
              text: legacyRemark,
            },
          });
        }

        await tx.leadRemark.create({
          data: {
            companyId,
            leadId,
            userId: req.clientUser.userId,
            text,
          },
        });
      });

      const remarks = await getLatestLeadRemarks(prisma, companyId, leadId);

      return res.status(201).json({
        success: true,
        message: "Remark added",
        remarks,
      });
    } catch (error) {
      console.error("Failed to add lead remark:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to add remark",
      });
    }
  }
);

router.patch(
  "/manual/:id/remarks/:remarkId",
  async (req, res) => {
    try {
      const companyId = req.clientUser.companyId;
      const leadId = String(req.params.id || "").trim();
      const remarkId = String(req.params.remarkId || "").trim();
      const text = cleanString(req.body?.text ?? req.body?.remark);

      if (!text) {
        return res.status(400).json({
          success: false,
          message: "Remark is required",
        });
      }

      const lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          companyId,
          source: "LEAD_STORE",
        },
        select: {
          id: true,
          assignedToUserId: true,
          assignedToName: true,
        },
      });

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: "Lead not found",
        });
      }

      if (!(await ensureLeadInScope(req, res, lead))) return;

      const remark = await prisma.leadRemark.findFirst({
        where: { id: remarkId, companyId, leadId },
        select: { id: true },
      });

      if (!remark) {
        return res.status(404).json({
          success: false,
          message: "Remark not found",
        });
      }

      await prisma.leadRemark.update({
        where: { id: remark.id },
        data: { text },
      });

      const remarks = await getLatestLeadRemarks(prisma, companyId, leadId);

      return res.json({
        success: true,
        message: "Remark updated",
        remarks,
      });
    } catch (error) {
      console.error("Failed to update lead remark:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to update remark",
      });
    }
  }
);

router.delete(
  "/manual/:id/remarks/:remarkId",
  async (req, res) => {
    try {
      const companyId = req.clientUser.companyId;
      const leadId = String(req.params.id || "").trim();
      const remarkId = String(req.params.remarkId || "").trim();

      const lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          companyId,
          source: "LEAD_STORE",
        },
        select: {
          id: true,
          assignedToUserId: true,
          assignedToName: true,
        },
      });

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: "Lead not found",
        });
      }

      if (!(await ensureLeadInScope(req, res, lead))) return;

      const remark = await prisma.leadRemark.findFirst({
        where: { id: remarkId, companyId, leadId },
        select: { id: true },
      });

      if (!remark) {
        return res.status(404).json({
          success: false,
          message: "Remark not found",
        });
      }

      await prisma.leadRemark.delete({
        where: { id: remark.id },
      });

      const remarks = await getLatestLeadRemarks(prisma, companyId, leadId);

      return res.json({
        success: true,
        message: "Remark deleted",
        remarks,
      });
    } catch (error) {
      console.error("Failed to delete lead remark:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to delete remark",
      });
    }
  }
);

/* =========================================================

   ADD INDIVIDUAL LEAD

   Single leads are stored directly in the main Lead table.

   We do NOT create a fake one-row dataset.

========================================================= */



router.post(

  "/manual",

  async (

    req,

    res

  ) => {

    try {

      const companyId =

        req.clientUser.companyId;



      const name =

        String(

          req.body?.name ||

            ""

        ).trim();



      const rawPhone =

        String(

          req.body?.phone ??

            ""

        ).trim();



      const phone =

        normalizeManualLeadPhone(

          rawPhone

        );

      const rawAlternatePhone =

        String(

          req.body?.alternatePhone ??

            ""

        ).trim();

      const alternatePhone = rawAlternatePhone

        ? normalizeManualLeadPhone(rawAlternatePhone)

        : "";



      const email =

        normalizeEmail(

          req.body?.email

        );



      const course =

        cleanString(

          req.body?.course

        );



      const temperature =

        String(

          req.body?.temperature ||

            "WARM"

        )

          .trim()

          .toUpperCase();



      const type =

        String(

          req.body?.type ||

            "INDIVIDUAL"

        )

          .trim()

          .toUpperCase();



      const sourceName =

        cleanString(

          req.body?.sourceName

        );



      const notes =

        cleanString(

          req.body?.notes

        );



      const assignedToUserId =

        cleanString(

          req.body

            ?.assignedToUserId

        );



      const customFields =

        req.body?.customFields || {};



      if (!name) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Lead name is required",

          });

      }



      if (!isValidManualLeadName(name)) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Lead name can contain only letters, spaces, apostrophes, periods and hyphens",

          });

      }



      if (!rawPhone) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Phone number is required",

          });

      }



      if (

        !isValidManualLeadPhone(

          phone

        )

      ) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Enter a valid 10-digit Indian mobile number",

          });

      }


      if (alternatePhone && !isValidManualLeadPhone(alternatePhone)) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Enter a valid 10-digit alternative mobile number",

          });

      }

      if (alternatePhone && alternatePhone === phone) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Alternative phone must be different from the primary phone",

          });

      }



      if (

        !VALID_TYPES.includes(

          type

        )

      ) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Invalid lead type",

          });

      }



      if (

        !VALID_TEMPERATURES.includes(

          temperature

        )

      ) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Invalid lead temperature",

          });

      }

      const remark = cleanString(req.body?.remark);

      let followUpAt;
      try {
        followUpAt = parseLeadFollowUpAt(req.body?.followUpAt);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: error?.message || "Invalid follow-up date or time",
        });
      }



      const assignee =

        await getAssignee(

          companyId,

          assignedToUserId

        );



      if (

        assignedToUserId &&

        !assignee

      ) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Selected assignee is invalid",

          });

      }

      // Security + UX: non-admins may only create leads assigned within their
      // scope. When no assignee is chosen, default to the creator so the new
      // lead stays visible to them (employees never create "lost" leads).
      const createScope = await getLeadVisibilityScope(
        prisma,
        companyId,
        req.clientUser
      );
      let effectiveAssignee = assignee;
      if (!createScope.isAdmin) {
        if (assignedToUserId) {
          if (!createScope.visibleUserIds?.has(assignedToUserId)) {
            return res.status(403).json({
              success: false,
              message: "You can only assign leads to yourself or your team.",
            });
          }
        } else {
          effectiveAssignee = await getAssignee(
            companyId,
            req.clientUser.userId
          );
        }
      }

      let preparedCustomFields;



      try {

        preparedCustomFields =

          await prepareCustomFieldValues(

            companyId,

            customFields

          );

      } catch (error) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              error?.message ||

              "Invalid custom field value",

          });

      }



      const OR = [

        {

          phone,

        },

        {

          alternatePhone: phone,

        },

      ];

      if (alternatePhone) {

        OR.push(

          { phone: alternatePhone },

          { alternatePhone }

        );

      }



      if (email) {

        OR.push({

          email,

        });

      }



      const duplicate =

        await prisma.lead.findFirst({

          where: {

            companyId,

            OR,

          },



          select: {

            id: true,

            name: true,

            phone: true,
            alternatePhone: true,
            email: true,

          },

        });



      if (duplicate) {

        return res

          .status(409)

          .json({

            success: false,

            duplicate: true,

            message:

              `A lead already exists with this ${

                duplicate.email === email && email

                  ? "email address"

                  : "phone number"

              }`,

            existingLead: duplicate,

          });

      }



      const lead =

        await prisma.$transaction(

          async (

            tx

          ) => {

            await tx.leadSourceConfig.upsert({

              where: {

                companyId_key: {

                  companyId,

                  key:

                    "LEAD_STORE",

                },

              },



              update: {

                active:

                  true,

                showInForms:

                  true,

              },



              create: {

                companyId,

                key:

                  "LEAD_STORE",

                name:

                  "Lead Store",

                description:

                  "Leads added manually or imported through Lead Store",

                active:

                  true,

                showInForms:

                  true,

                system:

                  true,

                sortOrder:

                  80,

              },

            });



            const lead = await tx.lead.create({

              data: {

                companyId,

                name,

                phone,

                alternatePhone:
                  alternatePhone ||
                  null,

                email:
                  email ||

                  null,

                course,

                source:

                  "LEAD_STORE",

                stage:

                  "NEW",
                leadStatus:
                  "Fresh",

                temperature,

                campaign:

                  "Individual Lead",

                medium:

                  type,

                assignedToName:

                  effectiveAssignee?.name ||

                  null,

                followUpAt,

                notes:

                  [

                    notes,

                    sourceName

                      ? `Lead Store source: ${sourceName}`

                      : null,

                    `Lead Store type: ${

                      TYPE_LABELS[

                        type

                      ] ||

                      type

                    }`,

                    "Added individually from Lead Store",

                  ]

                    .filter(

                      Boolean

                    )

                    .join(

                      "\n"

                    ),

              },

            });



            if (remark) {
              await tx.leadRemark.create({
                data: {
                  companyId,
                  leadId: lead.id,
                  userId: req.clientUser.userId,
                  text: remark,
                },
              });
            }



            const valuesToCreate =

              preparedCustomFields.filter(

                (item) =>

                  item.value !== null &&

                  item.value !== ""

              );



            if (valuesToCreate.length) {

              await tx.customFieldValue.createMany({

                data: valuesToCreate.map((item) => ({

                  customFieldId: item.field.id,

                  leadId: lead.id,

                  value: item.value,

                })),

              });

            }



            return lead;

          }

        );



      return res

        .status(201)

        .json({

          success: true,

          message:

            "Lead added successfully",

          lead: {

            id:

              lead.id,

            name:

              lead.name,

            phone:
              lead.phone,

            alternatePhone:
              lead.alternatePhone,

            email:
              lead.email,

            course:

              lead.course,

            source:

              lead.source,

            stage:

              lead.stage,

            temperature:

              lead.temperature ||

              "WARM",
            leadStatus:
              leadStatusFor(lead),

            type:

              lead.medium ||

              "INDIVIDUAL",

            assignedToName:

              lead.assignedToName,

            createdAt:

              lead.createdAt,

          },

        });

    } catch (error) {

      console.error(

        "Failed to add individual Lead Store lead:",

        error

      );



      return res

        .status(500)

        .json({

          success: false,

          message:

            "Unable to add lead",

        });

    }

  }

);



/* =========================================================

   PREVIEW SPREADSHEET

========================================================= */



router.post(

  "/preview",

  leadFileUpload,

  async (

    req,

    res

  ) => {

    try {

      const parsed =

        await parseSpreadsheet(

          req.file

        );



      const validated =

        validateRows(

          parsed.rows

        );



      const duplicates =

        await getExistingDuplicateSets(

          req.clientUser.companyId,

          validated.valid

        );



      const existingDuplicateCount =

        validated.valid.filter(

          (row) =>

            duplicates.phones.has(

              row.phone

            ) ||

            (row.alternatePhone && duplicates.phones.has(row.alternatePhone)) ||

            (

              row.email &&

              duplicates.emails.has(

                row.email

              )

            )

        ).length;



      const importableCount =

        Math.max(

          validated.valid.length -

            existingDuplicateCount,

          0

        );



      return res.json({

        success:

          true,



        file: {

          name:

            req.file.originalname,

          size:

            req.file.size,

        },



        summary: {

          totalRows:

            parsed.rows.length,

          importableCount,

          invalidCount:

            validated.invalid.length,

          duplicateCount:

            validated.duplicateInFile +

            existingDuplicateCount,

        },



        sample:

          parsed.rows

            .slice(

              0,

              8

            )

            .map(

              (row) => ({

                rowNumber:

                  row.rowNumber,

                name:

                  row.name ||

                  "",

                phone:

                  row.phone ||

                  "",

                alternatePhone:

                  row.alternatePhone ||

                  "",

                email:

                  row.email ||

                  "",

                course:

                  row.course ||

                  "",

              })

            ),



        invalidSample:

          validated.invalid.slice(

            0,

            5

          ),

      });

    } catch (error) {

      console.error(

        "Lead Store preview failed:",

        error

      );



      return res

        .status(400)

        .json({

          success:

            false,

          message:

            error?.message ||

            "Unable to preview spreadsheet",

        });

    }

  }

);



/* =========================================================

   IMPORT SPREADSHEET

========================================================= */



router.post(

  "/import",

  leadFileUpload,

  async (

    req,

    res

  ) => {

    try {

      const companyId =

        req.clientUser.companyId;



      const name =

        String(

          req.body?.name ||

            ""

        ).trim();



      const type =

        String(

          req.body?.type ||

            ""

        )

          .trim()

          .toUpperCase();



      const sourceName =

        cleanString(

          req.body

            ?.sourceName

        );



      const notes =

        cleanString(

          req.body?.notes

        );



      const assignedToUserId =

        cleanString(

          req.body

            ?.assignedToUserId

        );



      if (!name) {

        return res

          .status(400)

          .json({

            success:

              false,

            message:

              "Dataset name is required",

          });

      }



      if (

        !VALID_DATASET_TYPES.includes(

          type

        )

      ) {

        return res

          .status(400)

          .json({

            success:

              false,

            message:

              "Invalid dataset type",

          });

      }



      const assignee =

        await getAssignee(

          companyId,

          assignedToUserId

        );



      if (

        assignedToUserId &&

        !assignee

      ) {

        return res

          .status(400)

          .json({

            success:

              false,

            message:

              "Selected assignee is invalid",

          });

      }



      const parsed =

        await parseSpreadsheet(

          req.file

        );



      const validated =

        validateRows(

          parsed.rows

        );



      const duplicates =

        await getExistingDuplicateSets(

          companyId,

          validated.valid

        );



      const importable = [];

      let existingDuplicateCount =

        0;



      for (

        const row of

        validated.valid

      ) {

        const duplicate =

          duplicates.phones.has(

            row.phone

          ) ||

          (row.alternatePhone && duplicates.phones.has(row.alternatePhone)) ||

          (

            row.email &&

            duplicates.emails.has(

              row.email

            )

          );



        if (duplicate) {

          existingDuplicateCount +=

            1;

          continue;

        }



        importable.push(

          row

        );

      }



      if (

        importable.length ===

        0

      ) {

        return res

          .status(400)

          .json({

            success:

              false,

            message:

              "No new valid leads were found to import",

          });

      }



      const duplicateCount =

        validated.duplicateInFile +

        existingDuplicateCount;



      const failedCount =

        validated.invalid.length;



      const dataset =

        await prisma.$transaction(

          async (

            tx

          ) => {

            await tx.leadSourceConfig.upsert({

              where: {

                companyId_key: {

                  companyId,

                  key:

                    "LEAD_STORE",

                },

              },



              update: {

                active:

                  true,

              },



              create: {

                companyId,

                key:

                  "LEAD_STORE",

                name:

                  "Lead Store",

                description:

                  "Leads imported from Lead Store datasets",

                active:

                  true,

                showInForms:

                  true,

                system:

                  true,

                sortOrder:

                  80,

              },

            });



            const createdDataset =

              await tx.leadDataset.create({

                data: {

                  companyId,

                  name,

                  type,

                  sourceName,

                  sourceFileName:

                    req.file.originalname,

                  leadCount:

                    importable.length,

                  importedCount:

                    importable.length,

                  duplicateCount,

                  failedCount,

                  assignedToUserId:

                    assignee?.id ||

                    null,

                  notes,

                  uploadedAt:

                    new Date(),

                },

              });



            await tx.lead.createMany({

              data:

                importable.map(

                  (row) => ({

                    companyId,

                    leadDatasetId:

                      createdDataset.id,

                    name:

                      row.name,

                    phone:

                      row.phone,

                    alternatePhone:
                      row.alternatePhone ||
                      null,

                    email:

                      row.email ||

                      null,

                    course:

                      row.course,

                    source:

                      "LEAD_STORE",

                    stage:

                      "NEW",
                    leadStatus:
                      "Fresh",

                    campaign:

                      name,

                    medium:

                      type,

                    assignedToName:

                      assignee?.name ||

                      null,

                    notes:

                      [

                        row.notes,

                        sourceName

                          ? `Lead Store source: ${sourceName}`

                          : null,

                        `Imported from ${req.file.originalname}`,

                      ]

                        .filter(

                          Boolean

                        )

                        .join(

                          "\n"

                        ) ||

                      null,

                  })

                ),

            });



            return createdDataset;

          }

        );



      const fullDataset =

        await prisma.leadDataset.findUnique({

          where: {

            id:

              dataset.id,

          },



          include: {

            assignedToUser: {

              select: {

                id:

                  true,

                name:

                  true,

                email:

                  true,

                role:

                  true,

              },

            },

          },

        });



      return res

        .status(201)

        .json({

          success:

            true,

          message:

            `${importable.length} leads imported successfully`,

          dataset:

            formatDataset(

              fullDataset,

              0

            ),

          importSummary: {

            imported:

              importable.length,

            duplicates:

              duplicateCount,

            failed:

              failedCount,

          },

        });

    } catch (error) {

      console.error(

        "Lead Store import failed:",

        error

      );



      return res

        .status(400)

        .json({

          success:

            false,

          message:

            error?.message ||

            "Unable to import Lead Store file",

        });

    }

  }

);



/* =========================================================

   UPDATE DATASET

========================================================= */



router.patch(

  "/:id",

  async (

    req,

    res

  ) => {

    try {

      const companyId =

        req.clientUser.companyId;



      const existing =

        await prisma.leadDataset.findFirst({

          where: {

            id:

              req.params.id,

            companyId,

          },

        });



      if (!existing) {

        return res

          .status(404)

          .json({

            success:

              false,

            message:

              "Dataset not found",

          });

      }

      if (!(await ensureDatasetInScope(req, res, existing))) return;



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

          return res

            .status(400)

            .json({

              success:

                false,

              message:

                "Dataset name cannot be empty",

            });

        }



        data.name =

          name;

      }



      if (

        req.body?.type !==

        undefined

      ) {

        const type =

          String(

            req.body.type ||

              ""

          )

            .trim()

            .toUpperCase();



        if (

          !VALID_DATASET_TYPES.includes(

            type

          )

        ) {

          return res

            .status(400)

            .json({

              success:

                false,

              message:

                "Invalid dataset type",

            });

        }



        data.type =

          type;

      }



      if (

        req.body

          ?.sourceName !==

        undefined

      ) {

        data.sourceName =

          cleanString(

            req.body

              .sourceName

          );

      }



      if (

        req.body?.notes !==

        undefined

      ) {

        data.notes =

          cleanString(

            req.body.notes

          );

      }



      let assignee =

        undefined;



      if (

        req.body

          ?.assignedToUserId !==

        undefined

      ) {

        const assignedToUserId =

          cleanString(

            req.body

              .assignedToUserId

          );



        assignee =

          await getAssignee(

            companyId,

            assignedToUserId

          );



        if (

          assignedToUserId &&

          !assignee

        ) {

          return res

            .status(400)

            .json({

              success:

                false,

              message:

                "Selected assignee is invalid",

            });

        }



        data.assignedToUserId =

          assignee?.id ||

          null;

      }



      await prisma.$transaction(

        async (

          tx

        ) => {

          await tx.leadDataset.update({

            where: {

              id:

                existing.id,

            },

            data,

          });



          if (

            assignee !==

            undefined

          ) {

            await tx.lead.updateMany({

              where: {

                companyId,

                leadDatasetId:

                  existing.id,

              },



              data: {

                assignedToName:

                  assignee?.name ||

                  null,

              },

            });

          }

        }

      );



      const updated =

        await prisma.leadDataset.findUnique({

          where: {

            id:

              existing.id,

          },



          include: {

            assignedToUser: {

              select: {

                id:

                  true,

                name:

                  true,

                email:

                  true,

                role:

                  true,

              },

            },

          },

        });



      const converted =

        await prisma.lead.count({

          where: {

            companyId,

            leadDatasetId:

              existing.id,

            stage:

              "ADMITTED",

          },

        });



      return res.json({

        success:

          true,

        message:

          "Dataset updated successfully",

        dataset:

          formatDataset(

            updated,

            converted

          ),

      });

    } catch (error) {

      console.error(

        "Failed to update Lead Store dataset:",

        error

      );



      return res

        .status(500)

        .json({

          success:

            false,

          message:

            "Unable to update dataset",

        });

    }

  }

);



/* =========================================================

   DELETE DATASET

   Imported CRM leads are preserved and detached.

========================================================= */



router.delete(

  "/:id",

  async (

    req,

    res

  ) => {

    try {

      const companyId =

        req.clientUser.companyId;



      const existing =

        await prisma.leadDataset.findFirst({

          where: {

            id:

              req.params.id,

            companyId,

          },

        });



      if (!existing) {

        return res

          .status(404)

          .json({

            success:

              false,

            message:

              "Dataset not found",

          });

      }

      if (!(await ensureDatasetInScope(req, res, existing))) return;



      await prisma.$transaction(

        async (

          tx

        ) => {

          await tx.lead.updateMany({

            where: {

              companyId,

              leadDatasetId:

                existing.id,

            },



            data: {

              leadDatasetId:

                null,

            },

          });



          await tx.leadDataset.delete({

            where: {

              id:

                existing.id,

            },

          });

        }

      );



      return res.json({

        success:

          true,

        message:

          "Dataset deleted. Imported CRM leads were preserved.",

      });

    } catch (error) {

      console.error(

        "Failed to delete Lead Store dataset:",

        error

      );



      return res

        .status(500)

        .json({

          success:

            false,

          message:

            "Unable to delete dataset",

        });

    }

  }

);



export default router;