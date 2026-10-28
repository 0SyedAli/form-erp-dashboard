import { describe, it, expect } from 'vitest';
import { 
  calculateDashboardKPIs, 
  filterInvoices, 
  calculateBranchPerformance,
  calculateTopProducts 
} from '../utils/financialCalculations';
import { DEMO_BRANCHES, SHARED_PRODUCT_CATALOGUE, INITIAL_MOCK_INVOICES } from '../data/mockData';
import { Invoice } from '../types';

describe('Molty Foam ERP - Financial Aggregation Engine', () => {
  it('correctly calculates Net Sales = Gross Sales - Discounts - Returns', () => {
    const mockInvoices: Invoice[] = [
      {
        id: 'INV-1',
        invoiceNumber: 'MF-INV-1',
        branchId: 'BR-LHR-01',
        branchName: 'Lahore Flagship',
        customerType: 'RETAIL',
        customerName: 'Customer A',
        customerPhone: '+92 300 1234567',
        date: '2026-10-28T10:00:00+05:00',
        items: [],
        grossAmount: 100000,
        discountAmount: 10000,
        returnAmount: 0,
        taxAmount: 0,
        netAmount: 90000,
        amountPaid: 90000,
        amountDue: 0,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
        salesPerson: 'Rep 1',
      },
      {
        id: 'INV-2',
        invoiceNumber: 'MF-INV-2',
        branchId: 'BR-LHR-01',
        branchName: 'Lahore Flagship',
        customerType: 'RETAIL',
        customerName: 'Customer B',
        customerPhone: '+92 300 7654321',
        date: '2026-10-28T11:00:00+05:00',
        items: [],
        grossAmount: 50000,
        discountAmount: 5000,
        returnAmount: 5000, // Return of 5000
        taxAmount: 0,
        netAmount: 40000,
        amountPaid: 40000,
        amountDue: 0,
        paymentMethod: 'PAYPAK_CARD',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
        salesPerson: 'Rep 2',
      },
    ];

    const kpis = calculateDashboardKPIs(mockInvoices);

    expect(kpis.totalGrossSales).toBe(150000);
    expect(kpis.totalDiscounts).toBe(15000);
    expect(kpis.totalReturns).toBe(5000);
    // Net sales must be exactly 150000 - 15000 - 5000 = 130000
    expect(kpis.totalNetSales).toBe(130000);
    expect(kpis.totalInvoices).toBe(2);
    expect(kpis.averageOrderValue).toBe(65000);
  });

  it('correctly partitions Retail vs Wholesale revenue', () => {
    const mockInvoices: Invoice[] = [
      {
        id: 'INV-R',
        invoiceNumber: 'MF-R-01',
        branchId: 'BR-LHR-01',
        branchName: 'Lahore Flagship',
        customerType: 'RETAIL',
        customerName: 'Retail Buyer',
        customerPhone: '+92 300 1111111',
        date: '2026-10-28T10:00:00+05:00',
        items: [],
        grossAmount: 60000,
        discountAmount: 0,
        returnAmount: 0,
        taxAmount: 0,
        netAmount: 60000,
        amountPaid: 60000,
        amountDue: 0,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
        salesPerson: 'Rep 1',
      },
      {
        id: 'INV-W',
        invoiceNumber: 'MF-W-01',
        branchId: 'BR-KHI-01',
        branchName: 'Karachi South',
        customerType: 'WHOLESALE',
        customerName: 'Commercial Hotel Vendor',
        customerNTN: 'NTN-1234567-8',
        customerPhone: '+92 321 2222222',
        date: '2026-10-28T10:00:00+05:00',
        items: [],
        grossAmount: 540000,
        discountAmount: 0,
        returnAmount: 0,
        taxAmount: 0,
        netAmount: 540000,
        amountPaid: 540000,
        amountDue: 0,
        paymentMethod: 'BANK_TRANSFER',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
        salesPerson: 'Rep 2',
      },
    ];

    const kpis = calculateDashboardKPIs(mockInvoices);

    expect(kpis.retailRevenue).toBe(60000);
    expect(kpis.wholesaleRevenue).toBe(540000);
    expect(kpis.retailRevenuePercent).toBe(10);
    expect(kpis.wholesaleRevenuePercent).toBe(90);
    expect(kpis.retailInvoicesCount).toBe(1);
    expect(kpis.wholesaleInvoicesCount).toBe(1);
  });

  it('correctly tracks payment collections independently from sales', () => {
    const mockInvoices: Invoice[] = [
      {
        id: 'INV-CREDIT',
        invoiceNumber: 'MF-CR-01',
        branchId: 'BR-LHR-01',
        branchName: 'Lahore Flagship',
        customerType: 'WHOLESALE',
        customerName: 'Bulk Client',
        customerPhone: '+92 300 0000000',
        date: '2026-10-28T10:00:00+05:00',
        items: [],
        grossAmount: 1000000,
        discountAmount: 0,
        returnAmount: 0,
        taxAmount: 0,
        netAmount: 1000000,
        amountPaid: 400000, // 400k collected
        amountDue: 600000,  // 600k pending receivable
        paymentMethod: 'CREDIT_30D',
        paymentStatus: 'PARTIAL',
        status: 'PARTIAL',
        salesPerson: 'Rep',
      },
    ];

    const kpis = calculateDashboardKPIs(mockInvoices);

    expect(kpis.totalNetSales).toBe(1000000);
    expect(kpis.totalCollections).toBe(400000);
    expect(kpis.pendingReceivables).toBe(600000);
    expect(kpis.collectionsByMethod.CREDIT_30D).toBe(400000);
  });

  it('filters invoices strictly by branch identifier', () => {
    const mainInvoices = filterInvoices(INITIAL_MOCK_INVOICES, {
      branchId: 'BR-MAIN-01',
      dateRange: 'mtd',
    });

    expect(mainInvoices.length).toBeGreaterThan(0);
    const nonMain = mainInvoices.filter((inv) => inv.branchId !== 'BR-MAIN-01');
    expect(nonMain.length).toBe(0);

    const dispInvoices = filterInvoices(INITIAL_MOCK_INVOICES, {
      branchId: 'BR-DISP-02',
      dateRange: 'mtd',
    });
    expect(dispInvoices.length).toBeGreaterThan(0);
    const nonDisp = dispInvoices.filter((inv) => inv.branchId !== 'BR-DISP-02');
    expect(nonDisp.length).toBe(0);
  });

  it('calculates branch performance metrics and targets', () => {
    const performance = calculateBranchPerformance(DEMO_BRANCHES, INITIAL_MOCK_INVOICES);

    expect(performance.length).toBe(DEMO_BRANCHES.length);
    for (const b of performance) {
      expect(b.netSales).toBeGreaterThanOrEqual(0);
      expect(b.targetMonthlySales).toBeGreaterThan(0);
      expect(b.achievementPercentage).toBeGreaterThanOrEqual(0);
    }
  });

  it('calculates top products with shared catalogue stock tracking', () => {
    const topProducts = calculateTopProducts(SHARED_PRODUCT_CATALOGUE, INITIAL_MOCK_INVOICES);

    expect(topProducts.length).toBe(SHARED_PRODUCT_CATALOGUE.length);
    // Highest revenue product should be first
    expect(topProducts[0].totalRevenue).toBeGreaterThanOrEqual(topProducts[1].totalRevenue);
    expect(topProducts[0].totalCatalogueStock).toBeGreaterThan(0);
  });
});
