import mongoose from 'mongoose';
import {
  PurchaseOrder,
  IPurchaseOrder,
  PurchaseOrderStatus,
  StockReceipt,
  SupplierBill,
  ISupplierBill,
  SupplierPayment,
  SupplierLedgerEntry,
  PurchaseReturn,
  Supplier,
  Branch,
  StockLocation,
  StockBalance,
  StockMovement,
  Variant,
  Product,
  Counter,
  IdempotencyKey,
  AuditLog,
} from '../../models/index.js';
import { STOCK_MOVEMENT_TYPES, STOCK_LOCATION_TYPES } from '../../constants/index.js';
import { AppError } from '../../utils/apiResponse.js';
import { runTransaction } from '../../utils/transaction.js';
import {
  CreatePOInput,
  UpdatePOInput,
  ReceiveOrderInput,
  CreateSupplierBillInput,
  CreateSupplierPaymentInput,
  CreatePurchaseReturnInput,
  POQuery,
} from './purchasing.schema.js';

interface UserContext {
  id: string;
  loginId: string;
  role: 'SUPER_ADMIN' | 'BRANCH';
  branchId?: string;
  branchName?: string;
  permissions?: Record<string, boolean>;
}

export class PurchasingService {
  /**
   * Generates a date-based sequence code atomically: e.g. PO-YYYYMMDD-0001
   */
  public static async generateSequentialNumber(
    prefix: string,
    session?: mongoose.ClientSession | null
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const counterKey = `${prefix}_${dateStr}`;

    const counter = await Counter.findOneAndUpdate(
      { key: counterKey },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, session: session || undefined }
    );

