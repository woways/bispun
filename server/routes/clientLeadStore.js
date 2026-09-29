import {

  Router,

} from "express";

import multer from "multer";

import ExcelJS from "exceljs";



import prisma from "../lib/prisma.js";

import {

  requireClientUser,

  requireClientPermission,

} from "../middleware/clientAuth.js";



const router =

  Router();



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



const VALID_TYPES =

  Object.keys(

    TYPE_LABELS

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

      file.buffer

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



    const emailKey =

      row.email ||

      null;



    if (

      seenPhones.has(

        row.phone

      ) ||

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

          .map(

            (row) =>

              row.phone

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

    OR.push({

      phone: {

        in:

          phones,

      },

    });

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

        email:

          true,

      },

    });



  return {

    phones:

      new Set(

        existing

          .map(

            (lead) =>

              normalizePhone(

                lead.phone

              )

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

      const where = {

        companyId,

        ...(selectedYear ? { createdAt: yearRange(selectedYear) } : {}),

      };



      if (

        type &&

        VALID_TYPES.includes(

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

      const search = String(req.query.search || "").trim();



      const where = {

        companyId,

        source: "LEAD_STORE",

        campaign: "Individual Lead",

        ...(selectedYear ? { createdAt: yearRange(selectedYear) } : {}),

      };



      if (search) {

        where.OR = [

          { name: { contains: search, mode: "insensitive" } },

          { phone: { contains: search, mode: "insensitive" } },

          { email: { contains: search, mode: "insensitive" } },

          { course: { contains: search, mode: "insensitive" } },

          { assignedToName: { contains: search, mode: "insensitive" } },

        ];

      }



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

        },

        orderBy: { createdAt: "desc" },

      });



      return res.json({

        success: true,

        leads: leads.map((lead) => ({

          id: lead.id,

          name: lead.name,

          phone: lead.phone,

          email: lead.email,

          course: lead.course,

          source: lead.source,

          stage: lead.stage,

          type: lead.medium,

          assignedToName: lead.assignedToName,

          createdAt: lead.createdAt,

          sourceName: (lead.notes || "")

            .split("\n")

            .find((line) => line.startsWith("Lead Store source: "))

            ?.replace("Lead Store source: ", "") || "",

          notes: (lead.notes || "")

            .split("\n")

            .filter((line) =>

              !line.startsWith("Lead Store source: ") &&

              !line.startsWith("Lead Store type: ") &&

              line !== "Added individually from Lead Store"

            )

            .join("\n"),

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

          campaign: "Individual Lead",

        },

      });



      if (!existing) {

        return res.status(404).json({ success: false, message: "Lead not found" });

      }



      const name = String(req.body?.name || "").trim();

      const rawPhone = String(req.body?.phone ?? "").trim();
      const phone = normalizeManualLeadPhone(rawPhone);

      const email = normalizeEmail(req.body?.email);

      const course = cleanString(req.body?.course);

      const type = String(req.body?.type || existing.medium || "EXTERNAL_DATA").trim().toUpperCase();

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

      if (!VALID_TYPES.includes(type)) return res.status(400).json({ success: false, message: "Invalid lead type" });



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

            ...(email ? [{ email }] : []),

          ],

        },

        select: { id: true, phone: true, email: true },

      });



      if (duplicate) {

        return res.status(409).json({

          success: false,

          duplicate: true,

          message: `A lead already exists with this ${duplicate.phone === phone ? "phone number" : "email address"}`,

        });

      }



      const updated = await prisma.$transaction(async (tx) => {

        const lead = await tx.lead.update({

          where: { id: leadId },

          data: {

            name,

            phone,

            email: email || null,

            course,

            medium: type,

            assignedToName: assignee?.name || null,

            notes: [

              notes,

              sourceName ? `Lead Store source: ${sourceName}` : null,

              `Lead Store type: ${TYPE_LABELS[type] || type}`,

              "Added individually from Lead Store",

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



      return res.json({ success: true, message: "Lead updated successfully", lead: updated });

    } catch (error) {

      console.error("Failed to update individual Lead Store lead:", error);

      return res.status(500).json({ success: false, message: "Unable to update lead" });

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

          campaign: "Individual Lead",

        },

        select: { id: true, name: true },

      });



      if (!lead) {

        return res.status(404).json({ success: false, message: "Lead not found" });

      }



      await prisma.lead.delete({ where: { id: leadId } });



      return res.json({ success: true, message: "Lead deleted successfully", lead });

    } catch (error) {

      console.error("Failed to delete individual Lead Store lead:", error);

      return res.status(500).json({ success: false, message: "Unable to delete lead" });

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



      const email =

        normalizeEmail(

          req.body?.email

        );



      const course =

        cleanString(

          req.body?.course

        );



      const type =

        String(

          req.body?.type ||

            "EXTERNAL_DATA"

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

      ];



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

                duplicate.phone ===

                phone

                  ? "phone number"

                  : "email address"

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

                email:

                  email ||

                  null,

                course,

                source:

                  "LEAD_STORE",

                stage:

                  "NEW",

                campaign:

                  "Individual Lead",

                medium:

                  type,

                assignedToName:

                  assignee?.name ||

                  null,

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

            email:

              lead.email,

            course:

              lead.course,

            source:

              lead.source,

            stage:

              lead.stage,

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

  upload.single(

    "file"

  ),

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

  upload.single(

    "file"

  ),

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

        !VALID_TYPES.includes(

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

                    email:

                      row.email ||

                      null,

                    course:

                      row.course,

                    source:

                      "LEAD_STORE",

                    stage:

                      "NEW",

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

          !VALID_TYPES.includes(

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