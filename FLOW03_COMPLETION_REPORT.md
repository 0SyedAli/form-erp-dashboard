# MOLTY FOAM ERP — BACKEND FLOW 03 COMPLETION REPORT
## Product Catalogue, Simplified Product Creation, Three-Tier Pricing Engine & Frontend API Integration

**Status:** Completed & Fully Verified  
**Architecture:** Monorepo (`frontend/` Next.js 16 App Router + `backend/` Express.js TypeScript MongoDB)  
**Database:** MongoDB 8 with Replica Set (`rs0`) & ACID Multi-Document Transactions  
**Test Suite Status:** 219 Tests Passing (170 Frontend Vitest + 49 Backend Vitest) — 100% Pass Rate  

---

## 1. Seeded Branch Locations Verification (Karachi Central Mattress Market Cluster)

In compliance with Part A1, the seed script (`backend/src/scripts/seed.ts`) was corrected. Fictional distant city branches (Lahore, Islamabad, Rawalpindi, Faisalabad) were permanently removed and migrated to the **Karachi central mattress market cluster**.

| Branch Code | Branch Name | Shop Number | Market Location | Branch Type | Primary Account Login |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SHOP-12-14` | Main Branch | Shop #12–14 | Central Mattress Market, M.A. Jinnah Rd, Karachi | RETAIL_AND_WHOLESALE | `branch.main` |
| `SHOP-18` | Display Center | Shop #18 | Central Mattress Market, M.A. Jinnah Rd, Karachi | SHOWROOM | `branch.display` |
| `SHOP-24-A` | Wholesale Depot | Shop #24-A | Central Commercial Yard, M.A. Jinnah Rd, Karachi | WAREHOUSE | `branch.wholesale` |
| `SHOP-06` | Ortho Bedding Studio | Shop #06 | Healthcare Avenue, M.A. Jinnah Rd, Karachi | SPECIALTY_STORE | `branch.ortho` |
| `SHOP-31` | Express Counter | Shop #31 | Metro Plaza Market, M.A. Jinnah Rd, Karachi | EXPRESS_OUTLET | `branch.express` |

- Branch IDs, default stock locations, and existing permissions were preserved without data corruption or orphan records.
- All branches are verified to reside in Karachi (`city: 'Karachi'`).

---

## 2. Insecure Passwords & Log Exposure Audit

In compliance with Part A2:
- Hardcoded fallback passwords in seed scripts were eliminated.
- `backend/src/scripts/seed.ts` strictly enforces `process.env.SEED_ADMIN_PASSWORD` and `process.env.SEED_BRANCH_PASSWORD`. If missing, execution halts immediately with `MISSING_SEED_PASSWORDS`.
- Production passwords and hashes are strictly excluded from console logs, debug messages, and API responses (`select: false` on password hashes in Mongoose schemas).
- `.env.example` in both `frontend` and `backend` documents all required keys without exposing production secrets.

---

## 3. MongoDB Replica Set & ACID Multi-Document Transactions

In compliance with Part A3:
- MongoDB 8 Replica Set (`rs0`) on local development port `27018` was configured, initiated (`rs.initiate()`), and verified.
- Multi-document transactions (`session.withTransaction(...)`) were integrated in `backend/src/utils/transaction.ts`.
- **Fail-Safe Mechanism:** When transactions are strictly required (product creation with variant, initial stock balance, and ledger movement), the system checks topology (`client.topology?.description.type`). If standalone, it aborts cleanly with `503 TRANSACTIONS_UNAVAILABLE` rather than performing uncommitted, partial writes.
- Live integration tests verified transactional atomicity: when an operation fails midway, all changes (Product, Variant, StockBalance, StockMovement) are completely rolled back with zero leftover documents.

---

## 4. Product Catalogue Collections & Schemas

The following collections and Mongoose models support the catalogue:

1. **`Brand`** (`backend/src/models/brand.model.ts`):
   - Fields: `name`, `code` (uppercase, unique), `status` (`'ACTIVE' | 'INACTIVE'`), `description`.
   - Seeded with Molty Foam (`MF`), Master (`MS`), and Dura Foam (`DF`).
2. **`BrandCategory`** (`backend/src/models/category.model.ts`):
   - Fields: `brandId` (ref `Brand`), `name`, `code`, `status`, `description`.
   - Compound unique index on `{ brandId: 1, code: 1 }`.
3. **`Size`** (`backend/src/models/size.model.ts`):
   - Fields: `length`, `width`, `unit` (`'in'`), `displayLabel` (e.g. `78 × 78`), `status`.
   - Compound unique index on `{ length: 1, width: 1, unit: 1 }`.
4. **`Thickness`** (`backend/src/models/thickness.model.ts`):
   - Fields: `value`, `unit` (`'in'`), `displayLabel` (e.g. `5 inch`), `status`.
   - Compound unique index on `{ value: 1, unit: 1 }`.
5. **`Product`** (`backend/src/models/product.model.ts`):
   - Parent container representing the brand + model line (e.g., "Molty Foam - Ultra Luxury").
   - Compound unique index on `{ brandId: 1, categoryId: 1 }`.
6. **`ProductVariant`** (`backend/src/models/variant.model.ts`):
   - Specific physical SKU combining Product, Size, and Thickness.
   - Compound unique index on `{ productId: 1, sizeId: 1, thicknessId: 1 }`.
   - Unique sparse index on `sku`.

---

## 5. Simplified Product Creation Pipeline

The backend implements `POST /api/v1/products` (`CatalogueService.createProductWithVariant`):
1. **Validation:** Validates inputs via Zod schema (`createProductWithVariantSchema`).
2. **Entity Resolution:** Resolves Brand, Category, Size, and Thickness.
3. **Auto-Naming:** Sets product name to `${brand.name} - ${category.name}`.
4. **Parent Product Upsert:** Checks if a product with `{ brandId, categoryId }` exists; if not, creates it.
5. **SKU Code Generation:** Computes formatted SKU code.
6. **Collision Check:** Rejects duplicate specification under the same product with `409 SKU_ALREADY_EXISTS`.
7. **Pricing Calculation:** Runs the Lossless Integer-Paisa Pricing Engine.
8. **ACID Transaction:**
   - Creates `ProductVariant` record.
   - If initial stock $> 0$, initializes `StockBalance` and writes audit `StockMovement` of type `OPENING_BALANCE`.
   - Writes baseline entry to `PriceHistory`.

---

## 6. SKU Generation Format

SKUs follow the standardized ERP pattern:
$$\text{SKU} = \text{BRAND\_CODE} - \text{CATEGORY\_CODE} - \text{LENGTH}\text{X}\text{WIDTH} - \text{THICKNESS}$$

**Examples:**
- `MF-UL-78X78-5` $\rightarrow$ Molty Foam, Ultra Luxury, $78 \times 78$ inches, 5 inches thick.
- `MS-MC-78X72-6` $\rightarrow$ Master, Medical Care, $78 \times 72$ inches, 6 inches thick.
- `DF-PR-76X78-4` $\rightarrow$ Dura Foam, Premium, $76 \times 78$ inches, 4 inches thick.

**Uniqueness Guarantee:**
- SKU strings are uppercase and trimmed.
- Unique index on `sku` in MongoDB.
- Compound unique index `{ productId: 1, sizeId: 1, thicknessId: 1 }` prevents redundant variants.

---

## 7. Three-Tier Pricing Engine & Lossless Integer-Paisa Arithmetic

To prevent floating-point discrepancies, currency is stored and calculated using integer-paisa rules with half-up rounding:

$$\text{Paisa} = \text{round}(\text{PKR} \times 100)$$

### Formula Implementations:
1. **Purchase Price:** Derived from List Price with purchase discount:
   $$\text{Purchase Price} = \text{round}\left(\text{List Price} \times \left(1 - \frac{\text{Purchase Discount \%}}{100}\right)\right)$$
2. **Retail Price (`WALK_IN`):** Calculated as retail markup over Purchase Price:
   $$\text{Retail Price} = \text{round}\left(\text{Purchase Price} \times \left(1 + \frac{\text{Retail Markup \%}}{100}\right)\right)$$
3. **Wholesale Price (`WHOLESALE`):** Calculated as discount from List Price:
   $$\text{Wholesale Price} = \text{round}\left(\text{List Price} \times \left(1 - \frac{\text{Wholesale Discount \%}}{100}\right)\right)$$
4. **Distributor Price (`DISTRIBUTOR`):** Standard tier configured via discount from list or percentage above purchase:
   $$\text{Distributor Price} = \text{round}\left(\text{List Price} \times \left(1 - \frac{\text{Distributor Discount \%}}{100}\right)\right)$$

---

## 8. Bidirectional Recalculation & Reconciliation Tolerance

In `backend/src/utils/financial.ts`:
- If the user provides both a price and a percentage (e.g. Purchase % = 15 and Purchase Price = 15,300 for List Price = 18,000), the system validates reconciliation within a **$\pm 2$ PKR tolerance** ($\pm 200$ paisa) to account for natural integer rounding.
- If the discrepancy exceeds the rounding tolerance (e.g., claiming 15% discount on 20,000 gives 9,999 instead of 17,000), the request is rejected with `400 PRICE_DISCREPANCY`.

---

## 9. Price Modification Audit Trail & Immutable PriceHistory

File: `backend/src/models/priceHistory.model.ts`

Every update to prices (`PATCH /api/v1/skus/:id/prices`) writes an immutable record to the `PriceHistory` collection capturing:
- `skuId`, `sku`
- Previous prices & new prices for all 4 price values: List Price, Purchase Price, Retail Price, Wholesale Price, Distributor Price
- Discount/markup percentages
- Changed by user (`userId`, `loginId`, `role`, `branchId`)
- Reason for change (e.g., "Annual catalogue price adjustment")
- Accurate UTC timestamp

---

## 10 & 11. Separation of Catalogue & Physical Stock Balances

Physical stock balances are decoupled from the catalogue definitions:
- Product and Variant documents do **not** store branch quantities directly.
- Quantities are stored strictly in `StockBalance` records keyed by `{ branchId, stockLocationId, sku }`.
- When initial stock is provided during product creation:
  1. An opening balance is posted to the designated branch default location (`StockBalance.onHand`).
  2. An immutable `StockMovement` entry is recorded with `movementType: 'OPENING_BALANCE'`, `quantityDifference: initialStock`, and references.

---

## 12. Authorization Matrix for Catalogue Operations

| Endpoint | Method | Super Admin | Branch (Default) | Branch (`addEditProducts`) | Branch (`viewProducts`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/api/v1/brands` | GET | Allowed | Allowed | Allowed | Allowed |
| `/api/v1/brands` | POST / PATCH | Allowed | Denied (403) | Denied (403) | Denied (403) |
| `/api/v1/categories` | GET | Allowed | Allowed | Allowed | Allowed |
| `/api/v1/categories` | POST / PATCH | Allowed | Denied (403) | Denied (403) | Denied (403) |
| `/api/v1/sizes`, `/thicknesses` | GET | Allowed | Allowed | Allowed | Allowed |
| `/api/v1/sizes`, `/thicknesses` | POST / PATCH | Allowed | Denied (403) | Denied (403) | Denied (403) |
| `/api/v1/products` | GET | Allowed | Allowed | Allowed | Allowed |
| `/api/v1/products` | POST (Create) | Allowed | Denied (403) | Allowed | Denied (403) |
| `/api/v1/skus` | GET | Allowed | Allowed | Allowed | Allowed |
| `/api/v1/skus/:id/prices` | GET | Allowed | Allowed | Allowed | Allowed |
| `/api/v1/skus/:id/prices` | PATCH | Allowed | Denied (403) | Denied (403)* | Denied (403) |

