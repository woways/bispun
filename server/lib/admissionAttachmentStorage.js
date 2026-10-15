import {
  putObject,
  deleteObjectByKey,
  buildObjectKey,
  fileProxyUrl,
} from "./s3Storage.js";

/* ------------------------------------------------------------------ */
/*  Admission (college) attachments — stored in Bispun S3.            */
/*  Key prefix: admissions/<companyId>/<partnerId>/<uuid>-<name>      */
/*  Returns the same shape the routes already expect; `publicId`      */
/*  now holds the S3 object key, `url` a stable signed proxy link.    */
/* ------------------------------------------------------------------ */

export async function uploadAdmissionPartnerAttachment(file, companyId, partnerId) {
  const key = buildObjectKey(
    [companyId, "admissions", partnerId],
    file.originalname
  );

  await putObject({
    buffer: file.buffer,
    key,
    contentType: file.mimetype || "application/octet-stream",
  });

  return {
    url: fileProxyUrl(key),
    publicId: key,
    resourceType: "s3",
    fileName: file.originalname,
    mimeType: file.mimetype || "application/octet-stream",
    sizeBytes: Number(file.size || 0),
  };
}

export async function deleteAdmissionPartnerAttachment({ publicId }) {
  if (!publicId) return;
  await deleteObjectByKey(publicId);
}
