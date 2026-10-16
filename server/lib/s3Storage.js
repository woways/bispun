import crypto from "crypto";
import { randomUUID } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/* ------------------------------------------------------------------ */
/*  Bispun S3 file storage                                            */
/*  One Bispun-owned private bucket (ap-south-1 / Mumbai).            */
/*  Files are namespaced per company via the object-key prefix.       */
/*  The bucket blocks all public access, so files are served through  */
/*  short-lived presigned GET URLs behind our own /api/files proxy.   */
/* ------------------------------------------------------------------ */

function s3Config() {
  const region = String(process.env.AWS_REGION || "ap-south-1").trim();
  const bucket = String(process.env.S3_BUCKET || "").trim();
  const accessKeyId = String(process.env.AWS_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.AWS_SECRET_ACCESS_KEY || "").trim();

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 file storage is not configured");
  }
  return { region, bucket, accessKeyId, secretAccessKey };
}

let cachedClient = null;
function getClient() {
  if (cachedClient) return cachedClient;
  const { region, accessKeyId, secretAccessKey } = s3Config();
  cachedClient = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

/* --- object-key helpers ------------------------------------------- */

function safeName(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

/** Build a unique, prefix-scoped object key, e.g.
 *  admissions/<companyId>/<partnerId>/<uuid>-report.pdf  */
export function buildObjectKey(prefixParts, originalName) {
  const parts = (Array.isArray(prefixParts) ? prefixParts : [prefixParts])
    .map((p) => String(p || "").replace(/[^a-zA-Z0-9._-]/g, "_"))
    .filter(Boolean);
  return `${parts.join("/")}/${randomUUID()}-${safeName(originalName)}`;
}

/* --- signed proxy token ------------------------------------------- */
/*  We store a stable, unguessable proxy URL in the DB. The proxy     */
/*  route verifies the HMAC and then mints a short presigned GET.     */

function signingSecret() {
  const secret = process.env.FILE_SIGNING_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("FILE_SIGNING_SECRET/JWT_SECRET is not configured");
  return secret;
}

function b64url(input) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function b64urlDecode(input) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(
    input.replace(/-/g, "+").replace(/_/g, "/") + pad,
    "base64"
  ).toString("utf8");
}

export function buildFileToken(key) {
  const payload = b64url(key);
  const mac = crypto
    .createHmac("sha256", signingSecret())
    .update(payload)
    .digest("hex")
    .slice(0, 32);
  return `${payload}.${mac}`;
}

export function verifyFileToken(token) {
  const [payload, mac] = String(token || "").split(".");
  if (!payload || !mac) return null;
  const expected = crypto
    .createHmac("sha256", signingSecret())
    .update(payload)
    .digest("hex")
    .slice(0, 32);
  // constant-time compare
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return b64urlDecode(payload);
  } catch {
    return null;
  }
}

function apiBase() {
  // Absolute base of the API so file links work cross-origin (Vercel → Render).
  return String(process.env.PUBLIC_API_URL || "").replace(/\/+$/, "");
}

/** Stable proxy URL stored in the DB `url` column. */
export function fileProxyUrl(key) {
  const token = buildFileToken(key);
  const base = apiBase();
  return `${base}/api/files/${token}`;
}

/* --- core operations ---------------------------------------------- */

export async function putObject({ buffer, key, contentType }) {
  const { bucket } = s3Config();
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    })
  );
  return key;
}

export async function deleteObjectByKey(key) {
  if (!key) return;
  const { bucket } = s3Config();
  await getClient().send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key })
  );
}

/** Short-lived presigned GET URL (default 5 min). */
export async function presignGet(key, expiresInSeconds = 300) {
  const { bucket } = s3Config();
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

/**
 * Scan the whole bucket and aggregate storage usage grouped by the first
 * path segment of each object key (= companyId).
 *
 * Optional date window filters by each object's upload time (LastModified):
 *   { from?: Date, to?: Date }  — only objects uploaded in [from, to] are counted.
 *
 * Returns:
 *   { totalBytes, totalObjects, byCompany: { [companyId]: { bytes, objects } } }
 */
export async function aggregateUsageByCompany({ from, to } = {}) {
  const { bucket } = s3Config();
  const client = getClient();

  const fromMs = from ? new Date(from).getTime() : null;
  const toMs = to ? new Date(to).getTime() : null;

  const byCompany = {};
  let totalBytes = 0;
  let totalObjects = 0;
  let ContinuationToken = undefined;

  do {
    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken,
        MaxKeys: 1000,
      })
    );

    for (const obj of out.Contents || []) {
      // Date-window filter on upload time.
      if (fromMs || toMs) {
        const t = obj.LastModified ? new Date(obj.LastModified).getTime() : 0;
        if (fromMs && t < fromMs) continue;
        if (toMs && t > toMs) continue;
      }

      const size = Number(obj.Size || 0);
      const companyId = String(obj.Key || "").split("/")[0] || "unknown";
      if (!byCompany[companyId]) byCompany[companyId] = { bytes: 0, objects: 0 };
      byCompany[companyId].bytes += size;
      byCompany[companyId].objects += 1;
      totalBytes += size;
      totalObjects += 1;
    }

    ContinuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (ContinuationToken);

  return { totalBytes, totalObjects, byCompany };
}
