import { 
  Invoice, 
  DashboardKPIs, 
  PaymentMethod, 
  BranchPerformanceMetric, 
  SalesTrendDataPoint, 
  TopProductMetric,
  Branch,
  Product,
  DateRangePreset
} from '@/types';

/**
 * Filter invoices by branch and date range
 */
export function filterInvoices(
  invoices: Invoice[],
  options: {
    branchId?: string; // 'all' or specific branch ID
    dateRange?: DateRangePreset;
    startDate?: string;
    endDate?: string;
    customerType?: 'ALL' | 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR' | 'WALK_IN';
    saleType?: 'ALL' | 'WALK_IN' | 'WHOLESALE' | 'DISTRIBUTOR';
    searchQuery?: string;
    referenceDate?: Date; // Reference date for current time (defaults to 2026-10-28 or now)
  }
): Invoice[] {
  const {
    branchId = 'all',
    dateRange = 'mtd',
    startDate,
    endDate,
    customerType = 'ALL',
    saleType,
    searchQuery = '',
    referenceDate = new Date('2024-10-31T12:00:00+05:00'),
  } = options;

  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();

  // Start of today (00:00:00 PKT)
  const startOfToday = new Date(refYear, refMonth, refDay, 0, 0, 0, 0).getTime();
  // End of today
  const endOfToday = new Date(refYear, refMonth, refDay, 23, 59, 59, 999).getTime();

  // Start of last 7 days
  const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;

  // Month-to-date (1st of current month 00:00:00)
  const startOfMonth = new Date(refYear, refMonth, 1, 0, 0, 0, 0).getTime();

  // Year-to-date (Jan 1 of current year 00:00:00)
  const startOfYear = new Date(refYear, 0, 1, 0, 0, 0, 0).getTime();

  return invoices.filter((invoice) => {
    // 1. Branch filter
    if (branchId !== 'all' && invoice.branchId !== branchId) {
      return false;
    }

    // 2. Customer Type filter
    if (customerType !== 'ALL') {
      const matchRetail = (customerType === 'RETAIL' || customerType === 'WALK_IN') && (invoice.customerType === 'RETAIL' || invoice.saleType === 'WALK_IN');
      const matchWholesale = customerType === 'WHOLESALE' && (invoice.customerType === 'WHOLESALE' || invoice.saleType === 'WHOLESALE');
      const matchDistributor = customerType === 'DISTRIBUTOR' && (invoice.customerType === 'DISTRIBUTOR' || invoice.saleType === 'DISTRIBUTOR');
      if (!matchRetail && !matchWholesale && !matchDistributor) {
        return false;
      }
    }

    // 2b. Sale Type filter
    if (saleType && saleType !== 'ALL') {
      const sType = invoice.saleType || (invoice.customerType === 'WHOLESALE' ? 'WHOLESALE' : 'WALK_IN');
      if (sType !== saleType) {
        return false;
      }
    }

    // 3. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchInv = invoice.invoiceNumber.toLowerCase().includes(q);
      const matchCust = invoice.customerName.toLowerCase().includes(q);
      const matchBiz = (invoice.businessName || '').toLowerCase().includes(q);
      const matchNtn = (invoice.customerNTN || '').toLowerCase().includes(q);
      const matchPhone = invoice.customerPhone.includes(q);
      if (!matchInv && !matchCust && !matchBiz && !matchNtn && !matchPhone) {
        return false;
      }
    }

    // 4. Date filter
    const invTime = new Date(invoice.date).getTime();

    if (dateRange === 'today') {
      return invTime >= startOfToday && invTime <= endOfToday;
    } else if (dateRange === 'last7days') {
      return invTime >= sevenDaysAgo && invTime <= endOfToday;
    } else if (dateRange === 'mtd') {
      return invTime >= startOfMonth && invTime <= endOfToday;
    } else if (dateRange === 'ytd') {
      return invTime >= startOfYear && invTime <= endOfToday;
    } else if (dateRange === 'custom') {
      if (startDate) {
        const customStart = new Date(startDate).getTime();
        if (invTime < customStart) return false;
      }
      if (endDate) {
        const customEnd = new Date(endDate).setHours(23, 59, 59, 999);
        if (invTime > customEnd) return false;
      }
      return true;
    }

    return true;
  });
}

