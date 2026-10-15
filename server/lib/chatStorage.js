import {
  putObject,
  deleteObjectByKey,
  buildObjectKey,
  fileProxyUrl,
} from "./s3Storage.js";

/* ------------------------------------------------------------------ */
/*  Chat attachments — stored in Bispun S3.                           */
/*  Key prefix: chat/<companyId>/<uuid>-<name>                        */
/* ------------------------------------------------------------------ */

export async function uploadChatFile(file, companyId) {
  const key = buildObjectKey([companyId, "chat"], file.originalname);

  await putObject({
    buffer: file.buffer,
    key,
    contentType: file.mimetype || "application/octet-stream",
  });

  return {
    url: fileProxyUrl(key),
    publicId: key,
    resourceType: "s3",
    originalName: file.originalname,
    mimeType: file.mimetype || "application/octet-stream",
    sizeBytes: Number(file.size || 0),
  };
}

export async function deleteChatFile({ publicId }) {
  if (!publicId) return;
  await deleteObjectByKey(publicId);
}
