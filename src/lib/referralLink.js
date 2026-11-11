// Shared, framework-agnostic referral-link helpers.
//
// The signup base URL is configurable so the link is never hard-coded to
// production: callers pass VITE_PUBLIC_SIGNUP_URL (if set) and the current
// window origin. In Dev the origin fallback yields http://localhost:5173/signup;
// in production, https://bispun.com/signup (or the configured value).

export function buildReferralSignupUrl({ configuredBase, origin, code } = {}) {
  const base =
    String(configuredBase || "").trim() ||
    `${String(origin || "").replace(/\/+$/, "")}/signup`;
  const clean = base.replace(/\/+$/, "");
  const c = String(code || "").trim();
  if (!c) return clean;
  const sep = clean.includes("?") ? "&" : "?";
  return `${clean}${sep}ref=${encodeURIComponent(c)}`;
}

// Read a referral code from a URL query string (e.g. window.location.search).
// Only safe characters are kept; anything else yields "" (no attribution).
export function readRefFromSearch(search) {
  try {
    const raw = new URLSearchParams(String(search || "")).get("ref") || "";
    const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return cleaned.slice(0, 32);
  } catch {
    return "";
  }
}
