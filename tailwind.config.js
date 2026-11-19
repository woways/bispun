/** @type {import('tailwindcss').Config} */

import plugin from 'tailwindcss/plugin';

// brand-* and indigo-* both read the runtime CSS variables set by
// src/lib/brandTheme.js. Changing the Branding colour rewrites those variables
// and re-themes the whole platform. Semantic colours (accent/amber, success,
// emerald/rose/red used for meaning) stay fixed and are NOT tied to the brand.
const brandVar = (shade) => `rgb(var(--brand-${shade}) / <alpha-value>)`;
const brandScale = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((s) => [s, brandVar(s)])
);

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  safelist: [
    'from-amber-400', 'from-emerald-400', 'from-fuchsia-500', 'from-indigo-500',
    'from-orange-400', 'from-pink-400', 'from-rose-400', 'from-sky-400',
    'from-violet-500', 'from-yellow-400',
    'to-blue-700', 'to-green-600', 'to-indigo-600', 'to-orange-600',
    'to-pink-600', 'to-purple-700', 'to-red-600', 'to-rose-600', 'to-teal-600',
  ],
  theme: {
    extend: {
      colors: {
        // Brand + indigo are themeable (driven by --brand-* variables).
        brand: brandScale,
        indigo: brandScale,
        accent: {
          50:  "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        success: {
          50:  "#ecfdf5",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
      },
      backgroundImage: {
        "gradient-brand":
          "linear-gradient(135deg, rgb(var(--brand-600)) 0%, rgb(var(--brand-500)) 50%, rgb(var(--brand-400)) 100%)",
      },
      boxShadow: {
        "brand-sm": "0 2px 8px rgb(var(--brand-600) / 0.15)",
        "brand-md": "0 4px 16px rgb(var(--brand-600) / 0.25)",
        "brand-lg": "0 8px 32px rgb(var(--brand-600) / 0.35)",
      },
    },
  },
  plugins: [
    // `native:` variant — applies ONLY inside the Capacitor native app
    // (<html class="native">, set in src/main.jsx). Android-only UI uses it so
    // the web browser never receives the app-only layout. `.native &` outranks
    // base and responsive utilities, so the app value wins regardless of width.
    plugin(function ({ addVariant }) {
      addVariant('native', '.native &');
    }),
  ],
};