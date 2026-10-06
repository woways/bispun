# Bispun

**Multi-Tenant CRM & Business Management SaaS Platform**

Bispun is a scalable multi-tenant CRM platform designed for organizations that need to manage leads, admissions, revenue, analytics, teams, integrations, subscriptions, and business operations from a centralized system.

The platform provides separate **Super Admin** and **Client Portal** environments, allowing Bispun to onboard and manage multiple companies while keeping each organization's data, users, configuration, and operations isolated.

---

## 🚀 Product Overview

Bispun is built as a SaaS platform where multiple organizations can use the same application with their own:

- Company workspace
- Branding
- Users and roles
- CRM modules
- Subscription plan
- Enabled features
- Lead sources
- Custom fields
- Integrations
- Notifications
- Analytics
- Billing configuration

A centralized **Super Admin Portal** provides platform-level control over clients, plans, modules, subscriptions, billing, usage, support, analytics, system settings, and audit activity.

---

## ✨ Core Features

### Super Admin Portal

The Super Admin environment provides centralized SaaS management capabilities including:

- Client/company management
- Client 360° view
- Subscription management
- Plan management
- Module management
- Global billing overview
- Payment transaction tracking
- Client usage monitoring
- SaaS analytics
- Support & customization requests
- System settings
- Activity & audit logs

---

### Client CRM Portal

Each organization receives an isolated CRM workspace containing configurable modules such as:

- Dashboard
- UTM Leads
- Lead Management
- Admissions
- Revenue
- Lead Store
- Walk-ins
- Counselling
- Analytics
- Help & Support
- Settings

Modules can be controlled according to the organization's subscription and configuration.

---

## 👥 Role & Permission Management

Bispun supports role-based access control.

Current roles include:

- `SUPER_ADMIN`
- `CLIENT_ADMIN`
- `MANAGER`
- `EMPLOYEE`

Client users can additionally receive granular permissions for:

- User management
- Settings management
- Billing management
- Analytics access
- Admissions management
- Revenue management
- Lead management
- Support management

This allows companies to control access beyond basic role assignments.

---

## 🏢 Multi-Tenant Architecture

Bispun follows a company-based multi-tenant architecture.

Business records are associated with a specific company, including:

- Users
- Leads
- Admissions
- Revenue data
- Expenses
- Incentives
- UTM links
- Lead datasets
- Support tickets
- Notifications
- Integrations
- Custom fields
- Audit logs
- Subscriptions

This architecture is designed to keep client data logically separated while allowing centralized SaaS administration.

---

## 💳 Subscription & Billing

Bispun includes subscription infrastructure for:

- Monthly billing
- Yearly billing
- Trial subscriptions
- Active subscriptions
- Past-due subscriptions
- Cancelled subscriptions
- Expired subscriptions
- Plan-based module access
- Payment transaction history

### Razorpay

Razorpay integration is included for subscription payment processing.

The backend supports:

- Razorpay order/payment processing
- Payment verification
- Webhook signature verification
- Captured payment processing
- Failed payment handling
- Subscription activation/renewal
- Payment transaction records

Webhook endpoint:

```text
POST /api/webhooks/razorpay
```

---

## 📊 CRM & Analytics

The platform provides company-level and SaaS-level analytics.

### Client Analytics

Organizations can monitor CRM and operational performance through their own analytics environment.

### Super Admin Analytics

Platform administrators can monitor:

- Total clients
- Active clients
- Total users
- Active subscriptions
- Trial subscriptions
- Monthly recurring value
- Client growth
- Plan distribution
- Subscription distribution
- Users by client
- MRR by client

---

## 🔗 Lead & Integration Infrastructure

Bispun supports configurable lead acquisition and integration infrastructure.

Available integration types include:

- Website API
- Google Forms
- Meta Leads
- WhatsApp
- Email / SMTP
- Generic Webhooks

Integration configuration and status are maintained independently for each company.

---

## 🧩 Custom Fields

Companies can create configurable custom fields for lead records.

Supported field types include:

- Text
- Number
- Dropdown
- Date
- Checkbox
- Email
- Phone

Custom fields can be configured as required, optional, active/inactive, and visible in forms.

---

## 🔔 Notifications

Bispun contains an in-app notification system supporting events such as:

- Lead updates
- Admission updates
- Billing updates
- Support updates
- System updates
- Subscription payment events

Notification preferences can be configured per user.

---

## 🎫 Help & Support

Client organizations can submit support requests directly through the platform.

Supported request categories include:

- Technical Issues
- Feature Requests
- Customization Requests
- Integration Requests
- Billing Support

Requests can move through statuses including:

`NEW → UNDER_REVIEW → APPROVED → IN_PROGRESS → DEVELOPMENT → COMPLETED`

