// Native mobile actions: open the phone dialer, WhatsApp, or SMS composer.
// These use plain URI / deep links, so they need NO extra Capacitor plugin.
// They work both in a normal browser and inside the Capacitor Android app.
// The user always stays in control (nothing is sent/dialed automatically).

// Keep only digits. Strips spaces, dashes, brackets, leading + or 0.
function digitsOnly(phone) {
  return String(phone || "").replace(/\D/g, "").replace(/^0+/, "");
}

// Number for wa.me: country code + number, NO plus sign.
// Indian 10-digit numbers get a 91 prefix. Numbers that already include
// a country code (more than 10 digits) are left as-is.
function toWhatsAppNumber(phone) {
  const d = digitsOnly(phone);
  if (d.length === 10) return `91${d}`;
  return d;
}

// Number for tel:/sms: keep a leading + when a country code is present.
function toDialNumber(phone) {
  const d = digitsOnly(phone);
  if (d.length === 10) return `+91${d}`;
  return `+${d}`;
}

// Opens an external URL so the Android OS can hand it to the right app
// (WhatsApp, dialer, SMS). Falls back to same-window navigation.
function openExternal(url) {
  const opened = window.open(url, "_blank");
  if (!opened) window.location.href = url;
}

// 1) CALL — opens the native phone dialer with the number prefilled.
//    The user taps the green call button themselves.
export function openDialer(phone) {
  const num = toDialNumber(phone);
  if (!num || num === "+") return;
  window.location.href = `tel:${num}`;
}

// 2) WHATSAPP — opens WhatsApp on the correct chat, with an optional message.
export function openWhatsApp(phone, message = "") {
  const num = toWhatsAppNumber(phone);
  if (!num) return;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  openExternal(`https://wa.me/${num}${text}`);
}

// 3) SMS — opens the native SMS composer with recipient (+ optional text).
//    The user taps send themselves.
export function openSMS(phone, message = "") {
  const num = toDialNumber(phone);
  if (!num || num === "+") return;
  const body = message ? `?body=${encodeURIComponent(message)}` : "";
  window.location.href = `sms:${num}${body}`;
}
