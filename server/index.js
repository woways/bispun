import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import prisma from "./lib/prisma.js";
import { loadServerConfig } from "./lib/env.js";
import {
  requestId,
  securityHeaders,
  requestLogger,
} from "./middleware/security.js";
import {
  createRateLimiter,
} from "./middleware/rateLimit.js";

import adminSystemSettingsRoutes from "./routes/adminSystemSettings.js";
import adminAuthRoutes from "./routes/adminAuth.js";
import adminClientsRoutes from "./routes/adminClients.js";
import adminSupportRoutes from "./routes/adminSupport.js";
import adminUsageRoutes from "./routes/adminUsage.js";
import adminBillingRoutes from "./routes/adminBilling.js";
import adminPlansRoutes from "./routes/adminPlans.js";
import adminModulesRoutes from "./routes/adminModules.js";
import adminGlobalUsageRoutes from "./routes/adminGlobalUsage.js";
import adminGlobalBillingRoutes from "./routes/adminGlobalBilling.js";
import adminAnalyticsRoutes from "./routes/adminAnalytics.js";
import adminPaymentsRoutes from "./routes/adminPayments.js";
import adminAuditLogsRoutes from "./routes/adminAuditLogs.js";
import adminWebsiteLeadsRoutes from "./routes/adminWebsiteLeads.js";
import adminReferralsRoutes from "./routes/adminReferrals.js";
import publicWebsiteLeadsRoutes from "./routes/publicWebsiteLeads.js";

import clientAuthRoutes from "./routes/clientAuth.js";
import clientLeadsRoutes from "./routes/clientLeads.js";
import clientAdmissionsRoutes from "./routes/clientAdmissions.js";
import clientRevenueRoutes from "./routes/clientRevenue.js";
import clientAnalyticsRoutes from "./routes/clientAnalytics.js";
import clientLeadStoreRoutes from "./routes/clientLeadStore.js";
import clientSupportRoutes from "./routes/clientSupport.js";
import clientNotificationsRoutes from "./routes/clientNotifications.js";
import clientBillingRoutes from "./routes/clientBilling.js";
import clientUsersRoutes from "./routes/clientUsers.js";
import clientLeadSourcesRoutes from "./routes/clientLeadSources.js";
import clientCustomFieldsRoutes from "./routes/clientCustomFields.js";
import clientSettingsRoutes from "./routes/clientSettings.js";
import clientAuditLogsRoutes from "./routes/clientAuditLogs.js";
import clientWalkinsRoutes from "./routes/clientWalkins.js";
import clientCounsellingRoutes from "./routes/clientCounselling.js";
import clientCalendarRoutes from "./routes/clientCalendar.js";
import clientGoogleRoutes from "./routes/clientGoogle.js";
import clientYearsRoutes from "./routes/clientYears.js";
import clientChatRoutes from "./routes/clientChat.js";

import razorpayWebhook from "./routes/razorpayWebhook.js";
import http from "http";
import { attachSocketServer } from "./socket.js";
import clientTargetsRoutes from "./routes/clientTargets.js";
import clientReferralsRoutes from "./routes/clientReferrals.js";
import clientStoreRoutes from "./routes/clientStore.js";

const config = loadServerConfig();

const app = express();

if (config.trustProxy) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.use(requestId);
app.use(securityHeaders);
app.use(requestLogger);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.clientOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  })
);

app.post(
  "/api/webhooks/razorpay",
  express.raw({
    type: "application/json",
    limit: "256kb",
  }),
  razorpayWebhook
);

app.use(express.json({ limit: "12mb" }));
app.use(
  express.urlencoded({
    extended: false,
    limit: "256kb",
  })
);
app.use(cookieParser());

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  keyPrefix: "api",
  message: "Too many requests. Please try again shortly.",
});

app.use("/api", apiLimiter);

