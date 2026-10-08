// Client-side GST invoice generator (no server/PDF service needed).
// Used by the client portal receipt and the public /pay page so the invoice
// looks identical however the payment was made.
import { jsPDF } from "jspdf";

function inr(n) {
  const v = Number(n || 0);
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

/**
 * Build and download a PDF invoice from a receipt object
 * (the shape returned by /api/client/billing/receipts and /api/public/pay).
 */
export function downloadInvoicePdf(receipt) {
  if (!receipt) return;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const left = 48;
  const right = pageW - 48;
  let y = 56;

  const company = receipt.company || {};
  const plan = receipt.plan || {};

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(79, 70, 229); // indigo
  doc.text("Bispun", left, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text("Tax Invoice", right, y - 12, { align: "right" });
  doc.setFontSize(9);
  doc.text(`Invoice No: ${receipt.receiptNumber || receipt.id || ""}`, right, y + 2, { align: "right" });
  doc.text(`Date: ${fmtDate(receipt.paidAt || receipt.createdAt)}`, right, y + 15, { align: "right" });

  y += 34;
  doc.setDrawColor(226);
  doc.line(left, y, right, y);
  y += 24;

  // Billed to
  doc.setTextColor(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Billed to", left, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(70);
  y += 15;
  doc.text(company.brandName || company.name || "", left, y);
  if (company.city) { y += 13; doc.text(String(company.city), left, y); }
  if (company.email) { y += 13; doc.text(String(company.email), left, y); }
  if (company.phone) { y += 13; doc.text(String(company.phone), left, y); }

  y += 30;

  // Line item table header
  doc.setFillColor(243, 244, 246);
  doc.rect(left, y, right - left, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(55);
  doc.setFontSize(10);
  doc.text("Description", left + 10, y + 16);
  doc.text("Amount", right - 10, y + 16, { align: "right" });
  y += 24;

  const row = (label, value, opts = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setTextColor(opts.muted ? 120 : 40);
    doc.setFontSize(opts.bold ? 11 : 10);
    y += opts.gap || 20;
    doc.text(label, left + 10, y);
    doc.text(value, right - 10, y, { align: "right" });
  };

  row(`${plan.name || "Subscription"} (Annual)`, inr(receipt.listPrice));
  if (Number(receipt.discountAmount) > 0) row("Discount", "- " + inr(receipt.discountAmount));
  row("Subtotal", inr(receipt.subtotal));
  if (Number(receipt.gstAmount) > 0) row(`GST (${receipt.gstRate}%)`, inr(receipt.gstAmount));

  y += 10;
  doc.setDrawColor(226);
  doc.line(left + 10, y, right - 10, y);
  row("Total paid", inr(receipt.finalAmount != null ? receipt.finalAmount : receipt.amount), { bold: true, gap: 22 });

  y += 34;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  if (receipt.providerPaymentId) { doc.text(`Payment ID: ${receipt.providerPaymentId}`, left, y); y += 13; }
  if (receipt.providerOrderId) { doc.text(`Order ID: ${receipt.providerOrderId}`, left, y); y += 13; }
  doc.text(`Status: ${receipt.status || "PAID"}`, left, y); y += 13;
  doc.text("Paid via Razorpay. This is a system-generated invoice.", left, y);

  const name = `Bispun-Invoice-${receipt.receiptNumber || receipt.id || "payment"}.pdf`;
  doc.save(name);
}

/**
 * Build and download a PROFORMA invoice (pre-payment quote) from plain data.
 * This is NOT a tax invoice — it is generated before payment so a manually
 * onboarded client can verify their details and the amount payable.
 *
 * data: {
 *   number?, date?,                         // optional; defaults generated
 *   company: { name, brandName, city, email, phone },
 *   admin:   { name, email },
 *   plan:    { name },
 *   listPrice, discountAmount, subtotal, gstRate, gstAmount, finalAmount
 * }
 */
export function downloadProformaPdf(data) {
  if (!data) return;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const left = 48;
  const right = pageW - 48;
  let y = 56;

  const company = data.company || {};
  const admin = data.admin || {};
  const plan = data.plan || {};
  const number = data.number || `PI-${Date.now()}`;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(79, 70, 229);
  doc.text("Bispun", left, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text("Proforma Invoice", right, y - 12, { align: "right" });
  doc.setFontSize(9);
  doc.text(`Proforma No: ${number}`, right, y + 2, { align: "right" });
  doc.text(`Date: ${fmtDate(data.date || new Date())}`, right, y + 15, { align: "right" });

  y += 34;
  doc.setDrawColor(226);
  doc.line(left, y, right, y);
  y += 24;

  // Prepared for
  doc.setTextColor(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Prepared for", left, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(70);
  y += 15;
  doc.text(company.brandName || company.name || "", left, y);
  if (company.name && company.brandName && company.name !== company.brandName) {
    y += 13; doc.text(String(company.name), left, y);
  }
  if (company.city) { y += 13; doc.text(String(company.city), left, y); }
  if (company.email) { y += 13; doc.text(String(company.email), left, y); }
  if (company.phone) { y += 13; doc.text(String(company.phone), left, y); }
  if (admin.name || admin.email) {
    y += 13;
    doc.setTextColor(120);
    doc.text(`Admin: ${[admin.name, admin.email].filter(Boolean).join(" · ")}`, left, y);
    doc.setTextColor(70);
  }

  y += 30;

  // Line item table
  doc.setFillColor(243, 244, 246);
  doc.rect(left, y, right - left, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(55);
  doc.setFontSize(10);
  doc.text("Description", left + 10, y + 16);
  doc.text("Amount", right - 10, y + 16, { align: "right" });
  y += 24;

  const row = (label, value, opts = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setTextColor(opts.muted ? 120 : 40);
    doc.setFontSize(opts.bold ? 11 : 10);
    y += opts.gap || 20;
    doc.text(label, left + 10, y);
    doc.text(value, right - 10, y, { align: "right" });
  };

  row(`${plan.name || "Subscription"} (Annual)`, inr(data.listPrice));
  if (Number(data.discountAmount) > 0) row("Discount", "- " + inr(data.discountAmount));
  row("Subtotal", inr(data.subtotal));
  if (Number(data.gstAmount) > 0) row(`GST (${data.gstRate}%)`, inr(data.gstAmount));

  y += 10;
  doc.setDrawColor(226);
  doc.line(left + 10, y, right - 10, y);
  row("Total payable", inr(data.finalAmount), { bold: true, gap: 22 });

  y += 34;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Status: Awaiting payment", left, y); y += 13;
  doc.text("This is a proforma invoice (a quotation), not a tax invoice.", left, y); y += 12;
  doc.text("A tax invoice will be issued automatically once payment is completed.", left, y);

  doc.save(`Bispun-Proforma-${number}.pdf`);
}