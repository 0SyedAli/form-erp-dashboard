# Master Molty Foam — Retail & Wholesale ERP Dashboard

**Enterprise Multi-Branch Resource Planning & Point-of-Sale System**  
Built with **Next.js 16 (App Router)**, **TypeScript**, **Redux Toolkit + RTK Query**, **Tailwind CSS**, **Material UI**, **Recharts**, and **React Hook Form + Zod**.

---

## 🌟 Executive Summary & Architecture

This application delivers **Flow 01: Super Admin & Branch Dashboard** for Master Molty Foam Pakistan. It provides a multi-tenant, role-aware operational interface supporting 1–5 branches (scalable to unlimited regional hubs), strict financial reconciliation (separating sales from liquidity collections), clear segmentation of retail consumer walk-ins from commercial wholesale trade, and a shared product catalogue.

### 🏢 Supported Branches
| Branch Code | Branch Hub Name | City | Monthly Sales Target |
| :--- | :--- | :--- | :--- |
| `LHR-01` | **Lahore Flagship (Gulberg)** | Lahore, Punjab | PKR 18,000,000 |
| `KHI-01` | **Karachi South (DHA)** | Karachi, Sindh | PKR 22,000,000 |
| `ISB-01` | **Islamabad Capital (Blue Area)** | Islamabad, ICT | PKR 14,000,000 |
| `RWP-01` | **Rawalpindi Commercial (Saddar)** | Rawalpindi, Punjab | PKR 10,000,000 |
| `MUX-01` | **Multan City (Bosan Road)** | Multan, Punjab | PKR 8,000,000 |

---

## 🗺️ Route Map & Access Rules

| Route | Role Access | Primary Purpose | Key Components & Widgets |
| :--- | :--- | :--- | :--- |
| `/login` | Public / Demo | Authenticate enterprise session with instant 1-click persona quick-switch cards or credentials. | Zod schema validation, demo persona cards, company security notice. |
| `/admin/dashboard` | **SUPER_ADMIN** only | Consolidated group executive intelligence across all 5 branches. | Net sales, retail/wholesale revenue split, financial reconciliation (Gross - Discount - Returns = Net), payment collections breakdown, branch performance matrix, top products, recent billing table. |
| `/branch/dashboard` | **BRANCH_MANAGER** & **SUPER_ADMIN** | Independent branch operations cockpit. Locked to assigned branch for managers; drilldown-enabled for admin. | Assigned branch info header, today's sales, monthly revenue, daily velocity graph, local catalogue stock levels snapshot, branch recent invoices. |
| `/unauthorized` | Any unauthorized attempt | 403 Access Denied screen enforcing multi-branch isolation and role barriers. | Role explanation, active session badge, quick return to assigned branch, demo persona switcher. |
| `/` | Authenticated users | Root traffic distributor. | Evaluates Redux session state and routes to `/admin/dashboard`, `/branch/dashboard`, or `/login`. |

---

## 🎨 Enterprise Design System
- **Navy Primary Sidebar & Containers:** `#14243D` (Sub-tones: `#1E3354`, `#0D1726`)
- **Light Operational Canvas:** `#F4F6FA`
- **Elevated Cards:** Pure `#FFFFFF` with refined subtle borders (`#E2E8F0`)
- **Molty Foam Brand Red Accent:** `#C4122F` (Hover `#A50E26`, Tint `#FEE2E2`)
- **Typography:** `Inter` font via Next.js Google Font Optimization
- **Data Densities:** Standardized on **PKR Currency (`₨`)** and **Asia/Karachi (`PKT`, UTC+5)** timestamps.

---

## 💼 Core Business & Financial Logic

### 1. Financial Reconciliation Formula
$$\text{Net Sales} = \text{Gross Invoiced Sales} - \text{Trade/Promotional Discounts} - \text{Customer Returns/Warranty}$$

All mock transactions balance mathematically:
- **Gross Invoiced:** Subtotal calculated from catalogue unit prices $\times$ quantities.
- **Discounts Allowed:** Commercial tier volume discounts and retail promotions.
- **Returns Processed:** Size exchanges and warranty claims deducted directly.
- **Net Sales:** Final audited realized revenue.

### 2. Payment Collections vs Sales Revenue
Per enterprise requirement #11, **Collections are tracked separately from Invoiced Revenue**:
- **Cash Counter:** Physical currency received in local branch cash drawers.
- **Bank Transfer (IBFT/Wire):** Direct deposits into group corporate treasury.
- **PayPak & 1Link Cards:** Debit and credit cards processed via POS terminals.
- **Crossed Cheques:** Institutional payments cleared through Habib Bank / Bank Alfalah.
- **30-Day Commercial Credit:** Outstanding accounts receivable tracked with `amountPaid` vs `amountDue`.

### 3. Retail vs Wholesale Channel Segregation
- **Retail (`RETAIL`):** Consumer walk-ins, individual invoicing, immediate full settlement, standard retail list prices.
- **Wholesale (`WHOLESALE`):** Hotels, hospital suites, furniture dealers, corporate NTN/STRN recording, bulk tier wholesale pricing (15–20% trade discount), commercial credit terms.

### 4. Shared Catalogue & Central Warehouse Notice
- Product catalogue (Master MoltyFoam Original, Ortho Firm, Spring Lux, Molty Cure, Dual Comfort, Pillows, Protectors) is globally defined.
- Inventory is tracked across all 5 branches with safety stock threshold alerts.
- **Central Warehouse Status:** Central warehouse integration is marked as **RFC Pending (Phase 2 Roadmap)** with an informative banner.

---

## 🧪 Testing, Quality & Commands

### Running Unit Tests (Vitest)
```bash
npm test
```
The unit test suite in `src/tests/financials.test.ts` tests:
- Net Sales calculations ($\text{Gross} - \text{Discounts} - \text{Returns}$)
- Retail vs Wholesale revenue isolation
- Multi-channel payment collections & pending credit receivables
- Branch-level transaction filtering
- Branch target achievement metrics
- Shared catalogue inventory tracking

### Running Linting (ESLint)
```bash
npm run lint
```
*Validated with 0 errors and 0 warnings.*

### Running Production Build
```bash
npm run build
```
Generates optimized static and dynamic routes.

### Starting Local Development Server
```bash
npm run dev
```
Accessible at `http://localhost:3000` or `http://localhost:3001`.

---

## 🔒 Security Disclaimer & Remaining Limitations

> [!IMPORTANT]
> **Demo Authentication Mode:**
> Current authentication and persona switching are simulated via Redux Toolkit and client-side guards for Flow 01 preview. All branch isolation boundaries, permissions, and session tokens must be verified and enforced by the production backend API gateway in Phase 2.

### Remaining Phase 2 Roadmap Items:
1. **Central Warehouse Automated Reordering:** Real-time EDI integration with Kala Shah Kaku manufacturing facility upon finalization of warehouse specs.
2. **FBR POS Integration:** Real-time QR code generation for Pakistan Federal Board of Revenue (FBR) fiscalized tax compliance.
3. **Role Expansion:** Additional sub-roles (Cashier, Storekeeper, Regional Area Manager, External Auditor).
