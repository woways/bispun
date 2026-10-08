import crypto from "crypto";

function cloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary file storage is not configured");
  }

  return { cloudName, apiKey, apiSecret };
}

function sign(params, secret) {
  const base = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto.createHash("sha1").update(`${base}${secret}`).digest("hex");
}

export async function uploadAdmissionPartnerAttachment(file, companyId, partnerId) {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `bispun/admissions/${companyId}/${partnerId}`;
  const signature = sign({ folder, timestamp }, apiSecret);

  const form = new FormData();
  form.append(
    "file",
    new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" }),
    file.originalname
  );
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    { method: "POST", body: form }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.secure_url || !data.public_id) {
    throw new Error(data?.error?.message || "Unable to store attachment");
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
    resourceType: data.resource_type || "raw",
    fileName: file.originalname,
    mimeType: file.mimetype || "application/octet-stream",
    sizeBytes: Number(file.size || data.bytes || 0),
  };
}

export async function deleteAdmissionPartnerAttachment({ publicId, resourceType }) {
  if (!publicId) return;

  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign({ public_id: publicId, timestamp }, apiSecret);

  const form = new FormData();
  form.append("public_id", publicId);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);

  const type = ["image", "video", "raw"].includes(resourceType)
    ? resourceType
    : "raw";

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${type}/destroy`,
    { method: "POST", body: form }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || "Unable to delete stored attachment");
  }
}