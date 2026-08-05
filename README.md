# The CGC Network

> **B2B Creator Marketplace connecting Brands with UGC Creators for authentic content campaigns, custom proposals, escrow-backed collaborations, and automated licensing.**

Built on top of Sharetribe Web Template (React + Express Server-Side Rendering) with custom two-transaction workflow extensions, server-validated pricing security, and operator administration tools.

---

## 📚 Core Documentation (Single Source of Truth)

Before contributing or reviewing code, please refer to the core architecture documents:

* 📖 **[BLUEPRINT.md](BLUEPRINT.md)** — Product decisions, business requirements, and operational rules.
* 🛠️ **[IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)** — Architectural roadmap, data contracts (`publicData` / `protectedData` / `metadata`), and phase breakdown.
* 📐 **[AGENTS.md](AGENTS.md)** — Coding conventions, Redux patterns, styling guidelines, and architectural constraints.

---

## 🏛️ Domain Architecture & Key Features

### 1. Two-Transaction Collaboration Workflow
Sharetribe transactions require the buyer to be the `customer` initiating a transaction on the seller's `provider` listing. To support project-based applications and negotiations, CGC Network uses **two paired transactions**:

1. **Application Transaction (`cgc-application`)**:
   - **Listing**: Brand's `project` listing.
   - **Customer**: Creator (applicant) | **Provider**: Brand.
   - **Purpose**: Proposal submission, timeline commitments, and budget negotiations (up to 1 counter-offer round).
2. **Paid Collaboration Transaction (`cgc-ugc-approval`)**:
   - **Listing**: Creator's `creator-profile` listing.
   - **Customer**: Brand (funder) | **Provider**: Creator.
   - **Purpose**: Escrow funding, physical product shipping, asset deliverables (video/photo/carousel), revision rounds, payout, and license issuance.

### 2. Server-Computed Pricing Security Invariant
Price parameters are **never trusted from the client**. When a Brand checks out on a Creator's profile listing:
- Client passes only `orderData.applicationId`.
- Express server (`server/api/initiate-privileged.js` and `transition-privileged.js`) validates the application status (`accepted`) and retrieves agreed price directly from immutable transaction **`metadata`** written by Integration API.
- Server constructs `transactionLineItems` securely.

### 3. Multi-Role User Governance
- **Creators**: Apply to projects, submit content deliverables, manage earnings.
- **Brands**: Post project briefs, manage campaigns, review applicants, issue payments, and access licensed content library.
- **Operators**: Vetting & onboarding review (`/admin/applications`), invitation codes (`/admin/invites`), dispute intervention (`/admin/disputes`), and platform health checks (`/admin/health`).

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js**: `^22.22.0` || `>=24.0.0`
- **Yarn**: `1.x`

### Setup

1. **Clone repository & install dependencies**:
   ```bash
   git clone https://github.com/bejokasep3/cgc-network.git
   cd cgc-network
   yarn install
   ```

2. **Configure environment variables**:
   Copy `.env-template` to `.env` and fill required Sharetribe & Stripe keys:
   ```bash
   cp .env-template .env
   ```

3. **Start local development server**:
   ```bash
   yarn dev
   ```
   Open `http://localhost:3000` in your browser.

---

## 🧪 Testing & Verification

Run consistency verification and test suites after making changes:

```bash
# 1. Run CGC consistency checks (validates process.edn ↔ JS mirrors ↔ translations ↔ UI wiring)
node scripts/verify-cgc.js

# 2. Run full test suite (always use --runInBand to prevent parallel test timeouts)
npx jest --runInBand

# 3. Verify web build bundle
yarn build-web
```

---

## 📄 License

This project is built upon Sharetribe Web Template and licensed under the terms of the **Apache-2.0 License**. See [LICENSE](LICENSE) for details.
