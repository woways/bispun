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
  const left = 46;
  const right = pageW - 46;
  const contentW = right - left;
  const company = receipt.company || {};
  const plan = receipt.plan || {};

  const paidAmount = Number(receipt.finalAmount ?? receipt.amount ?? 0);
  const listPrice = Number(receipt.listPrice ?? receipt.subtotal ?? receipt.amount ?? 0);
  const discount = Number(receipt.discountAmount || 0);
  const subtotal = Number(receipt.subtotal ?? Math.max(0, listPrice - discount));
  const gst = Number(receipt.gstAmount || 0);
  const gstRate = Number(receipt.gstRate ?? (gst > 0 ? 18 : 0));
  const invoiceNo = receipt.receiptNumber || receipt.id || "";
  const paidDate = fmtDate(receipt.paidAt || receipt.createdAt);

  const label = (text, x, y) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(text, x, y);
  };

  const value = (text, x, y, options = {}) => {
    doc.setFont("helvetica", options.bold === false ? "normal" : "bold");
    doc.setFontSize(options.size || 10);
    doc.setTextColor(...(options.color || [30, 41, 59]));
    doc.text(String(text || "—"), x, y, options.textOptions || {});
  };

  // Header: brand left, document title centered, payment meta right.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.setTextColor(16, 24, 40);
  doc.text("BISPUN", left, 50);
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("CRM SUBSCRIPTION", left, 67);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("TAX INVOICE", pageW / 2, 58, { align: "center" });

  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(right - 67, 34, 67, 25, 12, 12, "FD");
  doc.setTextColor(4, 120, 87);
  doc.setFontSize(8.5);
  doc.text("PAID", right - 33.5, 50, { align: "center" });

  label("INVOICE NO.", right - 185, 83);
  value(invoiceNo, right, 98, {
    size: 8.5,
    textOptions: { align: "right", maxWidth: 185 },
  });
  label("PAYMENT DATE", right - 185, 118);
  value(paidDate, right, 133, {
    size: 8.5,
    textOptions: { align: "right", maxWidth: 185 },
  });

  doc.setDrawColor(241, 245, 249);
  doc.line(left, 154, right, 154);

  // Client / subscription summary
  const col2 = left + contentW * 0.55;
  label("BILLED TO", left, 188);
  label("SUBSCRIPTION", col2, 188);
  value(company.brandName || company.name || "Client", left, 210, { size: 11 });
  value(`${plan.name || "Bispun"} Plan`, col2, 210, { size: 11 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.7);
  doc.setTextColor(100, 116, 139);
  let by = 227;
  if (company.email) { doc.text(String(company.email), left, by); by += 14; }
  const contact = [company.phone, company.city].filter(Boolean).join(" · ");
  if (contact) doc.text(contact, left, by);
  doc.text("Annual Billing", col2, 227);
  if (receipt.subscription?.renewalDate) {
    doc.text(`Renews ${fmtDate(receipt.subscription.renewalDate).split(",")[0]}`, col2, 241);
  }

  // Payment summary — one clean amount hierarchy, no duplicate description amount.
  let y = 276;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(left, y, contentW, discount > 0 ? 187 : 164, 9, 9, "FD");
  label("PAYMENT SUMMARY", left + 15, y + 21);
  y += 48;

  const summaryRow = (name, amount, opts = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.bold ? 10.5 : 9.2);
    doc.setTextColor(...(opts.color || [100, 116, 139]));
    doc.text(name, left + 15, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(opts.valueColor || [51, 65, 85]));
    doc.text(amount, right - 15, y, { align: "right" });
    y += opts.gap || 24;
  };

  summaryRow("Plan price", inr(listPrice));
  if (discount > 0) {
    summaryRow("Discount", `- ${inr(discount)}`, { valueColor: [225, 29, 72] });
  }
  summaryRow("Subtotal", inr(subtotal));
  summaryRow(`GST (${gstRate}%)`, inr(gst));
  doc.setDrawColor(226, 232, 240);
  doc.line(left + 15, y - 8, right - 15, y - 8);
  summaryRow("Total Paid", inr(paidAmount), {
    bold: true,
    color: [15, 23, 42],
    valueColor: [15, 23, 42],
    gap: 18,
  });

  // Compact payment reference
  const refY = discount > 0 ? 500 : 478;
  label("PAYMENT REFERENCE", left, refY);
  const third = contentW / 3;
  const refField = (x, title, text) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(title, x, refY + 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.3);
    doc.setTextColor(51, 65, 85);
    doc.text(String(text || "—"), x, refY + 36, { maxWidth: third - 18 });
  };
  refField(left, "Method", "Razorpay");
  refField(left + third, "Payment ID", receipt.providerPaymentId || "—");
  refField(left + third * 2, "Order ID", receipt.providerOrderId || "—");

  doc.setDrawColor(241, 245, 249);
  doc.line(left, 590, right, 590);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Thank you for choosing Bispun.", left, 612);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("WOWAYS PRIVATE LIMITED", right, 612, { align: "right" });

  doc.save(`Bispun-Invoice-${invoiceNo || "payment"}.pdf`);
}

