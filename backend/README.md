# Molty Foam ERP — Production Backend

A high-performance, modular TypeScript & Express.js REST API powered by MongoDB & Mongoose for Molty Foam Retail, Wholesale & Distributor Operations in Pakistan.

---

## 1. Architecture & Tech Stack

- **Runtime**: Node.js (v22+)
- **Framework**: Express.js
- **Language**: TypeScript (Strict Mode)
- **Database**: MongoDB with Mongoose ODM
- **Schema Validation**: Zod
- **Security**: Helmet, CORS, Express-Rate-Limit, Cookie-Parser, BcryptJS
- **Logging**: Pino & Pino-HTTP with Pretty Printing
- **Testing**: Vitest & Supertest
- **API Documentation**: OpenAPI 3.0 / Swagger UI (`/api/v1/docs`)

---

## 2. Directory Structure

```text
backend/
├── src/
│   ├── config/              # Environment (Zod) & Mongoose Connection Lifecycle
│   │   ├── database.ts
│   │   └── env.ts
│   ├── constants/           # Branch codes, permissions, order/payment enums
│   │   └── index.ts
│   ├── docs/                # OpenAPI 3.0 specification & Swagger UI
│   │   └── swagger.ts
│   ├── middleware/          # Security, Auth, Rate Limiting, Error Handling
│   │   ├── auth.middleware.ts
│   │   ├── branchPermission.middleware.ts
│   │   ├── errorHandler.middleware.ts
│   │   ├── logger.middleware.ts
│   │   ├── rateLimiter.middleware.ts
│   │   └── validateRequest.middleware.ts
│   ├── models/              # Mongoose Domain Models (5 Business Domains)
│   │   ├── account.model.ts
│   │   ├── session.model.ts
│   │   ├── auditLog.model.ts
│   │   ├── branch.model.ts
│   │   ├── brand.model.ts
│   │   ├── category.model.ts
│   │   ├── size.model.ts
│   │   ├── thickness.model.ts
│   │   ├── product.model.ts
│   │   ├── variant.model.ts
│   │   ├── priceList.model.ts
│   │   ├── stockLocation.model.ts
│   │   ├── stockBalance.model.ts
│   │   ├── stockMovement.model.ts
│   │   ├── stockReceipt.model.ts
│   │   ├── stockTransfer.model.ts
│   │   ├── stockAdjustment.model.ts
│   │   ├── customer.model.ts
│   │   ├── customerLedger.model.ts
│   │   ├── salesInvoice.model.ts
│   │   ├── payment.model.ts
│   │   ├── supplier.model.ts
│   │   ├── purchaseOrder.model.ts
│   │   ├── supplierBill.model.ts
│   │   ├── supplierPayment.model.ts
│   │   ├── supplierLedger.model.ts
│   │   ├── idempotencyKey.model.ts
│   │   └── index.ts
│   ├── modules/             # Modular Controllers, Routes & Services
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.schema.ts
│   │   │   └── auth.service.ts
│   │   └── health/
│   │       ├── health.controller.ts
│   │       └── health.routes.ts
│   ├── utils/               # Financial utilities (Paisa arithmetic), Transactions, Logger
│   │   ├── apiResponse.ts
│   │   ├── financial.ts
│   │   ├── logger.ts
│   │   └── transaction.ts
│   ├── app.ts               # Express Application Factory
│   └── server.ts            # Server Bootstrap & Graceful Shutdown
├── dist/                    # Compiled JavaScript Output
├── .env.example             # Documented Environment Configuration
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 3. MongoDB Replica Set Setup (Local Development)

MongoDB multi-document transactions require a Replica Set (single-node or multi-node).

### Option A: Local MongoDB Community Edition (Single-Node Replica Set)
1. Stop the standalone mongod service:
   ```bash
   net stop MongoDB
   ```
2. Start mongod with replication enabled:
   ```bash
   mongod --port 27017 --dbpath "C:\data\db" --replSet rs0 --bind_ip 127.0.0.1
   ```
3. Open `mongosh` in a separate terminal:
   ```bash
   mongosh
   ```
4. Initiate the replica set:
   ```javascript
   rs.initiate()
   ```

### Option B: Docker Compose
```bash
docker run -d --name mongo-rs -p 27017:27017 mongo:7.0 mongod --replSet rs0 --bind_ip_all
docker exec -it mongo-rs mongosh --eval "rs.initiate()"
```

### Option C: MongoDB Atlas
Provide your connection string in `.env`:
```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/moltyformerp?retryWrites=true&w=majority
```

---

## 4. Environment Variables Reference

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5000` | HTTP Port for Express Server |
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/moltyformerp` | MongoDB connection URI |
| `FRONTEND_URL` | `http://localhost:3000` | Frontend Next.js Client URL |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS Origins (comma-separated) |
| `SESSION_SECRET` | *(string)* | Secret for signing session cookies |
| `SESSION_TTL_HOURS` | `24` | Session lifetime in hours |
| `COOKIE_SECURE` | `false` | Enable Secure flag for HTTPS in production |
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Rate limiter evaluation window |
| `RATE_LIMIT_MAX_REQUESTS` | `500` | Max requests per window |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | `20` | Max login attempts per window |

---

## 5. Available Scripts

From the `backend/` directory:

```bash
# Start development server with live reload
npm run dev

# Compile TypeScript to dist/
npm run build

# Start production server from dist/
npm run start

# Run ESLint check
npm run lint

# Run Vitest test suite
npm test
```

From the monorepo root:

```bash
# Start backend
npm run dev:backend

# Build backend
npm run build:backend

# Test backend
npm run test:backend
```

---

## 6. Financial Integrity Rules (Integer-Paisa Standard)

JavaScript standard floating-point representation (`0.1 + 0.2 === 0.30000000000000004`) causes rounding errors over time.
To guarantee audit compliance:
- All monetary arithmetic is computed in **Integer Paisa** (`1 PKR = 100 Paisa`).
- `toPaisa(rupees)` and `toRupees(paisa)` provide lossless conversions.
- `calculateInvoiceTotals` prevents fractional discrepancy during cart checkout.
- Multi-document transactions ensure atomic updates across Sales Invoices, Customer Ledgers, and Branch Inventory Balances.

