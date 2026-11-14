import prisma from "./prisma.js";

// ---------------------------------------------------------------------------
// MSG91 transactional SMS service (DLT-approved templates).
//
// Config split:
//   - MSG91_AUTH_KEY stays in server env (it is a secret, never in the DB/UI).
//   - Template IDs, sender, hours and per-message toggles live in Super Admin
//     (systemSettings) so they can be changed without a redeploy.
//
// Every send is BEST-EFFORT and never throws: SMS must not block onboarding,
// ticket creation or any primary action. Failures are logged and swallowed.
// ---------------------------------------------------------------------------

const MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow/";
const SETTINGS_KEY = "global";

export async function getSmsConfig() {
  const authKey = String(process.env.MSG91_AUTH_KEY || "").trim();
  let settings = null;
  try {
    settings = await prisma.systemSettings.findUnique({
      where: { key: SETTINGS_KEY },
    });
  } catch (error) {
    console.error("getSmsConfig: unable to read systemSettings:", error.message);
    settings = null;
  }

  return {
    authKey,
    // Master switch: needs both a secret auth key AND the Super Admin toggle.
    enabled: Boolean(authKey) && Boolean(settings?.smsEnabled),
    senderId: settings?.smsSenderId || null,
    otpTemplateId:
      settings?.smsOtpTemplateId ||
      String(process.env.MSG91_OTP_TEMPLATE_ID || "").trim() ||
      null,
    welcomeTemplateId: settings?.smsWelcomeTemplateId || null,
    welcomeEnabled: settings?.smsWelcomeEnabled !== false,
    enquiryTemplateId: settings?.smsEnquiryTemplateId || null,
    enquiryEnabled: settings?.smsEnquiryEnabled !== false,
    enquiryHours: Number(settings?.smsEnquiryHours || 24) || 24,
  };
}

// Normalise an Indian mobile number to MSG91's 91XXXXXXXXXX form.
function normalizeMobile(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length > 10) return `91${d.slice(-10)}`;
  return null;
}

// Low-level send via MSG91 Flow API. `variables` keys must match the template's
// variable names (for these templates: `name` and `number`).
export async function sendTemplatedSms({ templateId, mobile, variables = {}, authKey }) {
  try {
    const key = authKey || String(process.env.MSG91_AUTH_KEY || "").trim();
    const to = normalizeMobile(mobile);

    if (!key || !templateId || !to) {
      return {
        ok: false,
        skipped: true,
        reason: "SMS not configured or recipient missing",
      };
    }

    const response = await fetch(MSG91_FLOW_URL, {
      method: "POST",
      headers: {
        authkey: key,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "0",
        recipients: [{ mobiles: to, ...variables }],
      }),
    });

    const body = await response.json().catch(() => ({}));
    const failed =
      !response.ok || String(body?.type || "").toLowerCase() === "error";

    if (failed) {
      console.error(
        "MSG91 SMS send failed:",
        body?.message || body?.error || `HTTP ${response.status}`
      );
      return { ok: false, error: body?.message || `HTTP ${response.status}` };
    }

    return { ok: true, data: body };
  } catch (error) {
    console.error("MSG91 SMS send error:", error.message);
    return { ok: false, error: error.message };
  }
}

// Welcome SMS — fired when a client account is onboarded/activated.
export async function sendWelcomeSms({ mobile, name }) {
  const cfg = await getSmsConfig();
  if (!cfg.enabled || !cfg.welcomeEnabled || !cfg.welcomeTemplateId) {
    return { ok: false, skipped: true };
  }
  return sendTemplatedSms({
    templateId: cfg.welcomeTemplateId,
    mobile,
    variables: { name: name || "there" },
    authKey: cfg.authKey,
  });
}

// Enquiry acknowledgement SMS — fired when a query/support request is submitted
// through the client portal Help & Support page.
export async function sendEnquiryAckSms({ mobile, name }) {
  const cfg = await getSmsConfig();
  if (!cfg.enabled || !cfg.enquiryEnabled || !cfg.enquiryTemplateId) {
    return { ok: false, skipped: true };
  }
  return sendTemplatedSms({
    templateId: cfg.enquiryTemplateId,
    mobile,
    variables: { name: name || "there", number: String(cfg.enquiryHours || 24) },
    authKey: cfg.authKey,
  });
}