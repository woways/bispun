// Shared helper: read a JWT from the "Authorization: Bearer <token>" header.
// The web app authenticates with an httpOnly cookie. A mobile (Capacitor)
// WebView cannot keep a cross-origin cookie, so the mobile app sends the
// same JWT in the Authorization header instead. Middleware accepts either.
export function getBearerToken(req) {
  const header =
    req?.headers?.authorization || req?.headers?.Authorization || "";
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    return token || null;
  }
  return null;
}