/**
 * Build and download a payment receipt. Invoices and receipts are intentionally
 * separate documents: the invoice shows the tax breakdown, while this confirms
 * the money received and the Razorpay reference.
 */
export function downloadPaymentReceiptPdf(receipt) {
  if (!receipt) return;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const left = 46;
  const right = pageW - 46;
  const contentW = right - left;
  const company = receipt.company || {};
  const plan = receipt.plan || {};
  const paidAmount = Number(receipt.finalAmount ?? receipt.amount ?? 0);
  const listPrice = Number(receipt.listPrice ?? receipt.subtotal ?? receipt.amount ?? 0);
  const discount = Number(receipt.discountAmount || 0);
  const subtotal = Number(receipt.subtotal ?? Math.max(0, listPrice - discount));
  const gst = Number(receipt.gstAmount || 0);
  const gstRate = Number(receipt.gstRate ?? (gst > 0 ? 18 : 0));
  const receiptNo = receipt.receiptNumber || receipt.id || "";

  const label = (text, x, y) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(text, x, y);
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.setTextColor(16, 24, 40);
  doc.text("BISPUN", left, 50);
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("CRM SUBSCRIPTION", left, 67);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("PAYMENT RECEIPT", pageW / 2, 58, { align: "center" });

  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(right - 67, 34, 67, 25, 12, 12, "FD");
  doc.setTextColor(4, 120, 87);
  doc.setFontSize(8.5);
  doc.text("PAID", right - 33.5, 50, { align: "center" });

  label("RECEIPT NO.", right - 185, 83);
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(receiptNo, right, 98, { align: "right", maxWidth: 185 });
  label("PAYMENT DATE", right - 185, 118);
  doc.setTextColor(51, 65, 85);
  doc.text(fmtDate(receipt.paidAt || receipt.createdAt), right, 133, { align: "right", maxWidth: 185 });

  doc.setDrawColor(241, 245, 249);
  doc.line(left, 154, right, 154);

  const col2 = left + contentW * 0.55;
  label("RECEIVED FROM", left, 188);
  label("SUBSCRIPTION", col2, 188);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(company.brandName || company.name || "Client", left, 210);
  doc.text(`${plan.name || "Bispun"} Plan`, col2, 210);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.7);
  doc.setTextColor(100, 116, 139);
  if (company.email) doc.text(String(company.email), left, 228);
  const contact = [company.phone, company.city].filter(Boolean).join(" · ");
  if (contact) doc.text(contact, left, 242);
  doc.text("Annual Billing", col2, 228);

  let y = 278;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(left, y, contentW, discount > 0 ? 187 : 164, 9, 9, "FD");
  label("PAYMENT SUMMARY", left + 15, y + 21);
  y += 48;

  const row = (name, amount, opts = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.bold ? 10.5 : 9.2);
    doc.setTextColor(...(opts.color || [100, 116, 139]));
    doc.text(name, left + 15, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(opts.valueColor || [51, 65, 85]));
    doc.text(amount, right - 15, y, { align: "right" });
    y += 24;
  };

  row("Plan price", inr(listPrice));
  if (discount > 0) row("Discount", `- ${inr(discount)}`, { valueColor: [225, 29, 72] });
  row("Subtotal", inr(subtotal));
  row(`GST (${gstRate}%)`, inr(gst));
  doc.setDrawColor(226, 232, 240);
  doc.line(left + 15, y - 8, right - 15, y - 8);
  row("Total Paid", inr(paidAmount), { bold: true, color: [15, 23, 42], valueColor: [15, 23, 42] });

  const refY = discount > 0 ? 500 : 478;
  label("PAYMENT REFERENCE", left, refY);
  const third = contentW / 3;
  const ref = (x, title, text) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(title, x, refY + 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.3);
    doc.setTextColor(51, 65, 85);
    doc.text(String(text || "—"), x, refY + 36, { maxWidth: third - 18 });
  };
  ref(left, "Method", "Razorpay");
  ref(left + third, "Payment ID", receipt.providerPaymentId || "—");
  ref(left + third * 2, "Order ID", receipt.providerOrderId || "—");

  doc.setDrawColor(241, 245, 249);
  doc.line(left, 590, right, 590);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("This receipt confirms successful payment for your Bispun subscription.", left, 612);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("WOWAYS PRIVATE LIMITED", right, 612, { align: "right" });

  doc.save(`Bispun-Receipt-${receiptNo || "payment"}.pdf`);
}

