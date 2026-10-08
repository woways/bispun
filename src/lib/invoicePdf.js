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
  const left = 42;
  const right = pageW - 42;
  const contentW = right - left;
  const company = receipt.company || {};
  const plan = receipt.plan || {};
  const paidAmount = Number(receipt.finalAmount ?? receipt.amount ?? 0);
  const listPrice = Number(receipt.listPrice ?? receipt.amount ?? 0);
  const discount = Number(receipt.discountAmount || 0);
  const subtotal = Number(receipt.subtotal ?? Math.max(0, listPrice - discount));
  const gstRate = Number(receipt.gstRate ?? (receipt.gstAmount ? 18 : 0));
  const gst = Number(receipt.gstAmount || 0);
  const invoiceNo = receipt.receiptNumber || receipt.id || "";
  const paidDate = fmtDate(receipt.paidAt || receipt.createdAt);

  // Header / brand
  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.setTextColor(16, 24, 40);
  doc.text("BISPUN", left, 58);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text("CRM SUBSCRIPTION", left + 92, 57);

  // Paid pill
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(right - 73, 35, 73, 26, 13, 13, "FD");
  doc.setTextColor(4, 120, 87);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("PAID", right - 36.5, 52, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text("TAX INVOICE", left, 94);
  doc.setFontSize(25);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text(inr(paidAmount), left, 121);
  doc.setFontSize(9);
  doc.setTextColor(5, 150, 105);
  doc.text("Payment successful", left, 139);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("Invoice No.", right, 92, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text(invoiceNo, right, 108, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Payment Date", right, 127, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text(paidDate, right, 143, { align: "right" });

  doc.setDrawColor(241, 245, 249);
  doc.line(0, 164, pageW, 164);

  // Two-column summary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("BILLED TO", left, 194);
  doc.text("SUBSCRIPTION", left + contentW * 0.54, 194);

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(company.brandName || company.name || "Client", left, 218);
  doc.text(`${plan.name || "Bispun"} Plan`, left + contentW * 0.54, 218);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  let by = 236;
  if (company.email) { doc.text(String(company.email), left, by); by += 14; }
  const contact = [company.phone, company.city].filter(Boolean).join(" · ");
  if (contact) doc.text(contact, left, by);

  doc.text("Annual Billing", left + contentW * 0.54, 236);
  const renewal = receipt.subscription?.renewalDate ? fmtDate(receipt.subscription.renewalDate).split(",")[0] : "—";
  doc.text(`Renewal: ${renewal}`, left + contentW * 0.54, 251);

  // Amount table
  let y = 286;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(left, y, contentW, 248, 10, 10, "FD");
  doc.setFillColor(248, 250, 252);
  doc.rect(left, y, contentW, 34, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("DESCRIPTION", left + 16, y + 21);
  doc.text("AMOUNT", right - 16, y + 21, { align: "right" });

  y += 56;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`Bispun ${plan.name || "Subscription"} Plan`, left + 16, y);
  doc.text(inr(listPrice), right - 16, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Annual CRM subscription", left + 16, y + 18);

  doc.setDrawColor(241, 245, 249);
  doc.line(left, y + 38, right, y + 38);
  y += 64;

  const detail = (label, value, valueColor = [51, 65, 85]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(label, left + 16, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...valueColor);
    doc.text(value, right - 16, y, { align: "right" });
    y += 23;
  };

  detail("Original Price", inr(listPrice));
  detail("Discount", discount > 0 ? `- ${inr(discount)}` : "No discount", discount > 0 ? [225, 29, 72] : [100, 116, 139]);
  detail("Subtotal", inr(subtotal));
  detail(`GST (${gstRate}%)`, inr(gst));

  doc.setDrawColor(226, 232, 240);
  doc.line(left + 16, y - 5, right - 16, y - 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Total Paid", left + 16, y + 17);
  doc.setFontSize(16);
  doc.text(inr(paidAmount), right - 16, y + 17, { align: "right" });

  // Payment details
  y = 570;
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("PAYMENT DETAILS", left, y);
  const x2 = left + contentW * 0.54;
  const field = (label, value, x, yy) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(label, x, yy);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(String(value || "—"), x, yy + 16, { maxWidth: contentW * 0.42 });
  };
  field("Payment Method", "Razorpay", left, y + 22);
  field("Currency", receipt.currency || "INR", x2, y + 22);
  field("Payment ID", receipt.providerPaymentId || "—", left, y + 66);
  field("Order ID", receipt.providerOrderId || "—", x2, y + 66);
  field("Status", receipt.status || "CAPTURED", left, y + 110);
  field("Billing Cycle", "Annual", x2, y + 110);

  doc.setDrawColor(241, 245, 249);
  doc.line(left, 728, right, 728);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("Thank you for choosing Bispun.", left, 750);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("This invoice confirms successful payment for your CRM subscription.", left, 766);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("WOWAYS PRIVATE LIMITED", right, 766, { align: "right" });

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
  const left = 48;
  const right = pageW - 48;
  let y = 56;
  const company = receipt.company || {};
  const plan = receipt.plan || {};

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(79, 70, 229);
  doc.text("Bispun", left, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(70);
  doc.text("Payment Receipt", right, y - 8, { align: "right" });
  doc.setFontSize(9);
  doc.text(`Receipt No: ${receipt.receiptNumber || receipt.id || ""}`, right, y + 7, { align: "right" });
  doc.text(`Paid on: ${fmtDate(receipt.paidAt || receipt.createdAt)}`, right, y + 20, { align: "right" });

  y += 42;
  doc.setDrawColor(226);
  doc.line(left, y, right, y);
  y += 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.text("Received from", left, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(75);
  doc.text(company.brandName || company.name || "Client", left, y);
  if (company.email) { y += 14; doc.text(String(company.email), left, y); }
  if (company.phone) { y += 14; doc.text(String(company.phone), left, y); }

  y += 34;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(left, y, right - left, 92, 8, 8, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("For", left + 16, y + 24);
  doc.text("Amount received", left + 16, y + 50);
  doc.text("Payment status", left + 16, y + 76);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(35);
  doc.text(`${plan.name || "Bispun"} Annual Subscription`, right - 16, y + 24, { align: "right" });
  doc.setFontSize(14);
  doc.text(inr(receipt.finalAmount != null ? receipt.finalAmount : receipt.amount), right - 16, y + 52, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(5, 150, 105);
  doc.text(String(receipt.status || "CAPTURED"), right - 16, y + 76, { align: "right" });

  y += 122;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  if (receipt.providerPaymentId) { doc.text(`Razorpay Payment ID: ${receipt.providerPaymentId}`, left, y); y += 14; }
  if (receipt.providerOrderId) { doc.text(`Razorpay Order ID: ${receipt.providerOrderId}`, left, y); y += 14; }
  if (receipt.currency) { doc.text(`Currency: ${receipt.currency}`, left, y); y += 14; }
  doc.text("This is a system-generated payment receipt.", left, y);

  y += 44;
  doc.setDrawColor(226);
  doc.line(left, y, right, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(55);
  doc.text("WOWAYS PRIVATE LIMITED", left, y);

  const name = `Bispun-Receipt-${receipt.receiptNumber || receipt.id || "payment"}.pdf`;
  doc.save(name);
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
