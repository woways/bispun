import prisma from "./prisma.js";
import { decryptToken, encryptToken } from "./google.js";

export const TELEPHONY_MODES = new Set(["DEVICE_DIAL", "BISPUN_MANAGED", "OWN_MSG91"]);

export function canManageTelephony(clientUser) {
  return clientUser?.role === "CLIENT_ADMIN" || clientUser?.permissions?.canManageSettings === true || clientUser?.canManageSettings === true;
}

export function maskSecret(value) {
  const secret = String(value || "");
  return secret ? `${"•".repeat(8)}${secret.slice(-4)}` : "";
}

export function normalizeTelephonyConfig(raw = {}) {
  const requestedMode = String(raw?.mode || "DEVICE_DIAL").toUpperCase();
  return {
    enabled: Boolean(raw?.enabled),
    mode: TELEPHONY_MODES.has(requestedMode) ? requestedMode : "DEVICE_DIAL",
    provider: "MSG91",
    callerId: String(raw?.callerId || "").replace(/[^0-9+]/g, "").slice(0, 20),
    encryptedAuthKey: String(raw?.encryptedAuthKey || ""),
    consentConfirmed: Boolean(raw?.consentConfirmed),
  };
}

export async function readTelephonyConfig(companyId, { includeSecret = false } = {}) {
  const settings = await prisma.companySettings.findUnique({ where: { companyId }, select: { organizationConfig: true } });
  const organizationConfig = settings?.organizationConfig && typeof settings.organizationConfig === "object" ? settings.organizationConfig : {};
  const config = normalizeTelephonyConfig(organizationConfig.telephony);
  const authKey = config.encryptedAuthKey ? decryptToken(config.encryptedAuthKey) || "" : "";
  return { ...config, hasAuthKey: Boolean(authKey), authKeyMasked: maskSecret(authKey), ...(includeSecret ? { authKey } : {}) };
}

export async function saveTelephonyConfig(companyId, input = {}) {
  const existing = await readTelephonyConfig(companyId, { includeSecret: true });
  const next = normalizeTelephonyConfig({ ...existing, ...input });
  const incomingAuthKey = String(input?.authKey || "").trim();
  const encryptedAuthKey = incomingAuthKey ? encryptToken(incomingAuthKey) : next.mode === "OWN_MSG91" ? existing.encryptedAuthKey : "";
  const settings = await prisma.companySettings.findUnique({ where: { companyId }, select: { organizationConfig: true } });
  const organizationConfig = settings?.organizationConfig && typeof settings.organizationConfig === "object" ? settings.organizationConfig : {};
  const stored = { ...next, encryptedAuthKey };
  await prisma.companySettings.upsert({
    where: { companyId },
    create: { companyId, organizationConfig: { ...organizationConfig, telephony: stored } },
    update: { organizationConfig: { ...organizationConfig, telephony: stored } },
  });
  return readTelephonyConfig(companyId);
}

export function resolveTelephonyRuntime(config) {
  const mode = config?.enabled ? config.mode : "DEVICE_DIAL";
  if (mode === "OWN_MSG91") {
    const outboundUrl = String(process.env.MSG91_VOICE_CLICK_TO_CALL_URL || "").trim();
    return { mode, provider: "MSG91", outboundUrl, apiKey: config.authKey || "", callerId: config.callerId || "", ready: Boolean(outboundUrl && config.authKey && config.callerId && config.consentConfirmed) };
  }
  if (mode === "BISPUN_MANAGED") {
    const outboundUrl = String(process.env.MSG91_VOICE_CLICK_TO_CALL_URL || process.env.TELEPHONY_OUTBOUND_URL || "").trim();
    const apiKey = String(process.env.MSG91_AUTH_KEY || process.env.TELEPHONY_API_KEY || "");
    const callerId = String(process.env.MSG91_CALLER_ID || "");
    return { mode, provider: String(process.env.TELEPHONY_PROVIDER || "MSG91"), outboundUrl, apiKey, callerId, ready: Boolean(outboundUrl && apiKey && callerId && config.consentConfirmed) };
  }
  return { mode: "DEVICE_DIAL", provider: "CRM Dial", outboundUrl: "", apiKey: "", callerId: "", ready: false };
}
