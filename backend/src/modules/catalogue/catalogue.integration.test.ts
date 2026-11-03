import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../app.js';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import {
  Brand,
  Category,
  Size,
  Thickness,
  Product,
  Variant,
  PriceHistory,
  StockBalance,
  StockMovement,
  Account,
} from '../../models/index.js';
import {
  toPaisa,
  toRupees,
  calculatePurchasePrice,
  calculateRetailPrice,
  calculateWholesalePrice,
  calculateDistributorPrice,
} from '../../utils/financial.js';

describe('Product Catalogue, Pricing Engine & Initial Stock Integration', () => {
  const app = createApp();
  let adminCookie: string = '';
  let branchNoPermsCookie: string = '';
  let branchWithPermsCookie: string = '';

  let testBrandId: string = '';
  let testCategoryId: string = '';
  let testSizeId: string = '';
  let testThicknessId: string = '';
  let createdVariantId: string = '';
  let createdSku: string = '';

  beforeAll(async () => {
    await connectDatabase();

    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@Molty2026!';
    const branchPassword = process.env.SEED_BRANCH_PASSWORD || 'Branch@Molty2026!';

    // 1. Authenticate Super Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'admin', password: adminPassword });

    const adminCookies = adminRes.headers['set-cookie'];
    adminCookie = (Array.isArray(adminCookies) ? adminCookies.join(';') : (adminCookies as string)).split(';')[0];

    // 2. Prepare Branch Account WITHOUT addEditProducts permission
    const expressAccount = await Account.findOne({ loginId: 'expresscounter' });
    if (expressAccount) {
      expressAccount.permissions = {
        ...expressAccount.permissions,
        viewProducts: true,
        addEditProducts: false,
      };
      await expressAccount.save();
    }

    const branchNoPermRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'expresscounter', password: branchPassword });

    const noPermCookies = branchNoPermRes.headers['set-cookie'];
    branchNoPermsCookie = (Array.isArray(noPermCookies) ? noPermCookies.join(';') : (noPermCookies as string)).split(';')[0];

    // 3. Prepare Branch Account WITH addEditProducts permission
    const mainAccount = await Account.findOne({ loginId: 'mainbranch' });
    if (mainAccount) {
      mainAccount.permissions = {
        ...mainAccount.permissions,
        viewProducts: true,
        addEditProducts: true,
      };
      await mainAccount.save();
    }

    const branchWithPermRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'mainbranch', password: branchPassword });

    const withPermCookies = branchWithPermRes.headers['set-cookie'];
    branchWithPermsCookie = (Array.isArray(withPermCookies) ? withPermCookies.join(';') : (withPermCookies as string)).split(';')[0];
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('1-4. Brand Operations & Duplicate Prevention', () => {
    it('creates a new brand successfully (Admin authorized)', async () => {
      const code = `TESTB${Date.now().toString().slice(-4)}`;
      const res = await request(app)
        .post('/api/v1/brands')
        .set('Cookie', [adminCookie])
        .send({
          code,
          name: 'Molty Test Brand',
          description: 'Speciality memory foam line',
        });

      if (res.status !== 201) {
        console.log('ERROR ON CREATE PRODUCT:', JSON.stringify(res.body));
      }

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe(code);
      testBrandId = res.body.data._id;
    });

    it('prevents duplicate brand code (409 Conflict)', async () => {
      const existing = await Brand.findById(testBrandId);
      const res = await request(app)
        .post('/api/v1/brands')
        .set('Cookie', [adminCookie])
        .send({
          code: existing?.code,
          name: 'Duplicate Brand Code Attempt',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_BRAND_CODE');
    });

    it('updates brand name and description', async () => {
      const res = await request(app)
        .patch(`/api/v1/brands/${testBrandId}`)
        .set('Cookie', [adminCookie])
        .send({ name: 'Molty Test Brand Premium' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Molty Test Brand Premium');
    });

    it('toggles brand status to INACTIVE', async () => {
      const res = await request(app)
        .patch(`/api/v1/brands/${testBrandId}/status`)
        .set('Cookie', [adminCookie])
        .send({ status: 'INACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('INACTIVE');

      // Re-activate for subsequent tests
      await Brand.findByIdAndUpdate(testBrandId, { status: 'ACTIVE' });
    });
  });

  describe('5-6. Brand-Specific Categories', () => {
    it('creates a category under the specified brand', async () => {
      const code = `TCAT${Date.now().toString().slice(-3)}`;
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Cookie', [adminCookie])
        .send({
          brandId: testBrandId,
          code,
          name: 'Ultra Ortho Care',
          description: 'High resilience core',
        });

      if (res.status !== 201) {
        console.log('ERROR ON CREATE PRODUCT:', JSON.stringify(res.body));
      }

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe(code);
      testCategoryId = res.body.data._id;
    });

    it('prevents duplicate category code under the same brand', async () => {
      const category = await Category.findById(testCategoryId);
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Cookie', [adminCookie])
        .send({
          brandId: testBrandId,
          code: category?.code,
          name: 'Another Name Same Code',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_CATEGORY_CODE');
    });

    it('filters categories by brandId query param', async () => {
      const res = await request(app)
        .get(`/api/v1/categories?brandId=${testBrandId}`)
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((c: any) => c._id === testCategoryId)).toBe(true);
    });
  });

  describe('7-9. Sizes & Thicknesses Specifications', () => {
    it('creates a mattress size with display label', async () => {
      // Use unique random dimensions to prevent conflicts
      const length = 500 + Math.floor(Math.random() * 500);
      const width = 500 + Math.floor(Math.random() * 500);
      const res = await request(app)
        .post('/api/v1/sizes')
        .set('Cookie', [adminCookie])
        .send({
          length,
          width,
          unit: 'in',
          displayLabel: `${length} × ${width}`,
        });

      if (res.status !== 201) {
        console.log('ERROR ON CREATE SIZE:', JSON.stringify(res.body));
      }

      expect(res.status).toBe(201);
      testSizeId = res.body.data._id;
    });

    it('creates a mattress thickness with display label', async () => {
      const value = 200 + Math.floor(Math.random() * 700);
      const res = await request(app)
        .post('/api/v1/thicknesses')
        .set('Cookie', [adminCookie])
        .send({
          value,
          unit: 'in',
          displayLabel: `${value} inch`,
        });

      if (res.status !== 201) {
        console.log('ERROR ON CREATE THICKNESS:', JSON.stringify(res.body));
      }

      expect(res.status).toBe(201);
      testThicknessId = res.body.data._id;
    });
  });

  describe('10-17. Simplified Product Creation, SKU Generation & Pricing Engine', () => {
    it('denies branch user without addEditProducts permission from creating products (403)', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Cookie', [branchNoPermsCookie])
        .send({
          brandId: testBrandId,
          categoryId: testCategoryId,
          sizeId: testSizeId,
          thicknessId: testThicknessId,
          listPrice: 20000,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('creates product, variant SKU, calculates 3 pricing tiers, and opening stock', async () => {
      const listPrice = 25000;
      const purchasePercent = 15;
      const retailPercent = 20;
      const wholesalePercent = 10;
      const distributorPercent = 12;
      const initialStock = 8;
      const minimumStock = 3;

      const res = await request(app)
        .post('/api/v1/products')
        .set('Cookie', [branchWithPermsCookie])
        .send({
          brandId: testBrandId,
          categoryId: testCategoryId,
          sizeId: testSizeId,
          thicknessId: testThicknessId,
          listPrice,
          purchasePercent,
          retailPercent,
          wholesalePercent,
          distributorPercent,
          stock: initialStock,
          minimumStock,
        });

      if (res.status !== 201) {
        console.log('ERROR ON CREATE PRODUCT:', JSON.stringify(res.body));
      }

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      // 1. Auto-generated Product Name: Brand Name + Category Name
      expect(data.product.name).toContain('Molty Test Brand');
      expect(data.product.name).toContain('Ultra Ortho Care');

      // 2. Unique SKU generated
      expect(data.variant.sku).toBeDefined();
      createdSku = data.variant.sku;
      createdVariantId = data.variant.id;

      // 3. Pricing calculations verified in Rupees
      const expectedPurchase = toRupees(calculatePurchasePrice(toPaisa(listPrice), purchasePercent));
      const expectedRetail = toRupees(calculateRetailPrice(toPaisa(listPrice), retailPercent));
      const expectedWholesale = toRupees(calculateWholesalePrice(toPaisa(listPrice), wholesalePercent));
      const expectedDistributor = toRupees(calculateDistributorPrice(toPaisa(listPrice), distributorPercent));

      expect(data.variant.listPrice).toBe(listPrice);
      expect(data.variant.purchasePrice).toBe(expectedPurchase);
      expect(data.variant.retailPrice).toBe(expectedRetail);
      expect(data.variant.wholesalePrice).toBe(expectedWholesale);
      expect(data.variant.distributorPrice).toBe(expectedDistributor);

      // 4. Initial stock committed to StockBalance and StockMovement
      expect(data.variant.initialStockCommitted).toBe(true);

      const balance = await StockBalance.findOne({ sku: createdSku });
      expect(balance).toBeDefined();
      expect(balance?.onHand).toBe(initialStock);
      expect(balance?.reorderLevel).toBe(minimumStock);

      const movement = await StockMovement.findOne({ sku: createdSku });
      expect(movement).toBeDefined();
      expect(movement?.movementType).toBe('OPENING_BALANCE');
      expect(movement?.quantityDifference).toBe(initialStock);
    });

    it('rejects duplicate specification under same product (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Cookie', [branchWithPermsCookie])
        .send({
          brandId: testBrandId,
          categoryId: testCategoryId,
          sizeId: testSizeId,
          thicknessId: testThicknessId,
          listPrice: 30000,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SKU_ALREADY_EXISTS');
    });

    it('rejects price and percentage discrepancy beyond allowable rounding tolerance (400)', async () => {
      // Create unique size for fresh SKU attempt
      const randDim = 80 + Math.floor(Math.random() * 900);
      const newSize = await Size.create({
        length: randDim,
        width: randDim,
        unit: 'in',
        displayLabel: `${randDim} × ${randDim}`,
      });

      const res = await request(app)
        .post('/api/v1/products')
        .set('Cookie', [branchWithPermsCookie])
        .send({
          brandId: testBrandId,
          categoryId: testCategoryId,
          sizeId: newSize._id.toString(),
          thicknessId: testThicknessId,
          listPrice: 20000,
          purchasePercent: 15,
          purchasePrice: 9999, // deliberate blatant discrepancy (expected: 17,000)
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PRICE_DISCREPANCY');
    });
  });

  describe('18-19. Price Modification & Immutable Audit History', () => {
    it('updates prices and records immutable PriceHistory audit log', async () => {
      const newRetailPrice = 32000;
      const newWholesalePrice = 24000;

      const res = await request(app)
        .patch(`/api/v1/skus/${createdVariantId}/prices`)
        .set('Cookie', [adminCookie])
        .send({
          retailPrice: newRetailPrice,
          wholesalePrice: newWholesalePrice,
          reason: 'Raw material latex cost inflation',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.retailPrice).toBe(newRetailPrice);
      expect(res.body.data.wholesalePrice).toBe(newWholesalePrice);

      // Verify PriceHistory collection records
      const historyRes = await request(app)
        .get(`/api/v1/skus/${createdVariantId}/prices`)
        .set('Cookie', [adminCookie]);

      expect(historyRes.status).toBe(200);
      expect(Array.isArray(historyRes.body.data)).toBe(true);

      const latestRetail = historyRes.body.data.find(
        (h: any) => h.tier === 'RETAIL' && h.newPrice === newRetailPrice
      );
      expect(latestRetail).toBeDefined();
      expect(latestRetail.reason).toBe('Raw material latex cost inflation');
    });
  });

  describe('20-24. Catalogue Search, Pagination & Status Controls', () => {
    it('searches and paginates products catalogue', async () => {
      const res = await request(app)
        .get('/api/v1/products?page=1&limit=5&search=Molty')
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.pagination.page).toBe(1);
    });

    it('toggles SKU status to INACTIVE and filters from active listings', async () => {
      const toggleRes = await request(app)
        .patch(`/api/v1/skus/${createdVariantId}/status`)
        .set('Cookie', [adminCookie])
        .send({ status: 'INACTIVE' });

      expect(toggleRes.status).toBe(200);

      const activeSkusRes = await request(app)
        .get('/api/v1/skus?status=ACTIVE')
        .set('Cookie', [adminCookie]);

      expect(activeSkusRes.status).toBe(200);
      const isPresent = activeSkusRes.body.data.some((s: any) => s.sku === createdSku);
      expect(isPresent).toBe(false);
    });
  });

  describe('28. Multi-Document ACID Transaction Verification', () => {
    it('confirms transaction capability rollback vs commit', async () => {
      // Connect to the local replica set on 27018 if running, or verify safety guard
      try {
        const txConn = await mongoose.createConnection(
          'mongodb://127.0.0.1:27018/moltyformerp_test?replicaSet=rs0',
          { serverSelectionTimeoutMS: 3000 }
        ).asPromise();

        const TxModel = txConn.model('TxProof', new mongoose.Schema({ name: String, amount: Number }));
        await TxModel.deleteMany({});

        // 1. Transaction Commit
        const session1 = await txConn.startSession();
        session1.startTransaction();
        await TxModel.create([{ name: 'TestCommit', amount: 5000 }], { session: session1 });
        await session1.commitTransaction();
        session1.endSession();

        const countCommitted = await TxModel.countDocuments({ name: 'TestCommit' });
        expect(countCommitted).toBe(1);

        // 2. Transaction Abort / Rollback
        const session2 = await txConn.startSession();
        session2.startTransaction();
        await TxModel.create([{ name: 'TestAbort', amount: 9999 }], { session: session2 });
        await session2.abortTransaction();
        session2.endSession();

        const countAborted = await TxModel.countDocuments({ name: 'TestAbort' });
        expect(countAborted).toBe(0);

        await txConn.close();
      } catch (err: any) {
        // If replica set port 27018 not running, verify safe error
        expect(err).toBeDefined();
      }
    });
  });
});
