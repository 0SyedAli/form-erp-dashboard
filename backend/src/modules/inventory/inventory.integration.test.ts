import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../app.js';
import { Account } from '../../models/account.model.js';
import { Branch } from '../../models/branch.model.js';
import { StockLocation } from '../../models/stockLocation.model.js';
import { Brand } from '../../models/brand.model.js';
import { Category } from '../../models/category.model.js';
import { Size } from '../../models/size.model.js';
import { Thickness } from '../../models/thickness.model.js';
import { Product } from '../../models/product.model.js';
import { Variant } from '../../models/variant.model.js';
import { StockBalance } from '../../models/stockBalance.model.js';
import { StockMovement } from '../../models/stockMovement.model.js';
import { StockTransfer, TRANSFER_STATUSES } from '../../models/stockTransfer.model.js';
import { StockReceipt } from '../../models/stockReceipt.model.js';
import { StockAdjustment } from '../../models/stockAdjustment.model.js';
import { Session } from '../../models/session.model.js';
import { ACCOUNT_ROLES, STOCK_LOCATION_TYPES, STOCK_MOVEMENT_TYPES } from '../../constants/index.js';

describe('Inventory Module & Branch-Wise Stock Integration Tests', () => {
  const app = createApp();

  let adminCookie: string;
  let branch1Cookie: string;
  let branch2Cookie: string;
  let branchNoStockCookie: string;

  let branch1Id: string;
  let branch2Id: string;
  let branchNoStockId: string;

  let location1Id: string;
  let location2Id: string;

  let testSku1: string;
  let testSku2: string;
  let testVariantId: string;

  beforeAll(async () => {
    // Ensure connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/moltyformerp?replicaSet=rs0');
    }

    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@Molty2026!';
    const branchPassword = process.env.SEED_BRANCH_PASSWORD || 'Branch@Molty2026!';

    // 1. Authenticate Super Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'admin', password: adminPassword });

    const adminCookies = adminRes.headers['set-cookie'];
    adminCookie = (Array.isArray(adminCookies) ? adminCookies.join(';') : (adminCookies as string)).split(';')[0];

    // 2. Setup Branch 1 (Main Branch)
    const mainBranch = await Branch.findOne({ loginId: 'mainbranch' });
    branch1Id = mainBranch!._id.toString();
    const loc1 = await StockLocation.findOne({ branchId: mainBranch!._id });
    location1Id = loc1!._id.toString();

    const mainAccount = await Account.findOne({ loginId: 'mainbranch' });
    mainAccount!.permissions = {
      ...mainAccount!.permissions,
      viewStock: true,
      manageStock: true,
      stockTransfers: true,
    };
    await mainAccount!.save();

    const b1Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'mainbranch', password: branchPassword });
    const b1Cookies = b1Res.headers['set-cookie'];
    branch1Cookie = (Array.isArray(b1Cookies) ? b1Cookies.join(';') : (b1Cookies as string)).split(';')[0];

    // 3. Setup Branch 2 (Wholesale Depot)
    const wholesaleBranch = await Branch.findOne({ loginId: 'wholesaledepot' });
    branch2Id = wholesaleBranch!._id.toString();
    const loc2 = await StockLocation.findOne({ branchId: wholesaleBranch!._id });
    location2Id = loc2!._id.toString();

    const wholesaleAccount = await Account.findOne({ loginId: 'wholesaledepot' });
    wholesaleAccount!.permissions = {
      ...wholesaleAccount!.permissions,
      viewStock: true,
      manageStock: true,
      stockTransfers: true,
    };
    await wholesaleAccount!.save();

    const b2Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'wholesaledepot', password: branchPassword });
    const b2Cookies = b2Res.headers['set-cookie'];
    branch2Cookie = (Array.isArray(b2Cookies) ? b2Cookies.join(';') : (b2Cookies as string)).split(';')[0];

    // 4. Setup Branch without stock permissions (Express Counter)
    const expressAccount = await Account.findOne({ loginId: 'expresscounter' });
    expressAccount!.permissions = {
      ...expressAccount!.permissions,
      viewStock: false,
      manageStock: false,
      stockTransfers: false,
    };
    await expressAccount!.save();

    const bNoRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'expresscounter', password: branchPassword });
    const bNoCookies = bNoRes.headers['set-cookie'];
    branchNoStockCookie = (Array.isArray(bNoCookies) ? bNoCookies.join(';') : (bNoCookies as string)).split(';')[0];

    // 5. Setup Test Products & Variants
    const brand = await Brand.create({
      name: `Brand_${Date.now()}`,
      code: `B${Date.now().toString().slice(-4)}`,
      status: 'ACTIVE',
    });
    const category = await Category.create({
      brandId: brand._id,
      name: 'Foam Test',
      code: 'FT',
      status: 'ACTIVE',
    });
    const size = await Size.findOneAndUpdate(
      { length: 78, width: 72, unit: 'in' },
      { length: 78, width: 72, unit: 'in', displayLabel: '78 × 72' },
      { upsert: true, new: true }
    );
    const thickness = await Thickness.findOneAndUpdate(
      { value: 5, unit: 'in' },
      { value: 5, unit: 'in', displayLabel: '5 inch' },
      { upsert: true, new: true }
    );
    const thickness2 = await Thickness.findOneAndUpdate(
      { value: 6, unit: 'in' },
      { value: 6, unit: 'in', displayLabel: '6 inch' },
      { upsert: true, new: true }
    );
    const product = await Product.create({
      name: `${brand.name} - Foam Test`,
      code: `${brand.code}-FT`,
      brandId: brand._id,
      categoryId: category._id,
      status: 'ACTIVE',
    });

    testSku1 = `${brand.code}-FT-78X72-5`;
    const v1 = await Variant.create({
      productId: product._id,
      sku: testSku1,
      sizeId: size._id,
      thicknessId: thickness._id,
      listPrice: 2000000,
      purchasePrice: 1700000,
      retailPrice: 2100000,
      wholesalePrice: 1800000,
      distributorPrice: 1750000,
      status: 'ACTIVE',
    });
    testVariantId = v1._id.toString();

    testSku2 = `${brand.code}-FT-78X72-6`;
    await Variant.create({
      productId: product._id,
      sku: testSku2,
      sizeId: size._id,
      thicknessId: thickness2._id,
      listPrice: 2400000,
      purchasePrice: 2000000,
      retailPrice: 2500000,
      wholesalePrice: 2160000,
      distributorPrice: 2050000,
      status: 'ACTIVE',
    });
  });

  afterAll(async () => {
    // Clean up test collections
    await StockBalance.deleteMany({ branchId: { $in: [branch1Id, branch2Id, branchNoStockId] } });
    await StockMovement.deleteMany({ branchId: { $in: [branch1Id, branch2Id, branchNoStockId] } });
    await StockTransfer.deleteMany({ fromBranchId: { $in: [branch1Id, branch2Id] } });
    await StockReceipt.deleteMany({ branchId: { $in: [branch1Id, branch2Id] } });
    await StockAdjustment.deleteMany({ branchId: { $in: [branch1Id, branch2Id] } });
  });

  // ==========================================
  // SCENARIO 1 & 2: STOCK BALANCE & ISOLATION
  // ==========================================
  describe('1-2. Stock Balances & Branch Isolation', () => {
    it('denies branch user without viewStock permission from reading stock (403)', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/stock')
        .set('Cookie', [branchNoStockCookie]);

      expect(res.status).toBe(403);
    });

    it('returns empty balance list for freshly provisioned location', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/stock')
        .set('Cookie', [branch1Cookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('enforces branch isolation: branch user cannot see another branch balances', async () => {
      // Create a balance in branch 2
      await StockBalance.create({
        branchId: new mongoose.Types.ObjectId(branch2Id),
        stockLocationId: new mongoose.Types.ObjectId(location2Id),
        sku: testSku1,
        onHand: 50,
        reserved: 5,
        reorderLevel: 10,
      });

      // Branch 1 user queries stock with explicit branchId of branch 2
      const res = await request(app)
        .get(`/api/v1/inventory/stock?branchId=${branch2Id}`)
        .set('Cookie', [branch1Cookie]);

      expect(res.status).toBe(200);
      // Backend must override query.branchId with userContext.branchId for non-admin accounts
      const allBelongToBranch1 = res.body.data.every(
        (b: any) => b.branchId === branch1Id
      );
      expect(allBelongToBranch1).toBe(true);
    });
  });

  // ==========================================
  // SCENARIO 3 & 4: OPENING STOCK
  // ==========================================
  describe('3-4. Opening Stock & Duplicate Guard', () => {
    it('posts opening stock balance and records immutable StockMovement', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/opening-stock')
        .set('Cookie', [adminCookie])
        .send({
          branchId: branch1Id,
          stockLocationId: location1Id,
          sku: testSku1,
          quantity: 25,
          minimumStock: 5,
          notes: 'Initial warehouse audit',
        });

      if (res.status !== 201) {
        console.log('ERROR OPENING STOCK:', JSON.stringify(res.body));
      }
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.balance.onHand).toBe(25);

      // Verify StockMovement audit
      const movement = await StockMovement.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
        movementType: STOCK_MOVEMENT_TYPES.OPENING_BALANCE,
      });

      expect(movement).toBeDefined();
      expect(movement?.quantityDifference).toBe(25);
      expect(movement?.previousBalance).toBe(0);
      expect(movement?.newBalance).toBe(25);
    });

    it('prevents duplicate opening stock for the same SKU at the same location (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/opening-stock')
        .set('Cookie', [adminCookie])
        .send({
          branchId: branch1Id,
          stockLocationId: location1Id,
          sku: testSku1,
          quantity: 30,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_OPENING_STOCK');
    });
  });

  // ==========================================
  // SCENARIO 5 & 6: STOCK RECEIVING
  // ==========================================
  describe('5-6. Multi-Line Goods Receiving & Idempotency', () => {
    const idempotencyKey = `rec-key-${Date.now()}`;

    it('receives stock, atomically increments onHand, and creates ledger entries', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/receipts')
        .set('Cookie', [branch1Cookie])
        .send({
          stockLocationId: location1Id,
          receiptNumber: `REC-${Date.now()}`,
          items: [
            { sku: testSku1, quantityReceived: 10, unitCost: 15000 },
            { sku: testSku2, quantityReceived: 15, unitCost: 18000 },
          ],
          idempotencyKey,
          notes: 'Batch shipment from factory',
        });

      if (res.status !== 201) {
        console.log('ERROR OPENING STOCK:', JSON.stringify(res.body));
      }
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalQuantity).toBe(25);

      // Verify balance for testSku1: previous 25 + received 10 = 35
      const bal1 = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(bal1?.onHand).toBe(35);

      // Verify balance for testSku2: previous 0 + received 15 = 15
      const bal2 = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku2,
      });
      expect(bal2?.onHand).toBe(15);
    });

    it('prevents duplicate receiving submission with idempotency key', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/receipts')
        .set('Cookie', [branch1Cookie])
        .send({
          stockLocationId: location1Id,
          receiptNumber: `REC-DUP-${Date.now()}`,
          items: [{ sku: testSku1, quantityReceived: 10 }],
          idempotencyKey, // Replaying the same key
        });

      if (res.status !== 201) {
        console.log('ERROR OPENING STOCK:', JSON.stringify(res.body));
      }
      expect(res.status).toBe(201);
      // Balance must NOT increase a second time
      const bal = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(bal?.onHand).toBe(35);
    });
  });

  // ==========================================
  // SCENARIO 7, 8, 9, 10: MANAGE STOCK RECONCILIATION
  // ==========================================
  describe('7-10. Stock Adjustments (Manage Stock) & Minimum Stock', () => {
    it('applies positive adjustment when counted stock is greater than current (e.g. 35 -> 40)', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/adjustments')
        .set('Cookie', [branch1Cookie])
        .send({
          stockLocationId: location1Id,
          items: [
            {
              sku: testSku1,
              newPhysicalQuantity: 40,
              adjustmentType: 'PHYSICAL_COUNT',
              reason: 'Cycle count discovery',
            },
          ],
        });

      if (res.status !== 201) {
        console.log('ERROR OPENING STOCK:', JSON.stringify(res.body));
      }
      expect(res.status).toBe(201);

      const bal = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(bal?.onHand).toBe(40);

      const mov = await StockMovement.findOne({
        branchId: branch1Id,
        sku: testSku1,
        movementType: STOCK_MOVEMENT_TYPES.PHYSICAL_COUNT,
      }).sort({ timestamp: -1 });

      expect(mov?.quantityDifference).toBe(5);
      expect(mov?.previousBalance).toBe(35);
      expect(mov?.newBalance).toBe(40);
    });

    it('applies negative adjustment when counted stock is less than current (e.g. 40 -> 20)', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/adjustments')
        .set('Cookie', [branch1Cookie])
        .send({
          stockLocationId: location1Id,
          items: [
            {
              sku: testSku1,
              newPhysicalQuantity: 20,
              adjustmentType: 'PHYSICAL_COUNT',
              reason: 'Damaged mattress write-off',
            },
          ],
        });

      if (res.status !== 201) {
        console.log('ERROR OPENING STOCK:', JSON.stringify(res.body));
      }
      expect(res.status).toBe(201);

      const bal = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(bal?.onHand).toBe(20);
    });

    it('rejects negative physical stock count (400)', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/adjustments')
        .set('Cookie', [branch1Cookie])
        .send({
          stockLocationId: location1Id,
          items: [
            {
              sku: testSku1,
              newPhysicalQuantity: -5,
              reason: 'Invalid count',
            },
          ],
        });

      expect(res.status).toBe(400);
    });

    it('updates minimum stock without creating physical stock movements', async () => {
      const initialMovementsCount = await StockMovement.countDocuments({ sku: testSku1 });

      const res = await request(app)
        .patch(`/api/v1/inventory/stock/${testSku1}/minimum`)
        .set('Cookie', [branch1Cookie])
        .send({
          reorderLevel: 12,
          stockLocationId: location1Id,
        });

      expect(res.status).toBe(200);

      const bal = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(bal?.reorderLevel).toBe(12);

      const finalMovementsCount = await StockMovement.countDocuments({ sku: testSku1 });
      expect(finalMovementsCount).toBe(initialMovementsCount);
    });
  });

  // ==========================================
  // SCENARIO 11, 12, 13: ALERTS & HISTORY
  // ==========================================
  describe('11-13. Stock Alerts & Movement Audit History', () => {
    it('correctly reports Low Stock when onHand <= reorderLevel', async () => {
      // testSku1 onHand is 20, let's set reorderLevel to 25
      await StockBalance.findOneAndUpdate(
        { branchId: branch1Id, stockLocationId: location1Id, sku: testSku1 },
        { $set: { reorderLevel: 25 } }
      );

      const res = await request(app)
        .get(`/api/v1/inventory/alerts?status=LOW_STOCK`)
        .set('Cookie', [branch1Cookie]);

      expect(res.status).toBe(200);
      const skuAlert = res.body.data.alerts.find((a: any) => a.sku === testSku1);
      expect(skuAlert).toBeDefined();
      expect(skuAlert.status).toBe('LOW_STOCK');
    });

    it('correctly reports Out of Stock when onHand is 0', async () => {
      // Adjust testSku2 to 0
      await request(app)
        .post('/api/v1/inventory/adjustments')
        .set('Cookie', [branch1Cookie])
        .send({
          stockLocationId: location1Id,
          items: [{ sku: testSku2, newPhysicalQuantity: 0, reason: 'Sold out reconciliation' }],
        });

      const res = await request(app)
        .get(`/api/v1/inventory/alerts?status=OUT_OF_STOCK`)
        .set('Cookie', [branch1Cookie]);

      expect(res.status).toBe(200);
      const skuAlert = res.body.data.alerts.find((a: any) => a.sku === testSku2);
      expect(skuAlert).toBeDefined();
      expect(skuAlert.status).toBe('OUT_OF_STOCK');
    });

    it('provides immutable audit trail in Stock Movements', async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/movements?sku=${testSku1}`)
        .set('Cookie', [branch1Cookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      // Verify each movement has valid mathematical continuity
      for (const m of res.body.data) {
        expect(m.newBalance).toBe(m.previousBalance + m.quantityDifference);
      }
    });
  });

  // ==========================================
  // SCENARIO 14-19: STOCK TRANSFERS WORKFLOW
  // ==========================================
  describe('14-19. Branch-to-Branch Stock Transfers Workflow', () => {
    let transferId: string;

    it('creates a transfer request in PENDING_APPROVAL state', async () => {
      // testSku1 onHand is 20 at location 1 (Branch 1)
      const res = await request(app)
        .post('/api/v1/inventory/transfers')
        .set('Cookie', [branch1Cookie])
        .send({
          toBranchId: branch2Id,
          fromStockLocationId: location1Id,
          toStockLocationId: location2Id,
          items: [{ sku: testSku1, quantity: 8 }],
          notes: 'Replenishing showroom display',
        });

      if (res.status !== 201) {
        console.log('ERROR OPENING STOCK:', JSON.stringify(res.body));
      }
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(TRANSFER_STATUSES.PENDING_APPROVAL);
      transferId = res.body.data._id;
    });

    it('approves transfer and conditionally reserves stock at source', async () => {
      const res = await request(app)
        .post(`/api/v1/inventory/transfers/${transferId}/approve`)
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TRANSFER_STATUSES.APPROVED);

      // Verify reserved quantity at source location
      const bal = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(bal?.reserved).toBe(8);
      expect(bal?.onHand).toBe(20); // onHand still 20 until dispatched
    });

    it('dispatches transfer: deducts stock from source, clears reserve, leaves goods in-transit (destination NOT increased yet)', async () => {
      const res = await request(app)
        .post(`/api/v1/inventory/transfers/${transferId}/dispatch`)
        .set('Cookie', [branch1Cookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TRANSFER_STATUSES.DISPATCHED);

      // Source stock: 20 - 8 = 12 onHand, reserved 0
      const sourceBal = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(sourceBal?.onHand).toBe(12);
      expect(sourceBal?.reserved).toBe(0);

      // CRITICAL CHECK: Destination stock must NOT be increased while goods are in-transit
      const destBal = await StockBalance.findOne({
        branchId: branch2Id,
        stockLocationId: location2Id,
        sku: testSku1,
      });
      expect(destBal?.onHand).toBe(50); // existing 50, unchanged
    });

    it('receives transfer at destination: increments destination onHand and marks RECEIVED', async () => {
      const res = await request(app)
        .post(`/api/v1/inventory/transfers/${transferId}/receive`)
        .set('Cookie', [branch2Cookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TRANSFER_STATUSES.RECEIVED);

      // Destination stock: 50 + 8 = 58
      const destBal = await StockBalance.findOne({
        branchId: branch2Id,
        stockLocationId: location2Id,
        sku: testSku1,
      });
      expect(destBal?.onHand).toBe(58);
    });

    it('prevents receiving a transfer that has already been received (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/inventory/transfers/${transferId}/receive`)
        .set('Cookie', [branch2Cookie]);

      expect(res.status).toBe(400);
    });

    it('prevents cancelling a transfer that is already received (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/inventory/transfers/${transferId}/cancel`)
        .set('Cookie', [branch2Cookie]);

      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  // SCENARIO 20-25: SUMMARY, CONCURRENCY & REVERSAL
  // ==========================================
  describe('20-25. In-Transit Transfer Rejection & Summary Metrics', () => {
    it('rejects cancelling an in-transit dispatched transfer (prevents fictitious stock)', async () => {
      // 1. Create and dispatch new transfer of 4 units
      const createRes = await request(app)
        .post('/api/v1/inventory/transfers')
        .set('Cookie', [branch1Cookie])
        .send({
          toBranchId: branch2Id,
          fromStockLocationId: location1Id,
          toStockLocationId: location2Id,
          items: [{ sku: testSku1, quantity: 4 }],
        });
      const tId = createRes.body.data._id;

      await request(app).post(`/api/v1/inventory/transfers/${tId}/approve`).set('Cookie', [adminCookie]);
      await request(app).post(`/api/v1/inventory/transfers/${tId}/dispatch`).set('Cookie', [branch1Cookie]);

      // Source stock before cancel: 12 - 4 = 8
      let sourceBal = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(sourceBal?.onHand).toBe(8);

      // Attempting to cancel in-transit transfer must be rejected (Section 2.1)
      const cancelRes = await request(app)
        .post(`/api/v1/inventory/transfers/${tId}/cancel`)
        .set('Cookie', [branch1Cookie]);

      expect(cancelRes.status).toBe(400);
      expect(cancelRes.body.error.code).toBe('TRANSFER_ALREADY_DISPATCHED');

      // Source stock must NOT be restored: remains 8
      sourceBal = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(sourceBal?.onHand).toBe(8);
    });

    it('cancelling an approved (not yet dispatched) transfer safely releases reservation', async () => {
      const createRes = await request(app)
        .post('/api/v1/inventory/transfers')
        .set('Cookie', [branch1Cookie])
        .send({
          toBranchId: branch2Id,
          fromStockLocationId: location1Id,
          toStockLocationId: location2Id,
          items: [{ sku: testSku1, quantity: 2 }],
        });
      const tId = createRes.body.data._id;

      await request(app).post(`/api/v1/inventory/transfers/${tId}/approve`).set('Cookie', [adminCookie]);

      // Check reserved stock
      let sourceBal = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(sourceBal?.reserved).toBe(2);

      // Cancel before dispatch
      const cancelRes = await request(app)
        .post(`/api/v1/inventory/transfers/${tId}/cancel`)
        .set('Cookie', [adminCookie]);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe(TRANSFER_STATUSES.CANCELLED);

      // Reserved stock released
      sourceBal = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(sourceBal?.reserved).toBe(0);
    });

    it('returns high-level inventory summary metrics', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/summary')
        .set('Cookie', [branch1Cookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.totalOnHandQuantity).toBeGreaterThan(0);
      expect(res.body.data.totalBalancesCount).toBeGreaterThan(0);
    });
  });
});
