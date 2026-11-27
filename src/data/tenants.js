import {
  LayoutDashboard,
  Link2,
  UserCheck,
  IndianRupee,
  Database,
  UserPlus,
  Video,
  BarChart3,
  HelpCircle,
  Settings,
} from "lucide-react";

export const TENANTS = {
  "horizon-academy": {
    id: "horizon-academy",
    name: "Horizon Academy",
    short: "HA",
    accent: "bg-indigo-600",
    plan: "pro",
    brandName: "Horizon Academy CRM",
    subdomain: "horizon.consulbuzz.com",
    users: 12,
    leads: 8420,
    admissions: 286,
    renewal: "15 Sep 2026",
    status: "active",
    business: "Education Consultancy",
    mrr: 5000,
    city: "Hyderabad",
    owner: "Rakesh N.",
  },

  "abc-consultancy": {
    id: "abc-consultancy",
    name: "ABC Consultancy",
    short: "AB",
    accent: "bg-emerald-600",
    plan: "basic",
    brandName: "ABC Consultancy CRM",
    subdomain: "abcconsultancy.consulbuzz.com",
    users: 4,
    leads: 1240,
    admissions: 42,
    renewal: "02 Feb 2026",
    status: "active",
    business: "Career Consultancy",
    mrr: 2500,
    city: "Bangalore",
    owner: "Neha J.",
  },

  "xyz-admissions": {
    id: "xyz-admissions",
    name: "XYZ Admissions",
    short: "XZ",
    accent: "bg-amber-600",
    plan: "advanced",
    brandName: "XYZ Admissions Hub",
    subdomain: "xyz.consulbuzz.com",
    users: 28,
    leads: 15200,
    admissions: 612,
    renewal: "28 Nov 2026",
    status: "trial",
    business: "Admissions Agency",
    mrr: 7500,
    city: "Mumbai",
    owner: "Anil K.",
  },

  "nexus-edu": {
    id: "nexus-edu",
    name: "Nexus Edu",
    short: "NE",
    accent: "bg-rose-600",
    plan: "pro",
    brandName: "Nexus Edu Portal",
    subdomain: "nexus.consulbuzz.com",
    users: 8,
    leads: 3200,
    admissions: 118,
    renewal: "10 Jan 2027",
    status: "active",
    business: "Study Abroad",
    mrr: 5000,
    city: "Chennai",
    owner: "Meera R.",
  },

  "peak-careers": {
    id: "peak-careers",
    name: "Peak Careers",
    short: "PC",
    accent: "bg-purple-600",
    plan: "basic",
    brandName: "Peak Careers CRM",
    subdomain: "peak.consulbuzz.com",
    users: 3,
    leads: 640,
    admissions: 22,
    renewal: "05 Mar 2026",
    status: "suspended",
    business: "Career Coaching",
    mrr: 0,
    city: "Delhi",
    owner: "Vikram S.",
  },
};

export const PLANS = {
  basic: {
    name: "Basic",
    price: 2500,
    color: "slate",

    features: [
      "dashboard",
      "utm-leads",
      "admissions",
      "revenue",
      "lead-store",
      "analytics",
      "help",
      "settings",
    ],

    tagline:
      "Core CRM for small consultancies",
  },

  pro: {
    name: "Pro",
    price: 5000,
    color: "indigo",

    features: [
      "dashboard",
      "utm-leads",
      "admissions",
      "revenue",
      "lead-store",
      "analytics",
      "help",
      "settings",
      "walkins",
      "counselling",
    ],

    tagline:
      "Adds walk-ins & career counselling",
  },

  advanced: {
    name: "Advanced",
    price: 7500,
    color: "amber",

    features: [
      "dashboard",
      "utm-leads",
      "admissions",
      "revenue",
      "lead-store",
      "analytics",
      "help",
      "settings",
      "walkins",
      "counselling",
    ],

    tagline:
      "Advanced customization, integrations, white-label and priority capabilities",
  },
};

export const MODULE_META = {
  dashboard: {
    label: "Overall Dashboard",
    icon: LayoutDashboard,
  },

  "utm-leads": {
    label: "UTM Leads",
    icon: Link2,
  },

  admissions: {
    label: "Admissions",
    icon: UserCheck,
  },

  "domestic-walkins": { label: "Walk-ins", icon: UserPlus, plan: "pro" },
  "domestic-counselling": { label: "Counselling", icon: Video, plan: "pro" },
  "domestic-admissions": { label: "Admissions Done", icon: UserCheck },
  "international-walkins": { label: "Walk-ins", icon: UserPlus, plan: "pro" },
  "international-counselling": { label: "Counselling", icon: Video, plan: "pro" },
  "international-admissions": { label: "Admissions Done", icon: UserCheck },

  revenue: {
    label: "Revenue",
    icon: IndianRupee,
  },

  "lead-store": {
    label: "Lead Store",
    icon: Database,
  },

  walkins: {
    label: "Walk-ins",
    icon: UserPlus,
    plan: "pro",
  },

  counselling: {
    label: "Counselling",
    icon: Video,
    plan: "pro",
  },

  analytics: {
    label: "Analytics",
    icon: BarChart3,
  },

  help: {
    label: "Help & Support",
    icon: HelpCircle,
  },

  settings: {
    label: "Settings",
    icon: Settings,
  },
};