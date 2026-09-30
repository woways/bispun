import { Router } from "express";
import crypto from "crypto";

import prisma from "../lib/prisma.js";
import {
  requireClientUser,
  requireClientPermission,
} from "../middleware/clientAuth.js";
import { financeSectionAllowed } from "../lib/pageAccess.js";

const router = Router();

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


router.use(requireClientUser);

router.use(
  requireClientPermission(
    "canManageRevenue",
    "You do not have permission to access revenue"
  )
);

function monthKey(date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function monthLabel(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
  });
}

function expenseResponse(expense) {
  return {
    id: expense.id,
    title: expense.title,
    category: expense.category,
    description: expense.description,
    amount: Number(expense.amount),
    expenseDate: expense.expenseDate,
    submittedByName: expense.submittedByName,
    approvedByName: expense.approvedByName,
    paymentMode: expense.paymentMode,
    transactionRef: expense.transactionRef,
    vendorName: expense.vendorName,
    invoiceNumber: expense.invoiceNumber,
    receiptUrl: expense.receiptUrl,
    status: expense.status,
    createdAt: expense.createdAt,
  };
}


async function getActor(req) {
  return prisma.user.findFirst({
    where: {
      id: req.clientUser.userId,
      companyId: req.clientUser.companyId,
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });
}

function parseOptionalDate(value) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function incentiveResponse(incentive) {
  return {
    id: incentive.id,
    userId: incentive.userId,
    admissionId: incentive.admissionId,
    employeeName: incentive.employeeName,
    title: incentive.title,
    description: incentive.description,
    amount: Number(incentive.amount),
    incentiveDate: incentive.incentiveDate,
    status: incentive.status,
    approvedByName: incentive.approvedByName,
    paidDate: incentive.paidDate,
    createdAt: incentive.createdAt,

    admission: incentive.admission
      ? {
          id: incentive.admission.id,
          studentName:
            incentive.admission.studentName,
          college:
            incentive.admission.college,
        }
      : null,
  };
}

/* =========================================================
   GET REVENUE
========================================================= */

router.get("/", async (req, res) => {
  try {
    const companyId =
      req.clientUser.companyId;
    const selectedYear = parseYear(req.query.year);

    const [
      admissions,
      expenses,
      incentives,
    ] = await Promise.all([
      prisma.admission.findMany({
        where: {
          companyId,
          ...(selectedYear ? { admissionDate: yearRange(selectedYear) } : {}),

          status: {
            not: "CANCELLED",
          },
        },

        select: {
          totalFee: true,
          paidAmount: true,
          admissionDate: true,
          revenueStatus: true,
        },

        orderBy: {
          admissionDate: "asc",
        },
      }),

      prisma.expense.findMany({
        where: {
          companyId,
          ...(selectedYear ? { expenseDate: yearRange(selectedYear) } : {}),
        },

        orderBy: {
          expenseDate: "desc",
        },
      }),

      prisma.incentive.findMany({
        where: {
          companyId,
          ...(selectedYear ? { incentiveDate: yearRange(selectedYear) } : {}),
        },

        include: {
          admission: {
            select: {
              id: true,
              studentName: true,
              college: true,
            },
          },
        },

        orderBy: {
          incentiveDate: "desc",
        },
      }),
    ]);

    const potentialRevenue =
      admissions.reduce(
        (sum, admission) =>
          sum +
          Number(
            admission.totalFee || 0
          ),
        0
      );

    const receivedAmount =
      admissions.reduce(
        (sum, admission) =>
          sum +
          Number(
            admission.paidAmount || 0
          ),
        0
      );

    const pendingAmount =
      Math.max(
        potentialRevenue -
          receivedAmount,
        0
      );

    const inBucketRevenue =
      admissions
        .filter(
          (admission) =>
            admission.revenueStatus ===
            "IN_BUCKET"
        )
        .reduce(
          (sum, admission) =>
            sum +
            Number(
              admission.totalFee || 0
            ),
          0
        );

    const bufferRevenue =
      admissions
        .filter(
          (admission) =>
            admission.revenueStatus ===
            "BUFFER_ZONE"
        )
        .reduce(
          (sum, admission) =>
            sum +
            Number(
              admission.totalFee || 0
            ),
          0
        );

    const approvedExpenses =
      expenses
        .filter(
          (expense) =>
            expense.status ===
            "APPROVED"
        )
        .reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount || 0
            ),
          0
        );

    const totalIncentives =
      incentives
        .filter(
          (incentive) =>
            incentive.status ===
              "APPROVED" ||
            incentive.status ===
              "PAID"
        )
        .reduce(
          (sum, incentive) =>
            sum +
            Number(
              incentive.amount || 0
            ),
          0
        );

    const currentProfit =
      receivedAmount -
      approvedExpenses -
      totalIncentives;

    const now = new Date();

    const months = selectedYear
      ? Array.from({ length: 12 }, (_, month) => new Date(selectedYear, month, 1))
      : [];

    if (!selectedYear) {
      for (let offset = 7; offset >= 0; offset -= 1) {
        months.push(new Date(now.getFullYear(), now.getMonth() - offset, 1));
      }
    }

    const monthlyRevenue =
      months.map((month) => {
        const key =
          monthKey(month);

        const monthAdmissions =
          admissions.filter(
            (admission) =>
              monthKey(
                new Date(
                  admission.admissionDate
                )
              ) === key
          );

        const potential =
          monthAdmissions.reduce(
            (sum, admission) =>
              sum +
              Number(
                admission.totalFee ||
                  0
              ),
            0
          );

        const received =
          monthAdmissions.reduce(
            (sum, admission) =>
              sum +
              Number(
                admission.paidAmount ||
                  0
              ),
            0
          );

        return {
          key,
          m: monthLabel(month),
          potential,
          received,
        };
      });

    return res.json({
      success: true,

      summary: {
        potentialRevenue,
        inBucketRevenue,
        bufferRevenue,
        receivedAmount,
        pendingAmount,
        approvedExpenses,
        totalIncentives,
        currentProfit,
        totalAdmissions:
          admissions.length,
      },

      monthlyRevenue,

      // Section-level access: withhold the Expenses / Incentives payloads when
      // the viewer's finance access does not include those sections.
      expenses: financeSectionAllowed(
        req.clientUser.pageAccess,
        req.clientUser.role,
        "expenses"
      )
        ? expenses.map(expenseResponse)
        : [],

      incentives: financeSectionAllowed(
        req.clientUser.pageAccess,
        req.clientUser.role,
        "incentives"
      )
        ? incentives.map(incentiveResponse)
        : [],

      // Advertise which sections the viewer may open (drives the UI tabs).
      allowedSections: {
        overview: financeSectionAllowed(
          req.clientUser.pageAccess,
          req.clientUser.role,
          "overview"
        ),
        expenses: financeSectionAllowed(
          req.clientUser.pageAccess,
          req.clientUser.role,
          "expenses"
        ),
        incentives: financeSectionAllowed(
          req.clientUser.pageAccess,
          req.clientUser.role,
          "incentives"
        ),
      },
    });
  } catch (error) {
    console.error(
      "Failed to fetch revenue:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch revenue",
    });
  }
});

