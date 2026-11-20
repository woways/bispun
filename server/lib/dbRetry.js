// Shared transient-DB-error detection + retry helper.
//
// Serverless Postgres (Neon) autosuspends its compute; the first query after an
// idle period has to wake it, which can be slow or occasionally time out. These
// are transient connectivity failures, NOT authentication failures — we retry
// them briefly so a cold start does not surface as a hard login error, and map
// a persistent failure to a retry-friendly 503 instead of logging the user out.
//
// Auth/validation failures (bad/expired JWT, revoked session) are explicit
// responses, never thrown as DB errors, so isTransientDbError() returns false
// for them and they are never retried or masked.

const TRANSIENT_DB_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "EAI_AGAIN",
  "P1001", // can't reach database server
  "P1002", // database server reached but timed out
  "P1008", // operation timed out
  "P1017", // server closed the connection
  "P2024", // timed out fetching a connection from the pool
]);

export function isTransientDbError(error) {
  if (!error) return false;
  const code = error.code || error?.errorCode;
  if (code && TRANSIENT_DB_CODES.has(code)) return true;
  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("can't reach database") ||
    message.includes("connection terminated") ||
    message.includes("connection closed") ||
    message.includes("terminating connection")
  );
}

// Retry a DB operation on transient connectivity errors only. A warm database
// succeeds on the first attempt (no added latency); a cold start gets a couple
// of extra chances while the compute finishes waking. Non-transient errors
// (including auth/validation) are re-thrown immediately, never retried.
export async function withDbRetry(
  operation,
  { retries = 2, baseDelayMs = 600 } = {}
) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === retries) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * (attempt + 1))
      );
    }
  }
  throw lastError;
}