/**
 * Enterprise Financial KPIs aggregation
 * Net Sales = Gross Sales - Total Discounts - Total Returns
 */
export function calculateDashboardKPIs(
  filteredInvoices: Invoice[],
  referenceDate: Date = new Date('2024-10-31T12:00:00+05:00')
): DashboardKPIs {
  let totalGrossSales = 0;
  let totalDiscounts = 0;
  let totalReturns = 0;
  let retailRevenue = 0;
  let wholesaleRevenue = 0;
  let walkInRevenue = 0;
  let distributorRevenue = 0;
  let retailInvoicesCount = 0;
  let wholesaleInvoicesCount = 0;

  const collectionsByMethod: Record<PaymentMethod, number> = {
    CASH: 0,
    BANK_TRANSFER: 0,
    PAYPAK_CARD: 0,
    CHEQUE: 0,
    CREDIT_30D: 0,
  };

  let totalCollections = 0;
  let pendingReceivables = 0;
  let overdueAmount = 0;

  const nowMs = referenceDate.getTime();

  for (const inv of filteredInvoices) {
    totalGrossSales += inv.grossAmount;
    totalDiscounts += inv.discountAmount;
    totalReturns += inv.returnAmount;

    // Flow 07 Sale type revenue tracking
    const saleType = inv.saleType || (inv.customerType === 'WHOLESALE' ? 'WHOLESALE' : 'WALK_IN');
    if (saleType === 'WALK_IN') {
      walkInRevenue += inv.netAmount;
      retailRevenue += inv.netAmount;
      retailInvoicesCount += 1;
    } else if (saleType === 'DISTRIBUTOR') {
      distributorRevenue += inv.netAmount;
      wholesaleRevenue += inv.netAmount;
      wholesaleInvoicesCount += 1;
    } else {
      wholesaleRevenue += inv.netAmount;
      wholesaleInvoicesCount += 1;
    }

    // Collections tracking (Actual payments collected)
    totalCollections += inv.amountPaid;
    pendingReceivables += inv.amountDue;

    // Check overdue
    const isOverdue = inv.isOverdue || (inv.amountDue > 0 && inv.dueDate && new Date(inv.dueDate).getTime() < nowMs);
    if (isOverdue) {
      overdueAmount += inv.amountDue;
    }

    if (inv.paymentMethod in collectionsByMethod) {
      collectionsByMethod[inv.paymentMethod] += inv.amountPaid;
    }
  }

  const totalNetSales = Math.max(0, totalGrossSales - totalDiscounts - totalReturns);
  const totalInvoices = filteredInvoices.length;
  const averageOrderValue = totalInvoices > 0 ? Math.round(totalNetSales / totalInvoices) : 0;

  const retailRevenuePercent = totalNetSales > 0 ? Math.round((retailRevenue / totalNetSales) * 100) : 0;
  const wholesaleRevenuePercent = totalNetSales > 0 ? 100 - retailRevenuePercent : 0;

  // Today's stats calculation (relative to referenceDate)
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();
  const startOfToday = new Date(refYear, refMonth, refDay, 0, 0, 0, 0).getTime();
  const endOfToday = new Date(refYear, refMonth, refDay, 23, 59, 59, 999).getTime();

  let todaySales = 0;
  let todayInvoices = 0;

  for (const inv of filteredInvoices) {
    const t = new Date(inv.date).getTime();
    if (t >= startOfToday && t <= endOfToday) {
      todaySales += inv.netAmount;
      todayInvoices += 1;
    }
  }

  // Consistent simulated growth index (+14.8% MTD performance)
  const salesGrowthPercentage = 14.8;

  return {
    totalNetSales,
    totalGrossSales,
    totalDiscounts,
    totalReturns,
    retailRevenue,
    wholesaleRevenue,
    retailRevenuePercent,
    wholesaleRevenuePercent,
    totalInvoices,
    retailInvoicesCount,
    wholesaleInvoicesCount,
    averageOrderValue,
    totalCollections,
    collectionsByMethod,
    pendingReceivables,
    todaySales,
    todayInvoices,
    salesGrowthPercentage,
    walkInRevenue,
    distributorRevenue,
    totalOutstandingReceivables: pendingReceivables,
    overdueAmount,
  };
}

/**
 * Calculate Branch-wise Performance comparison
 */
