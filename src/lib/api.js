import { Capacitor } from "@capacitor/core";

const configuredApiUrl = String(
  import.meta.env.VITE_API_URL || ""
).trim();

if (import.meta.env.PROD && !configuredApiUrl) {
  throw new Error("VITE_API_URL is required in production");
}

export const API_URL = (
  configuredApiUrl || "http://localhost:4000"
).replace(/\/+$/, "");

// --- Mobile (Capacitor) token auth ------------------------------------
// The web app authenticates with an httpOnly cookie and is UNCHANGED.
// A mobile WebView cannot keep a cross-origin cookie, so on native
// platforms we also store the JWT returned by /auth/login and send it
// in the Authorization header. On web, none of this runs.
const TOKEN_KEY = "cb_auth_token";
const isNative = Capacitor?.isNativePlatform?.() === true;

function getStoredToken() {
  if (!isNative) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token) {
  if (!isNative) return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

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

  const token = getStoredToken();

  const headers = {
    ...(options.body && !isFormDataBody
      ? { "Content-Type": "application/json" }
      : {}),
    // Mobile only: carry the JWT when the cookie can't travel.
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(
    `${API_URL}${normalizedPath}`,
    {
      ...options,

      // Authentication in this app is cookie based on web. Never let an
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

  // Mobile only: capture the token on login, drop it on logout or 401.
  if (isNative) {
    if (
      normalizedPath.endsWith("/auth/login") &&
      response.ok &&
      data?.token
    ) {
      setStoredToken(data.token);
    } else if (normalizedPath.endsWith("/auth/logout")) {
      setStoredToken(null);
    } else if (response.status === 401) {
      setStoredToken(null);
    }
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
