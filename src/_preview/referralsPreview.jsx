// TEMPORARY dev-only preview harness — renders the real Referrals components
// with mock API data so the UI can be viewed without a backend/login.
// Safe to delete: this file + /referrals-preview.html are not part of the app.
import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import Referrals from "../modules/client/Referrals";

const iso = (d) => new Date(d).toISOString();

const ME = {
  code: "RAJ7K",
  rewardProgram: {
    slabs: [
      { key: "SLAB_1", label: "1–5", min: 1, max: 5, rate: 2500 },
      { key: "SLAB_2", label: "6–10", min: 6, max: 10, rate: 3000 },
      { key: "SLAB_3", label: "11+", min: 11, max: null, rate: 4000 },
    ],
    creditExpectationDays: { min: 5, max: 8 },
    summary: {
      successfulCount: 4,
      rate: 2500,
      totalEarnings: 10000,
      earned: 10000,
      credited: 5000,
      pendingCredit: 5000,
      slab: { key: "SLAB_1", label: "Slab 1" },
    },
    referrals: [
      { id: "c1", status: "EARNED", company: { name: "Horizon Academy", planName: "CRM Pro" }, createdAt: iso("2026-11-12"), qualifiedAt: iso("2026-11-12") },
      { id: "c2", status: "EARNED", company: { name: "Nova Institute", planName: "CRM Pro" }, createdAt: iso("2026-11-08"), qualifiedAt: iso("2026-11-08") },
      { id: "c3", status: "REFERRED", referredName: "Bright Future Coaching", createdAt: iso("2026-11-13") },
      { id: "c4", status: "EARNED", company: { name: "Pinnacle Tutorials", planName: "CRM Plan" }, createdAt: iso("2026-11-02"), qualifiedAt: iso("2026-11-02") },
      { id: "c5", status: "EARNED", company: { name: "Summit Careers", planName: "CRM Plan" }, createdAt: iso("2026-10-27"), qualifiedAt: iso("2026-10-27") },
    ],
    payouts: [
      { id: "p1", status: "PAID", amount: 2500, paidAt: iso("2026-11-10"), paymentReference: "UPI · 2026111012345" },
      { id: "p2", status: "PAID", amount: 2500, paidAt: iso("2026-10-28"), paymentReference: "UPI · 2026102898761" },
    ],
  },
  stats: { total: 6, admitted: 2, inProgress: 3 },
  referrals: [
    { id: "l1", lead: { name: "Rahul Verma", phone: "91234 56780", course: "MBA", stage: "ADMITTED", stageIndex: 4, isLost: false } },
    { id: "l2", lead: { name: "Priya Nair", phone: "93456 11223", course: "B.Sc", stage: "ADMITTED", stageIndex: 4, isLost: false } },
    { id: "l3", lead: { name: "Sneha Reddy", phone: "90080 12345", course: "B.Com", stage: "COUNSELLING", stageIndex: 3, isLost: false } },
    { id: "l4", lead: { name: "Ananya Sharma", phone: "98765 43210", course: "B.Tech CSE", stage: "QUALIFIED", stageIndex: 2, isLost: false } },
    { id: "l5", lead: { name: "Imran Khan", phone: "99887 65544", course: "BBA", stage: "CONTACTED", stageIndex: 1, isLost: false } },
    { id: "l6", lead: { name: "Karthik Rao", phone: "94567 00112", course: "MCA", stage: "QUALIFIED", stageIndex: 2, isLost: true } },
  ],
};

const SEARCH_LEADS = [
  { id: "s1", name: "Deepak Menon", phone: "98111 22334", course: "MBA" },
  { id: "s2", name: "Sana Shaikh", phone: "97654 00123", course: "B.Com" },
];

// Stub fetch so the real components load with mock data (no backend needed).
const origFetch = window.fetch ? window.fetch.bind(window) : null;
window.fetch = async (url, opts) => {
  const u = String(url);
  const json = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { "content-type": "application/json" } });
  if (u.includes("/api/client/referrals/me")) return json(ME);
  if (u.includes("/api/client/referrals/leads")) return json({ leads: SEARCH_LEADS });
  if (u.includes("/api/client/referrals/users")) return json({ users: [] });
  if (u.includes("/api/client/referrals/tag")) return json({ ok: true });
  if (origFetch) return origFetch(url, opts);
  return json({});
};

const currentUser = { name: "Rajesh Kumar", role: "CLIENT_ADMIN", jobTitle: "Director" };

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <div style={{ background: "#f1f5f9", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 16px" }}>
        <Referrals currentUser={currentUser} />
      </div>
    </div>
  </React.StrictMode>
);
