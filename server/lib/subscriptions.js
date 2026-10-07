import prisma from "./prisma.js";

export const SUBSCRIPTION_GRACE_DAYS = 7;
export const SUBSCRIPTION_RENEWAL_REMINDER_DAYS = [30, 7];

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getSubscriptionGraceEndsAt(renewalDate) {
  if (!renewalDate) return null;
  const date = new Date(renewalDate);
  if (Number.isNaN(date.getTime())) return null;
  return addDays(date, SUBSCRIPTION_GRACE_DAYS);
}

export function getSubscriptionLifecycleSnapshot(subscription, now = new Date()) {
  if (!subscription) {
    return {
      renewalMode: "MANUAL",
      status: null,
      renewalDate: null,
      graceEndsAt: null,
      renewalRequired: false,
      accessRestricted: false,
    };
  }

  const renewalDate = subscription.renewalDate
    ? new Date(subscription.renewalDate)
    : null;
  const graceEndsAt = getSubscriptionGraceEndsAt(renewalDate);

  let effectiveStatus = subscription.status;

  if (
    renewalDate &&
    !Number.isNaN(renewalDate.getTime()) &&
    !["CANCELLED", "EXPIRED"].includes(effectiveStatus)
  ) {
    if (graceEndsAt && now >= graceEndsAt) {
      effectiveStatus = "EXPIRED";
    } else if (now >= renewalDate && ["ACTIVE", "TRIAL"].includes(effectiveStatus)) {
      effectiveStatus = "PAST_DUE";
    }
  }

  return {
    renewalMode: "MANUAL",
    status: effectiveStatus,
    renewalDate,
    graceEndsAt,
    renewalRequired: ["PAST_DUE", "EXPIRED"].includes(effectiveStatus),
    accessRestricted: ["EXPIRED", "CANCELLED"].includes(effectiveStatus),
  };
}

export async function syncSubscriptionLifecycle(companyId) {
  if (!companyId) return getSubscriptionLifecycleSnapshot(null);

  const subscription = await prisma.subscription.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return getSubscriptionLifecycleSnapshot(null);
  }

  const snapshot = getSubscriptionLifecycleSnapshot(subscription);

  if (snapshot.status !== subscription.status) {
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: snapshot.status,
        ...(snapshot.status === "EXPIRED" && !subscription.endDate
          ? { endDate: snapshot.graceEndsAt || new Date() }
          : {}),
      },
    });

    return getSubscriptionLifecycleSnapshot(updated);
  }

  return snapshot;
}

export async function syncDueSubscriptionLifecycles() {
  const now = new Date();
  const graceCutoff = addDays(now, -SUBSCRIPTION_GRACE_DAYS);

  const expired = await prisma.subscription.updateMany({
    where: {
      renewalDate: { lte: graceCutoff },
      status: { in: ["ACTIVE", "TRIAL", "PAST_DUE"] },
    },
    data: { status: "EXPIRED", endDate: now },
  });

  const pastDue = await prisma.subscription.updateMany({
    where: {
      renewalDate: { gt: graceCutoff, lte: now },
      status: { in: ["ACTIVE", "TRIAL"] },
    },
    data: { status: "PAST_DUE" },
  });

  return {
    expired: expired.count,
    pastDue: pastDue.count,
  };
}

function addBillingPeriod(date) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + 1);
  return next;
}

