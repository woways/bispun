// Super-Admin review of account deletion requests. Read + status transitions
// only (no destructive deletion here — that is a separate, policy-gated action).
// Restricted to authenticated Super Admins (requireSuperAdmin).
import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireSuperAdmin } from "../middleware/adminAuth.js";
import { normalizeDeletionStatus } from "../lib/accountDeletion.js";

const router = Router();
router.use(requireSuperAdmin);

// List requests (optionally filtered by status). Guarded for pre-migration.
router.get("/", async (req, res) => {
  try {
    if (!prisma.accountDeletionRequest?.findMany) {
      return res.json({ success: true, requests: [], note: "deletion store not provisioned yet" });
    }
    const status = req.query.status ? normalizeDeletionStatus(req.query.status) : null;
    const requests = await prisma.accountDeletionRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return res.json({ success: true, requests });
  } catch (error) {
    console.error("List deletion requests failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load deletion requests" });
  }
});

// Transition a request's status (PENDING -> VERIFIED/PROCESSED/REJECTED) and
// record who handled it. Does NOT delete any user/company data.
router.patch("/:id", async (req, res) => {
  try {
    if (!prisma.accountDeletionRequest?.update) {
      return res.status(503).json({ success: false, message: "deletion store not provisioned yet" });
    }
    const status = normalizeDeletionStatus(req.body?.status);
    const updated = await prisma.accountDeletionRequest.update({
      where: { id: req.params.id },
      data: {
        status,
        handledByUserId: req.admin?.id || null,
        handledAt: new Date(),
        adminRemarks: String(req.body?.remarks || "").trim().slice(0, 2000) || null,
        ...(status === "VERIFIED" ? { verifiedAt: new Date() } : {}),
      },
    });
    return res.json({ success: true, request: updated });
  } catch (error) {
    console.error("Update deletion request failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update the request" });
  }
});

export default router;