*\* Note: Price modification requires Super Admin authority or explicit override.*

---

## 13. OpenAPI / Swagger 3.0 Documentation

All catalogue routes, request bodies, error schemas, and response formats are registered in `backend/src/docs/swagger.ts` and available at:
`http://localhost:5001/api/docs`

---

## 14. Frontend RTK Query Integration & Resilience Strategy

File: `frontend/src/store/services/catalogueApi.ts`

- Redux Toolkit RTK Query slice created with `credentials: 'include'` for secure HttpOnly cookie transmission.
- Endpoints:
  - `useGetBrandsQuery`, `useCreateBrandMutation`
  - `useGetCategoriesQuery`, `useCreateCategoryMutation`
  - `useGetSizesQuery`, `useCreateSizeMutation`
  - `useGetThicknessesQuery`, `useCreateThicknessMutation`
  - `useGetProductsQuery`, `useCreateProductWithVariantMutation`
  - `useGetSkusQuery`, `useUpdateSkuPricesMutation`, `useGetSkuPriceHistoryQuery`
- **Resilience Design:**
  - `frontend/src/app/products/new/page.tsx` uses backend data as primary, falling back to local demo DB if the server is offline or unreachable (`FETCH_ERROR`).
  - Upon server validation errors (such as 409 duplicate SKU or 400 price discrepancy), the UI surfaces the exact backend error message to the operator.
  - Successfully committed backend products mirror to local demo repositories for uninterrupted offline workflow support.