export async function finalizeCapturedPayment({
  transactionId,
  providerPaymentId,
}) {
  const existing =
    await prisma.paymentTransaction.findUnique({
      where: {
        id:
          transactionId,
      },
      include: {
        plan: {
          include: {
            planModules: {
              include: {
                module: {
                  select: {
                    id: true,
                    active: true,
                  },
                },
              },
            },
          },
        },
      },
    });

  if (!existing) {
    throw new Error(
      "Payment transaction not found"
    );
  }

  if (
    existing.status ===
    "CAPTURED"
  ) {
    return existing;
  }

  return prisma.$transaction(
    async (tx) => {
      const currentSubscription =
        await tx.subscription.findFirst({
          where: {
            companyId:
              existing.companyId,
          },
          orderBy: {
            createdAt:
              "desc",
          },
        });

      const now =
        new Date();

      const samePlan =
        currentSubscription?.planId ===
          existing.planId &&
        currentSubscription
          ?.billingCycle ===
          existing.billingCycle;

      const renewalBase =
        samePlan &&
        currentSubscription
          ?.renewalDate &&
        new Date(
          currentSubscription
            .renewalDate
        ) > now
          ? new Date(
              currentSubscription
                .renewalDate
            )
          : now;

      const renewalDate =
        addBillingPeriod(renewalBase);

      let subscription;

      if (
        currentSubscription
      ) {
        subscription =
          await tx.subscription.update({
            where: {
              id:
                currentSubscription.id,
            },
            data: {
              planId:
                existing.planId,
              status:
                "ACTIVE",
              billingCycle:
                existing.billingCycle,
              listPrice:
                existing.listPrice,
              discountAmount:
                existing.discountAmount,
              amount:
                existing.amount,
              startDate:
                samePlan
                  ? currentSubscription.startDate
                  : now,
              renewalDate,
              endDate:
                null,
            },
          });
      } else {
        subscription =
          await tx.subscription.create({
            data: {
              companyId:
                existing.companyId,
              planId:
                existing.planId,
              status:
                "ACTIVE",
              billingCycle:
                existing.billingCycle,
              listPrice:
                existing.listPrice,
              discountAmount:
                existing.discountAmount,
              amount:
                existing.amount,
              startDate:
                now,
              renewalDate,
            },
          });
      }

      if (
        !samePlan
      ) {
        const allModules =
          await tx.module.findMany({
            select: {
              id: true,
              active: true,
            },
          });

        const planModuleIds =
          new Set(
            existing.plan.planModules
              .filter(
                (item) =>
                  item.module
                    .active
              )
              .map(
                (item) =>
                  item.moduleId
              )
          );

        for (
          const crmModule of
            allModules
        ) {
          const enabled =
            crmModule.active &&
            planModuleIds.has(
              crmModule.id
            );

          await tx.companyModule.upsert({
            where: {
              companyId_moduleId: {
                companyId:
                  existing.companyId,
                moduleId:
                  crmModule.id,
              },
            },
            update: {
              enabled,
            },
            create: {
              companyId:
                existing.companyId,
              moduleId:
                crmModule.id,
              enabled,
            },
          });
        }
      }

      const company =
        await tx.company.findUnique({
          where: {
            id: existing.companyId,
          },
          select: {
            status: true,
          },
        });

      // Successful renewal reactivates the subscription, but must never undo a
      // deliberate Super Admin suspension/inactive state.
      if (
        company &&
        !["SUSPENDED", "INACTIVE"].includes(
          company.status
        )
      ) {
        await tx.company.update({
          where: {
            id: existing.companyId,
          },
          data: {
            status: "ACTIVE",
          },
        });
      }

      const payment =
        await tx.paymentTransaction.update({
          where: {
            id:
              existing.id,
          },
          data: {
            status:
              "CAPTURED",
            providerPaymentId,
            subscriptionId:
              subscription.id,
            paidAt:
              now,
            failureCode:
              null,
            failureReason:
              null,
          },
        });

      await tx.notification.create({
        data: {
          companyId:
            existing.companyId,
          userId:
            existing.initiatedByUserId,
          title:
            "Subscription payment successful",
          message:
            `${existing.plan.name} ${existing.billingCycle.toLowerCase()} subscription payment of ₹${Number(existing.amount).toLocaleString("en-IN")} was successful.`,
          type:
            "BILLING",
          actionModule:
            "settings",
          actionLabel:
            "View subscription",
        },
      });

      return payment;
    }
  );
}

export async function markPaymentFailed({
  providerOrderId,
  providerPaymentId = null,
  failureCode = null,
  failureReason = null,
}) {
  const payment =
    await prisma.paymentTransaction.findUnique({
      where: {
        providerOrderId,
      },
    });

  if (!payment) {
    return null;
  }

  if (
    payment.status ===
    "CAPTURED"
  ) {
    return payment;
  }

  const updated =
    await prisma.paymentTransaction.update({
      where: {
        id:
          payment.id,
      },
      data: {
        status:
          "FAILED",
        providerPaymentId:
          providerPaymentId ||
          payment.providerPaymentId,
        failureCode,
        failureReason,
      },
    });

  await prisma.notification.create({
    data: {
      companyId:
        payment.companyId,
      userId:
        payment.initiatedByUserId,
      title:
        "Subscription payment failed",
      message:
        failureReason
          ? `Subscription payment failed: ${failureReason}`
          : "Subscription payment failed. Please try again.",
      type:
        "BILLING",
      actionModule:
        "settings",
      actionLabel:
        "Review billing",
    },
  }).catch(() => {});

  return updated;
}