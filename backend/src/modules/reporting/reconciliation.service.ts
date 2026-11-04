import mongoose from 'mongoose';
import {
  SalesInvoice,
  Payment,
  Customer,
  CustomerLedgerEntry,
  StockBalance,
  StockMovement,
  StockTransfer,
  PurchaseOrder,
  StockReceipt,
  Supplier,
  SupplierBill,
  SupplierPayment,
  SupplierLedgerEntry,
} from '../../models/index.js';

export interface DiscrepancyReportItem {
  category: 'SALES' | 'COLLECTIONS' | 'RECEIVABLES' | 'INVENTORY' | 'PURCHASES' | 'PAYABLES';
  recordReference: string;
  expectedValue: number;
  actualValue: number;
  difference: number;
  severity: 'OK' | 'WARNING' | 'CRITICAL';
  message: string;
}

export interface ReconciliationResult {
  generatedAt: string;
  summary: {
    totalChecks: number;
    passedChecks: number;
    warningsCount: number;
    criticalCount: number;
    overallStatus: 'RECONCILED' | 'ATTENTION_REQUIRED' | 'CRITICAL_DISCREPANCY';
  };
  checks: DiscrepancyReportItem[];
}

export class ReconciliationService {
  /**
   * Runs complete cross-module audit across Sales, Collections, Receivables,
   * Inventory, Purchases, and Accounts Payable against real MongoDB documents.
   */
  public static async runFullAudit(): Promise<ReconciliationResult> {
    const checks: DiscrepancyReportItem[] = [];

    // ==========================================
    // 1. SALES RECONCILIATION
    // ==========================================
    // Check 1: Invoice arithmetic integrity: Net Amount == Gross Amount - Discount Amount - Return Amount
    const badInvoices = await SalesInvoice.aggregate([
      {
        $match: {
          status: { $nin: ['VOID', 'CANCELLED'] },
        },
      },
      {
        $project: {
          invoiceNumber: 1,
          grossAmount: 1,
          discountAmount: 1,
          returnAmount: 1,
          netAmount: 1,
          calculatedNet: {
            $subtract: [
              { $subtract: ['$grossAmount', '$discountAmount'] },
              { $ifNull: ['$returnAmount', 0] },
            ],
          },
        },
      },
      {
        $project: {
          invoiceNumber: 1,
          grossAmount: 1,
          discountAmount: 1,
          returnAmount: 1,
          netAmount: 1,
          calculatedNet: 1,
          diff: { $abs: { $subtract: ['$netAmount', '$calculatedNet'] } },
        },
      },
      {
        $match: {
          diff: { $gt: 1 }, // Tolerance for floating point or rounding, standard is 0 in paisa
        },
      },
      { $limit: 10 },
    ]);

    if (badInvoices.length === 0) {
      checks.push({
        category: 'SALES',
        recordReference: 'SALES_ARITHMETIC_ALL',
        expectedValue: 0,
        actualValue: 0,
        difference: 0,
        severity: 'OK',
        message: 'All posted sales invoice totals strictly match gross minus discount minus returns.',
      });
    } else {
      for (const inv of badInvoices) {
        checks.push({
          category: 'SALES',
          recordReference: `INV-${inv.invoiceNumber}`,
          expectedValue: inv.calculatedNet,
          actualValue: inv.netAmount,
          difference: inv.diff,
          severity: 'CRITICAL',
          message: `Invoice ${inv.invoiceNumber} netAmount does not equal grossAmount minus discounts.`,
        });
      }
    }

    // ==========================================
    // 2. COLLECTIONS & INVOICE PAYMENT RECONCILIATION
    // ==========================================
    // Check 2: Invoice amountPaid + amountDue == netAmount
    const badBalanceInvoices = await SalesInvoice.aggregate([
      {
        $match: {
          status: { $nin: ['VOID', 'CANCELLED'] },
        },
      },
      {
        $project: {
          invoiceNumber: 1,
          netAmount: 1,
          amountPaid: 1,
          amountDue: 1,
          settledSum: { $add: ['$amountPaid', '$amountDue'] },
        },
      },
      {
        $project: {
          invoiceNumber: 1,
          netAmount: 1,
          settledSum: 1,
          diff: { $abs: { $subtract: ['$netAmount', '$settledSum'] } },
        },
      },
      {
        $match: {
          diff: { $gt: 1 },
        },
      },
      { $limit: 10 },
    ]);

    if (badBalanceInvoices.length === 0) {
      checks.push({
        category: 'COLLECTIONS',
        recordReference: 'INVOICE_SETTLEMENT_ALL',
        expectedValue: 0,
        actualValue: 0,
        difference: 0,
        severity: 'OK',
        message: 'All invoices verify (amountPaid + amountDue == netAmount).',
      });
    } else {
      for (const inv of badBalanceInvoices) {
        checks.push({
          category: 'COLLECTIONS',
          recordReference: `INV-${inv.invoiceNumber}`,
          expectedValue: inv.netAmount,
          actualValue: inv.settledSum,
          difference: inv.diff,
          severity: 'CRITICAL',
          message: `Invoice ${inv.invoiceNumber} paid + due (${inv.settledSum}) does not equal net amount (${inv.netAmount}).`,
        });
      }
    }

    // Check 3: Total Posted Payments vs Invoice Amount Paid
    const [paymentsSum] = await Payment.aggregate([
      { $match: { status: 'CONFIRMED' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalPayments = paymentsSum?.total || 0;

    const [invoicesPaidSum] = await SalesInvoice.aggregate([
      { $match: { status: { $nin: ['VOID', 'CANCELLED'] } } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } },
    ]);
    const totalInvoicesPaid = invoicesPaidSum?.total || 0;
    const paymentDiff = Math.abs(totalPayments - totalInvoicesPaid);

    checks.push({
      category: 'COLLECTIONS',
      recordReference: 'PAYMENTS_VS_INVOICE_PAID',
      expectedValue: totalInvoicesPaid,
      actualValue: totalPayments,
      difference: paymentDiff,
      severity: paymentDiff > 10 ? 'WARNING' : 'OK',
      message:
        paymentDiff > 10
          ? `Total confirmed payments (${totalPayments}) differs from invoice recorded collections (${totalInvoicesPaid}).`
          : 'Total confirmed payment vouchers match invoiced collections.',
    });

    // ==========================================
    // 3. CUSTOMER RECEIVABLES RECONCILIATION
    // ==========================================
    // Compare total unpaid customer invoices with Customer.currentOutstanding
    const [openCustomerInvoices] = await SalesInvoice.aggregate([
      {
        $match: {
          status: { $nin: ['VOID', 'CANCELLED'] },
          amountDue: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalDue: { $sum: '$amountDue' },
        },
      },
    ]);
    const totalOpenInvoicesDue = openCustomerInvoices?.totalDue || 0;

    const [customersOutstandingSum] = await Customer.aggregate([
      { $group: { _id: null, totalOutstanding: { $sum: '$currentOutstanding' } } },
    ]);
    const totalCustomerOutstanding = customersOutstandingSum?.totalOutstanding || 0;
    const recDiff = Math.abs(totalOpenInvoicesDue - totalCustomerOutstanding);

    checks.push({
      category: 'RECEIVABLES',
      recordReference: 'RECEIVABLES_VS_CUSTOMER_OUTSTANDING',
      expectedValue: totalOpenInvoicesDue,
      actualValue: totalCustomerOutstanding,
      difference: recDiff,
      severity: recDiff > 100 ? 'WARNING' : 'OK',
      message:
        recDiff > 100
          ? `Total open invoice dues (${totalOpenInvoicesDue}) differs from customer records sum (${totalCustomerOutstanding}).`
          : 'Total open customer invoice dues reconcile with customer accounts balances.',
    });

    // ==========================================
    // 4. INVENTORY STOCK RECONCILIATION
    // ==========================================
    // Check 4a: Available = OnHand - Reserved >= 0
    const negativeAvailable = await StockBalance.find({
      $expr: { $gt: ['$reserved', '$onHand'] },
    }).limit(5);

    if (negativeAvailable.length === 0) {
      checks.push({
        category: 'INVENTORY',
        recordReference: 'STOCK_AVAILABLE_NON_NEGATIVE',
        expectedValue: 0,
        actualValue: 0,
        difference: 0,
        severity: 'OK',
        message: 'All stock balances satisfy onHand >= reserved (available >= 0).',
      });
    } else {
      for (const b of negativeAvailable) {
        checks.push({
          category: 'INVENTORY',
          recordReference: `BAL-${b.sku}`,
          expectedValue: b.onHand,
          actualValue: b.reserved,
          difference: b.reserved - b.onHand,
          severity: 'CRITICAL',
          message: `SKU '${b.sku}' at branch ${b.branchId} has reserved (${b.reserved}) exceeding on-hand (${b.onHand}).`,
        });
      }
    }

    // Check 4b: Active in-transit stock transfers
    const inTransitTransfers = await StockTransfer.find({
      status: { $in: ['DISPATCHED', 'IN_TRANSIT'] },
    });
    const totalInTransitUnits = inTransitTransfers.reduce(
      (sum, t) => sum + (t.items || []).reduce((s, i) => s + i.quantity, 0),
      0
    );

    checks.push({
      category: 'INVENTORY',
      recordReference: 'IN_TRANSIT_TRANSFERS',
      expectedValue: totalInTransitUnits,
      actualValue: totalInTransitUnits,
      difference: 0,
      severity: 'OK',
      message: `Active in-transit stock transfers: ${inTransitTransfers.length} transfers containing ${totalInTransitUnits} units quarantined from available stock.`,
    });

    // ==========================================
    // 5. PURCHASES & GOODS RECEIVING RECONCILIATION
    // ==========================================
    // Check PO ordered vs PO received vs GRNs
    const overReceivedPOs = await PurchaseOrder.aggregate([
      {
        $match: {
          status: { $in: ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'APPROVED'] },
        },
      },
      { $unwind: '$items' },
      {
        $project: {
          orderNumber: 1,
          sku: '$items.sku',
          orderedQuantity: '$items.orderedQuantity',
          receivedQuantity: '$items.receivedQuantity',
          overage: { $subtract: ['$items.receivedQuantity', '$items.orderedQuantity'] },
        },
      },
      {
        $match: {
          overage: { $gt: 0 },
        },
      },
      { $limit: 5 },
    ]);

    if (overReceivedPOs.length === 0) {
      checks.push({
        category: 'PURCHASES',
        recordReference: 'PO_OVER_RECEIVING_ALL',
        expectedValue: 0,
        actualValue: 0,
        difference: 0,
        severity: 'OK',
        message: 'No purchase orders have received quantities exceeding ordered quantities.',
      });
    } else {
      for (const po of overReceivedPOs) {
        checks.push({
          category: 'PURCHASES',
          recordReference: `PO-${po.orderNumber}`,
          expectedValue: po.orderedQuantity,
          actualValue: po.receivedQuantity,
          difference: po.overage,
          severity: 'CRITICAL',
          message: `PO ${po.orderNumber} for SKU ${po.sku} received ${po.receivedQuantity} vs ordered ${po.orderedQuantity}.`,
        });
      }
    }

    // ==========================================
    // 6. SUPPLIER PAYABLES & ADVANCES RECONCILIATION
    // ==========================================
    // Check open supplier bill dues vs Supplier.currentOutstanding
    const [openBillsSum] = await SupplierBill.aggregate([
      {
        $match: {
          status: 'POSTED',
          amountDue: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalDue: { $sum: '$amountDue' },
        },
      },
    ]);
    const totalOpenBillsDue = openBillsSum?.totalDue || 0;

    const [suppliersOutstandingSum] = await Supplier.aggregate([
      { $group: { _id: null, totalOutstanding: { $sum: '$currentOutstanding' } } },
    ]);
    const totalSupplierOutstanding = suppliersOutstandingSum?.totalOutstanding || 0;
    const apDiff = Math.abs(totalOpenBillsDue - totalSupplierOutstanding);

    checks.push({
      category: 'PAYABLES',
      recordReference: 'BILLS_VS_SUPPLIER_OUTSTANDING',
      expectedValue: totalOpenBillsDue,
      actualValue: totalSupplierOutstanding,
      difference: apDiff,
      severity: apDiff > 100 ? 'WARNING' : 'OK',
      message:
        apDiff > 100
          ? `Open supplier bills dues (${totalOpenBillsDue}) differs from supplier accounts payable sum (${totalSupplierOutstanding}).`
          : 'Open supplier bills balance reconciles with supplier accounts payable.',
    });

    // Check non-negative supplier liabilities
    const negativeSuppliers = await Supplier.find({
      currentOutstanding: { $lt: 0 },
    }).limit(5);

    if (negativeSuppliers.length === 0) {
      checks.push({
        category: 'PAYABLES',
        recordReference: 'SUPPLIER_NON_NEGATIVE_PAYABLE',
        expectedValue: 0,
        actualValue: 0,
        difference: 0,
        severity: 'OK',
        message: 'All supplier accounts have non-negative accounts payable liabilities (currentOutstanding >= 0).',
      });
    } else {
      for (const sup of negativeSuppliers) {
        checks.push({
          category: 'PAYABLES',
          recordReference: `SUP-${sup.code}`,
          expectedValue: 0,
          actualValue: sup.currentOutstanding,
          difference: Math.abs(sup.currentOutstanding),
          severity: 'CRITICAL',
          message: `Supplier ${sup.name} (${sup.code}) has negative payable liability (${sup.currentOutstanding}). Advances must be tracked separately in unallocatedAdvances.`,
        });
      }
    }

    // Summary calculation
    const totalChecks = checks.length;
    const passedChecks = checks.filter((c) => c.severity === 'OK').length;
    const warningsCount = checks.filter((c) => c.severity === 'WARNING').length;
    const criticalCount = checks.filter((c) => c.severity === 'CRITICAL').length;

    const overallStatus: 'RECONCILED' | 'ATTENTION_REQUIRED' | 'CRITICAL_DISCREPANCY' =
      criticalCount > 0
        ? 'CRITICAL_DISCREPANCY'
        : warningsCount > 0
        ? 'ATTENTION_REQUIRED'
        : 'RECONCILED';

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalChecks,
        passedChecks,
        warningsCount,
        criticalCount,
        overallStatus,
      },
      checks,
    };
  }
}

