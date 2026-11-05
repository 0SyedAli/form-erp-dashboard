import mongoose from 'mongoose';
import {
  SalesInvoice,
  Payment,
  Customer,
  CustomerLedgerEntry,
  StockBalance,
  StockMovement,
  StockTransfer,
  StockLocation,
  Variant,
  Brand,
  Category,
  Branch,
  PurchaseOrder,
  StockReceipt,
  Supplier,
  SupplierBill,
  SupplierPayment,
  SupplierLedgerEntry,
  PurchaseReturn,
} from '../../models/index.js';
import { resolveDateRange, DateRangePreset } from '../../utils/dateRange.js';
import { ReportQueryParams } from './reporting.schema.js';

export class ReportingService {
  /**
   * 1. Super Admin Consolidated Dashboard Metrics
   */
  public static async getAdminDashboard(query: ReportQueryParams): Promise<any> {
    const { start, end, label, preset } = resolveDateRange(query.preset, query.startDate, query.endDate);

    const dateFilter: any = {};
    if (start || end) {
      dateFilter.createdAt = {};
      if (start) dateFilter.createdAt.$gte = start;
      if (end) dateFilter.createdAt.$lt = end;
    }

    const invoiceDateFilter: any = {};
    if (start || end) {
      invoiceDateFilter.$or = [
        {
          createdAt: {
            ...(start ? { $gte: start } : {}),
            ...(end ? { $lt: end } : {}),
          },
        },
        {
          date: {
            ...(start ? { $gte: start } : {}),
            ...(end ? { $lt: end } : {}),
          },
        },
      ];
    }
    if (query.branchId && query.branchId !== 'all' && query.branchId !== 'ALL') {
      if (mongoose.Types.ObjectId.isValid(query.branchId)) {
        invoiceDateFilter.branchId = new mongoose.Types.ObjectId(query.branchId);
      }
    }

    // 1. SALES METRICS PIPELINE
    const [salesAgg] = await SalesInvoice.aggregate([
      {
        $match: {
          status: { $nin: ['VOID', 'CANCELLED'] },
          ...invoiceDateFilter,
        },
      },
      {
        $group: {
          _id: null,
          grossSales: { $sum: { $ifNull: ['$subtotal', '$grossAmount'] } },
          discounts: { $sum: { $ifNull: ['$discount', '$discountAmount'] } },
          returns: { $sum: { $ifNull: ['$returnAmount', 0] } },
          netSales: { $sum: { $ifNull: ['$total', '$netAmount'] } },
          invoiceCount: { $sum: 1 },
          walkInSales: {
            $sum: {
              $cond: [{ $eq: ['$saleType', 'WALK_IN'] }, { $ifNull: ['$total', '$netAmount'] }, 0],
            },
          },
          wholesaleSales: {
            $sum: {
              $cond: [{ $eq: ['$saleType', 'WHOLESALE'] }, { $ifNull: ['$total', '$netAmount'] }, 0],
            },
          },
          distributorSales: {
            $sum: {
              $cond: [{ $eq: ['$saleType', 'DISTRIBUTOR'] }, { $ifNull: ['$total', '$netAmount'] }, 0],
            },
          },
        },
      },
    ]);

    const salesMetrics = {
      grossSales: salesAgg?.grossSales || 0,
      discounts: salesAgg?.discounts || 0,
      returns: salesAgg?.returns || 0,
      netSales: salesAgg?.netSales || 0,
      invoiceCount: salesAgg?.invoiceCount || 0,
      averageInvoiceValue: salesAgg?.invoiceCount
        ? Math.round(salesAgg.netSales / salesAgg.invoiceCount)
        : 0,
      walkInSales: salesAgg?.walkInSales || 0,
      wholesaleSales: salesAgg?.wholesaleSales || 0,
      distributorSales: salesAgg?.distributorSales || 0,
    };

    // 2. COLLECTIONS & CREDIT METRICS
    const [collectionsAgg] = await Payment.aggregate([
      {
        $match: {
          status: 'CONFIRMED',
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalCollections: { $sum: '$amount' },
        },
      },
    ]);

    // Current month collections
    const monthRange = resolveDateRange('thisMonth');
    const [monthCollectionsAgg] = await Payment.aggregate([
      {
        $match: {
          status: 'CONFIRMED',
          createdAt: { $gte: monthRange.start, $lt: monthRange.end },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    const [receivablesAgg] = await Customer.aggregate([
      {
        $group: {
          _id: null,
          totalReceivables: { $sum: { $ifNull: ['$outstandingBalance', '$currentOutstanding'] } },
          customersWithCredit: {
            $sum: { $cond: [{ $gt: [{ $ifNull: ['$outstandingBalance', '$currentOutstanding'] }, 0] }, 1, 0] },
          },
        },
      },
    ]);

    const [overdueAgg] = await SalesInvoice.aggregate([
      {
        $match: {
          status: { $nin: ['VOID', 'CANCELLED'] },
          $or: [{ balanceDue: { $gt: 0 } }, { amountDue: { $gt: 0 } }],
          dueDate: { $lt: new Date() },
        },
      },
      {
        $group: {
          _id: null,
          totalOverdue: { $sum: { $ifNull: ['$balanceDue', '$amountDue'] } },
          count: { $sum: 1 },
        },
      },
    ]);

    const collectionsCreditMetrics = {
      totalConfirmedCollections: collectionsAgg?.totalCollections || 0,
      collectionsThisMonth: monthCollectionsAgg?.total || 0,
      totalCustomerReceivables: receivablesAgg?.totalReceivables || 0,
      overdueCustomerReceivables: overdueAgg?.totalOverdue || 0,
      overdueInvoicesCount: overdueAgg?.count || 0,
      customersWithOutstandingCount: receivablesAgg?.customersWithCredit || 0,
    };

    // 3. INVENTORY METRICS
    const [inventoryAgg] = await StockBalance.aggregate([
      {
        $group: {
          _id: null,
          totalOnHand: { $sum: '$onHand' },
          totalReserved: { $sum: '$reserved' },
        },
      },
    ]);

    const totalOnHand = inventoryAgg?.totalOnHand || 0;
    const totalReserved = inventoryAgg?.totalReserved || 0;
    const availableStock = Math.max(0, totalOnHand - totalReserved);

    // Dynamic SKU-specific Low Stock and Out of Stock evaluation using reorderLevel
    const [lowStockAgg] = await StockBalance.aggregate([
      {
        $group: {
          _id: { sku: '$sku', branchId: '$branchId' },
          totalOnHand: { $sum: '$onHand' },
          totalReserved: { $sum: '$reserved' },
          reorderLevel: { $first: '$reorderLevel' },
        },
      },
      {
        $project: {
          available: { $subtract: ['$totalOnHand', '$totalReserved'] },
          reorderLevel: 1,
        },
      },
      {
        $group: {
          _id: null,
          outOfStockCount: { $sum: { $cond: [{ $lte: ['$available', 0] }, 1, 0] } },
          lowStockCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ['$available', 0] },
                    { $ne: ['$reorderLevel', null] },
                    { $lte: ['$available', '$reorderLevel'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Active in-transit transfers
    const inTransitTransfers = await StockTransfer.find({
      status: { $in: ['DISPATCHED', 'IN_TRANSIT'] },
    });
    const inTransitUnits = inTransitTransfers.reduce(
      (sum, t) => sum + (t.items || []).reduce((s, i) => s + i.quantity, 0),
      0
    );

    // Inventory Valuation based on variant purchasePrice (cost basis)
    const [valuationAgg] = await StockBalance.aggregate([
      {
        $match: { onHand: { $gt: 0 } },
      },
      {
        $lookup: {
          from: 'variants',
          localField: 'sku',
          foreignField: 'sku',
          as: 'variant',
        },
      },
      { $unwind: { path: '$variant', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          totalValuation: {
            $sum: {
              $multiply: ['$onHand', { $ifNull: ['$variant.purchasePrice', 0] }],
            },
          },
          itemsWithoutCost: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: [{ $ifNull: ['$variant.purchasePrice', 0] }, 0] },
                    { $eq: [{ $ifNull: ['$variant', null] }, null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const inventoryMetrics = {
      totalStockUnits: totalOnHand,
      reservedStock: totalReserved,
      availableStock,
      lowStockSkuCount: lowStockAgg?.lowStockCount || 0,
      outOfStockSkuCount: lowStockAgg?.outOfStockCount || 0,
      activeInTransitTransfers: inTransitTransfers.length,
      inTransitUnits,
      inventoryValuation: valuationAgg?.totalValuation || 0,
      valuationTitle: 'Estimated Inventory Value — Standard Purchase Cost',
      valuationStatus: 'ESTIMATED_STANDARD_PURCHASE_COST',
      costBasisMethod: 'STANDARD_PURCHASE_COST',
    };

    // 4. PURCHASES & SUPPLIER PAYABLES METRICS
    const [poAgg] = await PurchaseOrder.aggregate([
      { $match: { ...dateFilter } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalValue: { $sum: '$totalAmount' },
        },
      },
    ]);

    const [billsAgg] = await SupplierBill.aggregate([
      { $match: { status: 'POSTED', ...dateFilter } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalDue: { $sum: { $ifNull: ['$balanceDue', '$amountDue'] } },
        },
      },
    ]);

    const [paymentsAgg] = await SupplierPayment.aggregate([
      { $match: { ...dateFilter } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    const [suppliersTotalAgg] = await Supplier.aggregate([
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: '$currentOutstanding' },
          totalAdvances: { $sum: '$unallocatedAdvances' },
        },
      },
    ]);

    const [overdueBillsAgg] = await SupplierBill.aggregate([
      {
        $match: {
          status: 'POSTED',
          $or: [{ balanceDue: { $gt: 0 } }, { amountDue: { $gt: 0 } }],
          dueDate: { $lt: new Date() },
        },
      },
      {
        $group: {
          _id: null,
          totalOverdue: { $sum: { $ifNull: ['$balanceDue', '$amountDue'] } },
          count: { $sum: 1 },
        },
      },
    ]);

    const purchasesSuppliersMetrics = {
      purchaseOrdersCount: poAgg?.count || 0,
      purchaseOrdersValue: poAgg?.totalValue || 0,
      postedBillsCount: billsAgg?.count || 0,
      postedBillsAmount: billsAgg?.totalAmount || 0,
      supplierPaymentsCount: paymentsAgg?.count || 0,
      supplierPaymentsAmount: paymentsAgg?.totalAmount || 0,
      outstandingSupplierPayables: suppliersTotalAgg?.totalOutstanding || 0,
      unallocatedAdvances: suppliersTotalAgg?.totalAdvances || 0,
      overdueSupplierPayables: overdueBillsAgg?.totalOverdue || 0,
      overdueBillsCount: overdueBillsAgg?.count || 0,
    };

    // 5. BRANCH PERFORMANCE TABLE (Market Cluster 5 Branches)
    const branches = await Branch.find().lean();
    const branchPerformance = await Promise.all(
      branches.map(async (b) => {
        const branchObjId = b._id;

        const [bSales] = await SalesInvoice.aggregate([
          {
            $match: {
              branchId: branchObjId,
              status: { $nin: ['VOID', 'CANCELLED'] },
              ...invoiceDateFilter,
            },
          },
          {
            $group: {
              _id: null,
              gross: { $sum: { $ifNull: ['$subtotal', '$grossAmount'] } },
              net: { $sum: { $ifNull: ['$total', '$netAmount'] } },
              invoices: { $sum: 1 },
              collections: { $sum: { $ifNull: ['$paidAmount', '$amountPaid'] } },
              outstanding: { $sum: { $ifNull: ['$balanceDue', '$amountDue'] } },
            },
          },
        ]);

        const [bStock] = await StockBalance.aggregate([
          { $match: { branchId: branchObjId } },
          {
            $group: {
              _id: null,
              units: { $sum: '$onHand' },
              lowStock: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: [{ $subtract: ['$onHand', '$reserved'] }, 0] },
                        { $ne: ['$reorderLevel', null] },
                        { $lte: [{ $subtract: ['$onHand', '$reserved'] }, '$reorderLevel'] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]);

        const [bPurchases] = await SupplierBill.aggregate([
          { $match: { branchId: branchObjId, status: 'POSTED', ...dateFilter } },
          {
            $group: {
              _id: null,
              purchaseValue: { $sum: '$totalAmount' },
              payables: { $sum: { $ifNull: ['$balanceDue', '$amountDue'] } },
            },
          },
        ]);

        return {
          branchId: b._id.toString(),
          code: b.code,
          name: b.name,
          shopNumber: b.shopNumber,
          type: b.type,
          grossSales: bSales?.gross || 0,
          netSales: bSales?.net || 0,
          invoiceCount: bSales?.invoices || 0,
          collections: bSales?.collections || 0,
          outstandingReceivables: bSales?.outstanding || 0,
          stockUnits: bStock?.units || 0,
          lowStockCount: bStock?.lowStock || 0,
          purchaseValue: bPurchases?.purchaseValue || 0,
          supplierPayables: bPurchases?.payables || 0,
        };
      })
    );

    // 6. SALES TREND (Daily points)
    const salesTrends = await SalesInvoice.aggregate([
      {
        $match: {
          status: { $nin: ['VOID', 'CANCELLED'] },
          ...invoiceDateFilter,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $ifNull: ['$date', '$createdAt'] },
              timezone: '+05:00',
            },
          },
          grossSales: { $sum: { $ifNull: ['$subtotal', '$grossAmount'] } },
          netSales: { $sum: { $ifNull: ['$total', '$netAmount'] } },
          retail: {
            $sum: { $cond: [{ $eq: ['$saleType', 'WALK_IN'] }, { $ifNull: ['$total', '$netAmount'] }, 0] },
          },
          wholesale: {
            $sum: {
              $cond: [
                { $in: ['$saleType', ['WHOLESALE', 'DISTRIBUTOR']] },
                { $ifNull: ['$total', '$netAmount'] },
                0,
              ],
            },
          },
          invoicesCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: '$_id',
          grossSales: 1,
          netSales: 1,
          retail: 1,
          wholesale: 1,
          invoicesCount: 1,
          _id: 0,
        },
      },
    ]);

    // 7. TOP SELLING PRODUCTS
    const topProducts = await SalesInvoice.aggregate([
      {
        $match: {
          status: { $nin: ['VOID', 'CANCELLED'] },
          ...invoiceDateFilter,
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.sku',
          productName: { $first: '$items.productName' },
          sizeLabel: { $first: '$items.sizeLabel' },
          thicknessLabel: { $first: '$items.thicknessLabel' },
          unitsSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $ifNull: ['$items.lineTotal', '$items.total'] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $project: {
          sku: '$_id',
          productName: 1,
          sizeLabel: 1,
          thicknessLabel: 1,
          unitsSold: 1,
          revenue: 1,
          _id: 0,
        },
      },
    ]);

    return {
      period: {
        preset,
        label,
        start: start?.toISOString(),
        end: end?.toISOString(),
      },
      sales: salesMetrics,
      collections: collectionsCreditMetrics,
      inventory: inventoryMetrics,
      purchases: purchasesSuppliersMetrics,
      branches: branchPerformance,
      salesTrends,
      topProducts,
    };
  }

  /**
   * 2. Branch Dashboard Metrics (Scoped to the authenticated branch)
   */
  public static async getBranchDashboard(
    branchId: string,
    query: ReportQueryParams
  ): Promise<any> {
    const branchObjId = new mongoose.Types.ObjectId(branchId);
    const branch = await Branch.findById(branchObjId).lean();
    if (!branch) throw new Error('Branch not found');

    const todayRange = resolveDateRange('today');
    const customRange = resolveDateRange(query.preset, query.startDate, query.endDate);

    // Today's Sales
    const [todaySales] = await SalesInvoice.aggregate([
      {
        $match: {
          branchId: branchObjId,
          status: { $nin: ['VOID', 'CANCELLED'] },
          $or: [
            { createdAt: { $gte: todayRange.start, $lt: todayRange.end } },
            { date: { $gte: todayRange.start, $lt: todayRange.end } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          todaySales: { $sum: { $ifNull: ['$total', '$netAmount'] } },
          todayInvoices: { $sum: 1 },
          todayCollections: { $sum: { $ifNull: ['$paidAmount', '$amountPaid'] } },
          todayCredit: { $sum: { $ifNull: ['$balanceDue', '$amountDue'] } },
        },
      },
    ]);

    // Period Sales
    const [periodSales] = await SalesInvoice.aggregate([
      {
        $match: {
          branchId: branchObjId,
          status: { $nin: ['VOID', 'CANCELLED'] },
          ...(customRange.start || customRange.end
            ? {
                $or: [
                  {
                    createdAt: {
                      ...(customRange.start ? { $gte: customRange.start } : {}),
                      ...(customRange.end ? { $lt: customRange.end } : {}),
                    },
                  },
                  {
                    date: {
                      ...(customRange.start ? { $gte: customRange.start } : {}),
                      ...(customRange.end ? { $lt: customRange.end } : {}),
                    },
                  },
                ],
              }
            : {}),
        },
      },
      {
        $group: {
          _id: null,
          netSales: { $sum: { $ifNull: ['$total', '$netAmount'] } },
          invoicesCount: { $sum: 1 },
          collections: { $sum: { $ifNull: ['$paidAmount', '$amountPaid'] } },
          creditSales: { $sum: { $ifNull: ['$balanceDue', '$amountDue'] } },
          walkInSales: {
            $sum: { $cond: [{ $eq: ['$saleType', 'WALK_IN'] }, { $ifNull: ['$total', '$netAmount'] }, 0] },
          },
          wholesaleSales: {
            $sum: { $cond: [{ $eq: ['$saleType', 'WHOLESALE'] }, { $ifNull: ['$total', '$netAmount'] }, 0] },
          },
          distributorSales: {
            $sum: { $cond: [{ $eq: ['$saleType', 'DISTRIBUTOR'] }, { $ifNull: ['$total', '$netAmount'] }, 0] },
          },
        },
      },
    ]);

    // Branch Daily Sales Trends
    const branchSalesTrends = await SalesInvoice.aggregate([
      {
        $match: {
          branchId: branchObjId,
          status: { $nin: ['VOID', 'CANCELLED'] },
          ...(customRange.start || customRange.end
            ? {
                $or: [
                  {
                    createdAt: {
                      ...(customRange.start ? { $gte: customRange.start } : {}),
                      ...(customRange.end ? { $lt: customRange.end } : {}),
                    },
                  },
                  {
                    date: {
                      ...(customRange.start ? { $gte: customRange.start } : {}),
                      ...(customRange.end ? { $lt: customRange.end } : {}),
                    },
                  },
                ],
              }
            : {}),
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $ifNull: ['$date', '$createdAt'] },
              timezone: '+05:00',
            },
          },
          sales: { $sum: { $ifNull: ['$total', '$netAmount'] } },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: '$_id',
          sales: 1,
          _id: 0,
        },
      },
    ]);

    // Branch Top Selling Products
    const branchTopProducts = await SalesInvoice.aggregate([
      {
        $match: {
          branchId: branchObjId,
          status: { $nin: ['VOID', 'CANCELLED'] },
          ...(customRange.start || customRange.end
            ? {
                $or: [
                  {
                    createdAt: {
                      ...(customRange.start ? { $gte: customRange.start } : {}),
                      ...(customRange.end ? { $lt: customRange.end } : {}),
                    },
                  },
                  {
                    date: {
                      ...(customRange.start ? { $gte: customRange.start } : {}),
                      ...(customRange.end ? { $lt: customRange.end } : {}),
                    },
                  },
                ],
              }
            : {}),
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.sku',
          name: { $first: '$items.productName' },
          sold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { sold: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: 1,
          sold: 1,
          _id: 0,
        },
      },
    ]);

    // Branch Stock Summary
    const [stockAgg] = await StockBalance.aggregate([
      { $match: { branchId: branchObjId } },
      {
        $group: {
          _id: null,
          totalOnHand: { $sum: '$onHand' },
          totalReserved: { $sum: '$reserved' },
        },
      },
    ]);
    const totalOnHand = stockAgg?.totalOnHand || 0;
    const totalReserved = stockAgg?.totalReserved || 0;
    const availableStock = Math.max(0, totalOnHand - totalReserved);

    // Branch Low Stock Alerts (dynamic against reorderLevel)
    const lowStockItems = await StockBalance.aggregate([
      {
        $match: {
          branchId: branchObjId,
        },
      },
      {
        $project: {
          sku: 1,
          onHand: 1,
          reserved: 1,
          available: { $subtract: ['$onHand', '$reserved'] },
          reorderLevel: 1,
          status: {
            $cond: [
              { $lte: [{ $subtract: ['$onHand', '$reserved'] }, 0] },
              'OUT_OF_STOCK',
              {
                $cond: [
                  { $eq: ['$reorderLevel', null] },
                  'NOT_CONFIGURED',
                  {
                    $cond: [
                      { $lte: [{ $subtract: ['$onHand', '$reserved'] }, '$reorderLevel'] },
                      'LOW_STOCK',
                      'NORMAL',
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      {
        $match: {
          status: { $in: ['OUT_OF_STOCK', 'LOW_STOCK', 'NOT_CONFIGURED'] },
        },
      },
      { $limit: 10 },
    ]);

    // Branch Recent Invoices
    const recentInvoices = await SalesInvoice.find({
      branchId: branchObjId,
      status: { $nin: ['VOID', 'CANCELLED'] },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return {
      branch: {
        id: branch._id.toString(),
        name: branch.name,
        code: branch.code,
        shopNumber: branch.shopNumber,
      },
      period: {
        preset: customRange.preset,
        label: customRange.label,
        start: customRange.start?.toISOString(),
        end: customRange.end?.toISOString(),
      },
      today: {
        sales: todaySales?.todaySales || 0,
        invoicesCount: todaySales?.todayInvoices || 0,
        collections: todaySales?.todayCollections || 0,
        creditSales: todaySales?.todayCredit || 0,
      },
      periodMetrics: {
        netSales: periodSales?.netSales || 0,
        invoicesCount: periodSales?.invoicesCount || 0,
        collections: periodSales?.collections || 0,
        creditSales: periodSales?.creditSales || 0,
      },
      salesBreakdown: {
        walkIn: periodSales?.walkInSales || 0,
        wholesale: periodSales?.wholesaleSales || 0,
        distributor: periodSales?.distributorSales || 0,
      },
      salesTrends: branchSalesTrends || [],
      topProducts: branchTopProducts || [],
      inventory: {
        onHand: totalOnHand,
        reserved: totalReserved,
        available: availableStock,
        lowStockAlertsCount: lowStockItems.length,
        lowStockItems,
      },
      recentInvoices: recentInvoices.map((inv: any) => ({
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        netAmount: inv.total ?? inv.netAmount ?? 0,
        amountPaid: inv.paidAmount ?? inv.amountPaid ?? 0,
        amountDue: inv.balanceDue ?? inv.amountDue ?? 0,
        saleType: inv.saleType,
        paymentStatus: inv.paymentStatus,
        date: inv.createdAt ?? inv.date,
      })),
    };
  }

  /**
   * 3. Detailed Sales Summary & Analytics
   */
  public static async getSalesSummary(query: ReportQueryParams): Promise<any> {
    const { start, end, label, preset } = resolveDateRange(query.preset, query.startDate, query.endDate);
    const filter: any = { status: { $nin: ['VOID', 'CANCELLED'] } };

    if (start || end) {
      filter.date = {};
      if (start) filter.date.$gte = start;
      if (end) filter.date.$lt = end;
    }

    if (query.branchId && query.branchId !== 'all') {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    const [summary] = await SalesInvoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          grossSales: { $sum: '$grossAmount' },
          discounts: { $sum: '$discountAmount' },
          returns: { $sum: { $ifNull: ['$returnAmount', 0] } },
          netSales: { $sum: '$netAmount' },
          taxAmount: { $sum: '$taxAmount' },
          invoiceCount: { $sum: 1 },
          collectedAmount: { $sum: '$amountPaid' },
          outstandingCredit: { $sum: '$amountDue' },
        },
      },
    ]);

    // Payment methods breakdown
    const paymentMethods = await SalesInvoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$paymentMethod',
          totalAmount: { $sum: '$amountPaid' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          method: '$_id',
          totalAmount: 1,
          count: 1,
          _id: 0,
        },
      },
    ]);

    return {
      period: { preset, label, start: start?.toISOString(), end: end?.toISOString() },
      grossSales: summary?.grossSales || 0,
      discounts: summary?.discounts || 0,
      returns: summary?.returns || 0,
      netSales: summary?.netSales || 0,
      taxAmount: summary?.taxAmount || 0,
      invoiceCount: summary?.invoiceCount || 0,
      averageInvoiceValue: summary?.invoiceCount
        ? Math.round(summary.netSales / summary.invoiceCount)
        : 0,
      collectedAmount: summary?.collectedAmount || 0,
      outstandingCredit: summary?.outstandingCredit || 0,
      paymentMethods,
    };
  }

  /**
   * 4. Sales Trends (Daily/Weekly/Monthly)
   */
  public static async getSalesTrends(query: ReportQueryParams): Promise<any> {
    const { start, end, label, preset } = resolveDateRange(query.preset, query.startDate, query.endDate);
    const filter: any = { status: { $nin: ['VOID', 'CANCELLED'] } };

    if (start || end) {
      filter.date = {};
      if (start) filter.date.$gte = start;
      if (end) filter.date.$lt = end;
    }

    if (query.branchId && query.branchId !== 'all') {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    const trends = await SalesInvoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: '+05:00' } },
          grossSales: { $sum: '$grossAmount' },
          netSales: { $sum: '$netAmount' },
          discountAmount: { $sum: '$discountAmount' },
          invoicesCount: { $sum: 1 },
          walkIn: {
            $sum: { $cond: [{ $eq: ['$saleType', 'WALK_IN'] }, '$netAmount', 0] },
          },
          wholesale: {
            $sum: { $cond: [{ $eq: ['$saleType', 'WHOLESALE'] }, '$netAmount', 0] },
          },
          distributor: {
            $sum: { $cond: [{ $eq: ['$saleType', 'DISTRIBUTOR'] }, '$netAmount', 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: '$_id',
          grossSales: 1,
          netSales: 1,
          discountAmount: 1,
          invoicesCount: 1,
          walkIn: 1,
          wholesale: 1,
          distributor: 1,
          _id: 0,
        },
      },
    ]);

    return {
      period: { preset, label, start: start?.toISOString(), end: end?.toISOString() },
      trends,
    };
  }

  /**
   * 5. Sales By Branch
   */
  public static async getSalesByBranch(query: ReportQueryParams): Promise<any> {
    const { start, end, label, preset } = resolveDateRange(query.preset, query.startDate, query.endDate);
    const filter: any = { status: { $nin: ['VOID', 'CANCELLED'] } };

    if (start || end) {
      filter.date = {};
      if (start) filter.date.$gte = start;
      if (end) filter.date.$lt = end;
    }

    const branchSales = await SalesInvoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$branchId',
          branchName: { $first: '$branchName' },
          grossSales: { $sum: '$grossAmount' },
          netSales: { $sum: '$netAmount' },
          discounts: { $sum: '$discountAmount' },
          invoiceCount: { $sum: 1 },
          collectedAmount: { $sum: '$amountPaid' },
          outstandingCredit: { $sum: '$amountDue' },
        },
      },
      { $sort: { netSales: -1 } },
      {
        $project: {
          branchId: '$_id',
          branchName: 1,
          grossSales: 1,
          netSales: 1,
          discounts: 1,
          invoiceCount: 1,
          collectedAmount: 1,
          outstandingCredit: 1,
          _id: 0,
        },
      },
    ]);

    return {
      period: { preset, label, start: start?.toISOString(), end: end?.toISOString() },
      branches: branchSales,
    };
  }

  /**
   * 6. Sales By Pricing Tier (WALK_IN, WHOLESALE, DISTRIBUTOR)
   */
  public static async getSalesByTier(query: ReportQueryParams): Promise<any> {
    const { start, end, label, preset } = resolveDateRange(query.preset, query.startDate, query.endDate);
    const filter: any = { status: { $nin: ['VOID', 'CANCELLED'] } };

    if (start || end) {
      filter.date = {};
      if (start) filter.date.$gte = start;
      if (end) filter.date.$lt = end;
    }

    if (query.branchId && query.branchId !== 'all') {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    const tiers = await SalesInvoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$saleType',
          grossSales: { $sum: '$grossAmount' },
          netSales: { $sum: '$netAmount' },
          discountAmount: { $sum: '$discountAmount' },
          invoiceCount: { $sum: 1 },
        },
      },
      {
        $project: {
          tier: '$_id',
          grossSales: 1,
          netSales: 1,
          discountAmount: 1,
          invoiceCount: 1,
          _id: 0,
        },
      },
    ]);

    return {
      period: { preset, label, start: start?.toISOString(), end: end?.toISOString() },
      tiers,
    };
  }

  /**
   * 7. Sales By Product (SKU, Brand, Category, Units Sold, Revenue)
   */
  public static async getSalesByProduct(query: ReportQueryParams): Promise<any> {
    const { start, end, label, preset } = resolveDateRange(query.preset, query.startDate, query.endDate);
    const filter: any = { status: { $nin: ['VOID', 'CANCELLED'] } };

    if (start || end) {
      filter.date = {};
      if (start) filter.date.$gte = start;
      if (end) filter.date.$lt = end;
    }

    if (query.branchId && query.branchId !== 'all') {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    const products = await SalesInvoice.aggregate([
      { $match: filter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.sku',
          productName: { $first: '$items.productName' },
          sizeLabel: { $first: '$items.sizeLabel' },
          thicknessLabel: { $first: '$items.thicknessLabel' },
          unitsSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: query.limit || 50 },
      {
        $project: {
          sku: '$_id',
          productName: 1,
          sizeLabel: 1,
          thicknessLabel: 1,
          unitsSold: 1,
          totalRevenue: 1,
          _id: 0,
        },
      },
    ]);

    return {
      period: { preset, label, start: start?.toISOString(), end: end?.toISOString() },
      products,
    };
  }

  /**
   * 8. Receivables Summary & Aging (Buckets: Not Due, 1-30, 31-60, 61-90, >90)
   */
  public static async getReceivablesSummary(): Promise<any> {
    const [recAgg] = await Customer.aggregate([
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: '$currentOutstanding' },
          totalCreditLimit: { $sum: '$creditLimit' },
          customersCount: { $sum: 1 },
          customersWithDueCount: {
            $sum: { $cond: [{ $gt: ['$currentOutstanding', 0] }, 1, 0] },
          },
        },
      },
    ]);

    const totalOutstanding = recAgg?.totalOutstanding || 0;
    const totalCreditLimit = recAgg?.totalCreditLimit || 0;
    const creditUtilization = totalCreditLimit > 0
      ? Math.round((totalOutstanding / totalCreditLimit) * 100)
      : 0;

    // Overdue calculation
    const now = new Date();
    const [overdue] = await SalesInvoice.aggregate([
      {
        $match: {
          status: { $nin: ['VOID', 'CANCELLED'] },
          amountDue: { $gt: 0 },
          dueDate: { $lt: now },
        },
      },
      {
        $group: {
          _id: null,
          totalOverdue: { $sum: '$amountDue' },
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      totalOutstanding,
      totalCreditLimit,
      creditUtilizationPercentage: creditUtilization,
      customersCount: recAgg?.customersCount || 0,
      customersWithDueCount: recAgg?.customersWithDueCount || 0,
      totalOverdueAmount: overdue?.totalOverdue || 0,
      overdueInvoicesCount: overdue?.count || 0,
    };
  }

  public static async getReceivablesAging(): Promise<any> {
    const now = new Date();

    const openInvoices = await SalesInvoice.find({
      status: { $nin: ['VOID', 'CANCELLED'] },
      amountDue: { $gt: 0 },
    }).lean();

    const buckets = {
      notDue: { label: 'Not Due', amount: 0, count: 0 },
      days1To30: { label: '1–30 Days Overdue', amount: 0, count: 0 },
      days31To60: { label: '31–60 Days Overdue', amount: 0, count: 0 },
      days61To90: { label: '61–90 Days Overdue', amount: 0, count: 0 },
      over90Days: { label: 'More Than 90 Days Overdue', amount: 0, count: 0 },
    };

    for (const inv of openInvoices) {
      const due = (inv as any).balanceDue ?? (inv as any).amountDue ?? 0;
      if (!inv.dueDate || inv.dueDate >= now) {
        buckets.notDue.amount += due;
        buckets.notDue.count += 1;
      } else {
        const diffMs = now.getTime() - new Date(inv.dueDate).getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) {
          buckets.days1To30.amount += due;
          buckets.days1To30.count += 1;
        } else if (diffDays <= 60) {
          buckets.days31To60.amount += due;
          buckets.days31To60.count += 1;
        } else if (diffDays <= 90) {
          buckets.days61To90.amount += due;
          buckets.days61To90.count += 1;
        } else {
          buckets.over90Days.amount += due;
          buckets.over90Days.count += 1;
        }
      }
    }

    const totalReceivables = Object.values(buckets).reduce((sum, b) => sum + b.amount, 0);

    return {
      asOfDate: now.toISOString(),
      totalReceivables,
      buckets: Object.values(buckets),
    };
  }

  /**
   * 9. Collections Summary
   */
  public static async getCollectionsSummary(query: ReportQueryParams): Promise<any> {
    const { start, end, label, preset } = resolveDateRange(query.preset, query.startDate, query.endDate);
    const filter: any = { status: 'CONFIRMED' };

    if (start || end) {
      filter.createdAt = {};
      if (start) filter.createdAt.$gte = start;
      if (end) filter.createdAt.$lt = end;
    }

    if (query.branchId && query.branchId !== 'all') {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    const [totalAgg] = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const byMethod = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$paymentMethod',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          method: '$_id',
          totalAmount: 1,
          count: 1,
          _id: 0,
        },
      },
    ]);

    return {
      period: { preset, label, start: start?.toISOString(), end: end?.toISOString() },
      totalCollected: totalAgg?.totalAmount || 0,
      paymentsCount: totalAgg?.count || 0,
      byMethod,
    };
  }

  /**
   * 10. Inventory Summary, Low Stock & Movements
   */
  public static async getInventorySummary(query: ReportQueryParams): Promise<any> {
    const filter: any = {};
    if (query.branchId && query.branchId !== 'all') {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    const [stockAgg] = await StockBalance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOnHand: { $sum: '$onHand' },
          totalReserved: { $sum: '$reserved' },
        },
      },
    ]);

    const totalOnHand = stockAgg?.totalOnHand || 0;
    const totalReserved = stockAgg?.totalReserved || 0;
    const totalAvailable = Math.max(0, totalOnHand - totalReserved);

    // Stock by branch
    const byBranch = await StockBalance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$branchId',
          onHand: { $sum: '$onHand' },
          reserved: { $sum: '$reserved' },
        },
      },
      {
        $lookup: {
          from: 'branches',
          localField: '_id',
          foreignField: '_id',
          as: 'branch',
        },
      },
      { $unwind: '$branch' },
      {
        $project: {
          branchId: '$_id',
          branchName: '$branch.name',
          shopNumber: '$branch.shopNumber',
          onHand: 1,
          reserved: 1,
          available: { $subtract: ['$onHand', '$reserved'] },
          _id: 0,
        },
      },
    ]);

    return {
      totalOnHand,
      totalReserved,
      totalAvailable,
      byBranch,
    };
  }

  public static async getInventoryLowStock(query: ReportQueryParams): Promise<any> {
    const filter: any = {};
    if (query.branchId && query.branchId !== 'all') {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    const lowStockItems = await StockBalance.aggregate([
      { $match: filter },
      {
        $project: {
          branchId: 1,
          stockLocationId: 1,
          sku: 1,
          onHand: 1,
          reserved: 1,
          reorderLevel: 1,
          available: { $subtract: ['$onHand', '$reserved'] },
          status: {
            $cond: [
              { $lte: [{ $subtract: ['$onHand', '$reserved'] }, 0] },
              'OUT_OF_STOCK',
              {
                $cond: [
                  { $eq: ['$reorderLevel', null] },
                  'NOT_CONFIGURED',
                  {
                    $cond: [
                      { $lte: [{ $subtract: ['$onHand', '$reserved'] }, '$reorderLevel'] },
                      'LOW_STOCK',
                      'NORMAL',
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      {
        $match: {
          status: { $in: ['OUT_OF_STOCK', 'LOW_STOCK', 'NOT_CONFIGURED'] },
        },
      },
      {
        $lookup: {
          from: 'branches',
          localField: 'branchId',
          foreignField: '_id',
          as: 'branch',
        },
      },
      { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'variants',
          localField: 'sku',
          foreignField: 'sku',
          as: 'variant',
        },
      },
      { $unwind: { path: '$variant', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          sku: 1,
          branchName: '$branch.name',
          onHand: 1,
          reserved: 1,
          available: 1,
          reorderLevel: 1,
          status: 1,
          isOutOfStock: { $lte: ['$available', 0] },
          _id: 0,
        },
      },
      { $sort: { available: 1 } },
      { $limit: query.limit || 50 },
    ]);

    return {
      lowStockCount: lowStockItems.length,
      items: lowStockItems,
    };
  }

  public static async getInventoryValuation(): Promise<any> {
    const valAgg = await StockBalance.aggregate([
      { $match: { onHand: { $gt: 0 } } },
      {
        $lookup: {
          from: 'stocklocations',
          localField: 'stockLocationId',
          foreignField: '_id',
          as: 'location',
        },
      },
      { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'variants',
          localField: 'sku',
          foreignField: 'sku',
          as: 'variant',
        },
      },
      { $unwind: { path: '$variant', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          totalUnits: { $sum: '$onHand' },
          totalValuation: {
            $sum: {
              $multiply: ['$onHand', { $ifNull: ['$variant.purchasePrice', 0] }],
            },
          },
          salableUnits: {
            $sum: {
              $cond: [{ $ne: ['$location.type', 'RETURNS_DAMAGED'] }, '$onHand', 0],
            },
          },
          salableValuation: {
            $sum: {
              $cond: [
                { $ne: ['$location.type', 'RETURNS_DAMAGED'] },
                { $multiply: ['$onHand', { $ifNull: ['$variant.purchasePrice', 0] }] },
                0,
              ],
            },
          },
          quarantinedUnits: {
            $sum: {
              $cond: [{ $eq: ['$location.type', 'RETURNS_DAMAGED'] }, '$onHand', 0],
            },
          },
          quarantinedValuation: {
            $sum: {
              $cond: [
                { $eq: ['$location.type', 'RETURNS_DAMAGED'] },
                { $multiply: ['$onHand', { $ifNull: ['$variant.purchasePrice', 0] }] },
                0,
              ],
            },
          },
          skusCount: { $addToSet: '$sku' },
          missingCostCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: [{ $ifNull: ['$variant.purchasePrice', 0] }, 0] },
                    { $eq: [{ $ifNull: ['$variant', null] }, null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const res = valAgg[0] || {};
    return {
      metricName: 'Estimated Inventory Value — Standard Purchase Cost',
      totalUnits: res.totalUnits || 0,
      totalValuation: res.totalValuation || 0,
      salableUnits: res.salableUnits || 0,
      salableValuation: res.salableValuation || 0,
      quarantinedUnits: res.quarantinedUnits || 0,
      quarantinedValuation: res.quarantinedValuation || 0,
      uniqueSkusCount: res.skusCount?.length || 0,
      missingCostSkusCount: res.missingCostCount || 0,
      costBasisMethod: 'PURCHASE_PRICE_SNAPSHOT',
      valuationStatus: (res.missingCostCount || 0) > 0 ? 'PARTIAL_COST_BASIS' : 'VERIFIED_COST_BASIS',
    };
  }

  public static async getInventoryMovements(query: ReportQueryParams): Promise<any> {
    const filter: any = {};
    if (query.branchId && query.branchId !== 'all') {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }
    if (query.sku) {
      filter.sku = query.sku.toUpperCase().trim();
    }

    const { start, end } = resolveDateRange(query.preset, query.startDate, query.endDate);
    if (start || end) {
      filter.timestamp = {};
      if (start) filter.timestamp.$gte = start;
      if (end) filter.timestamp.$lt = end;
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [movements, totalCount] = await Promise.all([
      StockMovement.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      StockMovement.countDocuments(filter),
    ]);

    return {
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
      movements,
    };
  }

  /**
   * 11. Purchasing & Supplier Reports
   */
  public static async getPurchasingSummary(query: ReportQueryParams): Promise<any> {
    const { start, end, label, preset } = resolveDateRange(query.preset, query.startDate, query.endDate);
    const filter: any = {};

    if (start || end) {
      filter.createdAt = {};
      if (start) filter.createdAt.$gte = start;
      if (end) filter.createdAt.$lt = end;
    }

    if (query.branchId && query.branchId !== 'all') {
      filter.destinationBranchId = new mongoose.Types.ObjectId(query.branchId);
    }

    const [poAgg] = await PurchaseOrder.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalPOs: { $sum: 1 },
          totalOrderedValue: { $sum: '$totalAmount' },
        },
      },
    ]);

    const billFilter: any = { status: 'POSTED' };
    if (start || end) {
      billFilter.billDate = {};
      if (start) billFilter.billDate.$gte = start;
      if (end) billFilter.billDate.$lt = end;
    }
    if (query.branchId && query.branchId !== 'all') {
      billFilter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    const [billsAgg] = await SupplierBill.aggregate([
      { $match: billFilter },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalBillAmount: { $sum: '$totalAmount' },
          totalBillDue: { $sum: '$amountDue' },
        },
      },
    ]);

    const [paymentsAgg] = await SupplierPayment.aggregate([
      {
        $match: {
          ...(start || end
            ? {
                paymentDate: {
                  ...(start ? { $gte: start } : {}),
                  ...(end ? { $lt: end } : {}),
                },
              }
            : {}),
          ...(query.branchId && query.branchId !== 'all'
            ? { branchId: new mongoose.Types.ObjectId(query.branchId) }
            : {}),
        },
      },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalPaidAmount: { $sum: '$amount' },
        },
      },
    ]);

    const [returnsAgg] = await PurchaseReturn.aggregate([
      {
        $match: {
          ...(start || end
            ? {
                returnDate: {
                  ...(start ? { $gte: start } : {}),
                  ...(end ? { $lt: end } : {}),
                },
              }
            : {}),
          ...(query.branchId && query.branchId !== 'all'
            ? { branchId: new mongoose.Types.ObjectId(query.branchId) }
            : {}),
        },
      },
      {
        $group: {
          _id: null,
          totalReturns: { $sum: 1 },
          totalReturnValue: { $sum: '$totalAmount' },
        },
      },
    ]);

    return {
      period: { preset, label, start: start?.toISOString(), end: end?.toISOString() },
      purchaseOrdersCount: poAgg?.totalPOs || 0,
      totalOrderedValue: poAgg?.totalOrderedValue || 0,
      postedBillsCount: billsAgg?.totalBills || 0,
      totalBillAmount: billsAgg?.totalBillAmount || 0,
      totalBillDue: billsAgg?.totalBillDue || 0,
      supplierPaymentsCount: paymentsAgg?.totalPayments || 0,
      totalPaidAmount: paymentsAgg?.totalPaidAmount || 0,
      returnsCount: returnsAgg?.totalReturns || 0,
      totalReturnValue: returnsAgg?.totalReturnValue || 0,
    };
  }

  public static async getPurchasingBySupplier(query: ReportQueryParams): Promise<any> {
    const suppliers = await Supplier.find().lean();

    const result = await Promise.all(
      suppliers.map(async (s) => {
        const [pos] = await PurchaseOrder.aggregate([
          { $match: { supplierId: s._id } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalValue: { $sum: '$totalAmount' },
            },
          },
        ]);

        const [bills] = await SupplierBill.aggregate([
          { $match: { supplierId: s._id, status: 'POSTED' } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAmount: { $sum: '$totalAmount' },
              totalDue: { $sum: '$amountDue' },
            },
          },
        ]);

        return {
          supplierId: s._id.toString(),
          code: s.code,
          name: s.name,
          currentOutstanding: s.currentOutstanding,
          unallocatedAdvances: s.unallocatedAdvances || 0,
          poCount: pos?.count || 0,
          poTotalValue: pos?.totalValue || 0,
          billsCount: bills?.count || 0,
          billsTotalAmount: bills?.totalAmount || 0,
          billsTotalDue: bills?.totalDue || 0,
        };
      })
    );

    return {
      suppliers: result,
    };
  }

  public static async getPurchasingByBranch(query: ReportQueryParams): Promise<any> {
    const branches = await Branch.find().lean();

    const result = await Promise.all(
      branches.map(async (b) => {
        const [pos] = await PurchaseOrder.aggregate([
          { $match: { destinationBranchId: b._id } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalValue: { $sum: '$totalAmount' },
            },
          },
        ]);

        const [bills] = await SupplierBill.aggregate([
          { $match: { branchId: b._id, status: 'POSTED' } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAmount: { $sum: '$totalAmount' },
              totalDue: { $sum: '$amountDue' },
            },
          },
        ]);

        return {
          branchId: b._id.toString(),
          name: b.name,
          shopNumber: b.shopNumber,
          poCount: pos?.count || 0,
          poTotalValue: pos?.totalValue || 0,
          billsCount: bills?.count || 0,
          billsTotalAmount: bills?.totalAmount || 0,
          billsTotalDue: bills?.totalDue || 0,
        };
      })
    );

    return {
      branches: result,
    };
  }

  /**
   * 12. Payables Summary & Aging
   */
  public static async getPayablesSummary(): Promise<any> {
    const [supAgg] = await Supplier.aggregate([
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: '$currentOutstanding' },
          totalAdvances: { $sum: '$unallocatedAdvances' },
          suppliersCount: { $sum: 1 },
        },
      },
    ]);

    const now = new Date();
    const [overdue] = await SupplierBill.aggregate([
      {
        $match: {
          status: 'POSTED',
          amountDue: { $gt: 0 },
          dueDate: { $lt: now },
        },
      },
      {
        $group: {
          _id: null,
          totalOverdue: { $sum: '$amountDue' },
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      totalOutstandingPayables: supAgg?.totalOutstanding || 0,
      totalUnallocatedAdvances: supAgg?.totalAdvances || 0,
      netPayableLiability: Math.max(0, (supAgg?.totalOutstanding || 0) - (supAgg?.totalAdvances || 0)),
      totalSuppliersCount: supAgg?.suppliersCount || 0,
      overdueBillsCount: overdue?.count || 0,
      overduePayablesAmount: overdue?.totalOverdue || 0,
    };
  }

  public static async getPayablesAging(): Promise<any> {
    const now = new Date();
    const openBills = await SupplierBill.find({
      status: 'POSTED',
      amountDue: { $gt: 0 },
    }).lean();

    const buckets = {
      notDue: { label: 'Not Due', amount: 0, count: 0 },
      days1To30: { label: '1–30 Days Overdue', amount: 0, count: 0 },
      days31To60: { label: '31–60 Days Overdue', amount: 0, count: 0 },
      days61To90: { label: '61–90 Days Overdue', amount: 0, count: 0 },
      over90Days: { label: 'More Than 90 Days Overdue', amount: 0, count: 0 },
    };

    for (const bill of openBills) {
      const due = (bill as any).balanceDue ?? (bill as any).amountDue ?? 0;
      if (!bill.dueDate || bill.dueDate >= now) {
        buckets.notDue.amount += due;
        buckets.notDue.count += 1;
      } else {
        const diffMs = now.getTime() - new Date(bill.dueDate).getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) {
          buckets.days1To30.amount += due;
          buckets.days1To30.count += 1;
        } else if (diffDays <= 60) {
          buckets.days31To60.amount += due;
          buckets.days31To60.count += 1;
        } else if (diffDays <= 90) {
          buckets.days61To90.amount += due;
          buckets.days61To90.count += 1;
        } else {
          buckets.over90Days.amount += due;
          buckets.over90Days.count += 1;
        }
      }
    }

    const totalPayables = Object.values(buckets).reduce((sum, b) => sum + b.amount, 0);

    return {
      asOfDate: now.toISOString(),
      totalPayables,
      buckets: Object.values(buckets),
    };
  }
}