/* =========================================================
   UPLOAD EXPENSE PROOF
   Uses Cloudinary signed upload without additional npm packages.
========================================================= */

router.post(
  "/expenses/proof-upload",
  async (req, res) => {
    try {
      const {
        fileName,
        mimeType,
        fileSize,
        dataUrl,
      } = req.body || {};

      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ];

      if (
        !fileName ||
        !mimeType ||
        !dataUrl
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Proof file is required",
        });
      }

      if (
        !allowedTypes.includes(
          String(mimeType)
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Only JPG, PNG, WEBP and PDF files are allowed",
        });
      }

      const parsedSize =
        Number(fileSize || 0);

      if (
        !Number.isFinite(
          parsedSize
        ) ||
        parsedSize <= 0 ||
        parsedSize >
          8 * 1024 * 1024
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Proof file must be 8 MB or smaller",
        });
      }

      const cloudName =
        process.env
          .CLOUDINARY_CLOUD_NAME;

      const apiKey =
        process.env
          .CLOUDINARY_API_KEY;

      const apiSecret =
        process.env
          .CLOUDINARY_API_SECRET;

      if (
        !cloudName ||
        !apiKey ||
        !apiSecret
      ) {
        return res.status(503).json({
          success: false,
          message:
            "Expense proof storage is not configured. Add Cloudinary environment variables.",
        });
      }

      const timestamp =
        Math.floor(
          Date.now() / 1000
        );

      const folder =
        `consulbuzz/${req.clientUser.companyId}/expense-proofs`;

      const signatureBase =
        `folder=${folder}&timestamp=${timestamp}${apiSecret}`;

      const signature =
        crypto
          .createHash("sha1")
          .update(
            signatureBase
          )
          .digest("hex");

      const form =
        new FormData();

      form.append(
        "file",
        String(dataUrl)
      );

      form.append(
        "api_key",
        apiKey
      );

      form.append(
        "timestamp",
        String(timestamp)
      );

      form.append(
        "folder",
        folder
      );

      form.append(
        "signature",
        signature
      );

      const response =
        await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
          {
            method: "POST",
            body: form,
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result?.secure_url
      ) {
        console.error(
          "Cloudinary expense upload failed:",
          result
        );

        return res.status(502).json({
          success: false,
          message:
            result?.error?.message ||
            "Unable to upload proof document",
        });
      }

      return res.json({
        success: true,
        url:
          result.secure_url,
        publicId:
          result.public_id,
        fileName:
          String(fileName),
        mimeType:
          String(mimeType),
        bytes:
          Number(
            result.bytes ||
              parsedSize
          ),
      });
    } catch (error) {
      console.error(
        "Failed to upload expense proof:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to upload proof document",
      });
    }
  }
);

