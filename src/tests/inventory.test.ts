import { describe, it, expect, beforeEach } from 'vitest';
import {
  inventoryRepository,
  stockLocationsRepository,
  stockMovementsRepository,
  stockTransfersRepository,
  stockCountsRepository,
  branchesRepository,
  demoStorage,
  STORAGE_KEYS,
} from '@/lib/demo-db';
import { User, InventoryBalance, Invoice } from '@/types';
import { hasPermission, canAccessBranch } from '@/lib/permissions';

describe('Flow 05: Inventory, Stock Locations, Transfers & Adjustments Management', () => {
  beforeEach(() => {
    // Reset all inventory and catalogue repositories to initial clean seed state
    inventoryRepository.resetToSeed();
    stockLocationsRepository.resetToSeed();
    stockMovementsRepository.resetToSeed();
    stockTransfersRepository.resetToSeed();
    stockCountsRepository.resetToSeed();
    branchesRepository.resetToSeed();
  });

  // 1. Opening stock: creates initial balances correctly
  it('1. Opening stock: creates initial balances correctly', () => {
    const uniqueSku = 'DURA-LUX-7872-T5';
    const locId = 'LOC-ORTH-01'; // Ortho Studio stockroom

    const res = inventoryRepository.createOpeningStock({
      branchId: 'BR-ORTH-04',
      stockLocationId: locId,
      referenceNumber: 'OB-TEST-001',
      notes: 'Initial opening stock audit',
      createdBy: 'Super Admin',
      items: [{ sku: uniqueSku, openingQuantity: 25, unitCost: 26000 }],
    });

    expect(res.referenceNumber).toBe('OB-TEST-001');
    expect(res.updatedBalances).toHaveLength(1);
    expect(res.updatedBalances[0].onHand).toBe(25);
    expect(res.updatedBalances[0].available).toBe(25);

    const balance = inventoryRepository.getBalance(locId, uniqueSku);
    expect(balance).toBeDefined();
    expect(balance!.onHand).toBe(25);
  });

  // 2. Duplicate opening balance prevention
  it('2. Duplicate opening balance prevention: rejects second opening stock initialization for same SKU/location', () => {
    const locId = 'LOC-MAIN-01';
    const sku = 'DURA-LUX-7872-T6'; // already initialized in seed movements

    expect(() => {
      inventoryRepository.createOpeningStock({
        branchId: 'BR-MAIN-01',
        stockLocationId: locId,
        referenceNumber: 'OB-DUP-TEST',
        createdBy: 'Super Admin',
        items: [{ sku, openingQuantity: 20 }],
      });
    }).toThrow(/already been initialized/i);
  });

  // 3. Stock receiving: increases destination stock and logs STOCK_RECEIPT
  it('3. Stock receiving: increases destination stock and logs STOCK_RECEIPT', () => {
    const sku = 'DURA-LUX-7872-T6';
    const locId = 'LOC-MAIN-01';

    const initialBalance = inventoryRepository.getBalance(locId, sku)!.onHand;

    const res = inventoryRepository.receiveStock({
      destinationBranchId: 'BR-MAIN-01',
      destinationLocationId: locId,
      supplierName: 'Master Foam Plant #1',
      referenceNumber: 'GRN-TEST-100',
      receivedBy: 'Bilal Ahmed',
      items: [{ sku, quantity: 20, unitCost: 28000 }],
    });

    expect(res.receiptNumber).toBeDefined();
    expect(res.movements).toHaveLength(1);
    expect(res.movements[0].movementType).toBe('STOCK_RECEIPT');
    expect(res.movements[0].quantity).toBe(20);

    const updatedBalance = inventoryRepository.getBalance(locId, sku)!.onHand;
    expect(updatedBalance).toBe(initialBalance + 20);
  });

  // 4. Multi-line receipts: receives multiple SKUs in a single document atomically
  it('4. Multi-line receipts: receives multiple SKUs in a single document atomically', () => {
    const locId = 'LOC-WS-01';
    const initialT5 = inventoryRepository.getBalance(locId, 'DURA-LUX-7872-T5')?.onHand ?? 0;
    const initialT8 = inventoryRepository.getBalance(locId, 'DURA-LUX-7872-T8')?.onHand ?? 0;

    const res = inventoryRepository.receiveStock({
      destinationBranchId: 'BR-WS-03',
      destinationLocationId: locId,
      referenceNumber: 'MULTI-GRN-01',
      receivedBy: 'Saad Malik',
      items: [
        { sku: 'DURA-LUX-7872-T5', quantity: 15, unitCost: 26000 },
        { sku: 'DURA-LUX-7872-T8', quantity: 10, unitCost: 31000 },
      ],
    });

    expect(res.updatedBalances).toHaveLength(2);
    expect(inventoryRepository.getBalance(locId, 'DURA-LUX-7872-T5')!.onHand).toBe(initialT5 + 15);
    expect(inventoryRepository.getBalance(locId, 'DURA-LUX-7872-T8')!.onHand).toBe(initialT8 + 10);
  });

  // 5. Branch-specific stock: distinct branches maintain isolated balances for identical SKU
  it('5. Branch-specific stock: verifies exact balances for Dura Luxury 78x72x6 matching Section 3 example', () => {
    const sku = 'DURA-LUX-7872-T6';

    const mainBal = inventoryRepository.getBalance('LOC-MAIN-01', sku)!.onHand;
    const dispBal = inventoryRepository.getBalance('LOC-DISP-01', sku)!.onHand;
    const wsBal = inventoryRepository.getBalance('LOC-WS-01', sku)!.onHand;
    const orthoBal = inventoryRepository.getBalance('LOC-ORTH-01', sku)!.onHand;
    const exprBal = inventoryRepository.getBalance('LOC-EXPR-01', sku)!.onHand;

    expect(mainBal).toBe(15);
    expect(dispBal).toBe(8);
    expect(wsBal).toBe(30);
    expect(orthoBal).toBe(4);
    expect(exprBal).toBe(2);
  });

  // 6. Stock transfer creation: validates source != destination and creates transfer in PENDING_APPROVAL
  it('6. Stock transfer creation: validates source != destination and creates transfer in PENDING_APPROVAL', () => {
    const transfer = stockTransfersRepository.createTransfer({
      sourceBranchId: 'BR-MAIN-01',
      sourceLocationId: 'LOC-MAIN-01',
      destinationBranchId: 'BR-DISP-02',
      destinationLocationId: 'LOC-DISP-01',
      items: [{ sku: 'DURA-LUX-7872-T6', requestedQuantity: 5 }],
      notes: 'Replenish display center stock',
      requestedBy: 'Bilal Ahmed',
    });

    expect(transfer.id).toBeDefined();
    expect(transfer.status).toBe('PENDING_APPROVAL');
    expect(transfer.items[0].requestedQuantity).toBe(5);

    // Source and destination identical rejected
    expect(() => {
      stockTransfersRepository.createTransfer({
        sourceBranchId: 'BR-MAIN-01',
        sourceLocationId: 'LOC-MAIN-01',
        destinationBranchId: 'BR-MAIN-01',
        destinationLocationId: 'LOC-MAIN-01',
        items: [{ sku: 'DURA-LUX-7872-T6', requestedQuantity: 2 }],
        requestedBy: 'Staff',
      });
    }).toThrow(/cannot be identical/i);
  });

  // 7. Transfer approval: transitions transfer to APPROVED
  it('7. Transfer approval: transitions transfer to APPROVED', () => {
    const transfer = stockTransfersRepository.createTransfer({
      sourceBranchId: 'BR-MAIN-01',
      sourceLocationId: 'LOC-MAIN-01',
      destinationBranchId: 'BR-DISP-02',
      destinationLocationId: 'LOC-DISP-01',
      items: [{ sku: 'DURA-LUX-7872-T6', requestedQuantity: 3 }],
      requestedBy: 'Bilal Ahmed',
    });

    const approved = stockTransfersRepository.approveTransfer(transfer.id, 'Super Admin');
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('Super Admin');
  });

  // 8. Transfer dispatch: reduces source stock on dispatch and sets status DISPATCHED (in transit)
  it('8. Transfer dispatch: reduces source stock on dispatch and sets status DISPATCHED', () => {
    const sku = 'DURA-LUX-7872-T6';
    const initialSourceStock = inventoryRepository.getBalance('LOC-MAIN-01', sku)!.onHand;

    const transfer = stockTransfersRepository.createTransfer({
      sourceBranchId: 'BR-MAIN-01',
      sourceLocationId: 'LOC-MAIN-01',
      destinationBranchId: 'BR-DISP-02',
      destinationLocationId: 'LOC-DISP-01',
      items: [{ sku, requestedQuantity: 5 }],
      requestedBy: 'Bilal Ahmed',
    });

    stockTransfersRepository.approveTransfer(transfer.id, 'Super Admin');
    const dispatched = stockTransfersRepository.dispatchTransfer(transfer.id, 'Bilal Ahmed');

    expect(dispatched.status).toBe('DISPATCHED');
    expect(dispatched.dispatchedBy).toBe('Bilal Ahmed');

    // Source stock decreased immediately
    const updatedSourceStock = inventoryRepository.getBalance('LOC-MAIN-01', sku)!.onHand;
    expect(updatedSourceStock).toBe(initialSourceStock - 5);

    // Destination stock should NOT increase yet while in transit
    const destStock = inventoryRepository.getBalance('LOC-DISP-01', sku)!.onHand;
    expect(destStock).toBe(8); // still at initial 8
  });

  // 9. Transfer receipt: increases destination stock on receipt and sets status RECEIVED
  it('9. Transfer receipt: increases destination stock on receipt and sets status RECEIVED', () => {
    const sku = 'DURA-LUX-7872-T6';
    const initialDestStock = inventoryRepository.getBalance('LOC-DISP-01', sku)!.onHand;

    const transfer = stockTransfersRepository.createTransfer({
      sourceBranchId: 'BR-MAIN-01',
      sourceLocationId: 'LOC-MAIN-01',
      destinationBranchId: 'BR-DISP-02',
      destinationLocationId: 'LOC-DISP-01',
      items: [{ sku, requestedQuantity: 4 }],
      requestedBy: 'Bilal Ahmed',
    });

    stockTransfersRepository.approveTransfer(transfer.id, 'Super Admin');
    stockTransfersRepository.dispatchTransfer(transfer.id, 'Bilal Ahmed');
    const received = stockTransfersRepository.receiveTransfer(transfer.id, 'Usman Khan');

    expect(received.status).toBe('RECEIVED');
    expect(received.receivedBy).toBe('Usman Khan');

    // Destination stock now increased
    const updatedDestStock = inventoryRepository.getBalance('LOC-DISP-01', sku)!.onHand;
    expect(updatedDestStock).toBe(initialDestStock + 4);
  });

  // 10. Transfer cancellation: cancels draft/pending transfer cleanly
  it('10. Transfer cancellation: cancels pending transfer cleanly', () => {
    const transfer = stockTransfersRepository.createTransfer({
      sourceBranchId: 'BR-MAIN-01',
      sourceLocationId: 'LOC-MAIN-01',
      destinationBranchId: 'BR-DISP-02',
      destinationLocationId: 'LOC-DISP-01',
      items: [{ sku: 'DURA-LUX-7872-T6', requestedQuantity: 2 }],
      requestedBy: 'Bilal Ahmed',
    });

    const cancelled = stockTransfersRepository.cancelTransfer(
      transfer.id,
      'Bilal Ahmed',
      'Client cancelled reserve order'
    );
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancellationReason).toBe('Client cancelled reserve order');
  });

  // 11. Transfer cancellation after dispatch: controlled reversal process restores source stock
  it('11. Transfer cancellation after dispatch: controlled reversal process restores source stock', () => {
    const sku = 'DURA-LUX-7872-T6';
    const initialStock = inventoryRepository.getBalance('LOC-MAIN-01', sku)!.onHand;

    const transfer = stockTransfersRepository.createTransfer({
      sourceBranchId: 'BR-MAIN-01',
      sourceLocationId: 'LOC-MAIN-01',
      destinationBranchId: 'BR-DISP-02',
      destinationLocationId: 'LOC-DISP-01',
      items: [{ sku, requestedQuantity: 5 }],
      requestedBy: 'Bilal Ahmed',
    });

    stockTransfersRepository.approveTransfer(transfer.id, 'Super Admin');
    stockTransfersRepository.dispatchTransfer(transfer.id, 'Bilal Ahmed');
    expect(inventoryRepository.getBalance('LOC-MAIN-01', sku)!.onHand).toBe(initialStock - 5);

    // Cancel while in transit -> restores source stock
    stockTransfersRepository.cancelTransfer(
      transfer.id,
      'Super Admin',
      'Delivery van broke down; returned to shop'
    );

    const restoredStock = inventoryRepository.getBalance('LOC-MAIN-01', sku)!.onHand;
    expect(restoredStock).toBe(initialStock);
  });

  // 12. Insufficient stock protection: blocks transfer creation if available stock < requested
  it('12. Insufficient stock protection: blocks transfer if available stock < requested', () => {
    const sku = 'DURA-LUX-7872-T6'; // on-hand is 15 at LOC-MAIN-01

    expect(() => {
      stockTransfersRepository.createTransfer({
        sourceBranchId: 'BR-MAIN-01',
        sourceLocationId: 'LOC-MAIN-01',
        destinationBranchId: 'BR-DISP-02',
        destinationLocationId: 'LOC-DISP-01',
        items: [{ sku, requestedQuantity: 999 }], // Exceeds available 15
        requestedBy: 'Bilal Ahmed',
      });
    }).toThrow(/insufficient stock/i);
  });

  // 13. Duplicate posting prevention: prevents double-dispatch or double-receipt
  it('13. Duplicate posting prevention: prevents double-dispatch or double-receipt', () => {
    const transfer = stockTransfersRepository.createTransfer({
      sourceBranchId: 'BR-MAIN-01',
      sourceLocationId: 'LOC-MAIN-01',
      destinationBranchId: 'BR-DISP-02',
      destinationLocationId: 'LOC-DISP-01',
      items: [{ sku: 'DURA-LUX-7872-T6', requestedQuantity: 2 }],
      requestedBy: 'Bilal Ahmed',
    });

    stockTransfersRepository.approveTransfer(transfer.id, 'Super Admin');
    stockTransfersRepository.dispatchTransfer(transfer.id, 'Bilal Ahmed');

    // Attempting to dispatch again must fail
    expect(() => {
      stockTransfersRepository.dispatchTransfer(transfer.id, 'Bilal Ahmed');
    }).toThrow(/must be approved/i);
  });

  // 14. Stock adjustments: updates balance with positive or negative quantity differences
  it('14. Stock adjustments: updates balance with positive or negative differences', () => {
    const sku = 'DURA-LUX-7872-T6';
    const locId = 'LOC-MAIN-01';
    const initial = inventoryRepository.getBalance(locId, sku)!.onHand;

    // Positive correction
    const adjPos = inventoryRepository.adjustStock({
      branchId: 'BR-MAIN-01',
      stockLocationId: locId,
      sku,
      adjustmentType: 'PHYSICAL_CORRECTION',
      quantityDifference: 3,
      reason: 'Physical count found 3 extra unopened boxed mattresses',
      authorizedBy: 'Super Admin',
    });
    expect(adjPos.updatedBalance.onHand).toBe(initial + 3);

    // Negative correction
    const adjNeg = inventoryRepository.adjustStock({
      branchId: 'BR-MAIN-01',
      stockLocationId: locId,
      sku,
      adjustmentType: 'PHYSICAL_CORRECTION',
      quantityDifference: -2,
      reason: 'Physical recount discrepancy adjustment',
      authorizedBy: 'Super Admin',
    });
    expect(adjNeg.updatedBalance.onHand).toBe(initial + 1);
  });

  // 15. Mandatory adjustment reason: rejects adjustments without reasons
  it('15. Mandatory adjustment reason: rejects adjustments without non-empty reasons', () => {
    expect(() => {
      inventoryRepository.adjustStock({
        branchId: 'BR-MAIN-01',
        stockLocationId: 'LOC-MAIN-01',
        sku: 'DURA-LUX-7872-T6',
        adjustmentType: 'PHYSICAL_CORRECTION',
        quantityDifference: -1,
        reason: '   ', // Empty spaces
        authorizedBy: 'Super Admin',
      });
    }).toThrow(/reason is strictly mandatory/i);
  });

  // 16. Damaged stock handling: routes damaged mattress write-off to quarantine bay
  it('16. Damaged stock handling: routes damaged mattress write-off to quarantine bay', () => {
    const sku = 'DURA-LUX-7872-T6';
    const initialSaleable = inventoryRepository.getBalance('LOC-MAIN-01', sku)!.onHand;
    const initialDamaged = inventoryRepository.getBalance('LOC-MAIN-DMG', sku)!.onHand;

    inventoryRepository.adjustStock({
      branchId: 'BR-MAIN-01',
      stockLocationId: 'LOC-MAIN-01',
      sku,
      adjustmentType: 'DAMAGED_MATTRESS',
      quantityDifference: -2,
      reason: 'Forklift ripped corner packaging during unloading',
      authorizedBy: 'Bilal Ahmed',
    });

    const updatedSaleable = inventoryRepository.getBalance('LOC-MAIN-01', sku)!.onHand;
    const updatedDamaged = inventoryRepository.getBalance('LOC-MAIN-DMG', sku)!.onHand;

    expect(updatedSaleable).toBe(initialSaleable - 2);
    expect(updatedDamaged).toBe(initialDamaged + 2);
  });

  // 17. Return to saleable stock: moves inspected quarantine items back to retail stock
  it('17. Return to saleable stock: moves inspected quarantine items back to retail stock', () => {
    const sku = 'DURA-LUX-7872-T6';
    const initialSaleable = inventoryRepository.getBalance('LOC-MAIN-01', sku)!.onHand;
    const initialDamaged = inventoryRepository.getBalance('LOC-MAIN-DMG', sku)!.onHand;

    // Deduct from quarantine
    inventoryRepository.adjustStock({
      branchId: 'BR-MAIN-01',
      stockLocationId: 'LOC-MAIN-DMG',
      sku,
      adjustmentType: 'RETURN_TO_SALEABLE',
      quantityDifference: -1,
      reason: 'Passed technical QA inspection: Re-bagged and approved for retail floor',
      authorizedBy: 'QA Inspector',
    });

    // Inward to saleable
    inventoryRepository.adjustStock({
      branchId: 'BR-MAIN-01',
      stockLocationId: 'LOC-MAIN-01',
      sku,
      adjustmentType: 'RETURN_TO_SALEABLE',
      quantityDifference: 1,
      reason: 'Re-admitted from quarantine bay',
      authorizedBy: 'QA Inspector',
    });

    expect(inventoryRepository.getBalance('LOC-MAIN-DMG', sku)!.onHand).toBe(initialDamaged - 1);
    expect(inventoryRepository.getBalance('LOC-MAIN-01', sku)!.onHand).toBe(initialSaleable + 1);
  });

  // 18. Stock counting session: calculates variance (physical - system)
  it('18. Stock counting session: calculates variance correctly', () => {
    const count = stockCountsRepository.createStockCount({
      branchId: 'BR-MAIN-01',
      stockLocationId: 'LOC-MAIN-01',
      skus: ['DURA-LUX-7872-T6', 'MF-ORIG-7872'],
      countedBy: 'Bilal Ahmed',
    });

    expect(count.status).toBe('IN_PROGRESS');
    expect(count.items).toHaveLength(2);

    const updated = stockCountsRepository.updateCountItems(count.id, [
      { sku: 'DURA-LUX-7872-T6', physicalQuantity: 18 }, // System was 15 -> variance +3
      { sku: 'MF-ORIG-7872', physicalQuantity: 17 }, // System was 18 -> variance -1
    ]);

    const item1 = updated.items.find((i) => i.sku === 'DURA-LUX-7872-T6');
    const item2 = updated.items.find((i) => i.sku === 'MF-ORIG-7872');

    expect(item1!.variance).toBe(3);
    expect(item2!.variance).toBe(-1);
    expect(updated.totalDiscrepancy).toBe(4); // |+3| + |-1| = 4
  });

  // 19. Reconcile and post count: adjusts balances and prevents double posting
  it('19. Reconcile and post count: adjusts balances and prevents double posting', () => {
    const sku = 'DURA-LUX-7872-T6';
    const locId = 'LOC-MAIN-01';

    const count = stockCountsRepository.createStockCount({
      branchId: 'BR-MAIN-01',
      stockLocationId: locId,
      skus: [sku],
      countedBy: 'Bilal Ahmed',
    });

    stockCountsRepository.updateCountItems(count.id, [
      { sku, physicalQuantity: 20 }, // 15 -> 20
    ]);

    const res = stockCountsRepository.reconcileAndPostCount(count.id, 'Super Admin');
    expect(res.count.status).toBe('COMPLETED');
    expect(res.movements).toHaveLength(1);
    expect(res.movements[0].movementType).toBe('ADJUSTMENT_IN');
    expect(res.movements[0].quantity).toBe(5);

    const updatedBalance = inventoryRepository.getBalance(locId, sku)!.onHand;
    expect(updatedBalance).toBe(20);

    // Accidental double posting rejected
    expect(() => {
      stockCountsRepository.reconcileAndPostCount(count.id, 'Super Admin');
    }).toThrow(/already been finalized/i);
  });

  // 20. Inventory movement history: every transaction creates an immutable traceable movement
  it('20. Inventory movement history: creates traceable movement records', () => {
    const movements = stockMovementsRepository.getAll();
    expect(movements.length).toBeGreaterThan(0);

    const latest = movements[0];
    expect(latest.id).toBeDefined();
    expect(latest.timestamp).toBeDefined();
    expect(latest.documentReference).toBeDefined();
    expect(latest.quantity).toBeGreaterThan(0);
  });

  // 21. Product/SKU relationship validation: rejects stock operations on non-existent SKUs
  it('21. Product/SKU relationship validation: rejects stock operations on invalid SKUs', () => {
    expect(() => {
      inventoryRepository.receiveStock({
        destinationBranchId: 'BR-MAIN-01',
        destinationLocationId: 'LOC-MAIN-01',
        receivedBy: 'Bilal Ahmed',
        items: [{ sku: 'NON-EXISTENT-SKU-999', quantity: 10 }],
      });
    }).toThrow(/does not exist in the catalogue/i);
  });

  // 22. Branch access restrictions: respects role and assigned branch permissions
  it('22. Branch access restrictions: respects role and assigned branch boundaries', () => {
    const superAdmin: User = {
      id: 'USR-ADMIN-01',
      name: 'Super Admin',
      email: 'admin@moltyfoam.store',
      role: 'SUPER_ADMIN',
      designation: 'Managing Director',
      isActive: true,
    };

    const branchManager: User = {
      id: 'USR-MGR-DISP',
      name: 'Usman Khan',
      email: 'usman.khan@moltyfoam.store',
      role: 'BRANCH_MANAGER',
      assignedBranchId: 'BR-DISP-02',
      designation: 'Display Center Manager',
      isActive: true,
    };

    expect(canAccessBranch(superAdmin, 'BR-MAIN-01')).toBe(true);
    expect(canAccessBranch(superAdmin, 'BR-DISP-02')).toBe(true);

    expect(canAccessBranch(branchManager, 'BR-DISP-02')).toBe(true);
    expect(canAccessBranch(branchManager, 'BR-MAIN-01')).toBe(false);

    expect(hasPermission(superAdmin, 'inventory:manage')).toBe(true);
    expect(hasPermission(branchManager, 'inventory:view')).toBe(true);
  });

  // 23. Persistence after refresh: demo database stores and re-hydrates inventory state
  it('23. Persistence after refresh: demo database stores and re-hydrates inventory state', () => {
    const sku = 'DURA-LUX-7872-T6';
    const locId = 'LOC-MAIN-01';

    inventoryRepository.setReorderLevel(locId, sku, 12);
    const inMemoryBalance = inventoryRepository.getBalance(locId, sku);
    expect(inMemoryBalance!.reorderLevel).toBe(12);

    // Read directly from raw storage engine
    const rawBalances = demoStorage.getItem<InventoryBalance[]>(STORAGE_KEYS.INVENTORY_BALANCES, []);
    const persisted = rawBalances.find(
      (b) => b.stockLocationId === locId && b.sku === sku
    );
    expect(persisted).toBeDefined();
    expect(persisted?.reorderLevel).toBe(12);
  });

  // 24. Dashboard inventory reconciliation & no unintended revenue changes
  it('24. Dashboard inventory reconciliation & no unintended revenue changes', () => {
    const kpis = inventoryRepository.getDashboardKPIs();
    expect(kpis.totalStockUnits).toBeGreaterThan(0);
    expect(kpis.totalLocations).toBeGreaterThan(0);
    expect(kpis.branchDistribution.length).toBe(5);

    // Verify inventory valuation only derives from actual unitCost
    expect(kpis.valuation.isValuationAvailable).toBe(true);
    expect(kpis.valuation.totalValue).toBeGreaterThan(0);

    // Verify stock receiving does not alter sales invoice revenue or create invoices
    const rawInvoices = demoStorage.getItem<Invoice[]>(STORAGE_KEYS.INVOICES, []);
    const invoiceCountBefore = rawInvoices.length;

    inventoryRepository.receiveStock({
      destinationBranchId: 'BR-MAIN-01',
      destinationLocationId: 'LOC-MAIN-01',
      receivedBy: 'Bilal Ahmed',
      items: [{ sku: 'DURA-LUX-7872-T6', quantity: 50, unitCost: 28000 }],
    });

    const rawInvoicesAfter = demoStorage.getItem<Invoice[]>(STORAGE_KEYS.INVOICES, []);
    expect(rawInvoicesAfter.length).toBe(invoiceCountBefore); // No sales invoices created
  });
});
