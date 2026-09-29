import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireSuperAdmin } from "../middleware/adminAuth.js";
import { writeSuperAdminAudit } from "../lib/adminAuditLog.js";

const router = Router();

router.use(requireSuperAdmin);

const VALID_STATUSES = [
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
  "EXPIRED",
];

function formatBilling(
  company,
  subscription
) {
  if (!subscription) {
    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        status: company.status,
      },
      subscription: null,
    };
  }

  return {
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      status: company.status,
    },

    subscription: {
      id: subscription.id,
      status: subscription.status,
      billingCycle:
        "YEARLY",
      startDate:
        subscription.startDate,
      renewalDate:
        subscription.renewalDate,
      endDate:
        subscription.endDate,
      amount:
        subscription.amount
          ? Number(
              subscription.amount
            )
          : 0,

      // Discount breakdown for the subscription details view.
      listPrice:
        subscription.listPrice
          ? Number(
              subscription.listPrice
            )
          : subscription.plan?.yearlyPrice
          ? Number(
              subscription.plan.yearlyPrice
            )
          : 0,
      discountAmount:
        subscription.discountAmount
          ? Number(
              subscription.discountAmount
            )
          : 0,
      finalAmount:
        subscription.amount
          ? Number(
              subscription.amount
            )
          : 0,

      plan: {
        id:
          subscription.plan.id,
        key:
          subscription.plan.key,
        name:
          subscription.plan.name,
        yearlyPrice:
          subscription.plan
            .yearlyPrice
            ? Number(
                subscription.plan
                  .yearlyPrice
              )
            : null,
      },

      createdAt:
        subscription.createdAt,
      updatedAt:
        subscription.updatedAt,
    },
  };
}

async function getCompanyBilling(
  companyId
) {
  const company =
    await prisma.company.findUnique({
      where: {
        id: companyId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    });

  if (!company) {
    return null;
  }

  const subscription =
    await prisma.subscription.findFirst({
      where: {
        companyId,
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  return formatBilling(
    company,
    subscription
  );
}

async function getActor(req) {
  return prisma.user.findUnique({
    where: {
      id:
        req.admin.userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

router.get(
  "/:companyId",
  async (req, res) => {
    try {
      const result =
        await getCompanyBilling(
          req.params.companyId
        );

      if (!result) {
        return res.status(404).json({
          success: false,
          message:
            "Client not found",
        });
      }

      return res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(
        "Failed to fetch client billing:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to fetch client billing",
      });
    }
  }
);

router.patch(
  "/:companyId",
  async (req, res) => {
    try {
      const companyId =
        req.params.companyId;

      const company =
        await prisma.company.findUnique({
          where: {
            id: companyId,
          },
        });

      if (!company) {
        return res.status(404).json({
          success: false,
          message:
            "Client not found",
        });
      }

      const subscription =
        await prisma.subscription.findFirst({
          where: {
            companyId,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message:
            "No subscription found for this client",
        });
      }

      const data = {};

      if (
        req.body.status !==
        undefined
      ) {
        const status =
          String(
            req.body.status || ""
          )
            .trim()
            .toUpperCase();

        if (
          !VALID_STATUSES.includes(
            status
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid subscription status",
          });
        }

        data.status = status;
      }

      for (
        const field of [
          "renewalDate",
          "endDate",
        ]
      ) {
        if (
          req.body[field] !==
          undefined
        ) {
          if (!req.body[field]) {
            data[field] =
              null;
          } else {
            const parsed =
              new Date(
                req.body[field]
              );

            if (
              Number.isNaN(
                parsed.getTime()
              )
            ) {
              return res.status(400).json({
                success: false,
                message:
                  `Invalid ${field}`,
              });
            }

            data[field] =
              parsed;
          }
        }
      }

      const updated =
        await prisma.subscription.update({
          where: {
            id:
              subscription.id,
          },
          data,
        });

      const actor =
        await getActor(req);

      if (
        Object.keys(data)
          .length
      ) {
        await writeSuperAdminAudit({
          req,
          actor,
          action:
            "CLIENT_BILLING_UPDATED",
          entityType:
            "SUBSCRIPTION",
          entityId:
            updated.id,
          companyId:
            company.id,
          companyName:
            company.name,
          summary:
            `${actor?.name || "Super Admin"} updated subscription billing for ${company.name}.`,
          metadata: {
            changedFields:
              Object.keys(data),
            status:
              updated.status,
            renewalDate:
              updated.renewalDate,
            endDate:
              updated.endDate,
          },
        });
      }

      const result =
        await getCompanyBilling(
          companyId
        );

      return res.json({
        success: true,
        message:
          "Subscription billing updated successfully",
        ...result,
      });
    } catch (error) {
      console.error(
        "Failed to update client billing:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update client billing",
      });
    }
  }
);

export default router;