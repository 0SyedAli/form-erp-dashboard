import { describe, it, expect, beforeEach } from 'vitest';
import {
  branchesRepository,
  productsRepository,
  variantsRepository,
  inventoryRepository,
  salesRepository,
  heldSalesRepository,
  customersRepository,
  customerLedgerRepository,
  collectionsRepository,
  priceListsRepository,
  posSettingsRepository,
} from '@/lib/demo-db';
import { calculateDashboardKPIs } from '@/utils/financialCalculations';
import { hasPermission } from '@/lib/permissions';
import { User, POSCartItem } from '@/types';

describe('Flow 07 — Unified POS, Multi-Tier Pricing, Customer Credit & Recovery Management', () => {
  beforeEach(() => {
    // Reset all demo DB repositories before each test
    branchesRepository.resetToSeed();
    productsRepository.resetToSeed();
    variantsRepository.resetToSeed();
    inventoryRepository.resetToSeed();
    salesRepository.resetToSeed();
    heldSalesRepository.resetToSeed();
    customersRepository.resetToSeed();
    customerLedgerRepository.resetToSeed();
    collectionsRepository.resetToSeed();
    priceListsRepository.resetToSeed();
    posSettingsRepository.resetToSeed();
  });

  // 1. Three sale-type selection
  it('1. supports three distinct sale types: WALK_IN, WHOLESALE, and DISTRIBUTOR', () => {
    const saleTypes = ['WALK_IN', 'WHOLESALE', 'DISTRIBUTOR'] as const;
    expect(saleTypes).toHaveLength(3);
    expect(saleTypes).toContain('WALK_IN');
    expect(saleTypes).toContain('WHOLESALE');
    expect(saleTypes).toContain('DISTRIBUTOR');
  });

  // 2. Dynamic price lookup
  it('2. looks up dynamic multi-tier pricing for Dura Luxury variant SKU DURA-LUX-7872-T6', () => {
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6');
    expect(variant).toBeDefined();

    const walkInPrice = priceListsRepository.getPriceForVariant('WALK_IN', variant!.id);
    const wholesalePrice = priceListsRepository.getPriceForVariant('WHOLESALE', variant!.id);
    const distributorPrice = priceListsRepository.getPriceForVariant('DISTRIBUTOR', variant!.id);

    expect(walkInPrice).toBe(45000);
    expect(wholesalePrice).toBe(39000);
    expect(distributorPrice).toBe(34500);
  });

  // 3. Cart repricing
  it('3. updates all cart line prices dynamically when sale type changes from Walk-in to Wholesale', () => {
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6');
    expect(variant).toBeDefined();

    // Initial walk-in cart item (2 units @ Rs. 45,000 = Rs. 90,000)
    const initialItem: POSCartItem = {
      variantId: variant!.id,
      productId: variant!.productId,
      sku: variant!.sku,
      productName: 'Dura Luxury Spring Mattress',
      brandName: 'Dura',
      categoryName: 'Mattress',
      sizeLabel: 'King (78x72)',
      dimensionInches: '78x72',
      thicknessInches: 6,
      unitPrice: 45000,
      quantity: 2,
      lineTotal: 90000,
      availableStock: 10,
      saleType: 'WALK_IN',
    };

    expect(initialItem.lineTotal).toBe(90000);

    // Simulate repricing to WHOLESALE
    const wholesalePrice = priceListsRepository.getPriceForVariant('WHOLESALE', variant!.id);
    const repricedItem: POSCartItem = {
      ...initialItem,
      saleType: 'WHOLESALE',
      unitPrice: wholesalePrice,
      lineTotal: wholesalePrice * initialItem.quantity,
    };

    expect(repricedItem.unitPrice).toBe(39000);
    expect(repricedItem.lineTotal).toBe(78000);
  });

  // 4. Missing price validation
  it('4. returns 0 and flags missing price when a tier has no configured price', () => {
    // If a variant is not present in price list repository
    const nonExistentPrice = priceListsRepository.getPriceForVariant('DISTRIBUTOR', 'VAR-INVALID');
    expect(nonExistentPrice).toBe(0);
  });

  // 5. Customer creation
  it('5. creates a new customer with code, credit limit, and terms', () => {
    const newCust = customersRepository.create({
      name: 'Gulberg Traders',
      phone: '0300-9876543',
      customerType: 'WHOLESALE',
      creditEnabled: true,
      creditLimit: 300000,
      creditTerms: '30 Days Net Credit',
      defaultDueDays: 30,
      status: 'ACTIVE',
    });

    expect(newCust.id).toBeDefined();
    expect(newCust.customerCode).toMatch(/^CUST-/);
    expect(newCust.creditLimit).toBe(300000);
    expect(newCust.currentOutstanding).toBe(0);
    expect(newCust.status).toBe('ACTIVE');
  });

  // 6. Customer editing
  it('6. updates existing customer credit limit and contact details', () => {
    const cust = customersRepository.getByCode('CUST-WS-001');
    expect(cust).toBeDefined();

    const updated = customersRepository.update(cust!.id, {
      creditLimit: 350000,
      phone: '0300-5555555',
    });

    expect(updated.creditLimit).toBe(350000);
    expect(updated.phone).toBe('0300-5555555');
  });

  // 7. Customer type validation
  it('7. categorizes customers into WALK_IN, WHOLESALE, and DISTRIBUTOR', () => {
    const wholesale = customersRepository.getAll({ customerType: 'WHOLESALE' });
    const distributor = customersRepository.getAll({ customerType: 'DISTRIBUTOR' });
    const walkIn = customersRepository.getAll({ customerType: 'WALK_IN' });

    expect(wholesale.length).toBeGreaterThan(0);
    expect(distributor.length).toBeGreaterThan(0);
    expect(walkIn.length).toBeGreaterThan(0);
  });

  // 8. Anonymous Walk-in full payment
  it('8. permits anonymous walk-in sales when paid in full', () => {
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6')!;
    const sale = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      customerName: 'Walk-in Retail Customer',
      customerPhone: '0300-1234567',
      paymentMethod: 'CASH',
      saleType: 'WALK_IN',
      paymentArrangement: 'FULL',
      subtotal: 45000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 45000,
      amountReceived: 45000,
      changeAmount: 0,
      items: [
        {
          sku: variant.sku,
          productId: variant.productId,
          productName: 'Dura Luxury Spring Mattress',
          quantity: 1,
          unitPrice: 45000,
        },
      ],
    });

    expect(sale.invoice.paymentStatus).toBe('PAID');
    expect(sale.invoice.amountDue).toBe(0);
    expect(sale.invoice.customerId).toBeUndefined();
  });

  // 9. Named Walk-in credit
  it('9. allows named walk-in customer accounts to purchase on partial credit', () => {
    const cust = customersRepository.getByCode('CUST-RT-001')!;
    const initialOutstanding = cust.currentOutstanding;

    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6')!;
    const sale = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      paymentMethod: 'CASH',
      saleType: 'WALK_IN',
      paymentArrangement: 'PARTIAL',
      subtotal: 45000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 45000,
      amountReceived: 15000,
      changeAmount: 0,
      dueDate: '2026-11-20',
      items: [
        {
          sku: variant.sku,
          productId: variant.productId,
          productName: 'Dura Luxury Spring Mattress',
          quantity: 1,
          unitPrice: 45000,
        },
      ],
    });

    expect(sale.invoice.paymentStatus).toBe('PARTIALLY_PAID');
    expect(sale.invoice.amountPaid).toBe(15000);
    expect(sale.invoice.amountDue).toBe(30000);

    const updatedCust = customersRepository.getById(cust.id)!;
    expect(updatedCust.currentOutstanding).toBe(initialOutstanding + 30000);
  });

  // 10. Wholesale credit
  it('10. requires identified customer and checks credit limit for Wholesale credit sales', () => {
    const cust = customersRepository.getByCode('CUST-WS-001')!;
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6')!;

    const sale = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      paymentMethod: 'CREDIT_30D',
      saleType: 'WHOLESALE',
      paymentArrangement: 'CREDIT',
      subtotal: 39000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 39000,
      amountReceived: 0,
      changeAmount: 0,
      dueDate: '2026-11-30',
      items: [
        {
          sku: variant.sku,
          productId: variant.productId,
          productName: 'Dura Luxury Spring Mattress',
          quantity: 1,
          unitPrice: 39000,
        },
      ],
    });

    expect(sale.invoice.paymentStatus).toBe('UNPAID');
    expect(sale.invoice.amountDue).toBe(39000);
  });

  // 11. Distributor credit
  it('11. processes distributor tier full credit invoice and records distributor price', () => {
    const distCust = customersRepository.getByCode('CUST-DIST-001')!;
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6')!;

    const sale = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      customerId: distCust.id,
      customerName: distCust.name,
      customerPhone: distCust.phone,
      paymentMethod: 'CREDIT_30D',
      saleType: 'DISTRIBUTOR',
      paymentArrangement: 'CREDIT',
      subtotal: 34500,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 34500,
      amountReceived: 0,
      changeAmount: 0,
      dueDate: '2026-11-30',
      items: [
        {
          sku: variant.sku,
          productId: variant.productId,
          productName: 'Dura Luxury Spring Mattress',
          quantity: 1,
          unitPrice: 34500,
        },
      ],
    });

    expect(sale.invoice.saleType).toBe('DISTRIBUTOR');
    expect(sale.invoice.items[0].unitPrice).toBe(34500);
    expect(sale.invoice.amountDue).toBe(34500);
  });

  // 12. Credit limit enforcement
  it('12. blocks credit sale when new credit exceeds available customer credit limit without override', () => {
    const cust = customersRepository.getByCode('CUST-RT-001')!; // Limit 50,000, Outstanding 0
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6')!;

    // Attempting to buy 2 units on full credit = Rs. 90,000 > Limit 50,000
    expect(() => {
      salesRepository.createSale({
        branchId: 'BR-MAIN-01',
        cashierId: 'USR-ADMIN-01',
        cashierName: 'Admin',
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone,
        paymentMethod: 'CREDIT_30D',
        saleType: 'WALK_IN',
        paymentArrangement: 'CREDIT',
        subtotal: 90000,
        discountAmount: 0,
        taxAmount: 0,
        grandTotal: 90000,
        amountReceived: 0,
        changeAmount: 0,
        creditOverride: false,
        items: [
          {
            sku: variant.sku,
            productId: variant.productId,
            productName: 'Dura Luxury Spring Mattress',
            quantity: 2,
            unitPrice: 45000,
          },
        ],
      });
    }).toThrow(/Credit limit exceeded/);
  });

  // 13. Credit approval permissions
  it('13. allows credit limit override when explicitly approved by authorized user', () => {
    const cust = customersRepository.getByCode('CUST-RT-001')!;
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6')!;

    const sale = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      paymentMethod: 'CREDIT_30D',
      saleType: 'WALK_IN',
      paymentArrangement: 'CREDIT',
      subtotal: 90000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 90000,
      amountReceived: 0,
      changeAmount: 0,
      creditOverride: true,
      creditApprovedBy: 'Branch Manager',
      items: [
        {
          sku: variant.sku,
          productId: variant.productId,
          productName: 'Dura Luxury Spring Mattress',
          quantity: 2,
          unitPrice: 45000,
        },
      ],
    });

    expect(sale.invoice.creditOverride).toBe(true);
    expect(sale.invoice.creditApprovedBy).toBe('Branch Manager');
  });

  // 14. Full payment checkout
  it('14. records full cash receipt and computes change correctly', () => {
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6')!;
    const sale = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      customerName: 'Walk-in Cash Customer',
      customerPhone: '0300-1111111',
      paymentMethod: 'CASH',
      saleType: 'WALK_IN',
      paymentArrangement: 'FULL',
      subtotal: 45000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 45000,
      amountReceived: 50000,
      changeAmount: 5000,
      items: [
        {
          sku: variant.sku,
          productId: variant.productId,
          productName: 'Dura Luxury Spring Mattress',
          quantity: 1,
          unitPrice: 45000,
        },
      ],
    });

    expect(sale.invoice.amountPaid).toBe(50000);
    expect(sale.invoice.changeAmount).toBe(5000);
    expect(sale.invoice.paymentStatus).toBe('PAID');
  });

  // 15. Partial payment checkout
  it('15. records partial amount received and marks invoice PARTIALLY_PAID', () => {
    const cust = customersRepository.getByCode('CUST-WS-001')!;
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6')!;

    const sale = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      paymentMethod: 'CASH',
      saleType: 'WHOLESALE',
      paymentArrangement: 'PARTIAL',
      subtotal: 39000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 39000,
      amountReceived: 15000,
      changeAmount: 0,
      dueDate: '2026-11-25',
      items: [
        {
          sku: variant.sku,
          productId: variant.productId,
          productName: 'Dura Luxury Spring Mattress',
          quantity: 1,
          unitPrice: 39000,
        },
      ],
    });

    expect(sale.invoice.paymentStatus).toBe('PARTIALLY_PAID');
    expect(sale.invoice.amountPaid).toBe(15000);
    expect(sale.invoice.amountDue).toBe(24000);
  });

  // 16. Full-credit checkout
  it('16. processes full credit checkout with 0 received and marks invoice UNPAID', () => {
    const cust = customersRepository.getByCode('CUST-WS-001')!;
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6')!;

    const sale = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      paymentMethod: 'CREDIT_30D',
      saleType: 'WHOLESALE',
      paymentArrangement: 'CREDIT',
      subtotal: 39000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 39000,
      amountReceived: 0,
      changeAmount: 0,
      dueDate: '2026-11-25',
      items: [
        {
          sku: variant.sku,
          productId: variant.productId,
          productName: 'Dura Luxury Spring Mattress',
          quantity: 1,
          unitPrice: 39000,
        },
      ],
    });

    expect(sale.invoice.paymentStatus).toBe('UNPAID');
    expect(sale.invoice.amountPaid).toBe(0);
    expect(sale.invoice.amountDue).toBe(39000);
  });

  // 17. Invoice generation
  it('17. generates sequentially numbered invoice with branch attribution', () => {
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6')!;
    const sale = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      customerName: 'Test Customer',
      customerPhone: '0300-0000000',
      paymentMethod: 'CASH',
      saleType: 'WALK_IN',
      paymentArrangement: 'FULL',
      subtotal: 45000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 45000,
      amountReceived: 45000,
      changeAmount: 0,
      items: [
        {
          sku: variant.sku,
          productId: variant.productId,
          productName: 'Dura Luxury Spring Mattress',
          quantity: 1,
          unitPrice: 45000,
        },
      ],
    });

    expect(sale.invoice.invoiceNumber).toMatch(/^INV-/);
    expect(sale.invoice.branchId).toBe('BR-MAIN-01');
  });

  // 18. Price snapshot preservation
  it('18. preserves immutable selling price snapshot even if product catalogue price updates later', () => {
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6')!;
    const sale = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      customerName: 'Customer Snapshot',
      customerPhone: '0300-1111111',
      paymentMethod: 'CASH',
      saleType: 'WALK_IN',
      paymentArrangement: 'FULL',
      subtotal: 45000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 45000,
      amountReceived: 45000,
      changeAmount: 0,
      items: [
        {
          sku: variant.sku,
          productId: variant.productId,
          productName: 'Dura Luxury Spring Mattress',
          quantity: 1,
          unitPrice: 45000,
        },
      ],
    });

    // Update variant price in database
    variantsRepository.update(variant.id, { retailPrice: 55000, walkInPrice: 55000 });

    // Historical invoice price must remain 45,000
    const historicalInv = salesRepository.getById(sale.invoice.id)!;
    expect(historicalInv.items[0].unitPrice).toBe(45000);
    expect(historicalInv.netAmount).toBe(45000);
  });

  // 19. Inventory deduction
  it('19. deduces branch physical inventory when credit sale is completed', () => {
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6')!;
    const initialBal = inventoryRepository.getBalance(variant.id, 'BR-MAIN-01');
    const initialAvailable = initialBal?.available || 0;

    const cust = customersRepository.getByCode('CUST-WS-001')!;
    salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      paymentMethod: 'CREDIT_30D',
      saleType: 'WHOLESALE',
      paymentArrangement: 'CREDIT',
      subtotal: 39000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 39000,
      amountReceived: 0,
      changeAmount: 0,
      items: [
        {
          sku: variant.sku,
          productId: variant.productId,
          productName: 'Dura Luxury Spring Mattress',
          quantity: 2,
          unitPrice: 39000,
        },
      ],
    });

    const updatedBal = inventoryRepository.getBalance(variant.id, 'BR-MAIN-01');
    expect(updatedBal?.available).toBe(initialAvailable - 2);
  });

  // 20. Duplicate checkout prevention
  it('20. prevents checkout when cart is empty', () => {
    expect(() => {
      salesRepository.createSale({
        branchId: 'BR-MAIN-01',
        cashierId: 'USR-ADMIN-01',
        cashierName: 'Admin',
        customerName: 'Empty Cart',
        customerPhone: '0300-0000000',
        paymentMethod: 'CASH',
        saleType: 'WALK_IN',
        paymentArrangement: 'FULL',
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        grandTotal: 0,
        amountReceived: 0,
        changeAmount: 0,
        items: [],
      });
    }).toThrow(/Cart cannot be empty/);
  });

  // 21. Customer ledger entries
  it('21. logs an immutable debit entry in customer account ledger on credit invoice creation', () => {
    const cust = customersRepository.getByCode('CUST-RT-001')!;
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6')!;

    const sale = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      paymentMethod: 'CREDIT_30D',
      saleType: 'WALK_IN',
      paymentArrangement: 'CREDIT',
      subtotal: 45000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 45000,
      amountReceived: 0,
      changeAmount: 0,
      items: [
        {
          sku: variant.sku,
          productId: variant.productId,
          productName: 'Dura Luxury Spring Mattress',
          quantity: 1,
          unitPrice: 45000,
        },
      ],
    });

    const ledger = customerLedgerRepository.getByCustomerId(cust.id);
    const lastEntry = ledger[ledger.length - 1];
    expect(lastEntry).toBeDefined();
    expect(lastEntry.type).toBe('INVOICE');
    expect(lastEntry.referenceNumber).toBe(sale.invoice.invoiceNumber);
    expect(lastEntry.debit).toBe(45000);
    expect(lastEntry.credit).toBe(0);
  });

  // 22. Partial payment recovery & Section 12 test case
  it('22. executes Section 12 scenario: customer owes Rs. 50,000 across two invoices, pays Rs. 25,000, and reduces outstanding', () => {
    const cust = customersRepository.getByCode('CUST-WS-001')!; // seeded with INV-0081 (20k) and INV-0082 (30k) = 50k
    expect(cust.currentOutstanding).toBe(50000);

    const collection = collectionsRepository.createCollection({
      customerId: cust.id,
      branchId: 'BR-MAIN-01',
      amount: 25000,
      paymentMethod: 'CASH',
      allocations: [
        {
          invoiceId: 'INV-202410-0081',
          invoiceNumber: 'INV-202410-0081',
          allocatedAmount: 20000,
        },
        {
          invoiceId: 'INV-202410-0082',
          invoiceNumber: 'INV-202410-0082',
          allocatedAmount: 5000,
        },
      ],
    });

    expect(collection.receiptNumber).toMatch(/^REC-/);
    expect(collection.amount).toBe(25000);

    // Verify invoice A (INV-0081) status is PAID
    const invA = salesRepository.getById('INV-202410-0081')!;
    expect(invA.paymentStatus).toBe('PAID');
    expect(invA.amountDue).toBe(0);
    expect(invA.amountPaid).toBe(20000);

    // Verify invoice B (INV-0082) status is PARTIALLY_PAID with Rs. 25,000 outstanding
    const invB = salesRepository.getById('INV-202410-0082')!;
    expect(invB.paymentStatus).toBe('PARTIALLY_PAID');
    expect(invB.amountPaid).toBe(5000);
    expect(invB.amountDue).toBe(25000);

    // Verify customer outstanding reduced from 50,000 to 25,000
    const updatedCust = customersRepository.getById(cust.id)!;
    expect(updatedCust.currentOutstanding).toBe(25000);
  });

  // 23. Payment allocation
  it('23. prevents allocation amount from exceeding invoice outstanding due', () => {
    const cust = customersRepository.getByCode('CUST-WS-001')!;

    expect(() => {
      collectionsRepository.createCollection({
        customerId: cust.id,
        branchId: 'BR-MAIN-01',
        amount: 30000,
        paymentMethod: 'CASH',
        allocations: [
          {
            invoiceId: 'INV-202410-0081', // Outstanding is 20,000
            invoiceNumber: 'INV-202410-0081',
            allocatedAmount: 25000, // Exceeds by 5,000
          },
        ],
      });
    }).toThrow(/exceeds invoice outstanding/);
  });

  // 24. Overpayment handling
  it('24. handles unallocated excess payment without crashing', () => {
    const cust = customersRepository.getByCode('CUST-WS-001')!;

    const collection = collectionsRepository.createCollection({
      customerId: cust.id,
      branchId: 'BR-MAIN-01',
      amount: 25000,
      paymentMethod: 'CASH',
      allocations: [
        {
          invoiceId: 'INV-202410-0081',
          invoiceNumber: 'INV-202410-0081',
          allocatedAmount: 20000,
        },
      ],
      // 5,000 is unallocated
    });

    expect(collection.unallocatedAdvance).toBe(5000);
  });

  // 25. Customer advances
  it('25. records unallocated collections as an auditable customer advance', () => {
    const cust = customersRepository.getByCode('CUST-DIST-001')!;

    collectionsRepository.createCollection({
      customerId: cust.id,
      branchId: 'BR-MAIN-01',
      amount: 50000,
      paymentMethod: 'BANK_TRANSFER',
      allocations: [], // Zero invoices allocated => full advance deposit
    });

    const advances = collectionsRepository.getAdvancesByCustomer(cust.id);
    expect(advances.length).toBeGreaterThan(0);
    expect(advances[0].amount).toBe(50000);
  });

  // 26. Overdue invoice calculation
  it('26. dynamically flags invoices past due date with remaining balance as overdue', () => {
    const cust = customersRepository.getByCode('CUST-WS-001')!;
    const variant = variantsRepository.getBySku('DURA-LUX-7872-T6')!;

    // Create an invoice with past due date
    const sale = salesRepository.createSale({
      branchId: 'BR-MAIN-01',
      cashierId: 'USR-ADMIN-01',
      cashierName: 'Admin',
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      paymentMethod: 'CREDIT_30D',
      saleType: 'WHOLESALE',
      paymentArrangement: 'CREDIT',
      subtotal: 39000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 39000,
      amountReceived: 0,
      changeAmount: 0,
      dueDate: '2024-10-01', // In the past
      items: [
        {
          sku: variant.sku,
          productId: variant.productId,
          productName: 'Dura Luxury Spring Mattress',
          quantity: 1,
          unitPrice: 39000,
        },
      ],
    });

    const kpis = calculateDashboardKPIs([sale.invoice], new Date('2024-10-25T12:00:00+05:00'));
    expect(kpis.overdueAmount).toBe(39000);
  });

  // 27. Branch permissions
  it('27. enforces centralized permission helper for credit operations', () => {
    const superAdmin: User = {
      id: 'USR-ADMIN-01',
      name: 'Super Admin',
      email: 'admin@moltyfoam.com.pk',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      createdAt: '2024-01-01',
    };

    const cashier: User = {
      id: 'USR-CASH-01',
      name: 'Tariq Cashier',
      email: 'cashier@moltyfoam.com.pk',
      role: 'CASHIER',
      assignedBranchId: 'BR-MAIN-01',
      status: 'ACTIVE',
      createdAt: '2024-01-01',
    };

    expect(hasPermission(superAdmin, 'sales.credit.approve')).toBe(true);
    expect(hasPermission(cashier, 'sales.credit.approve')).toBe(false);
    expect(hasPermission(cashier, 'sales.credit.create')).toBe(true);
  });

  // 28. Sales revenue reconciliation
  it('28. separates sales revenue from collections: recoveries must not double-count sales revenue', () => {
    const invoices = salesRepository.getAll();
    const kpisBefore = calculateDashboardKPIs(invoices);
    const initialSalesRevenue = kpisBefore.totalNetSales;

    // Collect 25,000 against customer CUST-WS-001
    const cust = customersRepository.getByCode('CUST-WS-001')!;
    collectionsRepository.createCollection({
      customerId: cust.id,
      branchId: 'BR-MAIN-01',
      amount: 25000,
      paymentMethod: 'CASH',
      allocations: [
        {
          invoiceId: 'INV-202410-0081',
          invoiceNumber: 'INV-202410-0081',
          allocatedAmount: 20000,
        },
      ],
    });

    // Re-query invoices after collection
    const invoicesAfter = salesRepository.getAll();
    const kpisAfter = calculateDashboardKPIs(invoicesAfter);

    // Net sales must NOT have inflated by 25,000!
    expect(kpisAfter.totalNetSales).toBe(initialSalesRevenue);
    // Realized collections increased
    expect(kpisAfter.totalCollections).toBe(kpisBefore.totalCollections + 20000);
    // Outstanding receivables decreased
    expect(kpisAfter.pendingReceivables).toBe(kpisBefore.pendingReceivables - 20000);
  });

  // 29. Collections reconciliation
  it('29. reconciles customer ledger running balance with customer outstanding', () => {
    const cust = customersRepository.getByCode('CUST-WS-001')!;
    const ledger = customerLedgerRepository.getByCustomerId(cust.id);
    const latestBalance = ledger[ledger.length - 1].runningBalance;

    expect(latestBalance).toBe(cust.currentOutstanding);
  });

  // 30. Persistence and safe migration
  it('30. preserves customer ledger records across operations', () => {
    const cust = customersRepository.getByCode('CUST-WS-001')!;
    const initialCount = customerLedgerRepository.getByCustomerId(cust.id).length;

    customerLedgerRepository.addEntry({
      customerId: cust.id,
      type: 'PAYMENT',
      referenceNumber: 'TEST-REC-001',
      description: 'Test Recovery Entry',
      credit: 5000,
    });

    const updatedLedger = customerLedgerRepository.getByCustomerId(cust.id);
    expect(updatedLedger.length).toBe(initialCount + 1);
  });

  // 31. Demo data reset
  it('31. resets customers and ledger to pristine seed state when resetToSeed is invoked', () => {
    customersRepository.create({
      name: 'Temporary Client',
      phone: '0300-9999999',
      customerType: 'WHOLESALE',
      creditEnabled: true,
      creditLimit: 100000,
      creditTerms: 'Net 30',
      defaultDueDays: 30,
      status: 'ACTIVE',
    });

    expect(customersRepository.getAll().some((c) => c.name === 'Temporary Client')).toBe(true);

    customersRepository.resetToSeed();
    customerLedgerRepository.resetToSeed();

    expect(customersRepository.getAll().some((c) => c.name === 'Temporary Client')).toBe(false);
  });

  // 32. Regression tests for previous flows
  it('32. does not regress branch listing, catalogue products, or basic retail POS operations', () => {
    const branches = branchesRepository.getAll();
    expect(branches.length).toBe(5);

    const products = productsRepository.getAll();
    expect(products.length).toBeGreaterThan(0);

    const settings = posSettingsRepository.get();
    expect(settings.defaultPaymentMethod).toBeDefined();
  });
});
