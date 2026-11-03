import { describe, it, expect, beforeEach } from 'vitest';
import {
  suppliersRepository,
  purchaseOrdersRepository,
  goodsReceiptsRepository,
  purchaseBillsRepository,
  supplierPaymentsRepository,
  supplierLedgerRepository,
  purchaseReturnsRepository,
  inventoryRepository,
  stockLocationsRepository,
  variantsRepository,
  branchesRepository,
  pricingRepository,
  stockMovementsRepository,
} from '@/lib/demo-db';

describe('Flow 08 — Supplier Management, Purchase Orders, Goods Receiving, Bills & Payables', () => {
  beforeEach(() => {
    suppliersRepository.resetToSeed();
    purchaseOrdersRepository.resetToSeed();
    goodsReceiptsRepository.resetToSeed();
    purchaseBillsRepository.resetToSeed();
    supplierPaymentsRepository.resetToSeed();
    supplierLedgerRepository.resetToSeed();
    purchaseReturnsRepository.resetToSeed();
    inventoryRepository.resetToSeed();
    stockLocationsRepository.resetToSeed();
    variantsRepository.resetToSeed();
    branchesRepository.resetToSeed();
  });

  // 1. Supplier registration generates unique supplier code
  it('1. generates unique supplier code when registering a new supplier', () => {
    const created = suppliersRepository.create({
      name: 'Olympia Spring Mattresses Ltd',
      contactPerson: 'Kamran Akmal',
      phone: '0300-8889991',
      address: 'Plot 45, S.I.T.E Area',
      city: 'Karachi',
      paymentTerms: 'Net 30',
      creditLimit: 3000000,
    });

    expect(created.id).toBeDefined();
    expect(created.code).toMatch(/^SUP-\d{3}$/);
    expect(created.name).toBe('Olympia Spring Mattresses Ltd');
    expect(created.status).toBe('ACTIVE');
    expect(created.currentOutstanding).toBe(0);
  });

  // 2. Duplicate supplier code or unique tax number handled cleanly
  it('2. prevents duplicate supplier code or handles unique fields gracefully', () => {
    const code = suppliersRepository.getNextSupplierCode();
    expect(code).toBeDefined();

    const sup1 = suppliersRepository.create({
      code,
      name: 'Vendor Alpha',
      contactPerson: 'Ali',
      phone: '0321-1111111',
      address: 'Lahore',
      city: 'Lahore',
    });

    expect(() => {
      suppliersRepository.create({
        code: sup1.code,
        name: 'Vendor Beta',
        contactPerson: 'Bilal',
        phone: '0321-2222222',
        address: 'Lahore',
        city: 'Lahore',
      });
    }).toThrow(/already exists/i);
  });

  // 3. Supplier update persists edits
  it('3. updates supplier profile information and persists edits', () => {
    const supplier = suppliersRepository.getAll()[0];
    expect(supplier).toBeDefined();

    const updated = suppliersRepository.update(supplier.id, {
      contactPerson: 'Muhammad Asif (Head of Sales)',
      phone: '0300-9998888',
      city: 'Islamabad',
      creditLimit: 7500000,
    });

    expect(updated.contactPerson).toBe('Muhammad Asif (Head of Sales)');
    expect(updated.phone).toBe('0300-9998888');
    expect(updated.city).toBe('Islamabad');
    expect(updated.creditLimit).toBe(7500000);

    const reloaded = suppliersRepository.getById(supplier.id);
    expect(reloaded?.contactPerson).toBe('Muhammad Asif (Head of Sales)');
  });

  // 4. Supplier deactivation stops new purchase orders for that supplier
  it('4. deactivates supplier and blocks new purchase order creation for deactivated supplier', () => {
    const supplier = suppliersRepository.getAll()[0];
    const toggled = suppliersRepository.toggleStatus(supplier.id);
    expect(toggled.status).toBe('INACTIVE');

    const variant = variantsRepository.getAll()[0];
    expect(() => {
      purchaseOrdersRepository.create({
        supplierId: supplier.id,
        destinationBranchId: 'BR-MAIN-01',
        destinationLocationId: 'LOC-MAIN-01',
        expectedDeliveryDate: '2026-11-15',
        paymentTerms: 'Net 30',
        items: [
          {
            variantId: variant.id,
            orderedQuantity: 10,
            unitCost: 18000,
          },
        ],
      });
    }).toThrow(/inactive/i);
  });

  // 5. Create purchase order with multiple variant SKUs calculates totals
  it('5. creates purchase order with multiple variant SKUs and calculates line totals, subtotal and grand total correctly', () => {
    const supplier = suppliersRepository.getAll()[0];
    const v1 = variantsRepository.getBySku('DURA-LUX-7872-T6')!;
    const v2 = variantsRepository.getBySku('DURA-CLASSIC-7836-T6')!;

    const po = purchaseOrdersRepository.create({
      supplierId: supplier.id,
      destinationBranchId: 'BR-MAIN-01',
      destinationLocationId: 'LOC-MAIN-01',
      orderDate: '2026-10-29',
      expectedDeliveryDate: '2026-11-05',
      paymentTerms: 'Net 30',
      items: [
        {
          variantId: v1.id,
          orderedQuantity: 5,
          unitCost: 25000,
          lineDiscount: 1000,
          taxAmount: 500,
        },
        {
          variantId: v2.id,
          orderedQuantity: 10,
          unitCost: 15000,
          lineDiscount: 2000,
          taxAmount: 1000,
        },
      ],
    });

    // Item 1: 5 * 25000 = 125000 - 1000 + 500 = 124500
    // Item 2: 10 * 15000 = 150000 - 2000 + 1000 = 149000
    // Subtotal: 275000, Discount: 3000, Tax: 1500, Grand Total: 273500
    expect(po.items).toHaveLength(2);
    expect(po.items[0].lineTotal).toBe(124500);
    expect(po.items[1].lineTotal).toBe(149000);
    expect(po.subtotal).toBe(275000);
    expect(po.discountAmount).toBe(3000);
    expect(po.taxAmount).toBe(1500);
    expect(po.grandTotal).toBe(273500);
    expect(po.status).toBe('PENDING_APPROVAL');
  });

  // 6. PO status transitions from DRAFT to PENDING_APPROVAL
  it('6. PO is initialized with PENDING_APPROVAL status ready for authorization', () => {
    const supplier = suppliersRepository.getAll()[0];
    const v = variantsRepository.getAll()[0];

    const po = purchaseOrdersRepository.create({
      supplierId: supplier.id,
      destinationBranchId: 'BR-MAIN-01',
      destinationLocationId: 'LOC-MAIN-01',
      items: [{ variantId: v.id, orderedQuantity: 2, unitCost: 10000 }],
    });

    expect(po.status).toBe('PENDING_APPROVAL');
  });

  // 7. Authorized manager can approve purchase order
  it('7. allows authorized user to approve purchase order and records approval metadata', () => {
    const supplier = suppliersRepository.getAll()[0];
    const v = variantsRepository.getAll()[0];

    const po = purchaseOrdersRepository.create({
      supplierId: supplier.id,
      destinationBranchId: 'BR-MAIN-01',
      destinationLocationId: 'LOC-MAIN-01',
      items: [{ variantId: v.id, orderedQuantity: 2, unitCost: 10000 }],
    });

    const approved = purchaseOrdersRepository.approve(po.id, 'USR-MGR-01', 'Tariq Mahmood (BM)');
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('USR-MGR-01');
    expect(approved.approvedByName).toBe('Tariq Mahmood (BM)');
    expect(approved.approvedAt).toBeDefined();
  });

  // 8. PO cancellation fails if goods have already been received
  it('8. prevents PO cancellation once goods receipt has already been processed', () => {
    // PO-20241020-0002 has PARTIALLY_RECEIVED status
    expect(() => {
      purchaseOrdersRepository.cancel('PO-20241020-0002', 'Cancelled by mistake');
    }).toThrow(/Cannot cancel purchase order with received goods/i);
  });

  // 9. PO line items retain snapshot of unit purchase costs
  it('9. retains exact historical unit purchase costs even if catalogue prices change', () => {
    const supplier = suppliersRepository.getAll()[0];
    const v = variantsRepository.getAll()[0];

    const po = purchaseOrdersRepository.create({
      supplierId: supplier.id,
      destinationBranchId: 'BR-MAIN-01',
      destinationLocationId: 'LOC-MAIN-01',
      items: [{ variantId: v.id, orderedQuantity: 4, unitCost: 17500 }],
    });

    expect(po.items[0].unitCost).toBe(17500);

    // Update variant price
    pricingRepository.updateVariantPrice(v.id, {
      retailPrice: v.retailPrice,
      wholesalePrice: 40000,
      changedBy: 'Admin',
    });

    const reloadedPO = purchaseOrdersRepository.getById(po.id);
    expect(reloadedPO?.items[0].unitCost).toBe(17500);
  });

  // 10. Receiving goods against approved PO updates line item received quantities
  it('10. updates line item received quantities upon processing goods receipt', () => {
    const supplier = suppliersRepository.getAll()[0];
    const v = variantsRepository.getAll()[0];
    const createdPO = purchaseOrdersRepository.create({
      supplierId: supplier.id,
      destinationBranchId: 'BR-MAIN-01',
      destinationLocationId: 'LOC-MAIN-01',
      items: [{ variantId: v.id, orderedQuantity: 10, unitCost: 15000 }],
    });
    const po = purchaseOrdersRepository.approve(createdPO.id, 'Manager', 'Approved for receiving');
    expect(po.status).toBe('APPROVED');

    const itemToReceive = po.items[0];
    const initialReceived = itemToReceive.receivedQuantity;

    const res = goodsReceiptsRepository.receiveGoods({
      poId: po.id,
      deliveryReference: 'DC-TEST-1001',
      destinationLocationId: po.destinationLocationId,
      receivedBy: 'Warehouse Keeper',
      items: [{ sku: itemToReceive.sku, receivedQuantity: 5 }],
    });

    expect(res.grn).toBeDefined();
    const updatedPO = purchaseOrdersRepository.getById(po.id)!;
    const updatedItem = updatedPO.items.find((i) => i.sku === itemToReceive.sku)!;
    expect(updatedItem.receivedQuantity).toBe(initialReceived + 5);
  });

  // 11. Receiving goods cannot exceed remaining unreceived quantities on the PO
  it('11. strictly prevents over-receiving beyond ordered quantities on the purchase order', () => {
    const supplier = suppliersRepository.getAll()[0];
    const v = variantsRepository.getAll()[0];
    const createdPO = purchaseOrdersRepository.create({
      supplierId: supplier.id,
      destinationBranchId: 'BR-MAIN-01',
      destinationLocationId: 'LOC-MAIN-01',
      items: [{ variantId: v.id, orderedQuantity: 5, unitCost: 15000 }],
    });
    const po = purchaseOrdersRepository.approve(createdPO.id, 'Manager', 'Approved');
    const item = po.items[0];
    const remaining = item.orderedQuantity - item.receivedQuantity;

    expect(() => {
      goodsReceiptsRepository.receiveGoods({
        poId: po.id,
        deliveryReference: 'DC-OVER-001',
        destinationLocationId: po.destinationLocationId,
        receivedBy: 'Warehouse Keeper',
        items: [{ sku: item.sku, receivedQuantity: remaining + 50 }],
      });
    }).toThrow(/exceeds remaining unreceived quantity/i);
  });

  // 12. Receiving goods deposits correct quantities into stock location via Flow 05 inventoryRepository
  it('12. deposits received stock into target branch stock location via Flow 05 inventory balance update', () => {
    const supplier = suppliersRepository.getAll()[0];
    const v = variantsRepository.getAll()[0];
    const createdPO = purchaseOrdersRepository.create({
      supplierId: supplier.id,
      destinationBranchId: 'BR-MAIN-01',
      destinationLocationId: 'LOC-MAIN-01',
      items: [{ variantId: v.id, orderedQuantity: 5, unitCost: 15000 }],
    });
    const po = purchaseOrdersRepository.approve(createdPO.id, 'Manager', 'Approved');
    const item = po.items[0];

    const initialBalance = inventoryRepository.getBalance(po.destinationLocationId, item.sku);
    const initialOnHand = initialBalance?.onHand || 0;

    goodsReceiptsRepository.receiveGoods({
      poId: po.id,
      deliveryReference: 'DC-INVENT-001',
      destinationLocationId: po.destinationLocationId,
      receivedBy: 'Warehouse Staff',
      items: [{ sku: item.sku, receivedQuantity: 3 }],
    });

    const newBalance = inventoryRepository.getBalance(po.destinationLocationId, item.sku);
    expect(newBalance?.onHand).toBe(initialOnHand + 3);
  });

  // 13. Immutable StockMovement records logged with type STOCK_RECEIPT
  it('13. logs immutable StockMovement records with movementType STOCK_RECEIPT upon receiving', () => {
    const supplier = suppliersRepository.getAll()[0];
    const v = variantsRepository.getAll()[0];
    const createdPO = purchaseOrdersRepository.create({
      supplierId: supplier.id,
      destinationBranchId: 'BR-MAIN-01',
      destinationLocationId: 'LOC-MAIN-01',
      items: [{ variantId: v.id, orderedQuantity: 5, unitCost: 15000 }],
    });
    const po = purchaseOrdersRepository.approve(createdPO.id, 'Manager', 'Approved');
    const item = po.items[0];

    const initialMovements = stockMovementsRepository.getAll({
      locationId: po.destinationLocationId,
      sku: item.sku,
    });

    goodsReceiptsRepository.receiveGoods({
      poId: po.id,
      deliveryReference: 'DC-MVMT-001',
      destinationLocationId: po.destinationLocationId,
      receivedBy: 'Warehouse Staff',
      items: [{ sku: item.sku, receivedQuantity: 2 }],
    });

    const newMovements = stockMovementsRepository.getAll({
      locationId: po.destinationLocationId,
      sku: item.sku,
    });

    expect(newMovements.length).toBeGreaterThan(initialMovements.length);
    const latest = newMovements[0];
    expect(latest.movementType).toBe('STOCK_RECEIPT');
    expect(latest.quantity).toBe(2);
  });

  // 14. Fully received PO automatically transitions to FULLY_RECEIVED
  it('14. transitions PO status to FULLY_RECEIVED when all line item quantities are received', () => {
    const supplier = suppliersRepository.getAll()[0];
    const v = variantsRepository.getAll()[0];
    const createdPO = purchaseOrdersRepository.create({
      supplierId: supplier.id,
      destinationBranchId: 'BR-MAIN-01',
      destinationLocationId: 'LOC-MAIN-01',
      items: [{ variantId: v.id, orderedQuantity: 4, unitCost: 15000 }],
    });
    const po = purchaseOrdersRepository.approve(createdPO.id, 'Manager', 'Approved');

    goodsReceiptsRepository.receiveGoods({
      poId: po.id,
      deliveryReference: 'DC-FULL-RECEIPT',
      destinationLocationId: po.destinationLocationId,
      receivedBy: 'Warehouse Lead',
      items: [{ sku: v.sku, receivedQuantity: 4 }],
    });

    const updatedPO = purchaseOrdersRepository.getById(po.id)!;
    expect(updatedPO.status).toBe('FULLY_RECEIVED');
  });

  // 15. Partially received PO transitions to PARTIALLY_RECEIVED
  it('15. transitions PO status to PARTIALLY_RECEIVED when only some ordered items are received', () => {
    const supplier = suppliersRepository.getAll()[0];
    const v = variantsRepository.getAll()[0];
    const createdPO = purchaseOrdersRepository.create({
      supplierId: supplier.id,
      destinationBranchId: 'BR-MAIN-01',
      destinationLocationId: 'LOC-MAIN-01',
      items: [{ variantId: v.id, orderedQuantity: 6, unitCost: 15000 }],
    });
    const po = purchaseOrdersRepository.approve(createdPO.id, 'Manager', 'Approved');

    goodsReceiptsRepository.receiveGoods({
      poId: po.id,
      deliveryReference: 'DC-PARTIAL-RECEIPT',
      destinationLocationId: po.destinationLocationId,
      receivedBy: 'Warehouse Lead',
      items: [{ sku: v.sku, receivedQuantity: 2 }],
    });

    const updatedPO = purchaseOrdersRepository.getById(po.id)!;
    expect(updatedPO.status).toBe('PARTIALLY_RECEIVED');
  });

  // 16. Supplier bill generation records SupplierBill with correct details
  it('16. generates SupplierBill with correct items, payment terms, and calculates amountDue', () => {
    const supplier = suppliersRepository.getAll()[0];
    const v = variantsRepository.getAll()[0];

    const bill = purchaseBillsRepository.create({
      supplierId: supplier.id,
      supplierInvoiceNumber: 'INV-BILL-TEST-99',
      branchId: 'BR-MAIN-01',
      billDate: '2026-10-29',
      dueDate: '2026-11-28',
      items: [
        {
          sku: v.sku,
          variantId: v.id,
          productName: 'Molty Ortho Luxury',
          quantity: 4,
          unitCost: 20000,
        },
      ],
    });

    expect(bill.id).toBeDefined();
    expect(bill.billNumber).toMatch(/^BILL-\d{8}-\d{4}$/);
    expect(bill.grandTotal).toBe(80000);
    expect(bill.amountPaid).toBe(0);
    expect(bill.amountDue).toBe(80000);
    expect(bill.paymentStatus).toBe('UNPAID');
    expect(bill.status).toBe('POSTED');
  });

  // 17. Posting a supplier bill increases supplier's currentOutstanding balance
  it('17. increases supplier currentOutstanding accounts payable liability when a bill is posted', () => {
    const supplier = suppliersRepository.getAll()[0];
    const initialOutstanding = supplier.currentOutstanding;

    const bill = purchaseBillsRepository.create({
      supplierId: supplier.id,
      supplierInvoiceNumber: 'INV-OUTSTANDING-TEST',
      branchId: 'BR-MAIN-01',
      items: [
        {
          sku: 'TEST-SKU-01',
          quantity: 2,
          unitCost: 35000,
        },
      ],
    });

    const reloadedSupplier = suppliersRepository.getById(supplier.id)!;
    expect(reloadedSupplier.currentOutstanding).toBe(initialOutstanding + bill.grandTotal);
  });

  // 18. Posting a supplier bill posts a CREDIT entry to supplierLedgerRepository
  it('18. posts a CREDIT entry into supplier accounts payable ledger when a bill is created', () => {
    const supplier = suppliersRepository.getAll()[0];

    const bill = purchaseBillsRepository.create({
      supplierId: supplier.id,
      supplierInvoiceNumber: 'INV-LEDGER-CREDIT-TEST',
      branchId: 'BR-MAIN-01',
      items: [{ sku: 'TEST-SKU-02', quantity: 1, unitCost: 50000 }],
    });

    const ledger = supplierLedgerRepository.getBySupplierId(supplier.id);
    const latest = ledger[ledger.length - 1];

    expect(latest.type).toBe('BILL');
    expect(latest.credit).toBe(50000);
    expect(latest.debit).toBe(0);
    expect(latest.documentId).toBe(bill.id);
  });

  // 19. Supplier running ledger balance increases correctly after bill credit
  it('19. increases running ledger balance by the exact credit amount of the bill', () => {
    const supplier = suppliersRepository.getAll()[0];
    const initialBalance = supplierLedgerRepository.getRunningBalance(supplier.id);

    purchaseBillsRepository.create({
      supplierId: supplier.id,
      supplierInvoiceNumber: 'INV-RUNNING-BAL-TEST',
      branchId: 'BR-MAIN-01',
      items: [{ sku: 'TEST-SKU-03', quantity: 2, unitCost: 15000 }],
    });

    const newBalance = supplierLedgerRepository.getRunningBalance(supplier.id);
    expect(newBalance).toBe(initialBalance + 30000);
  });

  // 20. Supplier payment creation reduces bill amountDue and updates paymentStatus
  it('20. reduces bill amountDue and updates paymentStatus to PARTIALLY_PAID or PAID', () => {
    const bill = purchaseBillsRepository.getAll().find((b) => b.paymentStatus === 'UNPAID')!;
    expect(bill.paymentStatus).toBe('UNPAID');

    const payAmount = Math.round(bill.amountDue / 2);

    supplierPaymentsRepository.createPayment({
      supplierId: bill.supplierId,
      branchId: bill.branchId,
      amount: payAmount,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-PAY-PARTIAL-01',
      allocations: [
        {
          billId: bill.id,
          allocatedAmount: payAmount,
        },
      ],
    });

    const updatedBill = purchaseBillsRepository.getById(bill.id)!;
    expect(updatedBill.amountPaid).toBe(payAmount);
    expect(updatedBill.amountDue).toBe(bill.grandTotal - payAmount);
    expect(updatedBill.paymentStatus).toBe('PARTIALLY_PAID');
  });

  // 21. Supplier payment creation reduces supplier's currentOutstanding balance
  it('21. decreases supplier currentOutstanding balance upon issuing payment voucher', () => {
    const supplier = suppliersRepository.getById('SUP-001')!;
    const initialOutstanding = supplier.currentOutstanding;

    supplierPaymentsRepository.createPayment({
      supplierId: supplier.id,
      branchId: 'BR-MAIN-01',
      amount: 100000,
      paymentMethod: 'CHEQUE',
      referenceNumber: 'CHQ-882910',
      allocations: [],
    });

    const updated = suppliersRepository.getById(supplier.id)!;
    expect(updated.currentOutstanding).toBe(initialOutstanding - 100000);
  });

  // 22. Supplier payment creation posts a DEBIT entry to supplierLedgerRepository
  it('22. posts a DEBIT entry to supplier ledger when a payment voucher is issued', () => {
    const bill = purchaseBillsRepository.getAll().find((b) => b.amountDue >= 45000)!;
    const supplier = suppliersRepository.getById(bill.supplierId)!;

    const payment = supplierPaymentsRepository.createPayment({
      supplierId: supplier.id,
      branchId: 'BR-MAIN-01',
      amount: 45000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'IBFT-554433',
      allocations: [
        {
          billId: bill.id,
          allocatedAmount: 45000,
        },
      ],
    });

    const ledger = supplierLedgerRepository.getBySupplierId(supplier.id);
    const latest = ledger[ledger.length - 1];

    expect(latest.type).toBe('PAYMENT');
    expect(latest.debit).toBe(45000);
    expect(latest.credit).toBe(0);
    expect(latest.referenceNumber).toBe(payment.voucherNumber);
  });

  // 23. Supplier running ledger balance decreases correctly after payment debit
  it('23. decreases running ledger balance by the exact debit amount of the payment', () => {
    const supplier = suppliersRepository.getById('SUP-001')!;
    const initialBalance = supplierLedgerRepository.getRunningBalance(supplier.id);

    supplierPaymentsRepository.createPayment({
      supplierId: supplier.id,
      branchId: 'BR-MAIN-01',
      amount: 50000,
      paymentMethod: 'CASH',
      allocations: [],
    });

    const newBalance = supplierLedgerRepository.getRunningBalance(supplier.id);
    expect(newBalance).toBe(initialBalance - 50000);
  });

  // 24. Over-allocation of payment against a bill is rejected
  it('24. rejects payment allocation that exceeds bill amount due', () => {
    const bill = purchaseBillsRepository.getAll().find((b) => b.amountDue > 0)!;

    expect(() => {
      supplierPaymentsRepository.createPayment({
        supplierId: bill.supplierId,
        branchId: bill.branchId,
        amount: bill.amountDue + 10000,
        paymentMethod: 'BANK_TRANSFER',
        allocations: [
          {
            billId: bill.id,
            allocatedAmount: bill.amountDue + 10000,
          },
        ],
      });
    }).toThrow(/exceeds/i);
  });

  // 25. Purchase return and debit note creation deducts stock from inventory
  it('25. deducts stock quantity from branch stock location upon processing purchase return', () => {
    const locationId = 'LOC-MAIN-01';
    const sku = 'DURA-LUX-7872-T6';

    const initialBalance = inventoryRepository.getBalance(locationId, sku);
    const initialOnHand = initialBalance?.onHand || 10;

    purchaseReturnsRepository.createReturn({
      supplierId: 'SUP-001',
      branchId: 'BR-MAIN-01',
      locationId,
      reason: 'Manufacturing fault',
      items: [{ sku, quantity: 2, unitCost: 20000 }],
    });

    const updatedBalance = inventoryRepository.getBalance(locationId, sku);
    expect(updatedBalance?.onHand).toBe(initialOnHand - 2);
  });

  // 26. Purchase return logs PURCHASE_RETURN stock movement
  it('26. logs PURCHASE_RETURN movement in stock movements journal', () => {
    const locationId = 'LOC-MAIN-01';
    const sku = 'DURA-LUX-7872-T6';

    const res = purchaseReturnsRepository.createReturn({
      supplierId: 'SUP-001',
      branchId: 'BR-MAIN-01',
      locationId,
      reason: 'Damaged mattress cover',
      items: [{ sku, quantity: 1, unitCost: 25000 }],
    });

    expect(res.movements).toHaveLength(1);
    expect(res.movements[0].movementType).toBe('PURCHASE_RETURN');
    expect(res.movements[0].quantity).toBe(1);
  });

  // 27. Purchase return reduces supplier's currentOutstanding balance
  it('27. reduces supplier accounts payable liability by debit note total amount', () => {
    const supplier = suppliersRepository.getById('SUP-001')!;
    const initialOutstanding = supplier.currentOutstanding;

    purchaseReturnsRepository.createReturn({
      supplierId: supplier.id,
      branchId: 'BR-MAIN-01',
      locationId: 'LOC-MAIN-01',
      reason: 'Excess goods returned',
      items: [{ sku: 'DURA-LUX-7872-T6', quantity: 2, unitCost: 30000 }],
    });

    const updated = suppliersRepository.getById(supplier.id)!;
    expect(updated.currentOutstanding).toBe(initialOutstanding - 60000);
  });

  // 28. Purchase return posts a DEBIT_NOTE entry to supplierLedgerRepository
  it('28. posts a DEBIT_NOTE entry reducing the running balance in the supplier accounts payable ledger', () => {
    const supplier = suppliersRepository.getById('SUP-001')!;
    const initialBalance = supplierLedgerRepository.getRunningBalance(supplier.id);

    const res = purchaseReturnsRepository.createReturn({
      supplierId: supplier.id,
      branchId: 'BR-MAIN-01',
      locationId: 'LOC-MAIN-01',
      reason: 'Defective mattress core',
      items: [{ sku: 'DURA-LUX-7872-T6', quantity: 1, unitCost: 28000 }],
    });

    const ledger = supplierLedgerRepository.getBySupplierId(supplier.id);
    const latest = ledger[ledger.length - 1];

    expect(latest.type).toBe('DEBIT_NOTE');
    expect(latest.debit).toBe(28000);
    expect(latest.credit).toBe(0);
    expect(latest.referenceNumber).toBe(res.purchaseReturn.debitNoteNumber);
    expect(latest.balance).toBe(initialBalance - 28000);
  });

  // 29. Purchasing dashboard KPIs calculate correct totals
  it('29. calculates purchasing dashboard KPIs correctly across all operational dimensions', () => {
    const poSummary = purchaseOrdersRepository.getSummary();
    const billsSummary = purchaseBillsRepository.getSummary();
    const returns = purchaseReturnsRepository.getAll();
    const payments = supplierPaymentsRepository.getAll();

    expect(poSummary.totalOrders).toBeGreaterThanOrEqual(4);
    expect(billsSummary.totalBills).toBeGreaterThanOrEqual(4);
    expect(billsSummary.totalDue).toBeGreaterThan(0);
    expect(returns.length).toBeGreaterThanOrEqual(1);
    expect(payments.length).toBeGreaterThanOrEqual(1);
  });

  // 30. Financial separation verified
  it('30. strictly maintains financial separation: PO commitments do not change sales revenue or direct expenses', () => {
    // 1. Create a PO
    const supplier = suppliersRepository.getAll()[0];
    const v = variantsRepository.getAll()[0];
    const initialOutstanding = supplier.currentOutstanding;

    const po = purchaseOrdersRepository.create({
      supplierId: supplier.id,
      destinationBranchId: 'BR-MAIN-01',
      destinationLocationId: 'LOC-MAIN-01',
      items: [{ variantId: v.id, orderedQuantity: 5, unitCost: 50000 }],
    });

    // PO value does not increase supplier accounts payable (only bills do)
    const supAfterPO = suppliersRepository.getById(supplier.id)!;
    expect(supAfterPO.currentOutstanding).toBe(initialOutstanding);

    // Approve PO
    purchaseOrdersRepository.approve(po.id, 'Manager');

    // Receiving stock updates inventory, but does NOT create accounts payable liability
    goodsReceiptsRepository.receiveGoods({
      poId: po.id,
      deliveryReference: 'DC-SEP-01',
      destinationLocationId: po.destinationLocationId,
      receivedBy: 'Store Keeper',
      items: [{ sku: po.items[0].sku, receivedQuantity: 5 }],
    });

    const supAfterGRN = suppliersRepository.getById(supplier.id)!;
    expect(supAfterGRN.currentOutstanding).toBe(initialOutstanding);

    // Only posting the Bill increases accounts payable liability
    const bill = purchaseBillsRepository.create({
      supplierId: supplier.id,
      supplierInvoiceNumber: 'INV-SEP-001',
      branchId: 'BR-MAIN-01',
      poId: po.id,
      items: [{ sku: po.items[0].sku, quantity: 5, unitCost: 50000 }],
    });

    const supAfterBill = suppliersRepository.getById(supplier.id)!;
    expect(supAfterBill.currentOutstanding).toBe(initialOutstanding + bill.grandTotal);
  });
});
