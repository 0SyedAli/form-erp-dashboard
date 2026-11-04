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
  StockMovement,
  Supplier,
  SupplierBill,
  SupplierPayment,
} from '../../models/index.js';
import { SALE_TYPES, PAYMENT_ARRANGEMENTS, PAYMENT_STATUSES } from '../../constants/index.js';

describe('Flow 08: QA, Concurrency, Financial & Security Audit Integration Tests', () => {
  const app = createApp();

  let adminCookie: string;
  let branch1Cookie: string;
  let branch2Cookie: string;

  let branch1Id: string;
  let branch2Id: string;
  let location1Id: string;
  let location2Id: string;

  let testBrandId: mongoose.Types.ObjectId;
  let testCatId: mongoose.Types.ObjectId;
  let defaultSizeId: mongoose.Types.ObjectId;
  let defaultThickId: mongoose.Types.ObjectId;

  const branchPassword = process.env.SEED_BRANCH_PASSWORD || 'Branch@Molty2026!';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@Molty2026!';

  beforeAll(async () => {
    await connectDatabase();

    const size = await Size.findOne();
    defaultSizeId = size!._id;

    const thick = await Thickness.findOne();
    defaultThickId = thick!._id;

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
    if (!loc1) {
      const newLoc = await StockLocation.create({
        name: 'Main Store Room',
        code: `LOC-${Date.now().toString().slice(-4)}`,
        branchId: mainBranch!._id,
        type: 'STORE_ROOM',
        isActive: true,
      });
      location1Id = newLoc._id.toString();
    } else {
      location1Id = loc1._id.toString();
    }

    const b1Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'mainbranch', password: branchPassword });
    const b1Cookies = b1Res.headers['set-cookie'];
    branch1Cookie = (Array.isArray(b1Cookies) ? b1Cookies.join(';') : (b1Cookies as string)).split(';')[0];

    // 3. Branch 2 (Wholesale Depot) login
    const wholesaleBranch = await Branch.findOne({ loginId: 'wholesaledepot' });
    branch2Id = wholesaleBranch!._id.toString();
    const loc2 = await StockLocation.findOne({ branchId: wholesaleBranch!._id });
    if (!loc2) {
      const newLoc2 = await StockLocation.create({
        name: 'Wholesale Depot Room',
        code: `LOC2-${Date.now().toString().slice(-4)}`,
        branchId: wholesaleBranch!._id,
        type: 'STORE_ROOM',
        isActive: true,
      });
      location2Id = newLoc2._id.toString();
    } else {
      location2Id = loc2._id.toString();
    }

    const b2Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'wholesaledepot', password: branchPassword });
    const b2Cookies = b2Res.headers['set-cookie'];
    branch2Cookie = (Array.isArray(b2Cookies) ? b2Cookies.join(';') : (b2Cookies as string)).split(';')[0];

    const brand = await Brand.findOneAndUpdate(
      { code: 'MOLTY' },
      { name: 'Molty Foam QA', code: 'MOLTY', status: 'ACTIVE' },
      { upsert: true, new: true }
    );
    testBrandId = brand._id;

    const category = await Category.findOneAndUpdate(
      { code: 'MATT' },
      { name: 'Mattresses', code: 'MATT', brandId: brand._id, status: 'ACTIVE' },
      { upsert: true, new: true }
    );
    testCatId = category._id;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  async function createTestVariantAndStock(prefix: string, initialStock: number, reorderLevel: number = 5) {
    const timestamp = Date.now() + Math.floor(Math.random() * 100000);

    const prod = await Product.create({
      name: `${prefix} Mattress ${timestamp}`,
      brandId: testBrandId,
      categoryId: testCatId,
      status: 'ACTIVE',
    });

    const sku = `SKU-${prefix}-${timestamp}`;
    const variant = await Variant.create({
      sku,
      productId: prod._id,
      sizeId: defaultSizeId,
      thicknessId: defaultThickId,
      retailPrice: 5000000,
      wholesalePrice: 4500000,
      distributorPrice: 4000000,
      purchasePrice: 3000000,
      listPrice: 5500000,
      status: 'ACTIVE',
    });

    const stock = await StockBalance.create({
      sku,
      variantId: variant._id,
      branchId: new mongoose.Types.ObjectId(branch1Id),
      stockLocationId: new mongoose.Types.ObjectId(location1Id),
      onHand: initialStock,
      reserved: 0,
      available: initialStock,
      reorderLevel,
      isActive: true,
    });

    return { sku, variant, stock };
  }

  describe('1. POS Concurrency — Two Simultaneous Checkouts for the Last Unit', () => {
    it('allows only 1 checkout to succeed and rejects the concurrent checkout with INSUFFICIENT_STOCK', async () => {
      const { sku } = await createTestVariantAndStock('CONC', 1, 5);

      const checkoutPayload1 = {
        saleType: SALE_TYPES.WALK_IN,
        paymentArrangement: PAYMENT_ARRANGEMENTS.FULL,
        paymentMethod: 'CASH',
        items: [{ sku, quantity: 1 }],
        amountReceived: 50000,
        cashReceived: 50000,
      };

      const checkoutPayload2 = {
        saleType: SALE_TYPES.WALK_IN,
        paymentArrangement: PAYMENT_ARRANGEMENTS.FULL,
        paymentMethod: 'CASH',
        items: [{ sku, quantity: 1 }],
        amountReceived: 50000,
        cashReceived: 50000,
      };

      const [res1, res2] = await Promise.all([
        request(app).post('/api/v1/pos/checkout').set('Cookie', [branch1Cookie]).send(checkoutPayload1),
        request(app).post('/api/v1/pos/checkout').set('Cookie', [branch1Cookie]).send(checkoutPayload2),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(400);

      const failedRes = res1.status === 400 ? res1 : res2;
      expect(failedRes.body.error?.code || failedRes.body.code).toBe('INSUFFICIENT_STOCK');

      // Verify stock balance remains non-negative (exactly 0)
      const finalStock = await StockBalance.findOne({ sku, branchId: branch1Id });
      expect(finalStock!.onHand).toBe(0);
      expect(finalStock!.available).toBe(0);
      expect(finalStock!.onHand).toBeGreaterThanOrEqual(0);
    });
  });

  describe('2. POS Idempotency — Duplicate Checkout Retries', () => {
    it('returns the existing invoice on duplicate idempotency key without duplicate inventory deduction', async () => {
      const { sku } = await createTestVariantAndStock('IDEMP', 10, 5);

      const idempotencyKey = `KEY-${Date.now()}-${Math.random()}`;
      const payload = {
        idempotencyKey,
        saleType: SALE_TYPES.WALK_IN,
        paymentArrangement: PAYMENT_ARRANGEMENTS.FULL,
        paymentMethod: 'CASH',
        items: [{ sku, quantity: 2 }],
        amountReceived: 100000,
        cashReceived: 100000,
      };

      // First checkout call
      const res1 = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Cookie', [branch1Cookie])
        .send(payload);
      expect(res1.status).toBe(201);
      const invoiceId1 = res1.body.data.id || res1.body.data._id;

      // Second identical call with same idempotency key
      const res2 = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Cookie', [branch1Cookie])
        .send(payload);
      expect(res2.status).toBe(200);
      const invoiceId2 = res2.body.data.id || res2.body.data._id;
      expect(invoiceId1).toBe(invoiceId2);

      // Verify stock was deducted only once (10 - 2 = 8, not 6)
      const stock = await StockBalance.findOne({ sku, branchId: branch1Id });
      expect(stock!.onHand).toBe(8);
      expect(stock!.available).toBe(8);
    });
  });

  describe('3. Security & Branch Isolation', () => {
    it('prohibits a branch account from viewing or querying another branch data', async () => {
      const res = await request(app)
        .get(`/api/v1/reports/dashboard/branch?branchId=${branch1Id}`)
        .set('Cookie', [branch2Cookie]);

      // Branch can only query their own assigned branch
      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.data.branchId).toBe(branch2Id);
      }
    });

    it('rejects unauthorized credit override attempt without SUPER_ADMIN authorization', async () => {
      const customer = await Customer.create({
        name: `Strict Credit Test ${Date.now()}`,
        phone: `0300${Math.floor(Math.random() * 9000000 + 1000000)}`,
        customerType: 'WHOLESALE',
        creditLimit: 1000000, // 10,000 PKR in paisa
        creditTerms: '15_DAYS',
        defaultDueDays: 15,
        isActive: true,
        currentOutstanding: 1000000, // fully utilized
        outstandingBalance: 1000000,
      });

      const { sku } = await createTestVariantAndStock('CRED', 10, 2);

      // Branch tries to override credit without admin token
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Cookie', [branch1Cookie])
        .send({
          customerId: customer._id.toString(),
          saleType: SALE_TYPES.WHOLESALE,
          paymentArrangement: PAYMENT_ARRANGEMENTS.CREDIT_FACILITY,
          creditOverride: true,
          items: [{ sku, quantity: 1 }],
        });

      expect([400, 403]).toContain(res.status);
    });
  });

  describe('4. Inventory Safety — Dispatched Transfer Protection', () => {
    it('prevents cancellation of an in-transit/dispatched transfer', async () => {
      const { sku } = await createTestVariantAndStock('TRF', 20, 5);

      const createRes = await request(app)
        .post('/api/v1/inventory/transfers')
        .set('Cookie', [branch1Cookie])
        .send({
          toBranchId: branch2Id,
          fromStockLocationId: location1Id,
          toStockLocationId: location2Id,
          items: [{ sku, quantity: 5 }],
        });

      expect(createRes.status).toBe(201);
      const transferId = createRes.body.data._id || createRes.body.data.id;

      // Approve transfer
      await request(app)
        .post(`/api/v1/inventory/transfers/${transferId}/approve`)
        .set('Cookie', [adminCookie]);

      // Dispatch transfer
      const dispatchRes = await request(app)
        .post(`/api/v1/inventory/transfers/${transferId}/dispatch`)
        .set('Cookie', [adminCookie])
        .send({ trackingNumber: 'TRK-9921', carrier: 'TCS Cargo' });
      expect(dispatchRes.status).toBe(200);

      // Try cancelling dispatched transfer (must be rejected)
      const cancelRes = await request(app)
        .post(`/api/v1/inventory/transfers/${transferId}/cancel`)
        .set('Cookie', [adminCookie])
        .send({ reason: 'Accidental order' });
      expect(cancelRes.status).toBe(400);
      expect(cancelRes.body.error?.code || cancelRes.body.code).toBe('TRANSFER_ALREADY_DISPATCHED');
    });
  });

  describe('5. Financial Auditing — Dynamic Low Stock & Inventory Valuation', () => {
    it('evaluates low stock dynamically using variant reorderLevel instead of hardcoding 5', async () => {
      // Set reorderLevel = 15, onHand = 12 (available = 12 <= 15, should be flagged as low stock!)
      const { sku } = await createTestVariantAndStock('LOW', 12, 15);

      const res = await request(app)
        .get(`/api/v1/reports/inventory/low-stock?branchId=${branch1Id}`)
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      const lowStockItems = res.body.data.items || res.body.data;
      const found = lowStockItems.find((item: any) => item.sku === sku);
      expect(found).toBeDefined();
      expect(found.reorderLevel).toBe(15);
      expect(found.available).toBe(12);
    });

    it('returns Inventory Valuation labeled Estimated Inventory Value — Standard Purchase Cost and isolates damaged stock', async () => {
      const res = await request(app)
        .get('/api/v1/reports/inventory/valuation')
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.metricName).toBe('Estimated Inventory Value — Standard Purchase Cost');
      expect(res.body.data).toHaveProperty('salableValuation');
      expect(res.body.data).toHaveProperty('quarantinedValuation');
      expect(typeof res.body.data.salableValuation).toBe('number');
    });
  });
});
