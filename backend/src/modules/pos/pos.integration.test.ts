import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../app.js';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import {
  Account,
  Branch,
  Brand,
  Category,
  Size,
  Thickness,
  Product,
  Variant,
  StockBalance,
  StockLocation,
  Customer,
  SalesInvoice,
  PaymentCollection,
  CustomerLedgerEntry,
} from '../../models/index.js';
import { SALE_TYPES, PAYMENT_ARRANGEMENTS, PAYMENT_STATUSES } from '../../constants/index.js';

describe('Unified POS, Sales Invoices, Customer Credit & Collections Integration Tests', () => {
  const app = createApp();

  let adminCookie: string;
  let branch1Cookie: string;
  let branch2Cookie: string;

  let branch1Id: string;
  let branch2Id: string;
  let location1Id: string;

  let testSku1: string;
  let testSku2: string;

  const branchPassword = process.env.SEED_BRANCH_PASSWORD || 'Branch@Molty2026!';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@Molty2026!';

  beforeAll(async () => {
    await connectDatabase();

    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'admin', password: adminPassword });
    const adminCookies = adminRes.headers['set-cookie'];
    adminCookie = (Array.isArray(adminCookies) ? adminCookies.join(';') : (adminCookies as string)).split(';')[0];

    // 2. Branch 1 (Main Branch) login
    const mainBranch = await Branch.findOne({ loginId: 'mainbranch' });
    branch1Id = mainBranch!._id.toString();
    const loc1 = await StockLocation.findOne({ branchId: mainBranch!._id });
    location1Id = loc1!._id.toString();

    const b1Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'mainbranch', password: branchPassword });
    const b1Cookies = b1Res.headers['set-cookie'];
    branch1Cookie = (Array.isArray(b1Cookies) ? b1Cookies.join(';') : (b1Cookies as string)).split(';')[0];

    // 3. Branch 2 (Wholesale Depot) login
    const wholesaleBranch = await Branch.findOne({ loginId: 'wholesaledepot' });
    branch2Id = wholesaleBranch!._id.toString();

    const b2Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'wholesaledepot', password: branchPassword });
    const b2Cookies = b2Res.headers['set-cookie'];
    branch2Cookie = (Array.isArray(b2Cookies) ? b2Cookies.join(';') : (b2Cookies as string)).split(';')[0];

    // 4. Create Test Products & Variants
    const brand = await Brand.create({
      name: `Brand_POS_${Date.now()}`,
      code: `BP${Date.now().toString().slice(-4)}`,
      status: 'ACTIVE',
    });
    const category = await Category.create({
      brandId: brand._id,
      name: 'POS Mattresses',
      code: 'PM',
      status: 'ACTIVE',
    });
    const size = await Size.findOneAndUpdate(
      { length: 78, width: 72, unit: 'in' },
      { length: 78, width: 72, unit: 'in', displayLabel: '78 × 72' },
      { upsert: true, new: true }
    );
    const thickness = await Thickness.findOneAndUpdate(
      { value: 6, unit: 'in' },
      { value: 6, unit: 'in', displayLabel: '6 inch' },
      { upsert: true, new: true }
    );
    const thickness2 = await Thickness.findOneAndUpdate(
      { value: 5, unit: 'in' },
      { value: 5, unit: 'in', displayLabel: '5 inch' },
      { upsert: true, new: true }
    );

    const product = await Product.create({
      name: `${brand.name} - Dura Luxury`,
      code: `${brand.code}-DL`,
      brandId: brand._id,
      categoryId: category._id,
      status: 'ACTIVE',
    });

    // Variant 1: Retail Rs. 20,000 (2000000 paisa), Wholesale Rs. 18,000, Distributor Rs. 16,000
    testSku1 = `${brand.code}-DL-78X72-6`;
    await Variant.create({
      productId: product._id,
      sku: testSku1,
      sizeId: size._id,
      thicknessId: thickness._id,
      listPrice: 2200000,
      purchasePrice: 1500000,
      retailPrice: 2000000, // Rs. 20,000
      wholesalePrice: 1800000, // Rs. 18,000
      distributorPrice: 1600000, // Rs. 16,000
      status: 'ACTIVE',
    });

    // Variant 2: Single unit for concurrency testing (5 inch)
    testSku2 = `${brand.code}-DL-78X72-5`;
    await Variant.create({
      productId: product._id,
      sku: testSku2,
      sizeId: size._id,
      thicknessId: thickness2._id,
      listPrice: 1000000,
      purchasePrice: 700000,
      retailPrice: 900000, // Rs. 9,000
      wholesalePrice: 800000,
      distributorPrice: 750000,
      status: 'ACTIVE',
    });

    // Set initial stock in Main Branch
    await StockBalance.findOneAndUpdate(
      { branchId: branch1Id, stockLocationId: location1Id, sku: testSku1 },
      { onHand: 50, reserved: 0, reorderLevel: 5 },
      { upsert: true }
    );

    await StockBalance.findOneAndUpdate(
      { branchId: branch1Id, stockLocationId: location1Id, sku: testSku2 },
      { onHand: 1, reserved: 0, reorderLevel: 1 }, // Exactly 1 unit available
      { upsert: true }
    );
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  // ==========================================
  // 1. POS CATALOGUE & AUTHORIZATION
  // ==========================================
  describe('1. POS Catalogue & Stock Availability', () => {
    it('retrieves POS catalogue with active variants and sanitized prices', async () => {
      const res = await request(app)
        .get('/api/v1/pos/catalogue')
        .set('Cookie', [branch1Cookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.variants).toBeDefined();

      const found = res.body.data.variants.find((v: any) => v.sku === testSku1);
      expect(found).toBeDefined();
      expect(found.retailPrice).toBe(20000);
      expect(found.wholesalePrice).toBe(18000);
      expect(found.distributorPrice).toBe(16000);
      // Purchase price must NOT be exposed to POS accounts
      expect(found.purchasePrice).toBeUndefined();
    });

    it('retrieves SKU stock availability for branch without warehouse administration', async () => {
      const res = await request(app)
        .get(`/api/v1/pos/products/${testSku1}/availability`)
        .set('Cookie', [branch1Cookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sku).toBe(testSku1);
      expect(res.body.data.onHand).toBe(50);
      expect(res.body.data.available).toBe(50);
    });
  });

  // ==========================================
  // 2. SCENARIO A: CASH SALE (WALK-IN)
  // ==========================================
  describe('2. Scenario A — Walk-in Cash Sale & Stock Deduction', () => {
    let invoiceNumber: string;

    it('completes walk-in cash sale, calculates change, and atomically decrements inventory', async () => {
      // Stock before checkout: 50
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Cookie', [branch1Cookie])
        .send({
          saleType: SALE_TYPES.WALK_IN,
          paymentArrangement: PAYMENT_ARRANGEMENTS.FULL,
          paymentMethod: 'CASH',
          items: [{ sku: testSku1, quantity: 2, unitPrice: 999999 }], // Fake client price must be ignored
          amountReceived: 45000, // Tendered cash
          cashReceived: 45000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const inv = res.body.data.invoice;
      expect(inv).toBeDefined();

      // Verified authoritative price: 20,000 * 2 = 40,000
      expect(inv.total).toBe(40000);
      expect(inv.paidAmount).toBe(40000);
      expect(inv.balanceDue).toBe(0);
      expect(inv.changeReturned).toBe(5000); // 45,000 - 40,000
      expect(inv.paymentStatus).toBe(PAYMENT_STATUSES.PAID);
      invoiceNumber = inv.invoiceNumber;

      // Verify stock in DB is decremented from 50 to 48
      const bal = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(bal?.onHand).toBe(48);
    });

    it('retrieves printable invoice receipt format', async () => {
      const invoice = await SalesInvoice.findOne({ invoiceNumber });
      const res = await request(app)
        .get(`/api/v1/sales/invoices/${invoice!._id}/receipt`)
        .set('Cookie', [branch1Cookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.invoiceNumber).toBe(invoiceNumber);
      expect(res.body.data.branch).toBeDefined();
      expect(res.body.data.financials.total).toBe(40000);
      expect(res.body.data.financials.changeReturned).toBe(5000);
    });
  });

  // ==========================================
  // 3. SCENARIO B: WHOLESALE SALE WITH PARTIAL CREDIT
  // ==========================================
  describe('3. Scenario B — Wholesale Partial Credit Sale & Customer Ledger', () => {
    let customerId: string;
    let invoiceNumber: string;

    beforeAll(async () => {
      // Create a Wholesale Customer with Rs. 100,000 credit limit
      const cust = await Customer.create({
        name: `Wholesale Client ${Date.now()}`,
        phone: `0300-${Date.now().toString().slice(-7)}`,
        customerType: 'WHOLESALE',
        creditEnabled: true,
        creditLimit: 100000,
        outstandingBalance: 0,
        status: 'ACTIVE',
      });
      customerId = cust._id.toString();
    });

    it('resolves authoritative wholesale price (18,000), accepts partial payment, posts receivable, and updates ledger', async () => {
      // 2 units * Rs. 18,000 = Rs. 36,000. Customer pays Rs. 20,000. Balance due = Rs. 16,000.
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Cookie', [branch1Cookie])
        .send({
          saleType: SALE_TYPES.WHOLESALE,
          paymentArrangement: PAYMENT_ARRANGEMENTS.PARTIAL,
          paymentMethod: 'CASH',
          customerId,
          items: [{ sku: testSku1, quantity: 2 }],
          amountReceived: 20000,
          cashReceived: 20000,
        });

      expect(res.status).toBe(201);
      const inv = res.body.data.invoice;
      expect(inv.total).toBe(36000);
      expect(inv.paidAmount).toBe(20000);
      expect(inv.balanceDue).toBe(16000);
      expect(inv.paymentStatus).toBe(PAYMENT_STATUSES.PARTIAL);
      invoiceNumber = inv.invoiceNumber;

      // Verify Customer Outstanding Balance increased to Rs. 16,000
      const cust = await Customer.findById(customerId);
      expect(cust?.outstandingBalance).toBe(16000);

      // Verify Customer Ledger Entry was created
      const ledger = await CustomerLedgerEntry.findOne({
        customerId,
        referenceInvoiceId: invoiceNumber,
      });
      expect(ledger).toBeDefined();
      expect(ledger?.debit).toBe(36000);
      expect(ledger?.credit).toBe(20000);
      expect(ledger?.runningBalance).toBe(16000);
    });

    it('records payment collection against outstanding invoice and updates customer ledger', async () => {
      // Customer pays Rs. 10,000 towards the outstanding Rs. 16,000
      const res = await request(app)
        .post('/api/v1/collections')
        .set('Cookie', [branch1Cookie])
        .send({
          customerId,
          amount: 10000,
          paymentMethod: 'BANK_TRANSFER',
          reference: 'BANK-TRF-998877',
          notes: 'Customer payment via online transfer',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.appliedAmount).toBe(10000);
      expect(res.body.data.newCustomerOutstanding).toBe(6000);

      // Verify invoice balanceDue decreased from 16,000 to 6,000
      const inv = await SalesInvoice.findOne({ invoiceNumber });
      expect(inv?.paidAmount).toBe(30000); // 20k original + 10k collection
      expect(inv?.balanceDue).toBe(6000);
      expect(inv?.paymentStatus).toBe(PAYMENT_STATUSES.PARTIAL);

      // Verify Customer Outstanding is now 6,000
      const cust = await Customer.findById(customerId);
      expect(cust?.outstandingBalance).toBe(6000);

      // Verify customer ledger has credit of 10,000 with runningBalance of 6,000
      const ledgerEntries = await CustomerLedgerEntry.find({ customerId }).sort({ timestamp: 1 });
      expect(ledgerEntries.length).toBe(2);
      expect(ledgerEntries[1].entryType).toBe('PAYMENT');
      expect(ledgerEntries[1].credit).toBe(10000);
      expect(ledgerEntries[1].runningBalance).toBe(6000);
    });
  });

  // ==========================================
  // 4. SCENARIO C: DISTRIBUTOR FULL CREDIT SALE
  // ==========================================
  describe('4. Scenario C — Distributor Full Credit & Due Date', () => {
    let customerId: string;

    beforeAll(async () => {
      const cust = await Customer.create({
        name: `Distributor Client ${Date.now()}`,
        phone: `0301-${Date.now().toString().slice(-7)}`,
        customerType: 'DISTRIBUTOR',
        creditEnabled: true,
        creditLimit: 200000,
        outstandingBalance: 0,
        status: 'ACTIVE',
      });
      customerId = cust._id.toString();
    });

    it('creates full credit sale at distributor price (16,000) with zero initial cash payment', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Cookie', [branch1Cookie])
        .send({
          saleType: SALE_TYPES.DISTRIBUTOR,
          paymentArrangement: PAYMENT_ARRANGEMENTS.CREDIT,
          paymentMethod: 'CREDIT_30D',
          customerId,
          dueDate: dueDate.toISOString(),
          items: [{ sku: testSku1, quantity: 3 }],
        });

      expect(res.status).toBe(201);
      const inv = res.body.data.invoice;
      // 3 units * 16,000 = 48,000
      expect(inv.total).toBe(48000);
      expect(inv.paidAmount).toBe(0);
      expect(inv.balanceDue).toBe(48000);
      expect(inv.paymentStatus).toBe(PAYMENT_STATUSES.UNPAID);

      const cust = await Customer.findById(customerId);
      expect(cust?.outstandingBalance).toBe(48000);
    });

    it('rejects anonymous full credit checkout without identified customer', async () => {
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Cookie', [branch1Cookie])
        .send({
          saleType: SALE_TYPES.DISTRIBUTOR,
          paymentArrangement: PAYMENT_ARRANGEMENTS.CREDIT,
          paymentMethod: 'CREDIT_30D',
          items: [{ sku: testSku1, quantity: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ANONYMOUS_CREDIT_REJECTED');
    });
  });

  // ==========================================
  // 5. CREDIT LIMITS & OVERRIDE
  // ==========================================
  describe('5. Customer Credit Limit Enforcement & Authorized Override', () => {
    let customerId: string;

    beforeAll(async () => {
      const cust = await Customer.create({
        name: `Strict Credit Client ${Date.now()}`,
        phone: `0302-${Date.now().toString().slice(-7)}`,
        customerType: 'WHOLESALE',
        creditEnabled: true,
        creditLimit: 30000, // Rs. 30,000 limit
        outstandingBalance: 25000, // Available = 5,000
        status: 'ACTIVE',
      });
      customerId = cust._id.toString();
    });

    it('blocks checkout when required credit exceeds available limit (without override)', async () => {
      // 1 unit * 18,000 = 18,000 > 5,000 available
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Cookie', [branch1Cookie])
        .send({
          saleType: SALE_TYPES.WHOLESALE,
          paymentArrangement: PAYMENT_ARRANGEMENTS.CREDIT,
          customerId,
          items: [{ sku: testSku1, quantity: 1 }],
          creditOverride: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CREDIT_LIMIT_EXCEEDED');
    });

    it('permits checkout when explicit supervisor credit override is granted', async () => {
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Cookie', [branch1Cookie])
        .send({
          saleType: SALE_TYPES.WHOLESALE,
          paymentArrangement: PAYMENT_ARRANGEMENTS.CREDIT,
          customerId,
          items: [{ sku: testSku1, quantity: 1 }],
          creditOverride: true,
          creditApprovedBy: 'Store Manager Tariq',
          overrideReason: 'Approved regular seasonal distributor buffer',
        });

      expect(res.status).toBe(201);
      const inv = res.body.data.invoice;
      expect(inv.creditOverride).toBe(true);
      expect(inv.creditApprovedBy).toBe('Store Manager Tariq');
      expect(inv.balanceDue).toBe(18000);
    });
  });

  // ==========================================
  // 6. SCENARIO D: CONCURRENT SALES (OVERSELLING DEFENSE)
  // ==========================================
  describe('6. Scenario D — Concurrent Checkout of Last Stock Item', () => {
    it('simultaneously attempts checkout of 1 available unit: exactly 1 succeeds and 1 fails with 400', async () => {
      // Verify initial available stock is exactly 1
      const initBal = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku2,
      });
      expect(initBal?.onHand).toBe(1);

      // Launch 2 simultaneous checkout requests for the same single unit
      const [req1, req2] = await Promise.all([
        request(app)
          .post('/api/v1/pos/checkout')
          .set('Cookie', [branch1Cookie])
          .send({
            saleType: SALE_TYPES.WALK_IN,
            paymentArrangement: PAYMENT_ARRANGEMENTS.FULL,
            paymentMethod: 'CASH',
            items: [{ sku: testSku2, quantity: 1 }],
          }),
        request(app)
          .post('/api/v1/pos/checkout')
          .set('Cookie', [branch1Cookie])
          .send({
            saleType: SALE_TYPES.WALK_IN,
            paymentArrangement: PAYMENT_ARRANGEMENTS.FULL,
            paymentMethod: 'CASH',
            items: [{ sku: testSku2, quantity: 1 }],
          }),
      ]);

      const statuses = [req1.status, req2.status];
      expect(statuses).toContain(201);
      expect(statuses.some((s) => s === 400 || s === 409)).toBe(true);

      // Verify that final onHand stock in DB is 0, NEVER negative!
      const finalBal = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku2,
      });
      expect(finalBal?.onHand).toBe(0);
    });
  });

  // ==========================================
  // 7. SCENARIO E: BRANCH ISOLATION & SECURITY
  // ==========================================
  describe('7. Scenario E — Branch Security & Invoice Isolation', () => {
    let mainBranchInvoiceId: string;

    beforeAll(async () => {
      const inv = await SalesInvoice.findOne({ branchId: branch1Id });
      mainBranchInvoiceId = inv!._id.toString();
    });

    it('denies Branch 2 user from accessing Branch 1 private invoice (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/sales/invoices/${mainBranchInvoiceId}`)
        .set('Cookie', [branch2Cookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_BRANCH');
    });

    it('denies Branch 2 user from retrieving Branch 1 invoice receipt format (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/sales/invoices/${mainBranchInvoiceId}/receipt`)
        .set('Cookie', [branch2Cookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_BRANCH');
    });

    it('filters sales invoice list to only include invoices belonging to authenticated branch', async () => {
      const res = await request(app)
        .get('/api/v1/sales/invoices')
        .set('Cookie', [branch2Cookie]);

      expect(res.status).toBe(200);
      const invoices = res.body.data;
      for (const inv of invoices) {
        expect(inv.branchId._id.toString() || inv.branchId.toString()).toBe(branch2Id);
      }
    });
  });

  // ==========================================
  // 8. HELD SALES (HOLD & RESUME)
  // ==========================================
  describe('8. Held Sales Management', () => {
    let heldSaleId: string;

    it('persists held cart without deducting physical stock', async () => {
      const stockBefore = (
        await StockBalance.findOne({ branchId: branch1Id, stockLocationId: location1Id, sku: testSku1 })
      )?.onHand;

      const res = await request(app)
        .post('/api/v1/pos/held-sales')
        .set('Cookie', [branch1Cookie])
        .send({
          customerName: 'Customer In Queue',
          saleType: SALE_TYPES.WALK_IN,
          items: [
            {
              sku: testSku1,
              productName: 'Dura Luxury',
              quantity: 2,
              unitPrice: 20000,
              lineTotal: 40000,
            },
          ],
          subtotal: 40000,
          grandTotal: 40000,
        });

      expect(res.status).toBe(201);
      heldSaleId = res.body.data._id;

      // Verify stock was NOT deducted merely because sale was held
      const stockAfter = (
        await StockBalance.findOne({ branchId: branch1Id, stockLocationId: location1Id, sku: testSku1 })
      )?.onHand;
      expect(stockAfter).toBe(stockBefore);
    });

    it('lists held sales scoped to authenticated branch', async () => {
      const res = await request(app)
        .get('/api/v1/pos/held-sales')
        .set('Cookie', [branch1Cookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.some((h: any) => h._id === heldSaleId)).toBe(true);
    });

    it('resumes and deletes held sale upon resumption', async () => {
      const res = await request(app)
        .post(`/api/v1/pos/held-sales/${heldSaleId}/resume`)
        .set('Cookie', [branch1Cookie]);

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(heldSaleId);

      // Verify held sale is now deleted from held storage
      const checkRes = await request(app)
        .get('/api/v1/pos/held-sales')
        .set('Cookie', [branch1Cookie]);
      expect(checkRes.body.data.some((h: any) => h._id === heldSaleId)).toBe(false);
    });
  });

  // ==========================================
  // 9. SALES REVENUE VS COLLECTIONS RECONCILIATION
  // ==========================================
  describe('9. Sales Summary & Revenue Distinction', () => {
    it('returns sales metrics and does not double-count collections as revenue', async () => {
      const res = await request(app)
        .get('/api/v1/sales/summary')
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.grossInvoicedSales).toBeGreaterThan(0);
      expect(data.netInvoicedSales).toBeGreaterThan(0);
      expect(data.collectionsRecovered).toBeDefined();
      // Total cash collected = cash at POS + collections, but revenue = netInvoicedSales
      expect(data.totalCashCollected).toBe(data.cashReceivedAtPOS + data.collectionsRecovered);
    });
  });
});
