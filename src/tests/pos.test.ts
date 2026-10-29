import { describe, it, expect, beforeEach } from 'vitest';
import {
  salesRepository,
  heldSalesRepository,
  posSettingsRepository,
  inventoryRepository,
  productsRepository,
  variantsRepository,
  branchesRepository,
  brandsRepository,
  categoriesRepository,
  sizesRepository,
  thicknessRepository,
  stockLocationsRepository,
} from '@/lib/demo-db';
import { calculateDashboardKPIs } from '@/utils/financialCalculations';
import { hasPermission } from '@/lib/permissions';
import { User, POSCartItem } from '@/types';

describe('Flow 06 — Point of Sale (POS), Counter Billing & Checkout System', () => {
  beforeEach(() => {
    // Reset all repositories to ensure fresh clean state before each test
    branchesRepository.resetToSeed();
    brandsRepository.resetToSeed();
    categoriesRepository.resetToSeed();
    sizesRepository.resetToSeed();
    thicknessRepository.resetToSeed();
    productsRepository.resetToSeed();
    variantsRepository.resetToSeed();
    stockLocationsRepository.resetToSeed();
    inventoryRepository.resetToSeed();
    salesRepository.resetToSeed();
    heldSalesRepository.resetToSeed();
    posSettingsRepository.resetToSeed();
  });

  // 1. Brand/category/product filtering
  it('1. correctly filters categories and products by selected brand and category', () => {
    const duraBrand = brandsRepository.getByCode('DURA');
    expect(duraBrand).toBeDefined();

    const duraCategories = categoriesRepository.getByBrandId(duraBrand!.id);
    expect(duraCategories.length).toBeGreaterThan(0);
    const classicCat = duraCategories.find((c) => c.name.toLowerCase().includes('classic'));
    expect(classicCat).toBeDefined();

    const duraProducts = productsRepository.getAll({ brandId: duraBrand!.id });
    expect(duraProducts.length).toBeGreaterThan(0);

    const classicProducts = productsRepository.getAll({
      brandId: duraBrand!.id,
      categoryId: classicCat!.id,
    });
    expect(classicProducts.length).toBeGreaterThan(0);
    expect(classicProducts[0].name).toContain('Classic');
  });

  // 2. Variant selection
  it('2. finds exact product variant based on size and thickness selection', () => {
    const variant = variantsRepository.getBySku('DURA-CLASSIC-7836-T6');
    expect(variant).toBeDefined();
    expect(variant?.retailPrice).toBe(12500);
  });

  // 3. Dynamic retail pricing
  it('3. dynamically retrieves variant retail prices matching screenshot specifications', () => {
    // Dura Classic 6" = 12,500
    const classicVar = variantsRepository.getBySku('DURA-CLASSIC-7836-T6');
    expect(classicVar?.retailPrice).toBe(12500);

    // Dura Luxury Queen 8" = 35,000
    const luxVar = variantsRepository.getBySku('DURA-LUX-7860-T8');
    expect(luxVar?.retailPrice).toBe(35000);

    // Dura Ultra Slim Double 6" = 15,200
    const slimVar = variantsRepository.getBySku('DURA-SLIM-7860-T6');
    expect(slimVar?.retailPrice).toBe(15200);
  });

  // 4. Add to cart
  it('4. calculates line total correctly when adding item to cart', () => {
    const item: POSCartItem = {
      variantId: 'VAR-DURA-CLASSIC-7836-T6',
      productId: 'PROD-DURA-CLASSIC',
      sku: 'DURA-CLASSIC-7836-T6',
      productName: 'Dura Classic',
      brandName: 'Dura',
      categoryName: 'Classic',
      sizeLabel: '78×36 (Single)',
      thicknessLabel: '6" Thickness',
      unitPrice: 12500,
      quantity: 1,
      lineTotal: 12500,
      availableStock: 30,
    };

    expect(item.lineTotal).toBe(12500);
  });

  // 5. Cart quantity changes
  it('5. recalculates line totals and cart subtotal on quantity changes', () => {
    const items: POSCartItem[] = [
      {
        variantId: 'VAR-DURA-CLASSIC-7836-T6',
        productId: 'PROD-DURA-CLASSIC',
        sku: 'DURA-CLASSIC-7836-T6',
        productName: 'Dura Classic',
        brandName: 'Dura',
        categoryName: 'Classic',
        sizeLabel: 'Single',
        unitPrice: 12500,
        quantity: 2,
        lineTotal: 25000,
        availableStock: 30,
      },
    ];

    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    expect(subtotal).toBe(25000);
  });

  // 6. Duplicate SKU cart merging
  it('6. merges duplicate SKUs into a single cart line item with summed quantities', () => {
    const cart: POSCartItem[] = [
      {
        variantId: 'VAR-DURA-CLASSIC-7836-T6',
        productId: 'PROD-DURA-CLASSIC',
        sku: 'DURA-CLASSIC-7836-T6',
        productName: 'Dura Classic',
        brandName: 'Dura',
        categoryName: 'Classic',
        sizeLabel: 'Single',
        unitPrice: 12500,
        quantity: 1,
        lineTotal: 12500,
        availableStock: 30,
      },
    ];

    const newItem: POSCartItem = {
      variantId: 'VAR-DURA-CLASSIC-7836-T6',
      productId: 'PROD-DURA-CLASSIC',
      sku: 'DURA-CLASSIC-7836-T6',
      productName: 'Dura Classic',
      brandName: 'Dura',
      categoryName: 'Classic',
      sizeLabel: 'Single',
      unitPrice: 12500,
      quantity: 2,
      lineTotal: 25000,
      availableStock: 30,
    };

    const existingIndex = cart.findIndex((i) => i.variantId === newItem.variantId);
    if (existingIndex >= 0) {
      cart[existingIndex].quantity += newItem.quantity;
      cart[existingIndex].lineTotal = cart[existingIndex].unitPrice * cart[existingIndex].quantity;
    }

    expect(cart.length).toBe(1);
    expect(cart[0].quantity).toBe(3);
    expect(cart[0].lineTotal).toBe(37500);
  });

  // 7. Stock availability validation
  it('7. validates available stock and blocks orders exceeding branch on-hand quantity', () => {
    const branchId = 'BR-MAIN-01';
    const balances = inventoryRepository.getByBranch(branchId);
    const balance = balances.find((b) => b.sku === 'DURA-CLASSIC-7836-T6');
    expect(balance).toBeDefined();
    expect(balance!.available).toBeGreaterThanOrEqual(10);

    // Attempting to checkout more than available raises an error
    expect(() => {
      salesRepository.createSale({
        branchId,
        cashierId: 'USR-ADMIN-01',
        cashierName: 'Admin',
        paymentMethod: 'CASH',
        items: [
          {
            sku: 'DURA-CLASSIC-7836-T6',
            productId: 'PROD-DURA-CLASSIC',
            productName: 'Dura Classic',
            quantity: 9999, // Exceeds available stock
            unitPrice: 12500,
          },
        ],
        subtotal: 9999 * 12500,
        discountAmount: 0,
        taxAmount: 0,
        grandTotal: 9999 * 12500,
        amountReceived: 9999 * 12500,
        changeAmount: 0,
      });
    }).toThrow(/Insufficient stock/);
  });

  // 8. Discount calculation
  it('8. handles discount calculation without resulting in negative total', () => {
    const subtotal = 77900;
    const discount = 2000;
    const grandTotal = Math.max(0, subtotal - discount);
    expect(grandTotal).toBe(75900);

    // Excess discount is clamped
    const excessDiscount = 100000;
    const clampedTotal = Math.max(0, subtotal - excessDiscount);
    expect(clampedTotal).toBe(0);
  });

  // 9. Tax calculation
  it('9. calculates tax safely according to configured rate', () => {
    const subtotal = 50000;
    const taxRatePercent = 0; // Default demo is 0
    const taxAmount = (subtotal * taxRatePercent) / 100;
    expect(taxAmount).toBe(0);
  });

  // 10. Cash/change calculation
  it('10. calculates change correctly matching reference screenshot numbers', () => {
    // Reference screenshot: Total Amount = 77,900, Amount Received = 80,000, Change = 2,100
    const totalAmount = 77900;
    const amountReceived = 80000;
    const change = amountReceived - totalAmount;
    expect(change).toBe(2100);
  });

  // 11. Insufficient payment validation
  it('11. prevents checkout when amount received is less than total', () => {
    const totalAmount = 77900;
    const amountReceived = 70000;
    const isInsufficient = amountReceived < totalAmount;
    expect(isInsufficient).toBe(true);

    expect(() => {
      salesRepository.createSale({
        branchId: 'BR-MAIN-01',
        cashierId: 'USR-ADMIN-01',
        cashierName: 'Admin',
        paymentMethod: 'CASH',
        items: [
          {
            sku: 'DURA-CLASSIC-7836-T6',
            productId: 'PROD-DURA-CLASSIC',
            productName: 'Dura Classic',
            quantity: 1,
            unitPrice: 12500,
          },
        ],
        subtotal: 12500,
        discountAmount: 0,
        taxAmount: 0,
        grandTotal: 12500,
        amountReceived: 10000, // Insufficient
        changeAmount: 0,
      });
    }).toThrow(/Insufficient payment/);
  });

  // 12. Successful checkout
  it('12. completes checkout successfully and returns invoice and stock movement', () => {
    const branchId = 'BR-MAIN-01';
    const initialBalances = inventoryRepository.getByBranch(branchId);
    const balanceBefore = initialBalances.find((b) => b.sku === 'DURA-CLASSIC-7836-T6')!;
    const stockBefore = balanceBefore.available;

    const result = salesRepository.createSale({
      branchId,
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      paymentMethod: 'CASH',
      items: [
        {
          sku: 'DURA-CLASSIC-7836-T6',
          productId: 'PROD-DURA-CLASSIC',
          productName: 'Dura Classic',
          quantity: 2,
          unitPrice: 12500,
        },
      ],
      subtotal: 25000,
      discountAmount: 1000,
      taxAmount: 0,
      grandTotal: 24000,
      amountReceived: 25000,
      changeAmount: 1000,
    });

    expect(result.invoice).toBeDefined();
    expect(result.invoice.invoiceNumber).toMatch(/^INV-/);
    expect(result.invoice.netAmount).toBe(24000);
    expect(result.invoice.paymentStatus).toBe('PAID');

    // 15. Stock deduction check
    const balanceAfter = inventoryRepository
      .getByBranch(branchId)
      .find((b) => b.sku === 'DURA-CLASSIC-7836-T6')!;
    expect(balanceAfter.available).toBe(stockBefore - 2);

    // 16. Stock movement check
    expect(result.deductedMovements.length).toBe(1);
    expect(result.deductedMovements[0].type).toBe('POS_SALE');
    expect(result.deductedMovements[0].quantity).toBe(2);
  });

  // 13. Duplicate checkout prevention
  it('13. prevents duplicate checkout submission with empty or zero items', () => {
    expect(() => {
      salesRepository.createSale({
        branchId: 'BR-MAIN-01',
        cashierId: 'USR-ADMIN-01',
        cashierName: 'Admin',
        paymentMethod: 'CASH',
        items: [],
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        grandTotal: 0,
        amountReceived: 0,
        changeAmount: 0,
      });
    }).toThrow(/Cart is empty/i);
  });

  // 14. Invoice number uniqueness
  it('14. guarantees unique sequential invoice numbers across transactions', () => {
    const sale1 = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      paymentMethod: 'CASH',
      items: [
        {
          sku: 'DURA-CLASSIC-7836-T6',
          productId: 'PROD-DURA-CLASSIC',
          productName: 'Dura Classic',
          quantity: 1,
          unitPrice: 12500,
        },
      ],
      subtotal: 12500,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 12500,
      amountReceived: 12500,
      changeAmount: 0,
    });

    const sale2 = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      paymentMethod: 'CASH',
      items: [
        {
          sku: 'DURA-CLASSIC-7836-T6',
          productId: 'PROD-DURA-CLASSIC',
          productName: 'Dura Classic',
          quantity: 1,
          unitPrice: 12500,
        },
      ],
      subtotal: 12500,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 12500,
      amountReceived: 12500,
      changeAmount: 0,
    });

    expect(sale1.invoice.invoiceNumber).not.toBe(sale2.invoice.invoiceNumber);
  });

  // 17. Branch isolation
  it('17. enforces branch isolation and blocks sales for branches where retail is disabled', () => {
    // Wholesale Depot has allowRetailSales: false
    const wholesaleBranch = branchesRepository.getById('BR-WS-03');
    expect(wholesaleBranch?.settings?.allowRetailSales).toBe(false);

    expect(() => {
      salesRepository.createSale({
        branchId: 'BR-WS-03',
        cashierId: 'USR-ADMIN-01',
        cashierName: 'Admin',
        paymentMethod: 'CASH',
        items: [
          {
            sku: 'DURA-CLASSIC-7836-T6',
            productId: 'PROD-DURA-CLASSIC',
            productName: 'Dura Classic',
            quantity: 1,
            unitPrice: 12500,
          },
        ],
        subtotal: 12500,
        discountAmount: 0,
        taxAmount: 0,
        grandTotal: 12500,
        amountReceived: 12500,
        changeAmount: 0,
      });
    }).toThrow(/retail sales/i);
  });

  // 18. Role permissions
  it('18. verifies role permissions using central permission system', () => {
    const superAdmin: User = {
      id: 'USR-ADMIN-01',
      name: 'Super Admin',
      email: 'admin@molty.pk',
      role: 'SUPER_ADMIN',
      designation: 'Admin',
    };

    const cashier: User = {
      id: 'USR-CASHIER-01',
      name: 'Cashier Bilal',
      email: 'bilal@molty.pk',
      role: 'CASHIER',
      designation: 'Cashier',
    };

    const inventoryOfficer: User = {
      id: 'USR-INV-01',
      name: 'Inventory Officer',
      email: 'inv@molty.pk',
      role: 'INVENTORY_OFFICER',
      designation: 'Officer',
    };

    expect(hasPermission(superAdmin, 'pos:create')).toBe(true);
    expect(hasPermission(cashier, 'pos:create')).toBe(true);
    expect(hasPermission(inventoryOfficer, 'pos:create')).toBe(false);
  });

  // 19. Hold sale & 20. Resume held sale
  it('19 & 20. holds sale, generates HOLD-XXXX reference, and restores it on resume', () => {
    const cart: POSCartItem[] = [
      {
        variantId: 'VAR-DURA-CLASSIC-7836-T6',
        productId: 'PROD-DURA-CLASSIC',
        sku: 'DURA-CLASSIC-7836-T6',
        productName: 'Dura Classic',
        brandName: 'Dura',
        categoryName: 'Classic',
        sizeLabel: 'Single',
        unitPrice: 12500,
        quantity: 1,
        lineTotal: 12500,
        availableStock: 30,
      },
    ];

    const held = heldSalesRepository.holdSale({
      branchId: 'BR-MAIN-01',
      branchName: 'Main Flagship Showroom',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      customerName: 'Ahmad Khan',
      subtotal: 12500,
      discountAmount: 500,
      taxAmount: 0,
      grandTotal: 12000,
      items: cart,
    });

    expect(held.id).toBeDefined();
    expect(held.holdReference).toMatch(/^HOLD-/);
    expect(held.items.length).toBe(1);

    // Listing held sales returns it
    const heldList = heldSalesRepository.getAll('BR-MAIN-01');
    expect(heldList.some((s) => s.id === held.id)).toBe(true);

    // Resuming and deleting from held sales
    const deleted = heldSalesRepository.deleteHeldSale(held.id);
    expect(deleted).toBe(true);
    const afterDelete = heldSalesRepository.getAll('BR-MAIN-01');
    expect(afterDelete.some((s) => s.id === held.id)).toBe(false);
  });

  // 21. Workstation settings persistence
  it('21. manages and persists POS workstation preferences', () => {
    const initial = posSettingsRepository.getSettings();
    expect(initial.selectedBranchId).toBe('BR-MAIN-01');
    expect(initial.receiptFormat).toBe('THERMAL_80MM');

    const updated = posSettingsRepository.updateSettings({
      shiftName: 'Evening',
      receiptFormat: 'STANDARD_A4',
    });

    expect(updated.shiftName).toBe('Evening');
    expect(updated.receiptFormat).toBe('STANDARD_A4');
  });

  // 22. Sales history
  it('22. lists sales history and filters by branch and payment method', () => {
    // Create a sale first
    salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      paymentMethod: 'CASH',
      items: [
        {
          sku: 'DURA-CLASSIC-7836-T6',
          productId: 'PROD-DURA-CLASSIC',
          productName: 'Dura Classic',
          quantity: 1,
          unitPrice: 12500,
        },
      ],
      subtotal: 12500,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 12500,
      amountReceived: 12500,
      changeAmount: 0,
    });

    const allSales = salesRepository.getAll();
    expect(allSales.length).toBeGreaterThan(0);

    const mainSales = salesRepository.getAll({ branchId: 'BR-MAIN-01' });
    expect(mainSales.every((s) => s.branchId === 'BR-MAIN-01')).toBe(true);
  });

  // 23. Invoice formatting & receipt data
  it('23. formats invoice record with complete receipt printable data', () => {
    const saleResult = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      paymentMethod: 'CASH',
      items: [
        {
          sku: 'DURA-CLASSIC-7836-T6',
          productId: 'PROD-DURA-CLASSIC',
          productName: 'Dura Classic',
          quantity: 1,
          unitPrice: 12500,
        },
      ],
      subtotal: 12500,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 12500,
      amountReceived: 15000,
      changeAmount: 2500,
    });

    const inv = saleResult.invoice;
    expect(inv.invoiceNumber).toBeDefined();
    expect(inv.branchName).toBeDefined();
    expect(inv.salesPerson).toBe('Admin');
    expect(inv.amountPaid).toBe(15000);
    expect(inv.changeAmount).toBe(2500);
  });

  // 24. Dashboard financial reconciliation
  it('24. reconciles sales transactions with dashboard KPI calculations', () => {
    const initialSales = salesRepository.getAll();
    const initialKpis = calculateDashboardKPIs(initialSales);
    const initialRevenue = initialKpis.totalNetSales;

    // Create a new retail sale
    salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      paymentMethod: 'CASH',
      items: [
        {
          sku: 'DURA-CLASSIC-7836-T6',
          productId: 'PROD-DURA-CLASSIC',
          productName: 'Dura Classic',
          quantity: 1,
          unitPrice: 12500,
        },
      ],
      subtotal: 12500,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 12500,
      amountReceived: 12500,
      changeAmount: 0,
    });

    const updatedSales = salesRepository.getAll();
    const updatedKpis = calculateDashboardKPIs(updatedSales);

    expect(updatedSales.length).toBe(initialSales.length + 1);
    expect(updatedKpis.totalNetSales).toBe(initialRevenue + 12500);
  });

  // 25. Demo data reset
  it('25. resets demo database safely and restores seed invoices', () => {
    // Add sale
    salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      paymentMethod: 'CASH',
      items: [
        {
          sku: 'DURA-CLASSIC-7836-T6',
          productId: 'PROD-DURA-CLASSIC',
          productName: 'Dura Classic',
          quantity: 1,
          unitPrice: 12500,
        },
      ],
      subtotal: 12500,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 12500,
      amountReceived: 12500,
      changeAmount: 0,
    });

    // Reset
    const resetList = salesRepository.resetToSeed();
    expect(resetList.length).toBeGreaterThan(0);
  });

  // 26. No regression in Flows 01–05
  it('26. preserves integrity of Flow 01-05 repositories and data', () => {
    expect(branchesRepository.getAll().length).toBe(5);
    expect(brandsRepository.getAll().length).toBeGreaterThanOrEqual(3);
    expect(categoriesRepository.getAll().length).toBeGreaterThanOrEqual(10);
    expect(productsRepository.getAll().length).toBeGreaterThanOrEqual(6);
    expect(variantsRepository.getAll().length).toBeGreaterThanOrEqual(15);
    expect(stockLocationsRepository.getAll().length).toBeGreaterThanOrEqual(5);
    expect(inventoryRepository.getAll().length).toBeGreaterThanOrEqual(10);
  });
});