/* =========================================================
   CREATE EXPENSE
========================================================= */

router.post(
  "/expenses",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const {
        title,
        category,
        description,
        amount,
        expenseDate,
        paymentMode,
        transactionRef,
        vendorName,
        invoiceNumber,
        receiptUrl,
      } = req.body || {};

      const cleanTitle =
        String(
          title || ""
        ).trim();

      const cleanCategory =
        String(
          category || ""
        ).trim();

      const parsedAmount =
        Number(amount || 0);

      if (!cleanTitle) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Expense title is required",
          });
      }

      if (!cleanCategory) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Expense category is required",
          });
      }

      if (
        !Number.isFinite(
          parsedAmount
        ) ||
        parsedAmount <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Expense amount must be greater than zero",
          });
      }

      const actor =
        await getActor(req);

      if (!actor) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const parsedExpenseDate =
        parseOptionalDate(expenseDate);

      if (!parsedExpenseDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid expense date",
        });
      }

      if (receiptUrl) {
        try {
          const parsedReceiptUrl =
            new URL(
              String(
                receiptUrl
              )
            );

          if (
            ![
              "http:",
              "https:",
            ].includes(
              parsedReceiptUrl.protocol
            )
          ) {
            throw new Error(
              "Invalid protocol"
            );
          }
        } catch {
          return res.status(400).json({
            success: false,
            message:
              "Receipt / proof URL must be a valid http or https URL",
          });
        }
      }

      const expense =
        await prisma.expense.create({
          data: {
            companyId,

            title: cleanTitle,

            category:
              cleanCategory,

            description:
              description
                ? String(
                    description
                  ).trim()
                : null,

            amount:
              parsedAmount,

            expenseDate:
              parsedExpenseDate,

            submittedByName:
              actor.name,

            paymentMode:
              paymentMode
                ? String(
                    paymentMode
                  ).trim()
                : null,

            transactionRef:
              transactionRef
                ? String(
                    transactionRef
                  ).trim()
                : null,

            vendorName:
              vendorName
                ? String(
                    vendorName
                  ).trim()
                : null,

            invoiceNumber:
              invoiceNumber
                ? String(
                    invoiceNumber
                  ).trim()
                : null,

            receiptUrl:
              receiptUrl
                ? String(
                    receiptUrl
                  ).trim()
                : null,

            status: "PENDING",
          },
        });

      return res
        .status(201)
        .json({
          success: true,
          message:
            "Expense created successfully",
          expense:
            expenseResponse(
              expense
            ),
        });
    } catch (error) {
      console.error(
        "Failed to create expense:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to create expense",
        });
    }
  }
);

/* =========================================================
   EDIT EXPENSE
   Existing approval status is preserved; approved records can be corrected.
========================================================= */

