
import { Router } from "express";
import {
  verifyFileToken,
  presignGet,
  isS3Configured,
  readLocalObject,
} from "../lib/s3Storage.js";

/* ------------------------------------------------------------------ */
/*  Bispun CRM — Private file proxy                                    */
/*  Stable HMAC-signed links: /api/files/<token>                        */
/*  S3: redirects to a short-lived presigned download URL.             */
/*  Local files: permitted only in explicitly enabled development.     */
/* ------------------------------------------------------------------ */

const router = Router();

router.get("/:token", async (req, res) => {
  try {
    const key = verifyFileToken(req.params.token);

    if (!key) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // S3/R2 is not configured.
    if (!isS3Configured()) {
      // Never use temporary local storage in production.
      if (
        process.env.NODE_ENV === "production" ||
        process.env.ALLOW_LOCAL_FILE_STORAGE !== "true"
      ) {
        return res.status(503).json({
          success: false,
          message: "File storage is unavailable",
        });
      }

      // Explicitly enabled local development storage.
      try {
        const { buffer, contentType } = await readLocalObject(key);

        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "private, max-age=120");
        res.setHeader("X-Content-Type-Options", "nosniff");

        return res.send(buffer);
      } catch (err) {
        if (err?.code === "ENOENT") {
          return res.status(404).json({
            success: false,
            message: "File not found",
          });
        }

        throw err;
      }
    }

    // Existing production S3/R2 download behavior.
    const signedUrl = await presignGet(key, 300);

    res.setHeader("Cache-Control", "private, max-age=120");

    return res.redirect(302, signedUrl);
  } catch (error) {
    console.error("File proxy failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to serve file",
    });
  }
});

export default router;
