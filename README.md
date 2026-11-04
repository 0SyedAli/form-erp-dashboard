# Molty Foam ERP — Multi-Branch Retail, Wholesale & Distributor Management System

An enterprise ERP platform engineered for Molty Foam Pakistan, managing retail storefronts, wholesale depots, central inventory, customer credit, and procurement.

---

## 1. Monorepo Architecture

The repository is structured as two completely independent applications:

```text
moltyformerp/
├── frontend/               # Next.js 16 App Router, React 19, Redux Toolkit, Tailwind CSS v4, MUI
└── backend/                # Express.js, TypeScript, MongoDB / Mongoose, Zod, Vitest
```

- **Frontend**: Responsive UI with POS terminal, unified catalogue, stock management, and customer/supplier ledgers. Uses Plus Jakarta Sans globally.
- **Backend**: High-performance REST API with MongoDB domain models, atomic session transactions, branch permission guards, and OpenAPI / Swagger documentation.

---

## 2. Quick Start

### Root Scripts (Runs on both or either)
```bash
# Start Frontend in dev mode
npm run dev:frontend

# Start Backend in dev mode
npm run dev:backend

# Run all tests (Frontend Vitest + Backend Vitest)
npm test

# Build both applications for production
npm run build
```

### Running Frontend Separately
```bash
cd frontend
npm install
npm run dev     # Starts Next.js on http://localhost:3000
npm run build   # Production build
npm test        # Run frontend unit & integration tests
```

### Running Backend Separately
```bash
cd backend
npm install
npm run dev     # Starts Express API on http://localhost:5001
npm run build   # Compile TypeScript to dist/
npm test        # Run backend test suite
```

---

## 3. Core Capabilities
- **One Super Admin + 1 Login Per Branch**: Streamlined branch-based security model.
- **Cross-Branch Security Enforcement**: Branch logins strictly access only their designated store inventory and sales.
- **Three-Tier Pricing**: Walk-in retail, Wholesale, and Distributor pricing.
- **Decimal-Safe Financials**: Integer Paisa arithmetic guaranteeing precision in POS and ledgers.
- **Real-Time API Docs**: Interactive Swagger documentation accessible at `http://localhost:5001/api/v1/docs`.

