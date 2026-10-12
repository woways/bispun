// WhatsApp Cloud API (Meta) helpers.
//
// Model A: each client company connects their OWN WhatsApp Business number via
// Meta Embedded Signup. Bispun acts only as the Tech Provider app — it never
// sends on its own number and never pays Meta. The client's own WABA is billed
// by Meta directly.
//
// Required env (create a Meta Developer App first, then fill these):
//   META_APP_ID                 Facebook/Meta app id (also used on the frontend)
//   META_APP_SECRET             app secret (server only)
//   META_CONFIG_ID              Embedded Signup configuration id
//   META_GRAPH_VERSION          e.g. v21.0 (optional; defaults below)
//   META_WEBHOOK_VERIFY_TOKEN   any random string; must match the value set in
//                               the Meta app's webhook config
//
// Access tokens are encrypted with the same AES-256-GCM scheme as Google tokens.
import { encryptToken, decryptToken } from "./google.js";

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function isWhatsAppConfigured() {
  return Boolean(
    process.env.META_APP_ID &&
      process.env.META_APP_SECRET &&
      process.env.META_CONFIG_ID
  );
}

// Public config the frontend needs to launch Embedded Signup.
export function publicWhatsAppConfig() {
  return {
    appId: process.env.META_APP_ID || "",
    configId: process.env.META_CONFIG_ID || "",
    graphVersion: GRAPH_VERSION,
  };
}

export { encryptToken, decryptToken };

async function graphGet(path, params) {
  const url = new URL(`${GRAPH}/${path}`);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { method: "GET" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Graph GET ${path} failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function graphPost(path, body, token) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Graph POST ${path} failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Exchange the Embedded Signup `code` for a business access token.
 * Returns the access_token string.
 */
export async function exchangeCodeForToken(code) {
  const data = await graphGet("oauth/access_token", {
    client_id: process.env.META_APP_ID,
    client_secret: process.env.META_APP_SECRET,
    code,
  });
  if (!data.access_token) throw new Error("No access token returned by Meta");
  return data.access_token;
}

/** Subscribe the app to the client's WABA so webhooks are delivered. */
export async function subscribeAppToWaba(wabaId, token) {
  return graphPost(`${wabaId}/subscribed_apps`, {}, token);
}

/** Look up the phone numbers on a WABA (to confirm id + display number). */
export async function getWabaPhoneNumbers(wabaId, token) {
  const data = await graphGet(`${wabaId}/phone_numbers`, {
    access_token: token,
    fields: "id,display_phone_number,verified_name",
  });
  return data.data || [];
}

/**
 * Send a pre-approved template message.
 * `to` is an E.164 number without '+', e.g. 919812345678.
 */
export async function sendTemplateMessage({
  phoneNumberId,
  token,
  to,
  templateName,
  languageCode = "en_US",
  components = [],
}) {
  return graphPost(
    `${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length ? { components } : {}),
      },
    },
    token
  );
}

/**
 * Send a plain text message (only valid inside the 24h customer-service window;
 * used later by the inbox phase). Kept here so routes can reuse it.
 */
export async function sendTextMessage({ phoneNumberId, token, to, body }) {
  return graphPost(
    `${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: String(body || "") },
    },
    token
  );
}
