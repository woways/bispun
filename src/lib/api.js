const configuredApiUrl = String(
  import.meta.env.VITE_API_URL || ""
).trim();

if (import.meta.env.PROD && !configuredApiUrl) {
  throw new Error("VITE_API_URL is required in production");
}

export const API_URL = (
  configuredApiUrl || "http://localhost:4000"
).replace(/\/+$/, "");

export async function apiRequest(path, options = {}) {
  const normalizedPath = String(path).startsWith("/")
    ? String(path)
    : `/${path}`;

  const isAuthRequest =
    normalizedPath.startsWith("/api/client/auth/") ||
    normalizedPath.startsWith("/api/admin/auth/");

  const isFormDataBody =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  const headers = {
    ...(options.body && !isFormDataBody
      ? { "Content-Type": "application/json" }
      : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(
    `${API_URL}${normalizedPath}`,
    {
      ...options,

      // Authentication in this app is cookie based. Never let an
      // individual request accidentally disable cookie transmission.
      credentials: "include",

      // Avoid a mobile browser reusing a stale auth/session response.
      cache:
        options.cache ||
        (isAuthRequest ? "no-store" : "default"),

      headers,
    }
  );

  let data = null;

  const contentType =
    response.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { message: text } : null;
    }
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        `Request failed (${response.status})`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}