router.patch(
  "/expenses/:id",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const expense =
        await prisma.expense.findFirst({
          where: {
            id: req.params.id,
            companyId,
          },
        });

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: "Expense not found",
        });
      }

      const {
        title,
        category,
        description,
        amount,
        expenseDate,
        paymentMode,
        transactionRef,
        vendorName,
        invoiceNumber,
        receiptUrl,
      } = req.body || {};

      const cleanTitle =
        String(title || "").trim();
      const cleanCategory =
        String(category || "").trim();
      const parsedAmount =
        Number(amount || 0);

      if (!cleanTitle) {
        return res.status(400).json({
          success: false,
          message: "Expense title is required",
        });
      }

      if (!cleanCategory) {
        return res.status(400).json({
          success: false,
          message: "Expense category is required",
        });
      }

      if (
        !Number.isFinite(parsedAmount) ||
        parsedAmount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Expense amount must be greater than zero",
        });
      }

      const parsedExpenseDate =
        parseOptionalDate(expenseDate);

      if (!parsedExpenseDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid expense date",
        });
      }

      if (receiptUrl) {
        try {
          const parsedReceiptUrl =
            new URL(String(receiptUrl));

          if (
            !["http:", "https:"].includes(
              parsedReceiptUrl.protocol
            )
          ) {
            throw new Error("Invalid protocol");
          }
        } catch {
          return res.status(400).json({
            success: false,
            message:
              "Receipt / proof URL must be a valid http or https URL",
          });
        }
      }

      const updated =
        await prisma.expense.update({
          where: {
            id: expense.id,
          },
          data: {
            title: cleanTitle,
            category: cleanCategory,
            description: description
              ? String(description).trim()
              : null,
            amount: parsedAmount,
            expenseDate: parsedExpenseDate,
            paymentMode: paymentMode
              ? String(paymentMode).trim()
              : null,
            transactionRef: transactionRef
              ? String(transactionRef).trim()
              : null,
            vendorName: vendorName
              ? String(vendorName).trim()
              : null,
            invoiceNumber: invoiceNumber
              ? String(invoiceNumber).trim()
              : null,
            receiptUrl: receiptUrl
              ? String(receiptUrl).trim()
              : null,
          },
        });

      return res.json({
        success: true,
        message: "Expense updated successfully",
        expense: expenseResponse(updated),
      });
    } catch (error) {
      console.error(
        "Failed to update expense:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to update expense",
      });
    }
  }
);

/* =========================================================
   DELETE EXPENSE
========================================================= */

router.delete(
  "/expenses/:id",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const expense =
        await prisma.expense.findFirst({
          where: {
            id: req.params.id,
            companyId,
          },
          select: {
            id: true,
            title: true,
          },
        });

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: "Expense not found",
        });
      }

      await prisma.expense.delete({
        where: {
          id: expense.id,
        },
      });

      return res.json({
        success: true,
        message: `${expense.title} deleted successfully`,
      });
    } catch (error) {
      console.error(
        "Failed to delete expense:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to delete expense",
      });
    }
  }
);

/* =========================================================
   UPDATE EXPENSE STATUS
========================================================= */

router.patch(
  "/expenses/:id/status",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      if (
        req.clientUser.role !==
        "CLIENT_ADMIN"
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              "Only Client Admin can approve or reject expenses",
          });
      }

      const status =
        String(
          req.body?.status || ""
        ).toUpperCase();

      if (
        ![
          "APPROVED",
          "REJECTED",
        ].includes(status)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid expense status",
          });
      }

      const expense =
        await prisma.expense.findFirst({
          where: {
            id: req.params.id,
            companyId,
          },
        });

      if (!expense) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Expense not found",
          });
      }

      const actor =
        await getActor(req);

      if (!actor) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const updated =
        await prisma.expense.update({
          where: {
            id: expense.id,
          },

          data: {
            status,

            approvedByName:
              actor.name,
          },
        });

      return res.json({
        success: true,
        message:
          "Expense status updated",
        expense:
          expenseResponse(
            updated
          ),
      });
    } catch (error) {
      console.error(
        "Failed to update expense:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to update expense",
        });
    }
  }
);

/* =========================================================
   CREATE INCENTIVE
========================================================= */

router.post(
  "/incentives",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const {
        employeeName,
        admissionId,
        title,
        description,
        amount,
        incentiveDate,
      } = req.body || {};

      const cleanEmployeeName =
        String(
          employeeName || ""
        ).trim();

      const parsedAmount =
        Number(amount || 0);

      if (!cleanEmployeeName) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Employee name is required",
          });
      }

      if (
        !Number.isFinite(
          parsedAmount
        ) ||
        parsedAmount <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Incentive amount must be greater than zero",
          });
      }

      let validAdmissionId =
        null;

      if (admissionId) {
        const admission =
          await prisma.admission.findFirst({
            where: {
              id: String(
                admissionId
              ),
              companyId,
            },
          });

        if (!admission) {
          return res
            .status(400)
            .json({
              success: false,
              message:
                "Invalid admission for this company",
            });
        }

        validAdmissionId =
          admission.id;
      }

      const parsedIncentiveDate =
        parseOptionalDate(incentiveDate);

      if (!parsedIncentiveDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid incentive date",
        });
      }

      const incentive =
        await prisma.incentive.create({
          data: {
            companyId,

            admissionId:
              validAdmissionId,

            employeeName:
              cleanEmployeeName,

            title: title
              ? String(
                  title
                ).trim()
              : null,

            description:
              description
                ? String(
                    description
                  ).trim()
                : null,

            amount:
              parsedAmount,

            incentiveDate:
              parsedIncentiveDate,

            status: "PENDING",
          },

          include: {
            admission: {
              select: {
                id: true,
                studentName: true,
                college: true,
              },
            },
          },
        });

      return res
        .status(201)
        .json({
          success: true,
          message:
            "Incentive created successfully",
          incentive:
            incentiveResponse(
              incentive
            ),
        });
    } catch (error) {
      console.error(
        "Failed to create incentive:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to create incentive",
        });
    }
  }
);