/**
 * Build and download a client onboarding PROFORMA / confirmation PDF.
 * This is generated before payment so the client can verify the company,
 * administrator and subscription details. The temporary password is NEVER
 * included in the PDF.
 *
 * data: {
 *   number?, date?, paymentLink?, billingCycle?, referralCode?,
 *   company: { name, brandName, business, ownerName, city, email, phone,
 *              subdomain, primaryColor },
 *   admin:   { name, email },
 *   plan:    { name },
 *   listPrice, discountAmount, subtotal, gstRate, gstAmount, finalAmount
 * }
 */
export function downloadProformaPdf(data) {
  if (!data) return;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 48;
  const right = pageW - 48;
  const contentW = right - left;
  let y = 56;

  const company = data.company || {};
  const admin = data.admin || {};
  const plan = data.plan || {};
  const number = data.number || `PI-${Date.now()}`;

  const safe = (value) => {
    const text = String(value ?? "").trim();
    return text || "—";
  };

  const ensureSpace = (height = 70) => {
    if (y + height < pageH - 54) return;
    doc.addPage();
    y = 54;
  };

  const sectionTitle = (title) => {
    ensureSpace(42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.text(title, left, y);
    y += 11;
    doc.setDrawColor(226);
    doc.line(left, y, right, y);
    y += 16;
  };

  const detailRow = (label, value) => {
    ensureSpace(28);
    const labelW = 126;
    const text = safe(value);
    const lines = doc.splitTextToSize(text, contentW - labelW - 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(label, left, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(45);
    doc.text(lines, left + labelW, y);
    y += Math.max(15, lines.length * 12 + 3);
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(79, 70, 229);
  doc.text("Bispun", left, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text("Client Onboarding Proforma", right, y - 12, { align: "right" });
  doc.setFontSize(9);
  doc.text(`Proforma No: ${number}`, right, y + 2, { align: "right" });
  doc.text(`Date: ${fmtDate(data.date || new Date())}`, right, y + 15, { align: "right" });

  y += 34;
  doc.setDrawColor(226);
  doc.line(left, y, right, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    "Please verify the details below before payment. The final tax invoice is issued only after successful payment.",
    left,
    y
  );
  y += 26;

  sectionTitle("Company details");
  detailRow("Company name", company.name);
  detailRow("Portal / brand", company.brandName || company.name);
  detailRow("Business type", company.business);
  detailRow("Owner / founder", company.ownerName);
  detailRow("Company email", company.email);
  detailRow("Phone", company.phone);
  detailRow("City", company.city);
  detailRow("Subdomain", company.subdomain);
  detailRow("Brand color", company.primaryColor);

  y += 4;
  sectionTitle("First client admin");
  detailRow("Admin name", admin.name);
  detailRow("Admin email", admin.email);
  if (data.referralCode) detailRow("Referral code", data.referralCode);
  detailRow("Password", "Not shown for security");

  y += 4;
  sectionTitle("Subscription & payment");
  detailRow("Plan", plan.name);
  detailRow("Billing cycle", data.billingCycle || "Annual");

  ensureSpace(170);
  doc.setFillColor(243, 244, 246);
  doc.rect(left, y, contentW, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(55);
  doc.setFontSize(10);
  doc.text("Description", left + 10, y + 16);
  doc.text("Amount", right - 10, y + 16, { align: "right" });
  y += 24;

  const priceRow = (label, value, opts = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setTextColor(opts.muted ? 120 : 40);
    doc.setFontSize(opts.bold ? 11 : 10);
    y += opts.gap || 20;
    doc.text(label, left + 10, y);
    doc.text(value, right - 10, y, { align: "right" });
  };

  priceRow(`${plan.name || "Subscription"} (Annual)`, inr(data.listPrice));
  if (Number(data.discountAmount) > 0) {
    priceRow("Discount", `- ${inr(data.discountAmount)}`);
  }
  priceRow("Subtotal", inr(data.subtotal));
  if (Number(data.gstAmount) > 0) {
    priceRow(`GST (${data.gstRate}%)`, inr(data.gstAmount));
  }

  y += 10;
  doc.setDrawColor(226);
  doc.line(left + 10, y, right - 10, y);
  priceRow("Total payable", inr(data.finalAmount), { bold: true, gap: 22 });

  if (data.paymentLink) {
    ensureSpace(92);
    y += 34;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(45);
    doc.text("Payment link", left, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(8);
    const linkLines = doc.splitTextToSize(String(data.paymentLink), contentW);
    linkLines.forEach((line, index) => {
      const lineY = y + index * 11;
      if (typeof doc.textWithLink === "function") {
        doc.textWithLink(line, left, lineY, { url: String(data.paymentLink) });
      } else {
        doc.text(line, left, lineY);
      }
    });
    y += linkLines.length * 11 + 8;
  }

  ensureSpace(78);
  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Status: Awaiting payment", left, y); y += 13;
  doc.text("This is a proforma / confirmation document, not a tax invoice.", left, y); y += 13;
  doc.text("The Bispun workspace and final invoice are activated after successful payment.", left, y);

  doc.save(`Bispun-Proforma-${number}.pdf`);
}
