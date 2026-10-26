import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaPg({
  connectionString,
});

const baseClient = new PrismaClient({
  adapter,
});

// ADDITIVE, failure-isolated mobile-push hook.
// After any Notification is created, we also attempt a best-effort mobile push.
// The web/desktop CRM is unaffected: the original create result is returned
// unchanged, and push dispatch runs detached (never awaited by the caller) and
// can never throw into business logic. If firebase-admin or the DeviceToken
// table is absent, dispatch is simply a no-op.
const prisma = baseClient.$extends({
  query: {
    notification: {
      async create({ args, query }) {
        const result = await query(args);
        import("./pushDispatch.js")
          .then(({ dispatchNotificationPush }) =>
            dispatchNotificationPush(baseClient, result)
          )
          .catch(() => {});
        return result;
      },
    },
  },
});

export default prisma;