The Super Admin can review requests, update their status, and provide administrative remarks.

---

## 🛡️ Security

The backend includes several application-level security mechanisms:

- JWT authentication
- HTTP-only cookie-based sessions
- Role-based authorization
- Company-level authorization
- Permission-based access control
- CORS configuration
- API rate limiting
- Security headers
- Request IDs
- Request logging
- Razorpay webhook signature verification
- Audit logging
- Environment-based secret management

Sensitive credentials must never be committed to the repository.

---

## 📝 Audit Logging

Bispun contains separate auditing infrastructure for:

### Client Audit Logs

Tracks activity occurring inside individual company workspaces.

### Super Admin Audit Logs

Tracks platform-level administrative actions.

Audit records can contain information such as:

- Actor
- Action
- Entity
- Company
- Summary
- Metadata
- IP address
- User agent
- Timestamp

---

## 🛠️ Technology Stack

### Frontend

- React 18
- Vite
- React Router
- Tailwind CSS
- Lucide React
- Recharts

### Backend

- Node.js
- Express.js
- JWT
- Cookie Parser
- CORS
- bcryptjs

### Database

- PostgreSQL
- Prisma ORM

### Payments

- Razorpay

### Database Hosting

- Neon PostgreSQL

---

## 📁 Project Structure

```text
consulbuzz/
│
├── prisma/
│   ├── schema.prisma
│   └── seed.js
│
├── server/
│   ├── lib/
│   ├── middleware/
│   ├── routes/
│   └── index.js
│
├── src/
│   ├── components/
│   ├── data/
│   ├── lib/
│   ├── modules/
│   │   ├── admin/
│   │   └── client/
│   ├── App.jsx
│   ├── ClientPortal.jsx
│   ├── SuperAdmin.jsx
│   └── main.jsx
│
├── .gitignore
├── index.html
├── package.json
├── prisma.config.ts
├── tailwind.config.js
├── vite.config.js
└── README.md
```

---

## ⚙️ Local Development

### 1. Clone the repository

```bash
git clone <repository-url>
cd consulbuzz
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root.

Example:

```env
DATABASE_URL="your-postgresql-connection-string"

JWT_SECRET="your-secure-jwt-secret"

CLIENT_URL="http://localhost:5173"

PORT=4000

RAZORPAY_KEY_ID="your-razorpay-key-id"
RAZORPAY_KEY_SECRET="your-razorpay-key-secret"
RAZORPAY_WEBHOOK_SECRET="your-razorpay-webhook-secret"
```

Never commit the `.env` file.

---

## 🗄️ Database Setup

Generate Prisma Client:

```bash
npx prisma generate
```

Synchronize the database schema:

```bash
npx prisma db push
```

Seed the database when required:

```bash
npx prisma db seed
```

---

## ▶️ Running Locally

### Start Backend

```bash
npm run server
```

Backend:

```text
http://localhost:4000
```

Health check:

```text
GET /api/health
```

### Start Frontend

Open another terminal:

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

## 🏗️ Production Build

Create the optimized frontend build:

```bash
npm run build
```

Preview the production frontend locally:

```bash
npm run preview
```

Run the backend without watch mode:

```bash
npm run server:prod
```

---

## 🔐 Environment & Secret Management

The following files should remain excluded from Git:

```text
.env
.env.local
node_modules
dist
```

Production credentials should be configured directly through the selected hosting provider's environment-variable management system.

Never expose:

- Database passwords
- JWT secrets
- Razorpay secrets
- Webhook secrets
- Production credentials

---

## 🧪 Production Readiness

Before releasing ConsulBuzz to users or a testing team, verify:

- Authentication
- Role permissions
- Tenant isolation
- Client onboarding
- Lead management
- Admissions
- Revenue calculations
- Analytics
- Module restrictions
- Subscription lifecycle
- Razorpay payments
- Razorpay webhooks
- Notifications
- Support workflows
- Audit logs
- Production database connectivity
- CORS configuration
- Environment variables
- Error handling
- Responsive UI

---

## 🗺️ Product Direction

ConsulBuzz is being developed toward a scalable SaaS architecture capable of supporting multiple organizations from one platform.

The architecture is designed to support future capabilities such as:

- Advanced integrations
- Automated workflows
- Enhanced reporting
- Additional CRM modules
- Custom company workflows
- Extended role/permission controls
- White-label configuration
- Subscription automation
- Advanced SaaS analytics
- Enterprise-level administration

---

## 📄 License

This project is proprietary software.

All rights reserved.

Unauthorized copying, redistribution, modification, publication, or commercial use of this source code is prohibited without permission from the project owner.

---

**ConsulBuzz**  
*One platform. Multiple businesses. Centralized control.*