/* =========================================================
   EDIT INCENTIVE
   Existing approval/payment status is preserved.
========================================================= */

router.patch(
  "/incentives/:id",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const existing =
        await prisma.incentive.findFirst({
          where: {
            id: req.params.id,
            companyId,
          },
        });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Incentive not found",
        });
      }

      const {
        employeeName,
        admissionId,
        title,
        description,
        amount,
        incentiveDate,
      } = req.body || {};

      const cleanEmployeeName =
        String(employeeName || "").trim();
      const parsedAmount =
        Number(amount || 0);

      if (!cleanEmployeeName) {
        return res.status(400).json({
          success: false,
          message: "Employee name is required",
        });
      }

      if (
        !Number.isFinite(parsedAmount) ||
        parsedAmount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Incentive amount must be greater than zero",
        });
      }

      let validAdmissionId =
        existing.admissionId;

      if (admissionId !== undefined) {
        validAdmissionId = null;

        if (admissionId) {
          const admission =
            await prisma.admission.findFirst({
              where: {
                id: String(admissionId),
                companyId,
              },
              select: { id: true },
            });

          if (!admission) {
            return res.status(400).json({
              success: false,
              message:
                "Invalid admission for this company",
            });
          }

          validAdmissionId =
            admission.id;
        }
      }

      const parsedIncentiveDate =
        parseOptionalDate(incentiveDate);

      if (!parsedIncentiveDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid incentive date",
        });
      }

      const updated =
        await prisma.incentive.update({
          where: {
            id: existing.id,
          },
          data: {
            admissionId: validAdmissionId,
            employeeName: cleanEmployeeName,
            title: title
              ? String(title).trim()
              : null,
            description: description
              ? String(description).trim()
              : null,
            amount: parsedAmount,
            incentiveDate:
              parsedIncentiveDate,
          },
          include: {
            admission: {
              select: {
                id: true,
                studentName: true,
                college: true,
              },
            },
          },
        });

      return res.json({
        success: true,
        message: "Incentive updated successfully",
        incentive: incentiveResponse(updated),
      });
    } catch (error) {
      console.error(
        "Failed to update incentive:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to update incentive",
      });
    }
  }
);

/* =========================================================
   DELETE INCENTIVE
========================================================= */

router.delete(
  "/incentives/:id",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const incentive =
        await prisma.incentive.findFirst({
          where: {
            id: req.params.id,
            companyId,
          },
          select: {
            id: true,
            title: true,
            employeeName: true,
          },
        });

      if (!incentive) {
        return res.status(404).json({
          success: false,
          message: "Incentive not found",
        });
      }

      await prisma.incentive.delete({
        where: {
          id: incentive.id,
        },
      });

      return res.json({
        success: true,
        message: "Incentive deleted successfully",
      });
    } catch (error) {
      console.error(
        "Failed to delete incentive:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to delete incentive",
      });
    }
  }
);

/* =========================================================
   UPDATE INCENTIVE STATUS
========================================================= */

router.patch(
  "/incentives/:id/status",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      if (
        req.clientUser.role !==
        "CLIENT_ADMIN"
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              "Only Client Admin can update incentive status",
          });
      }

      const status =
        String(
          req.body?.status || ""
        ).toUpperCase();

      if (
        ![
          "APPROVED",
          "PAID",
          "REJECTED",
        ].includes(status)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid incentive status",
          });
      }

      const incentive =
        await prisma.incentive.findFirst({
          where: {
            id: req.params.id,
            companyId,
          },
        });

      if (!incentive) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Incentive not found",
          });
      }

      const actor =
        await getActor(req);

      if (!actor) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const updated =
        await prisma.incentive.update({
          where: {
            id: incentive.id,
          },

          data: {
            status,

            approvedByName:
              actor.name,

            paidDate:
              status === "PAID"
                ? incentive.paidDate ||
                  new Date()
                : null,
          },

          include: {
            admission: {
              select: {
                id: true,
                studentName: true,
                college: true,
              },
            },
          },
        });

      return res.json({
        success: true,
        message:
          "Incentive status updated",
        incentive:
          incentiveResponse(
            updated
          ),
      });
    } catch (error) {
      console.error(
        "Failed to update incentive:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to update incentive",
        });
    }
  }
);

export default router;