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
  StockReceipt,
  StockMovement,
  Supplier,
  PurchaseOrder,
  SupplierBill,
  SupplierPayment,
  SupplierLedgerEntry,
  PurchaseReturn,
} from '../../models/index.js';
import { STOCK_MOVEMENT_TYPES, STOCK_LOCATION_TYPES } from '../../constants/index.js';

describe('Purchasing & Supplier Management Integration Tests (Flow 06)', () => {
  const app = createApp();

  let adminCookie: string;
  let branch1Cookie: string;
  let branch2Cookie: string;

  let branch1Id: string;
  let branch2Id: string;
  let location1Id: string;
  let location2Id: string;

  let testSku1: string;
  let testSku2: string;
  let testSupplierId: string;
  let testPOId: string;

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

    // 2. Branch 1 (Main Branch)
    const mainBranch = await Branch.findOne({ loginId: 'mainbranch' });
    branch1Id = mainBranch!._id.toString();
    const loc1 = await StockLocation.findOne({ branchId: mainBranch!._id });
    location1Id = loc1!._id.toString();

    // Grant Branch 1 permissions for purchases and suppliers for testing
    await Account.findOneAndUpdate(
      { loginId: 'mainbranch' },
      {
        $set: {
          'permissions.purchases': true,
          'permissions.suppliers': true,
        },
      }
    );

    const b1Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'mainbranch', password: branchPassword });
    const b1Cookies = b1Res.headers['set-cookie'];
    branch1Cookie = (Array.isArray(b1Cookies) ? b1Cookies.join(';') : (b1Cookies as string)).split(';')[0];

    // 3. Branch 2 (Wholesale Depot) - leave permissions as default (purchases: false)
    const wholesaleBranch = await Branch.findOne({ loginId: 'wholesaledepot' });
    branch2Id = wholesaleBranch!._id.toString();
    const loc2 = await StockLocation.findOne({ branchId: wholesaleBranch!._id });
    location2Id = loc2!._id.toString();

    const b2Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'wholesaledepot', password: branchPassword });
    const b2Cookies = b2Res.headers['set-cookie'];
    branch2Cookie = (Array.isArray(b2Cookies) ? b2Cookies.join(';') : (b2Cookies as string)).split(';')[0];

    // 4. Create Unique Test Products & Variants
    const testTimestamp = Date.now();
    const brand = await Brand.create({
      name: `Brand_Purchasing_${testTimestamp}`,
      code: `BP_${testTimestamp.toString().slice(-4)}`,
    });
    const category = await Category.create({
      brandId: brand._id,
      name: 'Spring Series',
      code: 'SPRING',
    });

    const sizes = await Size.find().limit(2);
    const sz1 = sizes[0] || (await Size.create({ name: 'Standard 78x72', length: 78, width: 72, unit: 'in', displayLabel: '78 × 72' }));
    const sz2 = sizes[1] || sz1;
    let th = await Thickness.findOne({ value: 6 });
    if (!th) {
      th = await Thickness.create({
        value: 6,
        unit: 'in',
        displayLabel: '6 Inches',
      });
    }

    const product = await Product.create({
      brandId: brand._id,
      categoryId: category._id,
      name: `Molty Premium Ortho ${testTimestamp}`,
      slug: `molty-premium-ortho-${testTimestamp}`,
      baseDescription: 'High density orthopaedic foam mattress',
    });

    testSku1 = `PO-TEST-1-${testTimestamp.toString().slice(-4)}`;
    testSku2 = `PO-TEST-2-${testTimestamp.toString().slice(-4)}`;

    await Variant.create([
      {
        productId: product._id,
        sizeId: sz1._id,
        thicknessId: th._id,
        sku: testSku1,
        listPrice: 2500000,
        purchasePrice: 1500000, // 15,000 PKR
        retailPrice: 2500000,
        wholesalePrice: 2000000,
        distributorPrice: 1800000,
        status: 'ACTIVE',
      },
      {
        productId: product._id,
        sizeId: sz2._id,
        thicknessId: th._id,
        sku: testSku2,
        listPrice: 3000000,
        purchasePrice: 1800000, // 18,000 PKR
        retailPrice: 3000000,
        wholesalePrice: 2400000,
        distributorPrice: 2100000,
        status: 'ACTIVE',
      },
    ]);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  // ==========================================
  // PART 1: SUPPLIER DIRECTORY
  // ==========================================
  describe('1. Supplier Directory & Ledger Setup', () => {
    it('creates a new supplier with opening balance and assigns atomic SUP-XXXX code', async () => {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('Cookie', adminCookie)
        .send({
          name: `Master Chemical Industries ${Date.now()}`,
          contactPerson: 'Khurram Shahzad',
          phone: '03001234567',
          city: 'Karachi',
          address: 'Plot 45, Sector 15, Korangi Industrial Area',
          creditEnabled: true,
          defaultCreditDays: 30,
          creditLimit: 5000000, // 50,000 PKR
          openingPayable: 1000000, // 10,000 PKR opening payable
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toMatch(/^SUP-\d{4,}$/);
      expect(res.body.data.currentOutstanding).toBe(1000000);

      testSupplierId = res.body.data._id || res.body.data.id;

      // Verify opening balance ledger entry was created
      const ledgerEntry = await SupplierLedgerEntry.findOne({
        supplierId: testSupplierId,
        entryType: 'OPENING_BALANCE',
      });
      expect(ledgerEntry).toBeDefined();
      expect(ledgerEntry?.credit).toBe(1000000);
      expect(ledgerEntry?.runningBalance).toBe(1000000);
    });

    it('rejects duplicate supplier name with 409 Conflict', async () => {
      const supplier = await Supplier.findById(testSupplierId);
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('Cookie', adminCookie)
        .send({
          name: supplier!.name,
          phone: '03009999999',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('retrieves suppliers list with search and pagination', async () => {
      const res = await request(app)
        .get('/api/v1/suppliers?limit=10')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.suppliers.length).toBeGreaterThan(0);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('updates supplier profile information', async () => {
      const res = await request(app)
        .patch(`/api/v1/suppliers/${testSupplierId}`)
        .set('Cookie', adminCookie)
        .send({
          contactPerson: 'Khurram Shahzad Updated',
          creditLimit: 7500000,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.contactPerson).toBe('Khurram Shahzad Updated');
      expect(res.body.data.creditLimit).toBe(7500000);
    });

    it('denies access to suppliers for unauthorized branch accounts (403)', async () => {
      const res = await request(app)
        .get('/api/v1/suppliers')
        .set('Cookie', branch2Cookie);

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // PART 2: PURCHASE ORDERS WORKFLOW
  // ==========================================
  describe('2. Purchase Orders Workflow (Draft -> Pending -> Approved)', () => {
    it('creates a purchase order in DRAFT status with computed integer totals', async () => {
      const res = await request(app)
        .post('/api/v1/purchases/orders')
        .set('Cookie', branch1Cookie)
        .send({
          supplierId: testSupplierId,
          branchId: branch1Id,
          stockLocationId: location1Id,
          expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          paymentTerms: 'Net 30 Days',
          referenceNumber: 'RFQ-2026-001',
          items: [
            {
              sku: testSku1,
              quantity: 10,
              unitCost: 1500000, // 15,000 PKR
              lineDiscount: 50000, // 500 PKR
              taxAmount: 0,
            },
            {
              sku: testSku2,
              quantity: 5,
              unitCost: 1800000, // 18,000 PKR
              lineDiscount: 0,
              taxAmount: 0,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const po = res.body.data;
      testPOId = po._id;

      expect(po.orderNumber).toMatch(/^PO-\d{8}-\d{4}$/);
      expect(po.status).toBe('DRAFT');
      // Subtotal: 10*15,000 + 5*18,000 = 150,000 + 90,000 = 240,000 PKR (24,000,000 paisa)
      expect(po.subtotal).toBe(24000000);
      expect(po.discountAmount).toBe(50000);
      expect(po.totalAmount).toBe(24000000 - 50000);
    });

    it('allows updating items while in DRAFT status', async () => {
      const res = await request(app)
        .patch(`/api/v1/purchases/orders/${testPOId}`)
        .set('Cookie', branch1Cookie)
        .send({
          notes: 'Updated priority order for weekend delivery',
          items: [
            {
              sku: testSku1,
              quantity: 10,
              unitCost: 1500000,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Updated priority order for weekend delivery');
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.totalAmount).toBe(15000000);
    });

    it('submits purchase order for approval (DRAFT -> PENDING_APPROVAL)', async () => {
      const res = await request(app)
        .post(`/api/v1/purchases/orders/${testPOId}/submit`)
        .set('Cookie', branch1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING_APPROVAL');
    });

    it('prevents modifying purchase order when in PENDING_APPROVAL status (400)', async () => {
      const res = await request(app)
        .patch(`/api/v1/purchases/orders/${testPOId}`)
        .set('Cookie', branch1Cookie)
        .send({ notes: 'Trying to sneak a note change' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ORDER_STATE');
    });

    it('approves purchase order with server-verified approver metadata', async () => {
      const res = await request(app)
        .post(`/api/v1/purchases/orders/${testPOId}/approve`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.approvedBy).toBe('admin');
      expect(res.body.data.approvedAt).toBeDefined();
    });

    it('denies branch user without purchases permission from accessing or approving PO (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/purchases/orders/${testPOId}/approve`)
        .set('Cookie', branch2Cookie);

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // PART 3: GOODS RECEIVING / GRN
  // ==========================================
  describe('3. Goods Receiving & Stock Increment (GRN)', () => {
    it('performs partial receipt of 4 out of 10 units: updates onHand and moves PO to PARTIALLY_RECEIVED', async () => {
      // Check initial stock onHand
      const initialStock = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      const initialOnHand = initialStock ? initialStock.onHand : 0;

      const res = await request(app)
        .post(`/api/v1/purchases/orders/${testPOId}/receive`)
        .set('Cookie', branch1Cookie)
        .send({
          deliveryReference: 'DC-88990',
          stockLocationId: location1Id,
          items: [
            {
              sku: testSku1,
              quantityReceived: 4,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderStatus).toBe('PARTIALLY_RECEIVED');
      expect(res.body.data.acceptedUnits).toBe(4);

      // Verify onHand increased by 4
      const updatedStock = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(updatedStock?.onHand).toBe(initialOnHand + 4);

      // Verify StockMovement entry
      const movement = await StockMovement.findOne({
        sku: testSku1,
        movementType: STOCK_MOVEMENT_TYPES.PURCHASE_RECEIPT,
        branchId: branch1Id,
      }).sort({ timestamp: -1 });
      expect(movement).toBeDefined();
      expect(movement?.quantityDifference).toBe(4);

      // Verify StockReceipt document
      const grn = await StockReceipt.findOne({ purchaseOrderId: testPOId });
      expect(grn).toBeDefined();
      expect(grn?.supplierReference).toBe('DC-88990');
    });

    it('rejects over-receiving beyond remaining ordered quantity (400)', async () => {
      // PO ordered: 10, already received: 4. Remaining: 6.
      // Attempting to receive 7 units should fail.
      const res = await request(app)
        .post(`/api/v1/purchases/orders/${testPOId}/receive`)
        .set('Cookie', branch1Cookie)
        .send({
          deliveryReference: 'DC-88991',
          items: [
            {
              sku: testSku1,
              quantityReceived: 7,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('OVER_RECEIVING_PROHIBITED');
    });

    it('quarantines damaged units: only accepted units increment saleable stock', async () => {
      // Receive 4 units, but 1 is damaged -> 3 accepted into saleable stock
      const prevStock = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      const prevOnHand = prevStock ? prevStock.onHand : 0;

      const res = await request(app)
        .post(`/api/v1/purchases/orders/${testPOId}/receive`)
        .set('Cookie', branch1Cookie)
        .send({
          deliveryReference: 'DC-88992',
          items: [
            {
              sku: testSku1,
              quantityReceived: 4,
              damagedQuantity: 1,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.acceptedUnits).toBe(3);
      expect(res.body.data.quarantineUnits).toBe(1);

      // Verify onHand increased only by 3 (accepted), not 4
      const currentStock = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(currentStock?.onHand).toBe(prevOnHand + 3);
    });

    it('receives remaining units and transitions PO to FULLY_RECEIVED', async () => {
      // Total ordered: 10. Received so far: 4 + 4 = 8. Remaining: 2.
      const res = await request(app)
        .post(`/api/v1/purchases/orders/${testPOId}/receive`)
        .set('Cookie', branch1Cookie)
        .send({
          deliveryReference: 'DC-88993',
          items: [
            {
              sku: testSku1,
              quantityReceived: 2,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.orderStatus).toBe('FULLY_RECEIVED');

      const po = await PurchaseOrder.findById(testPOId);
      expect(po?.status).toBe('FULLY_RECEIVED');
      expect(po?.items[0].receivedQuantity).toBe(10);
    });

    it('prevents cancelling a purchase order that has received goods (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/purchases/orders/${testPOId}/cancel`)
        .set('Cookie', branch1Cookie)
        .send({ reason: 'No longer needed' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_CANCEL');
    });
  });

  // ==========================================
  // PART 4: SUPPLIER BILLS & LIABILITY
  // ==========================================
  describe('4. Supplier Bills & Accounts Payable Posting', () => {
    let billId1: string;
    let billId2: string;
    const invNumber1 = `INV-MC-${Date.now()}`;
    const invNumber2 = `INV-MC-${Date.now() + 1}`;

    it('posts a supplier bill, updates supplier outstanding liability, and adds ledger entry', async () => {
      const supplierBefore = await Supplier.findById(testSupplierId);
      const initialOutstanding = supplierBefore!.currentOutstanding;

      const res = await request(app)
        .post('/api/v1/purchases/bills')
        .set('Cookie', adminCookie)
        .send({
          supplierId: testSupplierId,
          supplierInvoiceNumber: invNumber1,
          branchId: branch1Id,
          purchaseOrderId: testPOId,
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
          items: [
            {
              sku: testSku1,
              quantity: 10,
              unitCost: 1500000, // 150,000 PKR total (15,000,000 paisa)
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const bill = res.body.data;
      billId1 = bill._id;

      expect(bill.billNumber).toMatch(/^BILL-\d{8}-\d{4}$/);
      expect(bill.totalAmount).toBe(15000000);
      expect(bill.balanceDue).toBe(15000000);
      expect(bill.paymentStatus).toBe('UNPAID');

      // Verify supplier outstanding liability increased
      const supplierAfter = await Supplier.findById(testSupplierId);
      expect(supplierAfter?.currentOutstanding).toBe(initialOutstanding + 15000000);

      // Verify supplier ledger entry
      const ledgerEntry = await SupplierLedgerEntry.findOne({
        referenceNumber: bill.billNumber,
      });
      expect(ledgerEntry).toBeDefined();
      expect(ledgerEntry?.credit).toBe(15000000);
      expect(ledgerEntry?.debit).toBe(0);
      expect(ledgerEntry?.runningBalance).toBe(supplierAfter?.currentOutstanding);
    });

    it('rejects duplicate bill with identical supplierInvoiceNumber for same supplier (409)', async () => {
      const res = await request(app)
        .post('/api/v1/purchases/bills')
        .set('Cookie', adminCookie)
        .send({
          supplierId: testSupplierId,
          supplierInvoiceNumber: invNumber1,
          branchId: branch1Id,
          dueDate: new Date().toISOString(),
          items: [{ sku: testSku1, quantity: 1, unitCost: 1500000 }],
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_BILL');
    });

    it('posts a second bill for partial payment testing', async () => {
      const res = await request(app)
        .post('/api/v1/purchases/bills')
        .set('Cookie', adminCookie)
        .send({
          supplierId: testSupplierId,
          supplierInvoiceNumber: invNumber2,
          branchId: branch1Id,
          dueDate: new Date(Date.now() + 45 * 86400000).toISOString(),
          items: [
            {
              sku: testSku2,
              quantity: 2,
              unitCost: 1800000, // 36,000 PKR total (3,600,000 paisa)
            },
          ],
        });

      expect(res.status).toBe(201);
      billId2 = res.body.data._id;
    });

    // ==========================================
    // PART 5: SUPPLIER PAYMENTS & ALLOCATION
    // ==========================================
    describe('5. Supplier Payments & Settlement', () => {
      it('executes supplier payment with auto-allocation across oldest unpaid bills', async () => {
        const supplierBefore = await Supplier.findById(testSupplierId);
        const startingOutstanding = supplierBefore!.currentOutstanding;

        // Pay 10,000,000 paisa (100,000 PKR) against Bill 1 (150,000 PKR)
        const res = await request(app)
          .post('/api/v1/purchases/payments')
          .set('Cookie', adminCookie)
          .send({
            supplierId: testSupplierId,
            branchId: branch1Id,
            amount: 10000000,
            paymentMethod: 'BANK_TRANSFER',
            reference: 'HBL-FT-998811',
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        const payment = res.body.data;
        expect(payment.paymentNumber).toMatch(/^PAY-SUP-\d{8}-\d{4}$/);
        expect(payment.amount).toBe(10000000);
        expect(payment.allocations.length).toBeGreaterThan(0);

        // Bill 1 was 15,000,000; paid 10,000,000 -> remaining 5,000,000
        const bill1 = await SupplierBill.findById(billId1);
        expect(bill1?.paidAmount).toBe(10000000);
        expect(bill1?.balanceDue).toBe(5000000);
        expect(bill1?.paymentStatus).toBe('PARTIALLY_PAID');

        // Supplier outstanding decremented by 10,000,000
        const supplierAfter = await Supplier.findById(testSupplierId);
        expect(supplierAfter?.currentOutstanding).toBe(startingOutstanding - 10000000);

        // Supplier ledger debit entry
        const ledgerEntry = await SupplierLedgerEntry.findOne({
          referenceNumber: payment.paymentNumber,
        });
        expect(ledgerEntry).toBeDefined();
        expect(ledgerEntry?.debit).toBe(10000000);
        expect(ledgerEntry?.credit).toBe(0);
        expect(ledgerEntry?.runningBalance).toBe(supplierAfter?.currentOutstanding);
      });

      it('executes manual bill allocation payment and marks bill PAID when balance reaches zero', async () => {
        // Pay exactly remaining 5,000,000 on Bill 1
        const res = await request(app)
          .post('/api/v1/purchases/payments')
          .set('Cookie', adminCookie)
          .send({
            supplierId: testSupplierId,
            branchId: branch1Id,
            amount: 5000000,
            paymentMethod: 'CHEQUE',
            reference: 'CHQ-778899',
            chequeDate: new Date().toISOString(),
            allocations: [
              {
                billId: billId1,
                allocatedAmount: 5000000,
              },
            ],
          });

        expect(res.status).toBe(201);
        const bill1 = await SupplierBill.findById(billId1);
        expect(bill1?.balanceDue).toBe(0);
        expect(bill1?.paymentStatus).toBe('PAID');
      });

      it('rejects manual payment over-allocation exceeding bill balance (400)', async () => {
        // Bill 1 balance is now 0, attempting to allocate 100,000 must fail
        const res = await request(app)
          .post('/api/v1/purchases/payments')
          .set('Cookie', adminCookie)
          .send({
            supplierId: testSupplierId,
            branchId: branch1Id,
            amount: 100000,
            paymentMethod: 'CASH',
            allocations: [
              {
                billId: billId1,
                allocatedAmount: 100000,
              },
            ],
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('OVERALLOCATION_NOT_ALLOWED');
      });
    });
  });

  // ==========================================
  // PART 6: SUPPLIER LEDGER STATEMENT
  // ==========================================
  describe('6. Supplier Ledger Statement & Audit Trail', () => {
    it('retrieves full ledger statement and confirms runningBalance equals supplier currentOutstanding', async () => {
      const res = await request(app)
        .get(`/api/v1/suppliers/${testSupplierId}/ledger`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ledger = res.body.data;

      expect(ledger.entries.length).toBeGreaterThanOrEqual(4); // Opening, Bill1, Bill2, Payment1, Payment2
      expect(ledger.summary).toBeDefined();

      const lastEntry = ledger.entries[ledger.entries.length - 1];
      const supplier = await Supplier.findById(testSupplierId);

      expect(lastEntry.balance).toBe(supplier?.currentOutstanding);
      expect(ledger.summary.currentBalance).toBe(supplier?.currentOutstanding);
    });
  });

  // ==========================================
  // PART 7: PURCHASE RETURNS & DEBIT NOTES
  // ==========================================
  describe('7. Purchase Returns & Debit Notes', () => {
    it('processes physical return: decrements inventory, creates debit note, and updates supplier ledger', async () => {
      // Check stock before return
      const stockBefore = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      const onHandBefore = stockBefore?.onHand || 0;
      expect(onHandBefore).toBeGreaterThanOrEqual(2);

      const supplierBefore = await Supplier.findById(testSupplierId);
      const outstandingBefore = supplierBefore!.currentOutstanding;

      const res = await request(app)
        .post('/api/v1/purchases/returns')
        .set('Cookie', branch1Cookie)
        .send({
          supplierId: testSupplierId,
          branchId: branch1Id,
          stockLocationId: location1Id,
          reason: 'Defective fabric cover from batch 102',
          items: [
            {
              sku: testSku1,
              quantity: 2,
              unitCost: 1500000, // 30,000 PKR total (3,000,000 paisa)
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const ret = res.body.data;
      expect(ret.returnNumber).toMatch(/^RET-\d{8}-\d{4}$/);
      expect(ret.debitNoteNumber).toMatch(/^DN-\d{8}-\d{4}$/);
      expect(ret.totalAmount).toBe(3000000);

      // Verify stock was deducted
      const stockAfter = await StockBalance.findOne({
        branchId: branch1Id,
        stockLocationId: location1Id,
        sku: testSku1,
      });
      expect(stockAfter?.onHand).toBe(onHandBefore - 2);

      // Verify StockMovement entry
      const movement = await StockMovement.findOne({
        sku: testSku1,
        movementType: STOCK_MOVEMENT_TYPES.PURCHASE_RETURN,
      }).sort({ timestamp: -1 });
      expect(movement).toBeDefined();
      expect(movement?.quantityDifference).toBe(-2);

      // Verify supplier outstanding reduced
      const supplierAfter = await Supplier.findById(testSupplierId);
      expect(supplierAfter?.currentOutstanding).toBe(outstandingBefore - 3000000);

      // Verify Debit Note in supplier ledger
      const debitEntry = await SupplierLedgerEntry.findOne({
        referenceNumber: ret.debitNoteNumber,
      });
      expect(debitEntry).toBeDefined();
      expect(debitEntry?.debit).toBe(3000000);
      expect(debitEntry?.runningBalance).toBe(supplierAfter?.currentOutstanding);
    });

    it('rejects purchase return if requested return quantity exceeds onHand (400)', async () => {
      const res = await request(app)
        .post('/api/v1/purchases/returns')
        .set('Cookie', branch1Cookie)
        .send({
          supplierId: testSupplierId,
          branchId: branch1Id,
          stockLocationId: location1Id,
          reason: 'Excessive return test',
          items: [
            {
              sku: testSku1,
              quantity: 9999, // Impossible quantity
              unitCost: 1500000,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INSUFFICIENT_STOCK_TO_RETURN');
    });
  });

  // ==========================================
  // PART 8: PURCHASING SUMMARY METRICS
  // ==========================================
  describe('8. Purchasing Summary & Overview Metrics', () => {
    it('returns accurate purchasing summary metrics without double-counting', async () => {
      const res = await request(app)
        .get('/api/v1/purchases/summary')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const summary = res.body.data;

      expect(summary.totalOrders).toBeGreaterThanOrEqual(1);
      expect(summary.totalGoodsReceipts).toBeGreaterThanOrEqual(1);
      expect(summary.totalBilledAmount).toBeGreaterThanOrEqual(18600000);
      expect(summary.totalPaidAmount).toBeGreaterThanOrEqual(15000000);
      expect(summary.activeSuppliersCount).toBeGreaterThanOrEqual(1);
    });
  });
});
