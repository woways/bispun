import crypto from "crypto";

import prisma from "../lib/prisma.js";
import {
  finalizeCapturedPayment,
  markPaymentFailed,
} from "../lib/subscriptions.js";
import { finalizeSelfServeSignup } from "../lib/selfServeOnboard.js";

function safeEqualHex(a, b) {
  try {
    const aBuffer =
      Buffer.from(a, "hex");
    const bBuffer =
      Buffer.from(b, "hex");

    return (
      aBuffer.length ===
        bBuffer.length &&
      crypto.timingSafeEqual(
        aBuffer,
        bBuffer
      )
    );
  } catch {
    return false;
  }
}

export default async function razorpayWebhook(
  req,
  res
) {
  try {
    const secret =
      process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      console.error(
        "RAZORPAY_WEBHOOK_SECRET is not configured"
      );

      return res.status(500).send(
        "Webhook secret is not configured"
      );
    }

    const signature =
      String(
        req.headers[
          "x-razorpay-signature"
        ] || ""
      );

    const rawBody =
      Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(
            req.body || ""
          );

    const expected =
      crypto
        .createHmac(
          "sha256",
          secret
        )
        .update(rawBody)
        .digest("hex");

    if (
      !signature ||
      !safeEqualHex(
        expected,
        signature
      )
    ) {
      return res.status(400).send(
        "Invalid webhook signature"
      );
    }

    const event =
      JSON.parse(
        rawBody.toString("utf8")
      );

    const eventName =
      event.event;

    const payment =
      event.payload?.payment
        ?.entity;

    if (
      eventName ===
        "payment.captured" &&
      payment?.order_id
    ) {
      const transaction =
        await prisma.paymentTransaction.findUnique({
          where: {
            providerOrderId:
              payment.order_id,
          },
        });

      if (
        transaction &&
        transaction.status !==
          "CAPTURED"
      ) {
        await finalizeCapturedPayment({
          transactionId:
            transaction.id,
          providerPaymentId:
            payment.id,
        });
      } else if (!transaction) {
        // No PaymentTransaction yet => this may be a self-serve signup whose
        // account is created only on capture. Finalise it from the holding row.
        const pending =
          await prisma.pendingSignup.findUnique({
            where: {
              providerOrderId:
                payment.order_id,
            },
          });

        if (
          pending &&
          pending.status === "PENDING"
        ) {
          await finalizeSelfServeSignup(
            pending,
            payment.id
          );
        }
      }
    }

    if (
      eventName ===
        "payment.failed" &&
      payment?.order_id
    ) {
      await markPaymentFailed({
        providerOrderId:
          payment.order_id,
        providerPaymentId:
          payment.id || null,
        failureCode:
          payment.error_code ||
          null,
        failureReason:
          payment.error_description ||
          payment.error_reason ||
          null,
      });
    }

    return res.status(200).json({
      received: true,
    });
  } catch (error) {
    console.error(
      "Razorpay webhook failed:",
      error
    );

    return res.status(500).json({
      received: false,
    });
  }
}