export function calculateBranchPerformance(
  branches: Branch[],
  invoices: Invoice[]
): BranchPerformanceMetric[] {
  return branches.map((branch) => {
    const branchInvoices = invoices.filter((inv) => inv.branchId === branch.id);
    
    let netSales = 0;
    let retailSales = 0;
    let wholesaleSales = 0;

    for (const inv of branchInvoices) {
      netSales += inv.netAmount;
      if (inv.customerType === 'RETAIL') {
        retailSales += inv.netAmount;
      } else {
        wholesaleSales += inv.netAmount;
      }
    }

    const invoiceCount = branchInvoices.length;
    const targetMonthlySales = branch.targetMonthlySales;
    const achievementPercentage = targetMonthlySales > 0 
      ? Math.round((netSales / targetMonthlySales) * 100) 
      : 0;
    const avgOrderValue = invoiceCount > 0 ? Math.round(netSales / invoiceCount) : 0;

    return {
      branchId: branch.id,
      branchCode: branch.code,
      branchName: branch.name,
      city: branch.city,
      netSales,
      retailSales,
      wholesaleSales,
      invoiceCount,
      targetMonthlySales,
      achievementPercentage,
      avgOrderValue,
    };
  });
}

/**
 * Generate Sales Trend Data points (time-series aggregation)
 */
export function calculateSalesTrend(
  invoices: Invoice[]
): SalesTrendDataPoint[] {
  const map = new Map<string, { retail: number; wholesale: number; netTotal: number; count: number }>();

  // Sort invoices ascending by date
  const sorted = [...invoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const inv of sorted) {
    const dateObj = new Date(inv.date);
    // Format date key as "YYYY-MM-DD"
    const dateKey = dateObj.toISOString().split('T')[0];

    const current = map.get(dateKey) || { retail: 0, wholesale: 0, netTotal: 0, count: 0 };
    if (inv.customerType === 'RETAIL') {
      current.retail += inv.netAmount;
    } else {
      current.wholesale += inv.netAmount;
    }
    current.netTotal += inv.netAmount;
    current.count += 1;
    map.set(dateKey, current);
  }

  const results: SalesTrendDataPoint[] = [];
  map.forEach((value, key) => {
    const [, , day] = key.split('-');
    const label = `${day} Oct`;
    results.push({
      date: key,
      label,
      retail: value.retail,
      wholesale: value.wholesale,
      netTotal: value.netTotal,
      invoices: value.count,
    });
  });

  return results;
}

/**
 * Calculate Top-Selling Products across catalogue
 */
export function calculateTopProducts(
  products: Product[],
  invoices: Invoice[],
  branchId?: string
): TopProductMetric[] {
  const productStats = new Map<
    string,
    { unitsSold: number; totalRevenue: number; retailRevenue: number; wholesaleRevenue: number }
  >();

  for (const inv of invoices) {
    for (const item of inv.items) {
      const current = productStats.get(item.productId) || {
        unitsSold: 0,
        totalRevenue: 0,
        retailRevenue: 0,
        wholesaleRevenue: 0,
      };

      current.unitsSold += item.quantity;
      current.totalRevenue += item.total;
      if (inv.customerType === 'RETAIL') {
        current.retailRevenue += item.total;
      } else {
        current.wholesaleRevenue += item.total;
      }

      productStats.set(item.productId, current);
    }
  }

  const list: TopProductMetric[] = products.map((prod) => {
    const stats = productStats.get(prod.id) || {
      unitsSold: 0,
      totalRevenue: 0,
      retailRevenue: 0,
      wholesaleRevenue: 0,
    };

    const totalStock = Object.values(prod.stockByBranch).reduce((a, b) => a + b, 0);
    const branchStock = branchId && branchId !== 'all' ? prod.stockByBranch[branchId] : undefined;

    return {
      productId: prod.id,
      sku: prod.sku,
      name: prod.name,
      category: prod.category,
      unitsSold: stats.unitsSold,
      totalRevenue: stats.totalRevenue,
      retailRevenue: stats.retailRevenue,
      wholesaleRevenue: stats.wholesaleRevenue,
      stockRemainingInBranch: branchStock,
      totalCatalogueStock: totalStock,
    };
  });

  // Sort descending by total revenue
  return list.sort((a, b) => b.totalRevenue - a.totalRevenue);
}