    const seq = String(counter.seq).padStart(4, '0');
    return `${prefix}-${dateStr}-${seq}`;
  }

  // ==========================================
  // 1. PURCHASE ORDERS
  // ==========================================

  public static async createPurchaseOrder(
    input: CreatePOInput,
    userContext: UserContext
  ): Promise<IPurchaseOrder> {
    const supplier = await Supplier.findById(input.supplierId);
    if (!supplier) {
      throw new AppError('Supplier not found.', 404, 'SUPPLIER_NOT_FOUND');
    }

    // Branch determination
    let branchId = input.branchId;
    if (userContext.role === 'BRANCH') {
      branchId = userContext.branchId;
    } else if (!branchId) {
      // Default to Main Branch for Super Admin if not provided
      const main = await Branch.findOne({ code: 'SHOP-12-14' });
      branchId = main ? main._id.toString() : undefined;
    }

    if (!branchId) {
      throw new AppError('Branch identity is required for purchase order.', 400, 'BRANCH_REQUIRED');
    }

    const branch = await Branch.findById(branchId);
    if (!branch) {
      throw new AppError('Target branch not found.', 404, 'BRANCH_NOT_FOUND');
    }

    // Stock Location determination
    let stockLocationId = input.stockLocationId;
    if (!stockLocationId) {
      const defaultLoc = await StockLocation.findOne({
        branchId,
        type: { $in: [STOCK_LOCATION_TYPES.SALES_FLOOR, STOCK_LOCATION_TYPES.WAREHOUSE] },
        isActive: true,
      });
      stockLocationId = defaultLoc ? defaultLoc._id.toString() : undefined;
    }

    // Enrich and calculate line items
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    const enrichedItems: any[] = [];

    for (const item of input.items) {
      const cleanSku = item.sku.toUpperCase().trim();
      const variant = await Variant.findOne({ sku: cleanSku })
        .populate('productId')
        .populate('sizeId')
        .populate('thicknessId');
      if (!variant) {
        throw new AppError(`Variant with SKU '${item.sku}' not found.`, 404, 'VARIANT_NOT_FOUND');
      }

      const product = variant.productId as any;
      const sizeDoc = variant.sizeId as any;
      const thicknessDoc = variant.thicknessId as any;
      const unitCost = Math.round(item.unitCost);
      const qty = item.quantity;
      const lineDiscount = Math.round(item.lineDiscount || 0);
      const taxAmount = Math.round(item.taxAmount || 0);
      const lineTotal = qty * unitCost - lineDiscount + taxAmount;

      subtotal += qty * unitCost;
      totalDiscount += lineDiscount;
      totalTax += taxAmount;

      enrichedItems.push({
        sku: cleanSku,
        variantId: variant._id,
        productName: product?.name || variant.sku,
        brandName: product?.brand || undefined,
        categoryName: product?.category || undefined,
        sizeLabel: sizeDoc?.displayLabel || undefined,
        thicknessLabel: thicknessDoc?.displayLabel || undefined,
        orderedQuantity: qty,
        receivedQuantity: 0,
        unitCost,
        lineDiscount,
        taxAmount,
        lineTotal,
      });
    }

    const totalAmount = subtotal - totalDiscount + totalTax;

    return await runTransaction(async (session) => {
      const orderNumber = await PurchasingService.generateSequentialNumber('PO', session);

      const [order] = await PurchaseOrder.create(
        [
          {
            orderNumber,
            supplierId: supplier._id,
            branchId: branch._id,
            stockLocationId: stockLocationId ? new mongoose.Types.ObjectId(stockLocationId) : undefined,
            items: enrichedItems,
            subtotal,
            discountAmount: totalDiscount,
            taxAmount: totalTax,
            totalAmount,
            status: 'DRAFT',
            orderDate: new Date(),
            expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : undefined,
            paymentTerms: input.paymentTerms || supplier.paymentTerms || 'Net 30 Days',
            referenceNumber: input.referenceNumber?.trim(),
            createdBy: userContext.loginId,
            createdByName: userContext.role === 'SUPER_ADMIN' ? 'Super Admin' : userContext.branchName,
            notes: input.notes?.trim(),
          },
        ],
        { session }
      );

      return order;
    });
  }

  public static async getPurchaseOrders(query: POQuery, userContext: UserContext): Promise<any> {
    const filter: Record<string, any> = {};

    // Branch isolation: Branch user only sees their own POs
    if (userContext.role === 'BRANCH') {
      filter.branchId = userContext.branchId;
    } else if (query.branchId) {
      filter.branchId = query.branchId;
    }

    if (query.supplierId) {
      filter.supplierId = query.supplierId;
    }

    if (query.status) {
      filter.status = query.status.toUpperCase();
    }

    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { orderNumber: regex },
        { referenceNumber: regex },
        { 'items.sku': regex },
        { 'items.productName': regex },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      filter.orderDate = {};
      if (query.dateFrom) filter.orderDate.$gte = new Date(query.dateFrom);
      if (query.dateTo) filter.orderDate.$lte = new Date(query.dateTo);
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate('supplierId', 'code name phone email')
        .populate('branchId', 'code name city address')
        .populate('stockLocationId', 'code name type')
        .sort({ orderDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PurchaseOrder.countDocuments(filter),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  public static async getPurchaseOrderById(id: string, userContext: UserContext): Promise<any> {
    const order = await PurchaseOrder.findById(id)
      .populate('supplierId', 'code name phone email contactPerson address paymentTerms')
      .populate('branchId', 'code name city address phone')
      .populate('stockLocationId', 'code name type')
      .lean();

    if (!order) {
      throw new AppError('Purchase order not found.', 404, 'ORDER_NOT_FOUND');
    }

    if (userContext.role === 'BRANCH' && order.branchId && (order.branchId as any)._id?.toString() !== userContext.branchId) {
      throw new AppError('Access denied to purchase orders of another branch.', 403, 'FORBIDDEN_BRANCH_ACCESS');
    }

    // Fetch related GRNs and Supplier Bills
    const [receipts, bills] = await Promise.all([
      StockReceipt.find({ purchaseOrderId: id }).sort({ receivedDate: -1 }).lean(),
      SupplierBill.find({ purchaseOrderId: id }).sort({ billDate: -1 }).lean(),
    ]);

    return {
      ...order,
      receipts,
      bills,
    };
  }

  public static async updatePurchaseOrder(
    id: string,
    input: UpdatePOInput,
    userContext: UserContext
  ) {
    const order = await PurchaseOrder.findById(id);
    if (!order) {
      throw new AppError('Purchase order not found.', 404, 'ORDER_NOT_FOUND');
    }

    if (order.status !== 'DRAFT') {
      throw new AppError(`Cannot edit purchase order in '${order.status}' status. Only DRAFT orders can be modified.`, 400, 'INVALID_ORDER_STATE');
    }

    if (userContext.role === 'BRANCH' && order.branchId.toString() !== userContext.branchId) {
      throw new AppError('Access denied.', 403, 'FORBIDDEN_BRANCH_ACCESS');
    }

    if (input.supplierId) {
      const supplier = await Supplier.findById(input.supplierId);
      if (!supplier) throw new AppError('Supplier not found.', 404, 'SUPPLIER_NOT_FOUND');
      order.supplierId = supplier._id;
    }

    if (input.stockLocationId) {
      order.stockLocationId = new mongoose.Types.ObjectId(input.stockLocationId);
    }
    if (input.expectedDeliveryDate) {
      order.expectedDeliveryDate = new Date(input.expectedDeliveryDate);
    }
    if (input.paymentTerms) order.paymentTerms = input.paymentTerms;
    if (input.referenceNumber !== undefined) order.referenceNumber = input.referenceNumber.trim();
    if (input.notes !== undefined) order.notes = input.notes.trim();

    if (input.items && input.items.length > 0) {
      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      const enrichedItems: any[] = [];

      for (const item of input.items) {
        const cleanSku = item.sku.toUpperCase().trim();
        const variant = await Variant.findOne({ sku: cleanSku })
          .populate('productId')
          .populate('sizeId')
          .populate('thicknessId');
        if (!variant) {
          throw new AppError(`Variant with SKU '${item.sku}' not found.`, 404, 'VARIANT_NOT_FOUND');
        }

        const product = variant.productId as any;
        const sizeDoc = variant.sizeId as any;
        const thicknessDoc = variant.thicknessId as any;
        const unitCost = Math.round(item.unitCost);
        const qty = item.quantity;
        const lineDiscount = Math.round(item.lineDiscount || 0);
        const taxAmount = Math.round(item.taxAmount || 0);
        const lineTotal = qty * unitCost - lineDiscount + taxAmount;

        subtotal += qty * unitCost;
        totalDiscount += lineDiscount;
        totalTax += taxAmount;

        enrichedItems.push({
          sku: cleanSku,
          variantId: variant._id,
          productName: product?.name || variant.sku,
          brandName: product?.brand || undefined,
          categoryName: product?.category || undefined,
          sizeLabel: sizeDoc?.displayLabel || undefined,
          thicknessLabel: thicknessDoc?.displayLabel || undefined,
          orderedQuantity: qty,
          receivedQuantity: 0,
          unitCost,
          lineDiscount,
          taxAmount,
          lineTotal,
        });
      }

      order.items = enrichedItems as any;
      order.subtotal = subtotal;
      order.discountAmount = totalDiscount;
      order.taxAmount = totalTax;
      order.totalAmount = subtotal - totalDiscount + totalTax;
    }

    await order.save();
    return order;
  }

  public static async submitPurchaseOrder(id: string, userContext: UserContext) {
    const order = await PurchaseOrder.findById(id);
    if (!order) throw new AppError('Purchase order not found.', 404, 'ORDER_NOT_FOUND');

    if (order.status !== 'DRAFT') {
      throw new AppError(`Order cannot be submitted for approval in '${order.status}' status.`, 400, 'INVALID_STATE');
    }

    if (userContext.role === 'BRANCH' && order.branchId.toString() !== userContext.branchId) {
      throw new AppError('Access denied.', 403, 'FORBIDDEN_BRANCH_ACCESS');
    }

    order.status = 'PENDING_APPROVAL';
    await order.save();
    return order;
  }

  public static async approvePurchaseOrder(id: string, userContext: UserContext) {
    // Only Super Admin or authorized manager can approve purchase orders
    const canApprove =
      userContext.role === 'SUPER_ADMIN' || userContext.permissions?.purchases === true;

    if (!canApprove) {
      throw new AppError('Insufficient authorization to approve purchase orders.', 403, 'UNAUTHORIZED_APPROVAL');
    }

    const order = await PurchaseOrder.findById(id);
    if (!order) throw new AppError('Purchase order not found.', 404, 'ORDER_NOT_FOUND');

    if (order.status !== 'PENDING_APPROVAL' && order.status !== 'DRAFT') {
      throw new AppError(`Purchase order in '${order.status}' status cannot be approved.`, 400, 'INVALID_STATE');
    }

    order.status = 'APPROVED';
    order.approvedBy = userContext.loginId;
    order.approvedByName = userContext.role === 'SUPER_ADMIN' ? 'Super Admin' : userContext.loginId;
    order.approvedAt = new Date();

    await order.save();

    await AuditLog.create({
      action: 'APPROVE_PURCHASE_ORDER',
      entity: 'PurchaseOrder',
      entityId: order.orderNumber,
      performedBy: userContext.loginId,
      branchId: order.branchId,
      details: {
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        approvedAt: order.approvedAt,
      },
    });

    return order;
  }

  public static async cancelPurchaseOrder(id: string, reason: string, userContext: UserContext) {
    const order = await PurchaseOrder.findById(id);
    if (!order) throw new AppError('Purchase order not found.', 404, 'ORDER_NOT_FOUND');

    if (['FULLY_RECEIVED', 'CLOSED', 'CANCELLED'].includes(order.status)) {
      throw new AppError(`Cannot cancel purchase order in '${order.status}' status.`, 400, 'CANNOT_CANCEL');
    }

    // Check if any goods have already been received
    const hasReceived = order.items.some((item) => item.receivedQuantity > 0);
    if (hasReceived) {
      throw new AppError('Cannot cancel purchase order because goods have already been received against it.', 400, 'GOODS_ALREADY_RECEIVED');
    }

    order.status = 'CANCELLED';
    order.notes = order.notes ? `${order.notes} | Cancelled: ${reason}` : `Cancelled: ${reason}`;
    await order.save();

    return order;
  }

  // ==========================================
  // 2. GOODS RECEIVING / GRN (REUSING FLOW 04 ENGINE)
  // ==========================================

  public static async receivePurchaseOrder(
    orderId: string,
    input: ReceiveOrderInput,
    userContext: UserContext
  ) {
    const order = await PurchaseOrder.findById(orderId);
    if (!order) throw new AppError('Purchase order not found.', 404, 'ORDER_NOT_FOUND');

    if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(order.status)) {
      throw new AppError(
        `Purchase order cannot receive goods in '${order.status}' status. It must be APPROVED or PARTIALLY_RECEIVED.`,
        400,
        'ORDER_NOT_RECEIVABLE'
      );
    }

    // Branch Authorization check
    if (userContext.role === 'BRANCH' && order.branchId.toString() !== userContext.branchId) {
      throw new AppError('Branch accounts can only receive shipments destined for their own branch.', 403, 'FORBIDDEN_RECEIVE');
    }

    // Target StockLocation
    const targetBranchId = order.branchId.toString();
    let locationId = input.stockLocationId || order.stockLocationId?.toString();
    if (!locationId) {
      const defaultLoc = await StockLocation.findOne({
        branchId: targetBranchId,
        type: { $in: [STOCK_LOCATION_TYPES.SALES_FLOOR, STOCK_LOCATION_TYPES.WAREHOUSE] },
        isActive: true,
      });
      if (!defaultLoc) throw new AppError('No active stock location found for target branch.', 404, 'LOCATION_NOT_FOUND');
      locationId = defaultLoc._id.toString();
    }

    const stockLocation = await StockLocation.findOne({
      _id: locationId,
      branchId: targetBranchId,
      isActive: true,
    });
    if (!stockLocation) {
      throw new AppError('Selected stock location does not belong to authorized branch.', 403, 'INVALID_LOCATION');
    }

    // Execute atomic receiving transaction
    return await runTransaction(async (session) => {
      const grnNumber = await PurchasingService.generateSequentialNumber('GRN', session);

      let totalAcceptedQty = 0;
      let totalDamagedQty = 0;
      let totalCostPaisa = 0;
      const receiptLineItems: any[] = [];

      for (const recItem of input.items) {
        const cleanSku = recItem.sku.toUpperCase().trim();
        const poLine = order.items.find((i) => i.sku.toUpperCase() === cleanSku);

        if (!poLine) {
          throw new AppError(`Item '${recItem.sku}' is not part of Purchase Order ${order.orderNumber}.`, 400, 'UNORDERED_ITEM_RECEIVED');
        }

        const remainingQty = poLine.orderedQuantity - poLine.receivedQuantity;
        if (recItem.quantityReceived > remainingQty) {
          throw new AppError(
            `Cannot receive ${recItem.quantityReceived} units of SKU '${cleanSku}'. Maximum remaining to receive is ${remainingQty}.`,
            400,
            'OVER_RECEIVING_PROHIBITED'
          );
        }

        const damagedQty = Math.max(0, recItem.damagedQuantity || 0);
        if (damagedQty > recItem.quantityReceived) {
          throw new AppError(`Damaged quantity cannot exceed received quantity for SKU '${cleanSku}'.`, 400, 'INVALID_DAMAGED_QUANTITY');
        }

        const acceptedQty = recItem.quantityReceived - damagedQty;
        totalAcceptedQty += acceptedQty;
        totalDamagedQty += damagedQty;

        const lineCost = recItem.quantityReceived * poLine.unitCost;
        totalCostPaisa += lineCost;

        // Fetch variant details
        const variant = await Variant.findOne({ sku: cleanSku }).session(session);

        // 1. Increment onHand in StockBalance for accepted saleable stock
        if (acceptedQty > 0) {
          const balance = await StockBalance.findOne({
            branchId: targetBranchId,
            stockLocationId: stockLocation._id,
            sku: cleanSku,
          }).session(session);

          const prevOnHand = balance ? balance.onHand : 0;
          const newOnHand = prevOnHand + acceptedQty;

          await StockBalance.findOneAndUpdate(
            {
              branchId: targetBranchId,
              stockLocationId: stockLocation._id,
              sku: cleanSku,
            },
            {
              $inc: { onHand: acceptedQty },
              $set: { variantId: variant?._id },
              $setOnInsert: { reserved: 0, reorderLevel: 5 },
            },
            { upsert: true, session }
          );

          // 2. Create StockMovement entry
          await StockMovement.create(
            [
              {
                movementNumber: await PurchasingService.generateSequentialNumber('MOV-REC', session),
                branchId: targetBranchId,
                stockLocationId: stockLocation._id,
                sku: cleanSku,
                movementType: STOCK_MOVEMENT_TYPES.PURCHASE_RECEIPT,
                quantityDifference: acceptedQty,
                previousBalance: prevOnHand,
                newBalance: newOnHand,
                referenceType: 'PURCHASE_ORDER',
                referenceId: order.orderNumber,
                reason: `Goods receipt ${grnNumber} against PO ${order.orderNumber}`,
                performedBy: userContext.loginId,
                timestamp: new Date(),
              },
            ],
            { session }
          );
        }

        // Update PO line received quantity
        poLine.receivedQuantity += recItem.quantityReceived;

        receiptLineItems.push({
          sku: cleanSku,
          variantId: variant?._id,
          productName: poLine.productName,
          brandName: poLine.brandName,
          categoryName: poLine.categoryName,
          sizeLabel: poLine.sizeLabel,
          thicknessLabel: poLine.thicknessLabel,
          quantityOrdered: poLine.orderedQuantity,
          quantityReceived: recItem.quantityReceived,
          damagedQuantity: damagedQty,
          unitCost: poLine.unitCost,
          lineTotal: lineCost,
        });
      }

      // Check whether PO is fully received or partially received
      const allFullyReceived = order.items.every((i) => i.receivedQuantity >= i.orderedQuantity);
      order.status = allFullyReceived ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED';
      await order.save({ session });

      // Create StockReceipt (GRN) document
      const [stockReceipt] = await StockReceipt.create(
        [
          {
            receiptNumber: grnNumber,
            purchaseOrderId: order._id,
            branchId: order.branchId,
            supplierId: order.supplierId,
            supplierReference: input.deliveryReference.trim(),
            stockLocationId: stockLocation._id,
            items: receiptLineItems,
            totalQuantity: totalAcceptedQty + totalDamagedQty,
            totalCost: totalCostPaisa,
            receivedBy: userContext.loginId,
            receivedDate: new Date(),
            status: 'COMPLETED',
            notes: input.notes?.trim() || `Delivery Ref: ${input.deliveryReference.trim()}`,
          },
        ],
        { session }
      );

      return {
        grn: stockReceipt,
        orderStatus: order.status,
        acceptedUnits: totalAcceptedQty,
        quarantineUnits: totalDamagedQty,
      };
    });
  }

  // ==========================================
  // 3. SUPPLIER BILLS & ACCOUNTS PAYABLE
  // ==========================================

  public static async createSupplierBill(
    input: CreateSupplierBillInput,
    userContext: UserContext
  ): Promise<ISupplierBill> {
    const supplier = await Supplier.findById(input.supplierId);
    if (!supplier) throw new AppError('Supplier not found.', 404, 'SUPPLIER_NOT_FOUND');

    let branchId = input.branchId;
    if (userContext.role === 'BRANCH') {
      branchId = userContext.branchId;
    } else if (!branchId) {
      const main = await Branch.findOne({ code: 'SHOP-12-14' });
      branchId = main ? main._id.toString() : undefined;
    }
    if (!branchId) throw new AppError('Branch identity is required.', 400, 'BRANCH_REQUIRED');

    // Prevent duplicate bill entry from the same supplier with identical invoice number
    const duplicateBill = await SupplierBill.findOne({
      supplierId: supplier._id,
      supplierInvoiceNumber: input.supplierInvoiceNumber.trim(),
      status: { $ne: 'CANCELLED' },
    });
    if (duplicateBill) {
      throw new AppError(
        `Supplier bill with invoice number '${input.supplierInvoiceNumber}' already exists for supplier '${supplier.name}'.`,
        409,
        'DUPLICATE_BILL'
      );
    }

    // Compute line totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    const billItems: any[] = [];

    for (const item of input.items) {
      const cleanSku = item.sku.toUpperCase().trim();
      const variant = await Variant.findOne({ sku: cleanSku }).populate('productId');
      const unitCost = Math.round(item.unitCost);
      const qty = item.quantity;
      const discount = Math.round(item.discount || 0);
      const tax = Math.round(item.tax || 0);
      const lineTotal = qty * unitCost - discount + tax;

      subtotal += qty * unitCost;
      totalDiscount += discount;
      totalTax += tax;

      billItems.push({
        sku: cleanSku,
        variantId: variant?._id,
        productName: (variant?.productId as any)?.name || cleanSku,
        quantity: qty,
        unitCost,
        discount,
        tax,
        total: lineTotal,
      });
    }

    const totalAmount = subtotal - totalDiscount + totalTax;

    return await runTransaction(async (session) => {
      const billNumber = await PurchasingService.generateSequentialNumber('BILL', session);

      // Create SupplierBill document
      const [bill] = await SupplierBill.create(
        [
          {
            billNumber,
            supplierInvoiceNumber: input.supplierInvoiceNumber.trim(),
            supplierId: supplier._id,
            branchId: new mongoose.Types.ObjectId(branchId),
            purchaseOrderId: input.purchaseOrderId ? new mongoose.Types.ObjectId(input.purchaseOrderId) : undefined,
            grnIds: (input.grnIds || []).map((id) => new mongoose.Types.ObjectId(id)),
            billDate: input.billDate ? new Date(input.billDate) : new Date(),
            dueDate: new Date(input.dueDate),
            items: billItems,
            subtotal,
            discountAmount: totalDiscount,
            taxAmount: totalTax,
            totalAmount,
            paidAmount: 0,
            balanceDue: totalAmount,
            status: 'POSTED',
            paymentStatus: 'UNPAID',
            createdBy: userContext.loginId,
            notes: input.notes?.trim(),
          },
        ],
        { session }
      );

      // Update supplier currentOutstanding atomically
      const updatedSupplier = await Supplier.findByIdAndUpdate(
        supplier._id,
        {
          $inc: {
            currentOutstanding: totalAmount,
            balancePayable: totalAmount,
          },
        },
        { new: true, session }
      );

      const runningBalance = updatedSupplier?.currentOutstanding || 0;

      // Post AP liability to SupplierLedger
      await SupplierLedgerEntry.create(
        [
          {
            supplierId: supplier._id,
            branchId: new mongoose.Types.ObjectId(branchId),
            entryDate: bill.billDate,
            entryType: 'BILL',
            referenceNumber: billNumber,
            referenceBillId: billNumber,
            debit: 0,
            credit: totalAmount,
            runningBalance,
            narration: `Supplier bill ${billNumber} (Inv #${input.supplierInvoiceNumber.trim()})`,
            performedBy: userContext.loginId,
            timestamp: new Date(),
          },
        ],
        { session }
      );

      return bill;
    });
  }

  public static async getSupplierBills(
    query: {
      supplierId?: string;
      branchId?: string;
      paymentStatus?: string;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    userContext: UserContext
  ) {
    const filter: Record<string, any> = {};

    if (userContext.role === 'BRANCH') {
      filter.branchId = userContext.branchId;
    } else if (query.branchId) {
      filter.branchId = query.branchId;
    }

    if (query.supplierId) filter.supplierId = query.supplierId;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus.toUpperCase();
    if (query.status) filter.status = query.status.toUpperCase();

    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ billNumber: regex }, { supplierInvoiceNumber: regex }];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const [bills, total] = await Promise.all([
      SupplierBill.find(filter)
        .populate('supplierId', 'code name phone email')
        .populate('branchId', 'code name city')
        .sort({ billDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupplierBill.countDocuments(filter),
    ]);

    return {
      bills,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================
  // 4. SUPPLIER PAYMENTS & SETTLEMENT
  // ==========================================

  public static async createSupplierPayment(
    input: CreateSupplierPaymentInput,
    userContext: UserContext
  ) {
    const supplier = await Supplier.findById(input.supplierId);
    if (!supplier) throw new AppError('Supplier not found.', 404, 'SUPPLIER_NOT_FOUND');

    let branchId = input.branchId;
    if (userContext.role === 'BRANCH') {
      branchId = userContext.branchId;
    } else if (!branchId) {
      const main = await Branch.findOne({ code: 'SHOP-12-14' });
      branchId = main ? main._id.toString() : undefined;
    }
    if (!branchId) throw new AppError('Branch identity is required.', 400, 'BRANCH_REQUIRED');

    const paymentAmount = Math.round(input.amount);
    if (paymentAmount <= 0) {
      throw new AppError('Payment amount must be greater than zero.', 400, 'INVALID_AMOUNT');
    }

    return await runTransaction(async (session) => {
      const paymentNumber = await PurchasingService.generateSequentialNumber('PAY-SUP', session);

      // Determine allocations: either manual or FIFO auto-allocation across unpaid bills
      let remainingToAllocate = paymentAmount;
      const appliedAllocations: Array<{
        billId: mongoose.Types.ObjectId;
        billNumber: string;
        supplierInvoiceNumber?: string;
        allocatedAmount: number;
        previousDue: number;
        newDue: number;
      }> = [];

      if (input.allocations && input.allocations.length > 0) {
        // Manual allocation validation
        let totalManualAllocated = 0;
        for (const alloc of input.allocations) {
          const bill = await SupplierBill.findById(alloc.billId).session(session);
          if (!bill) throw new AppError(`Bill '${alloc.billId}' not found.`, 404, 'BILL_NOT_FOUND');
          if (bill.supplierId.toString() !== supplier._id.toString()) {
            throw new AppError(`Bill '${bill.billNumber}' does not belong to supplier '${supplier.name}'.`, 400, 'BILL_SUPPLIER_MISMATCH');
          }
          if (bill.status === 'CANCELLED') {
            throw new AppError(`Cannot allocate payment to cancelled bill '${bill.billNumber}'.`, 400, 'BILL_CANCELLED');
          }

          const allocAmt = Math.round(alloc.allocatedAmount);
          if (allocAmt > bill.balanceDue) {
            throw new AppError(
              `Allocated amount (${allocAmt}) exceeds balance due (${bill.balanceDue}) on bill '${bill.billNumber}'.`,
              400,
              'OVERALLOCATION_NOT_ALLOWED'
            );
          }

          totalManualAllocated += allocAmt;
          const prevDue = bill.balanceDue;
          const newDue = prevDue - allocAmt;

          bill.paidAmount += allocAmt;
          bill.balanceDue = newDue;
          bill.paymentStatus = newDue === 0 ? 'PAID' : 'PARTIALLY_PAID';
          await bill.save({ session });

          appliedAllocations.push({
            billId: bill._id,
            billNumber: bill.billNumber,
            supplierInvoiceNumber: bill.supplierInvoiceNumber,
            allocatedAmount: allocAmt,
            previousDue: prevDue,
            newDue,
          });
        }

        if (totalManualAllocated > paymentAmount) {
          throw new AppError(
            `Total allocated amounts (${totalManualAllocated}) exceed total payment amount (${paymentAmount}).`,
            400,
            'ALLOCATION_EXCEEDS_PAYMENT'
          );
        }

        remainingToAllocate = paymentAmount - totalManualAllocated;
      } else {
        // Auto FIFO allocation: Find unpaid or partially paid bills ordered by dueDate
        const openBills = await SupplierBill.find({
          supplierId: supplier._id,
          status: 'POSTED',
          paymentStatus: { $in: ['UNPAID', 'PARTIALLY_PAID'] },
          balanceDue: { $gt: 0 },
        })
          .sort({ dueDate: 1, createdAt: 1 })
          .session(session);

        for (const bill of openBills) {
          if (remainingToAllocate <= 0) break;

          const allocAmt = Math.min(bill.balanceDue, remainingToAllocate);
          const prevDue = bill.balanceDue;
          const newDue = prevDue - allocAmt;

          bill.paidAmount += allocAmt;
          bill.balanceDue = newDue;
          bill.paymentStatus = newDue === 0 ? 'PAID' : 'PARTIALLY_PAID';
          await bill.save({ session });

          appliedAllocations.push({
            billId: bill._id,
            billNumber: bill.billNumber,
            supplierInvoiceNumber: bill.supplierInvoiceNumber,
            allocatedAmount: allocAmt,
            previousDue: prevDue,
            newDue,
          });

          remainingToAllocate -= allocAmt;
        }
      }

      const unallocatedAdvance = remainingToAllocate;

      // Create SupplierPayment record
      const [payment] = await SupplierPayment.create(
        [
          {
            paymentNumber,
            supplierId: supplier._id,
            branchId: new mongoose.Types.ObjectId(branchId),
            amount: paymentAmount,
            paymentMethod: input.paymentMethod || 'BANK_TRANSFER',
            reference: input.reference?.trim(),
            chequeDate: input.chequeDate ? new Date(input.chequeDate) : undefined,
            chequeStatus: input.paymentMethod === 'CHEQUE' ? 'PENDING_CLEARANCE' : undefined,
            allocations: appliedAllocations,
            unallocatedAdvance,
            paidBy: userContext.loginId,
            notes: input.notes?.trim(),
            paymentDate: new Date(),
          },
        ],
        { session }
      );

      // Total amount allocated towards open bills
      const allocatedTotal = appliedAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
      const advanceAmount = unallocatedAdvance;

      // Deduct payable from Supplier atomically up to currentOutstanding, and add any excess to unallocatedAdvances
      const currentPayable = Math.max(0, supplier.currentOutstanding || 0);
      const payableDeduction = Math.min(currentPayable, allocatedTotal);
      const excessToAdvance = advanceAmount + Math.max(0, allocatedTotal - payableDeduction);

      const updatedSupplier = await Supplier.findByIdAndUpdate(
        supplier._id,
        {
          $inc: {
            currentOutstanding: -payableDeduction,
            balancePayable: -payableDeduction,
            unallocatedAdvances: excessToAdvance,
          },
        },
        { new: true, session }
      );

      const runningBalance = updatedSupplier?.currentOutstanding || 0;

      // Post to SupplierLedger (debit reduces our payable)
      await SupplierLedgerEntry.create(
        [
          {
            supplierId: supplier._id,
            branchId: new mongoose.Types.ObjectId(branchId),
            entryDate: payment.paymentDate,
            entryType: unallocatedAdvance === paymentAmount ? 'ADVANCE' : 'PAYMENT',
            referenceNumber: paymentNumber,
            referencePaymentId: paymentNumber,
            debit: paymentAmount,
            credit: 0,
            runningBalance,
            narration: `Payment ${paymentNumber} via ${input.paymentMethod || 'BANK_TRANSFER'}${
              input.reference ? ` (Ref: ${input.reference.trim()})` : ''
            }`,
            performedBy: userContext.loginId,
            timestamp: new Date(),
          },
        ],
        { session }
      );

      return payment;
    });
  }

  // ==========================================
  // 5. PURCHASE RETURNS & DEBIT NOTES
  // ==========================================

  public static async createPurchaseReturn(
    input: CreatePurchaseReturnInput,
    userContext: UserContext
  ) {
    const supplier = await Supplier.findById(input.supplierId);
    if (!supplier) throw new AppError('Supplier not found.', 404, 'SUPPLIER_NOT_FOUND');

    let branchId = input.branchId;
    if (userContext.role === 'BRANCH') {
      branchId = userContext.branchId;
    } else if (!branchId) {
      const main = await Branch.findOne({ code: 'SHOP-12-14' });
      branchId = main ? main._id.toString() : undefined;
    }
    if (!branchId) throw new AppError('Branch identity is required.', 400, 'BRANCH_REQUIRED');

    // Stock location verification
    let stockLocationId = input.stockLocationId;
    if (!stockLocationId) {
      const defaultLoc = await StockLocation.findOne({
        branchId,
        isActive: true,
      });
      if (!defaultLoc) throw new AppError('Active stock location required.', 404, 'LOCATION_NOT_FOUND');
      stockLocationId = defaultLoc._id.toString();
    }

    const location = await StockLocation.findOne({
      _id: stockLocationId,
      branchId,
    });
    if (!location) {
      throw new AppError('Stock location does not belong to authorized branch.', 403, 'INVALID_LOCATION');
    }

    return await runTransaction(async (session) => {
      const returnNumber = await PurchasingService.generateSequentialNumber('RET', session);
      const debitNoteNumber = await PurchasingService.generateSequentialNumber('DN', session);

      let totalReturnCost = 0;
      const returnItems: any[] = [];

      for (const item of input.items) {
        const cleanSku = item.sku.toUpperCase().trim();
        const variant = await Variant.findOne({ sku: cleanSku }).populate('productId').session(session);
        if (!variant) throw new AppError(`Variant '${cleanSku}' not found.`, 404, 'VARIANT_NOT_FOUND');

        const unitCost = Math.round(item.unitCost ?? variant.purchasePrice ?? 0);
        const lineTotal = item.quantity * unitCost;
        totalReturnCost += lineTotal;

        // Verify available stock before deducting
        const currentBalance = await StockBalance.findOne({
          branchId,
          stockLocationId: location._id,
          sku: cleanSku,
        }).session(session);

        const availableOnHand = currentBalance?.onHand || 0;
        if (availableOnHand < item.quantity) {
          throw new AppError(
            `Insufficient stock to return for SKU '${cleanSku}'. Current onHand is ${availableOnHand}, requested return is ${item.quantity}.`,
            400,
            'INSUFFICIENT_STOCK_TO_RETURN'
          );
        }

        // Deduct physical inventory atomically
        const updatedBalance = await StockBalance.findOneAndUpdate(
          {
            branchId,
            stockLocationId: location._id,
            sku: cleanSku,
            onHand: { $gte: item.quantity },
          },
          { $inc: { onHand: -item.quantity } },
          { new: true, session }
        );

        if (!updatedBalance) {
          throw new AppError(
            `Concurrent stock deduction conflict for SKU '${cleanSku}'. Please retry.`,
            409,
            'STOCK_CONCURRENCY_ERROR'
          );
        }

        // Create StockMovement record
        await StockMovement.create(
          [
            {
              movementNumber: await PurchasingService.generateSequentialNumber('MOV-RET', session),
              branchId,
              stockLocationId: location._id,
              sku: cleanSku,
              movementType: STOCK_MOVEMENT_TYPES.PURCHASE_RETURN,
              quantityDifference: -item.quantity,
              previousBalance: availableOnHand,
              newBalance: updatedBalance.onHand,
              referenceType: 'PURCHASE_RETURN',
              referenceId: returnNumber,
              reason: `Purchase return ${returnNumber} to supplier ${supplier.name} (${input.reason})`,
              performedBy: userContext.loginId,
              timestamp: new Date(),
            },
          ],
          { session }
        );

        returnItems.push({
          sku: cleanSku,
          variantId: variant._id,
          productName: (variant.productId as any)?.name || cleanSku,
          quantity: item.quantity,
          unitCost,
          totalCost: lineTotal,
          reason: item.reason?.trim() || input.reason.trim(),
        });
      }

      // Create PurchaseReturn document
      const [purchaseReturn] = await PurchaseReturn.create(
        [
          {
            returnNumber,
            debitNoteNumber,
            supplierId: supplier._id,
            branchId: new mongoose.Types.ObjectId(branchId),
            stockLocationId: location._id,
            purchaseOrderId: input.purchaseOrderId ? new mongoose.Types.ObjectId(input.purchaseOrderId) : undefined,
            billId: input.billId ? new mongoose.Types.ObjectId(input.billId) : undefined,
            receiptId: input.receiptId ? new mongoose.Types.ObjectId(input.receiptId) : undefined,
            items: returnItems,
            totalAmount: totalReturnCost,
            returnDate: new Date(),
            reason: input.reason.trim(),
            status: 'COMPLETED',
            processedBy: userContext.loginId,
            notes: input.notes?.trim(),
          },
        ],
        { session }
      );

      // Deduct payable from Supplier up to currentOutstanding, and add any excess to supplierCreditBalance (refund receivable)
      const currentPayable = Math.max(0, supplier.currentOutstanding || 0);
      const payableDeduction = Math.min(currentPayable, totalReturnCost);
      const creditToAdd = totalReturnCost - payableDeduction;

      const updatedSupplier = await Supplier.findByIdAndUpdate(
        supplier._id,
        {
          $inc: {
            currentOutstanding: -payableDeduction,
            balancePayable: -payableDeduction,
            supplierCreditBalance: creditToAdd,
          },
        },
        { new: true, session }
      );

      // If returning against a specific bill, reduce bill amountDue
      if (input.billId) {
        const targetBill = await SupplierBill.findById(input.billId).session(session);
        if (targetBill && targetBill.status === 'POSTED') {
          const billDeduction = Math.min(targetBill.balanceDue, totalReturnCost);
          const newBalanceDue = targetBill.balanceDue - billDeduction;
          targetBill.balanceDue = newBalanceDue;
          if (newBalanceDue === 0) {
            targetBill.paymentStatus = 'PAID';
          }
          await targetBill.save({ session });
        }
      }

      const runningBalance = updatedSupplier?.currentOutstanding || 0;

      // Post Debit Note to SupplierLedger (debit reduces our payable)
      await SupplierLedgerEntry.create(
        [
          {
            supplierId: supplier._id,
            branchId: new mongoose.Types.ObjectId(branchId),
            entryDate: purchaseReturn.returnDate,
            entryType: 'DEBIT_NOTE',
            referenceNumber: debitNoteNumber,
            debit: totalReturnCost,
            credit: 0,
            runningBalance,
            narration: `Debit Note ${debitNoteNumber} for Purchase Return ${returnNumber} - ${input.reason.trim()}`,
            performedBy: userContext.loginId,
            timestamp: new Date(),
          },
        ],
        { session }
      );

      return purchaseReturn;
    });
  }

  // ==========================================
  // 6. PURCHASING SUMMARY & METRICS
  // ==========================================

  public static async getPurchasingSummary(userContext: UserContext) {
    const filter: Record<string, any> = {};
    if (userContext.role === 'BRANCH') {
      filter.branchId = userContext.branchId;
    }

    const now = new Date();

    const [
      totalOrders,
      pendingApprovalOrders,
      totalReceivedCount,
      totalBills,
      totalPayments,
      overdueBills,
      suppliersCount,
    ] = await Promise.all([
      PurchaseOrder.countDocuments(filter),
      PurchaseOrder.countDocuments({ ...filter, status: 'PENDING_APPROVAL' }),
      StockReceipt.countDocuments(filter),
      SupplierBill.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalValue: { $sum: '$totalAmount' },
            totalBalanceDue: { $sum: '$balanceDue' },
            count: { $sum: 1 },
          },
        },
      ]),
      SupplierPayment.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalPaid: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      SupplierBill.aggregate([
        {
          $match: {
            ...filter,
            paymentStatus: { $in: ['UNPAID', 'PARTIALLY_PAID'] },
            status: 'POSTED',
            dueDate: { $lt: now },
          },
        },
        {
          $group: {
            _id: null,
            overdueAmount: { $sum: '$balanceDue' },
            count: { $sum: 1 },
          },
        },
      ]),
      Supplier.countDocuments({ status: 'ACTIVE' }),
    ]);

    const billMetrics = totalBills[0] || { totalValue: 0, totalBalanceDue: 0, count: 0 };
    const paymentMetrics = totalPayments[0] || { totalPaid: 0, count: 0 };
    const overdueMetrics = overdueBills[0] || { overdueAmount: 0, count: 0 };

    return {
      totalOrders,
      pendingApprovalOrders,
      totalGoodsReceipts: totalReceivedCount,
      totalBilledAmount: billMetrics.totalValue,
      totalBalanceDue: billMetrics.totalBalanceDue,
      totalPaidAmount: paymentMetrics.totalPaid,
      totalOverdueAmount: overdueMetrics.overdueAmount,
      overdueBillsCount: overdueMetrics.count,
      activeSuppliersCount: suppliersCount,
    };
  }
}
