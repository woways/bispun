import { Router } from "express";
import { verifyFileToken, presignGet } from "../lib/s3Storage.js";

/* ------------------------------------------------------------------ */
/*  Public file proxy.                                                */
/*  The DB stores a stable, HMAC-signed link: /api/files/<token>.     */
/*  This route verifies the token, mints a short-lived presigned S3   */
/*  GET URL, and 302-redirects to it. The private bucket is never     */
/*  exposed directly, and links work cross-origin (img/src, anchors). */
/* ------------------------------------------------------------------ */

const router = Router();

router.get("/:token", async (req, res) => {
  try {
    const key = verifyFileToken(req.params.token);
    if (!key) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    const signedUrl = await presignGet(key, 300); // 5 minutes
    res.setHeader("Cache-Control", "private, max-age=120");
    return res.redirect(302, signedUrl);
  } catch (error) {
    console.error("File proxy failed:", error);
    return res.status(500).json({ success: false, message: "Unable to serve file" });
  }
});

export default router;