app.get("/", (req, res) =>
  res.json({
    success: true,
    message: "Bispun API is running",
    requestId: req.requestId,
  })
);

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.json({
      success: true,
      database: "connected",
      message: "Bispun API and database are working",
      requestId: req.requestId,
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return res.status(503).json({
      success: false,
      database: "disconnected",
      message: "Database connection failed",
      requestId: req.requestId,
    });
  }
});

app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/clients", adminClientsRoutes);
app.use("/api/admin/support", adminSupportRoutes);
app.use("/api/admin/usage", adminUsageRoutes);
app.use("/api/admin/billing", adminBillingRoutes);
app.use("/api/admin/plans", adminPlansRoutes);
app.use("/api/admin/modules", adminModulesRoutes);
app.use("/api/admin/global-usage", adminGlobalUsageRoutes);
app.use("/api/admin/global-billing", adminGlobalBillingRoutes);
app.use("/api/admin/analytics", adminAnalyticsRoutes);
app.use("/api/admin/system-settings", adminSystemSettingsRoutes);
app.use("/api/admin/payments", adminPaymentsRoutes);
app.use("/api/admin/audit-logs", adminAuditLogsRoutes);
app.use("/api/admin/website-leads", adminWebsiteLeadsRoutes);
app.use("/api/admin/referrals", adminReferralsRoutes);

// Public marketing-site lead capture. This route is intentionally unauthenticated
// but remains protected by the global API rate limiter and CORS allow-list.
app.use("/api/public/website-leads", publicWebsiteLeadsRoutes);

app.use("/api/client/auth", clientAuthRoutes);
app.use("/api/client/leads", clientLeadsRoutes);
app.use("/api/client/admissions", clientAdmissionsRoutes);
app.use("/api/client/revenue", clientRevenueRoutes);
app.use("/api/client/analytics", clientAnalyticsRoutes);
app.use("/api/client/lead-store", clientLeadStoreRoutes);
app.use("/api/client/support", clientSupportRoutes);
app.use("/api/client/notifications", clientNotificationsRoutes);
app.use("/api/client/google", clientGoogleRoutes);
app.use("/api/client/billing", clientBillingRoutes);
app.use("/api/client/users", clientUsersRoutes);
app.use("/api/client/lead-sources", clientLeadSourcesRoutes);
app.use("/api/client/custom-fields", clientCustomFieldsRoutes);
app.use("/api/client/settings", clientSettingsRoutes);
app.use("/api/client/audit-logs", clientAuditLogsRoutes);
app.use("/api/client/walkins", clientWalkinsRoutes);
app.use("/api/client/counselling", clientCounsellingRoutes);
app.use("/api/client/calendar", clientCalendarRoutes);
app.use("/api/client/years", clientYearsRoutes);
app.use("/api/client/chat", clientChatRoutes);
app.use("/api/client/targets", clientTargetsRoutes);
app.use("/api/client/referrals", clientReferralsRoutes);
app.use("/api/client/store", clientStoreRoutes);

app.use((req, res) =>
  res.status(404).json({
    success: false,
    message: "API route not found",
    requestId: req.requestId,
  })
);

app.use((error, req, res, next) => {
  console.error("Unhandled request error:", {
    requestId: req.requestId,
    message: error?.message,
    stack: config.isProduction ? undefined : error?.stack,
  });

  if (res.headersSent) {
    return next(error);
  }

  const isCorsError = error?.message === "Origin not allowed by CORS";

  return res.status(isCorsError ? 403 : 500).json({
    success: false,
    message: isCorsError ? "Origin not allowed" : "Internal server error",
    requestId: req.requestId,
  });
});

const server = http.createServer(app);

// Attach Socket.IO for real-time chat (shares cookie-JWT auth).
const io = attachSocketServer(server, config);
app.set("io", io);

server.listen(config.port, () =>
  console.log(`Bispun API running on http://localhost:${config.port}`)
);

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  server.close(async () => {
    try {
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));