---

## 15. UI Verification Against Visual References

- **Product Details Form (`frontend/src/app/products/new/page.tsx`):**
  - Matches Screenshot 1: Step 1 Brand $\rightarrow$ Step 2 Category $\rightarrow$ Step 3 Size pills $\rightarrow$ Step 4 Thickness pills.
  - Pricing & Stock card matches Screenshot 1 with List Price, Purchase %/Price, Retail %/Price, Wholesale %/Price, and stock inputs.
- **Product Preview Sidebar:**
  - Matches Screenshot 2: Real-time mattress preview card displaying live Brand, Category, Size, Thickness, and calculated 3-tier prices.
- **Stock Note:**
  - Clear indicator linking to Manage Stock for multi-branch allocation.

---

## 16. Monorepo Architecture & Verification

The project cleanly follows the designated monorepo structure:
```text
form-erp-dashboard/
├── frontend/
│   ├── src/app/
│   ├── src/store/services/catalogueApi.ts
│   ├── src/store/services/authApi.ts
│   └── package.json (Next.js 16.4.3, React 19)
├── backend/
│   ├── src/modules/catalogue/
│   ├── src/modules/auth/
│   ├── src/modules/branch-account/
│   ├── src/models/
│   ├── src/utils/financial.ts
│   └── package.json (Express.js, TypeScript, Mongoose)
└── package.json (Workspace Root scripts)
```

---

## 17. Test Coverage Summary

```text
======================================================================
TOTAL TEST SUITES: 17 Passed | 0 Failed (100% Pass Rate)
TOTAL TESTS:       219 Passed | 0 Failed (100% Pass Rate)
======================================================================

Backend Vitest Suites (49/49 Passed):
  ✓ src/modules/auth/auth.integration.test.ts (8 tests)
  ✓ src/modules/branch-account/branch-account.test.ts (5 tests)
  ✓ src/modules/catalogue/catalogue.integration.test.ts (17 tests)
  ✓ src/middleware/branchPermission.test.ts (4 tests)
  ✓ src/utils/financial.test.ts (5 tests)
  ✓ src/middleware/auth.test.ts (6 tests)
  ✓ src/modules/health/health.test.ts (4 tests)

Frontend Vitest Suites (170/170 Passed):
  ✓ src/tests/products.test.ts (20 tests)
  ✓ src/tests/unified-pos-credit.test.ts (32 tests)
  ✓ src/tests/purchases.test.ts (30 tests)
  ✓ src/tests/inventory.test.ts (24 tests)
  ✓ src/tests/simplification-manage-stock.test.ts (7 tests)
  ✓ src/tests/pos.test.ts (23 tests)
  ✓ src/tests/branches.test.ts (11 tests)
  ✓ src/tests/financials.test.ts (6 tests)
  ✓ src/tests/users.test.ts (13 tests)
  ✓ src/tests/auth.test.ts (4 tests)

TypeScript & Linting:
  ✓ Backend TSC Build: 0 errors
  ✓ Frontend Next.js 16 Build: 37/37 routes compiled successfully (0 errors)
  ✓ Frontend ESLint: 0 errors
```

---

## 18. Readiness for Backend Flow 04

The product catalogue, variants, three-tier pricing engine, and opening balance hooks are now production-ready. The codebase is prepared for **Backend Flow 04 — Multi-Branch Inventory Management, Stock Transfers & Stockroom Controls**.

