import mongoose from 'mongoose';
import { StockBalance, IStockBalance } from '../../models/stockBalance.model.js';
import { StockLocation } from '../../models/stockLocation.model.js';
import { StockMovement } from '../../models/stockMovement.model.js';
import { StockReceipt } from '../../models/stockReceipt.model.js';
import { StockAdjustment } from '../../models/stockAdjustment.model.js';
import { StockTransfer, TRANSFER_STATUSES } from '../../models/stockTransfer.model.js';
import { Variant } from '../../models/variant.model.js';
import { Branch } from '../../models/branch.model.js';
import { IdempotencyKey } from '../../models/idempotencyKey.model.js';
import { STOCK_MOVEMENT_TYPES } from '../../constants/index.js';
import { AppError } from '../../utils/apiResponse.js';
import { runTransaction } from '../../utils/transaction.js';

export interface UserContext {
  accountId: string;
  loginId: string;
  role: string;
  branchId?: string;
}

export class InventoryService {
  /**
   * Helper: Generate unique audit/receipt numbers
   */
  private static generateDocNumber(prefix: string): string {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${dateStr}-${rand}`;
  }

  // ==========================================
  // 1. STOCK BALANCES
  // ==========================================

  public static async getStockBalances(
    query: {
      branchId?: string;
      stockLocationId?: string;
      sku?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    userContext: UserContext
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    // Branch Isolation
    if (userContext.role !== 'SUPER_ADMIN') {
      if (!userContext.branchId) {
        throw new AppError('Branch user is not bound to a valid branch.', 403, 'UNBOUND_BRANCH');
      }
      filter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    } else if (query.branchId) {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    if (query.stockLocationId) {
      filter.stockLocationId = new mongoose.Types.ObjectId(query.stockLocationId);
    }

    if (query.sku) {
      filter.sku = query.sku.toUpperCase();
    } else if (query.search) {
      filter.sku = { $regex: query.search.trim(), $options: 'i' };
    }

    const [total, balances] = await Promise.all([
      StockBalance.countDocuments(filter),
      StockBalance.find(filter)
        .populate('branchId', 'name code shopNumber city')
        .populate('stockLocationId', 'name code type')
        .populate({
          path: 'variantId',
          select: 'sku listPrice retailPrice wholesalePrice distributorPrice status',
          populate: [
            {
              path: 'productId',
              select: 'name',
              populate: [
                { path: 'brandId', select: 'name code' },
                { path: 'categoryId', select: 'name code' },
              ],
            },
            { path: 'sizeId', select: 'displayLabel length width' },
            { path: 'thicknessId', select: 'displayLabel value' },
          ],
        })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    const mapped = balances.map((b) => {
      const onHand = b.onHand || 0;
      const reserved = b.reserved || 0;
      const available = Math.max(0, onHand - reserved);
      return {
        id: b._id.toString(),
        branchId: (b.branchId as any)?._id?.toString() || b.branchId?.toString(),
        branch: b.branchId,
        stockLocationId: (b.stockLocationId as any)?._id?.toString() || b.stockLocationId?.toString(),
        stockLocation: b.stockLocationId,
        sku: b.sku,
        variantId: (b.variantId as any)?._id?.toString() || b.variantId?.toString(),
        variant: b.variantId,
        onHand,
        reserved,
        available,
        reorderLevel: b.reorderLevel ?? 5,
        updatedAt: b.updatedAt,
      };
    });

    return {
      balances: mapped,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public static async getStockBySku(sku: string, userContext: UserContext) {
    const cleanSku = sku.toUpperCase().trim();
    const filter: Record<string, unknown> = { sku: cleanSku };

    if (userContext.role !== 'SUPER_ADMIN') {
      if (!userContext.branchId) {
        throw new AppError('Branch user is not bound to a valid branch.', 403, 'UNBOUND_BRANCH');
      }
      filter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    }

    const balances = await StockBalance.find(filter)
      .populate('branchId', 'name code shopNumber city')
      .populate('stockLocationId', 'name code type');

    return balances.map((b) => ({
      id: b._id.toString(),
      branchId: (b.branchId as any)?._id?.toString() || b.branchId?.toString(),
      branch: b.branchId,
      stockLocationId: (b.stockLocationId as any)?._id?.toString() || b.stockLocationId?.toString(),
      stockLocation: b.stockLocationId,
      sku: b.sku,
      onHand: b.onHand,
      reserved: b.reserved,
      available: Math.max(0, b.onHand - b.reserved),
      reorderLevel: b.reorderLevel,
      updatedAt: b.updatedAt,
    }));
  }

  public static async getStockLocations(branchId: string | undefined, userContext: UserContext) {
    const filter: Record<string, unknown> = { isActive: true };

    if (userContext.role !== 'SUPER_ADMIN') {
      filter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    } else if (branchId) {
      filter.branchId = new mongoose.Types.ObjectId(branchId);
    }

    const locations = await StockLocation.find(filter)
      .populate('branchId', 'name code shopNumber')
      .sort({ code: 1 });

    return locations.map((l) => ({
      id: l._id.toString(),
      branchId: (l.branchId as any)?._id?.toString() || l.branchId?.toString(),
      branch: l.branchId,
      code: l.code,
      name: l.name,
      type: l.type,
      isActive: l.isActive,
    }));
  }

  public static async updateMinimumStock(
    skuOrId: string,
    reorderLevel: number,
    locationId: string | undefined,
    branchId: string | undefined,
    userContext: UserContext
  ) {
    const filter: Record<string, unknown> = {};

    // Check if skuOrId is an ObjectId or SKU
    if (mongoose.Types.ObjectId.isValid(skuOrId)) {
      const v = await Variant.findById(skuOrId);
      if (v) {
        filter.sku = v.sku;
      } else {
        filter._id = new mongoose.Types.ObjectId(skuOrId);
      }
    } else {
      filter.sku = skuOrId.toUpperCase().trim();
    }

    if (userContext.role !== 'SUPER_ADMIN') {
      filter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    } else if (branchId) {
      filter.branchId = new mongoose.Types.ObjectId(branchId);
    }

    if (locationId) {
      filter.stockLocationId = new mongoose.Types.ObjectId(locationId);
    }

    const updated = await StockBalance.updateMany(filter, {
      $set: { reorderLevel },
    });

    return {
      success: true,
      modifiedCount: updated.modifiedCount,
      reorderLevel,
    };
  }

  // ==========================================
  // 2. OPENING STOCK POSTING
  // ==========================================

  public static async postOpeningStock(
    input: {
      branchId?: string;
      stockLocationId: string;
      sku: string;
      quantity: number;
      minimumStock?: number;
      notes?: string;
    },
    userContext: UserContext
  ) {
    const cleanSku = input.sku.toUpperCase().trim();

    // Determine target branch
    let targetBranchId: string;
    if (userContext.role === 'SUPER_ADMIN') {
      targetBranchId = input.branchId || '';
      if (!targetBranchId) {
        const loc = await StockLocation.findById(input.stockLocationId);
        if (!loc) throw new AppError('Stock location not found.', 404, 'LOCATION_NOT_FOUND');
        targetBranchId = loc.branchId.toString();
      }
    } else {
      targetBranchId = userContext.branchId || '';
    }

    if (!targetBranchId) {
      throw new AppError('Branch identity could not be established.', 400, 'BRANCH_REQUIRED');
    }

    // Verify Variant exists
    const variant = await Variant.findOne({ sku: cleanSku });
    if (!variant) {
      throw new AppError(`SKU '${cleanSku}' does not exist in product catalogue.`, 404, 'SKU_NOT_FOUND');
    }

    // Verify StockLocation
    const location = await StockLocation.findOne({
      _id: input.stockLocationId,
      branchId: targetBranchId,
    });
    if (!location) {
      throw new AppError('Stock location does not belong to authorized branch.', 403, 'INVALID_LOCATION');
    }

    // Execute atomic opening stock transaction
    return await runTransaction(async (session) => {
      // 1. Guard against duplicate opening stock
      const existingMovement = await StockMovement.findOne({
        branchId: targetBranchId,
        stockLocationId: location._id,
        sku: cleanSku,
        movementType: STOCK_MOVEMENT_TYPES.OPENING_BALANCE,
      }).session(session);

      if (existingMovement) {
        throw new AppError(
          `Opening stock has already been posted for SKU ${cleanSku} at location ${location.code}.`,
          409,
          'DUPLICATE_OPENING_STOCK'
        );
      }

      // 2. Upsert StockBalance
      const existingBalance = await StockBalance.findOne({
        branchId: targetBranchId,
        stockLocationId: location._id,
        sku: cleanSku,
      }).session(session);

      const previousOnHand = existingBalance ? existingBalance.onHand : 0;
      const newOnHand = previousOnHand + input.quantity;

      const balance = await StockBalance.findOneAndUpdate(
        {
          branchId: targetBranchId,
          stockLocationId: location._id,
          sku: cleanSku,
        },
        {
          $set: {
            variantId: variant._id,
            onHand: newOnHand,
            reorderLevel: input.minimumStock ?? 5,
          },
          $setOnInsert: {
            reserved: 0,
          },
        },
        { upsert: true, new: true, session }
      );

      // 3. Create immutable StockMovement
      const movement = await StockMovement.create(
        [
          {
            movementNumber: this.generateDocNumber('MOV-OP'),
            branchId: targetBranchId,
            stockLocationId: location._id,
            sku: cleanSku,
            movementType: STOCK_MOVEMENT_TYPES.OPENING_BALANCE,
            quantityDifference: input.quantity,
            previousBalance: previousOnHand,
            newBalance: newOnHand,
            referenceType: 'OPENING_BALANCE',
            referenceId: balance._id.toString(),
            reason: input.notes || 'Opening stock initialization',
            performedBy: userContext.loginId,
            timestamp: new Date(),
          },
        ],
        { session }
      );

      return {
        balance: {
          id: balance._id.toString(),
          sku: balance.sku,
          onHand: balance.onHand,
          reorderLevel: balance.reorderLevel,
        },
        movement: movement[0],
      };
    }, { strict: true });
  }

  // ==========================================
  // 3. STOCK RECEIVING (GOODS RECEIVING)
  // ==========================================

  public static async createStockReceipt(
    input: {
      branchId?: string;
      stockLocationId: string;
      receiptNumber?: string;
      supplierId?: string;
      supplierReference?: string;
      receivedDate?: string;
      items: Array<{
        sku: string;
        quantityOrdered?: number;
        quantityReceived: number;
        unitCost?: number;
      }>;
      idempotencyKey?: string;
      notes?: string;
    },
    userContext: UserContext
  ) {
    // Idempotency check
    if (input.idempotencyKey) {
      const existingKey = await IdempotencyKey.findOne({ key: input.idempotencyKey });
      if (existingKey && existingKey.status === 'RESOLVED') {
        return existingKey.responseBody;
      }
    }

    // Determine target branch
    let targetBranchId: string;
    if (userContext.role === 'SUPER_ADMIN') {
      targetBranchId = input.branchId || '';
      if (!targetBranchId) {
        const loc = await StockLocation.findById(input.stockLocationId);
        if (!loc) throw new AppError('Stock location not found.', 404, 'LOCATION_NOT_FOUND');
        targetBranchId = loc.branchId.toString();
      }
    } else {
      targetBranchId = userContext.branchId || '';
    }

    if (!targetBranchId) {
      throw new AppError('Branch identity could not be established.', 400, 'BRANCH_REQUIRED');
    }

    // Verify StockLocation
    const location = await StockLocation.findOne({
      _id: input.stockLocationId,
      branchId: targetBranchId,
    });
    if (!location) {
      throw new AppError('Destination stock location does not belong to authorized branch.', 403, 'INVALID_LOCATION');
    }

    // Validate SKUs and Quantities
    for (const item of input.items) {
      if (item.quantityReceived <= 0) {
        throw new AppError(`Item '${item.sku}' received quantity must be positive.`, 400, 'INVALID_QUANTITY');
      }
      const v = await Variant.findOne({ sku: item.sku.toUpperCase().trim() });
      if (!v) {
        throw new AppError(`SKU '${item.sku}' not found in active product catalogue.`, 404, 'SKU_NOT_FOUND');
      }
    }

    const receiptNum = input.receiptNumber || this.generateDocNumber('REC');

    // Run ACID transaction for goods receiving
    const result = await runTransaction(async (session) => {
      // Prevent duplicate receipt posting
      const dupReceipt = await StockReceipt.findOne({ receiptNumber: receiptNum }).session(session);
      if (dupReceipt) {
        throw new AppError(`Receipt '${receiptNum}' has already been processed.`, 409, 'DUPLICATE_RECEIPT');
      }

      let totalQty = 0;
      let totalCost = 0;
      const receiptItems = [];

      for (const item of input.items) {
        const cleanSku = item.sku.toUpperCase().trim();
        const qty = item.quantityReceived;
        const cost = item.unitCost || 0;
        const lineTotal = qty * cost;

        totalQty += qty;
        totalCost += lineTotal;

        const variant = await Variant.findOne({ sku: cleanSku }).session(session);

        // Fetch current onHand
        const currentBalance = await StockBalance.findOne({
          branchId: targetBranchId,
          stockLocationId: location._id,
          sku: cleanSku,
        }).session(session);

        const previousOnHand = currentBalance ? currentBalance.onHand : 0;
        const newOnHand = previousOnHand + qty;

        // Atomic update of StockBalance
        await StockBalance.findOneAndUpdate(
          {
            branchId: targetBranchId,
            stockLocationId: location._id,
            sku: cleanSku,
          },
          {
            $inc: { onHand: qty },
            $set: { variantId: variant?._id },
            $setOnInsert: { reserved: 0, reorderLevel: 5 },
          },
          { upsert: true, session, new: true }
        );

        // Create immutable StockMovement
        await StockMovement.create(
          [
            {
              movementNumber: this.generateDocNumber('MOV-RC'),
              branchId: targetBranchId,
              stockLocationId: location._id,
              sku: cleanSku,
              movementType: STOCK_MOVEMENT_TYPES.PURCHASE_RECEIPT,
              quantityDifference: qty,
              previousBalance: previousOnHand,
              newBalance: newOnHand,
              referenceType: 'STOCK_RECEIPT',
              referenceId: receiptNum,
              reason: input.notes || `Goods receipt from supplier`,
              performedBy: userContext.loginId,
              timestamp: new Date(),
            },
          ],
          { session }
        );

        receiptItems.push({
          sku: cleanSku,
          variantId: variant?._id,
          quantityOrdered: item.quantityOrdered || qty,
          quantityReceived: qty,
          unitCost: cost,
          lineTotal,
        });
      }

      const receipt = await StockReceipt.create(
        [
          {
            receiptNumber: receiptNum,
            branchId: targetBranchId,
            supplierId: input.supplierId ? new mongoose.Types.ObjectId(input.supplierId) : undefined,
            supplierReference: input.supplierReference,
            stockLocationId: location._id,
            items: receiptItems,
            totalQuantity: totalQty,
            totalCost,
            receivedBy: userContext.loginId,
            receivedDate: input.receivedDate ? new Date(input.receivedDate) : new Date(),
            status: 'COMPLETED',
            notes: input.notes,
          },
        ],
        { session }
      );

      return receipt[0];
    }, { strict: true });

    // Save Idempotency response if key provided
    if (input.idempotencyKey) {
      await IdempotencyKey.findOneAndUpdate(
        { key: input.idempotencyKey },
        {
          key: input.idempotencyKey,
          endpoint: '/inventory/receipts',
          accountId: new mongoose.Types.ObjectId(userContext.accountId),
          requestHash: 'receipt-' + receiptNum,
          responseStatus: 201,
          responseBody: result,
          status: 'RESOLVED',
        },
        { upsert: true }
      );
    }

    return result;
  }

  public static async getStockReceipts(
    query: {
      branchId?: string;
      supplierId?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    },
    userContext: UserContext
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (userContext.role !== 'SUPER_ADMIN') {
      filter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    } else if (query.branchId) {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    if (query.supplierId) {
      filter.supplierId = new mongoose.Types.ObjectId(query.supplierId);
    }

    if (query.dateFrom || query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (query.dateFrom) dateFilter.$gte = new Date(query.dateFrom);
      if (query.dateTo) dateFilter.$lte = new Date(query.dateTo);
      filter.receivedDate = dateFilter;
    }

    const [total, receipts] = await Promise.all([
      StockReceipt.countDocuments(filter),
      StockReceipt.find(filter)
        .populate('branchId', 'name code shopNumber')
        .populate('supplierId', 'name contactPerson')
        .populate('stockLocationId', 'name code')
        .sort({ receivedDate: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return {
      receipts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public static async getStockReceiptById(id: string, userContext: UserContext) {
    const receipt = await StockReceipt.findById(id)
      .populate('branchId', 'name code shopNumber')
      .populate('supplierId', 'name contactPerson phone')
      .populate('stockLocationId', 'name code');

    if (!receipt) throw new AppError('Stock receipt not found.', 404, 'RECEIPT_NOT_FOUND');

    if (userContext.role !== 'SUPER_ADMIN' && receipt.branchId?._id?.toString() !== userContext.branchId) {
      throw new AppError('Unauthorized access to receipt for another branch.', 403, 'FORBIDDEN_BRANCH');
    }

    return receipt;
  }

  // ==========================================
  // 4. STOCK ADJUSTMENTS (MANAGE STOCK)
  // ==========================================

  public static async createAdjustments(
    input: {
      branchId?: string;
      stockLocationId: string;
      items: Array<{
        sku: string;
        newPhysicalQuantity: number;
        adjustmentType?: 'PHYSICAL_COUNT' | 'ADMINISTRATIVE' | 'DAMAGE_WRITE_OFF';
        reason: string;
      }>;
      idempotencyKey?: string;
    },
    userContext: UserContext
  ) {
    if (input.idempotencyKey) {
      const existingKey = await IdempotencyKey.findOne({ key: input.idempotencyKey });
      if (existingKey && existingKey.status === 'RESOLVED') {
        return existingKey.responseBody;
      }
    }

    // Determine target branch
    let targetBranchId: string;
    if (userContext.role === 'SUPER_ADMIN') {
      targetBranchId = input.branchId || '';
      if (!targetBranchId) {
        const loc = await StockLocation.findById(input.stockLocationId);
        if (!loc) throw new AppError('Stock location not found.', 404, 'LOCATION_NOT_FOUND');
        targetBranchId = loc.branchId.toString();
      }
    } else {
      targetBranchId = userContext.branchId || '';
    }

    if (!targetBranchId) {
      throw new AppError('Branch identity could not be established.', 400, 'BRANCH_REQUIRED');
    }

    // Verify destination location
    const location = await StockLocation.findOne({
      _id: input.stockLocationId,
      branchId: targetBranchId,
    });
    if (!location) {
      throw new AppError('Stock location does not belong to authorized branch.', 403, 'INVALID_LOCATION');
    }

    // Execute atomic reconciliation
    const adjNum = this.generateDocNumber('ADJ');

    const result = await runTransaction(async (session) => {
      const adjustmentsCreated = [];

      for (const item of input.items) {
        const cleanSku = item.sku.toUpperCase().trim();
        const newQty = item.newPhysicalQuantity;

        if (newQty < 0) {
          throw new AppError(`Physical stock for SKU '${cleanSku}' cannot be negative.`, 400, 'NEGATIVE_STOCK_FORBIDDEN');
        }

        const variant = await Variant.findOne({ sku: cleanSku }).session(session);

        const currentBalance = await StockBalance.findOne({
          branchId: targetBranchId,
          stockLocationId: location._id,
          sku: cleanSku,
        }).session(session);

        const currentOnHand = currentBalance ? currentBalance.onHand : 0;
        const currentReserved = currentBalance ? currentBalance.reserved : 0;

        if (newQty < currentReserved) {
          throw new AppError(
            `New physical quantity (${newQty}) cannot be lower than existing reserved stock (${currentReserved}) for SKU ${cleanSku}.`,
            400,
            'RESERVED_STOCK_VIOLATION'
          );
        }

        const diff = newQty - currentOnHand;

        // Concurrency-safe atomic update
        await StockBalance.findOneAndUpdate(
          {
            branchId: targetBranchId,
            stockLocationId: location._id,
            sku: cleanSku,
          },
          {
            $set: {
              onHand: newQty,
              variantId: variant?._id,
            },
            $setOnInsert: {
              reserved: 0,
              reorderLevel: 5,
            },
          },
          { upsert: true, session, new: true }
        );

        if (diff !== 0) {
          // Record adjustment document
          const adjDoc = await StockAdjustment.create(
            [
              {
                adjustmentNumber: `${adjNum}-${cleanSku}`,
                branchId: targetBranchId,
                stockLocationId: location._id,
                sku: cleanSku,
                adjustmentType: item.adjustmentType || 'PHYSICAL_COUNT',
                quantityDifference: diff,
                reason: item.reason,
                authorizedBy: userContext.loginId,
                timestamp: new Date(),
              },
            ],
            { session }
          );

          // Record immutable movement ledger
          const movementType =
            item.adjustmentType === 'DAMAGE_WRITE_OFF'
              ? STOCK_MOVEMENT_TYPES.ADMINISTRATIVE_ADJUSTMENT
              : STOCK_MOVEMENT_TYPES.PHYSICAL_COUNT;

          await StockMovement.create(
            [
              {
                movementNumber: this.generateDocNumber('MOV-ADJ'),
                branchId: targetBranchId,
                stockLocationId: location._id,
                sku: cleanSku,
                movementType,
                quantityDifference: diff,
                previousBalance: currentOnHand,
                newBalance: newQty,
                referenceType: 'STOCK_ADJUSTMENT',
                referenceId: `${adjNum}-${cleanSku}`,
                reason: item.reason,
                performedBy: userContext.loginId,
                timestamp: new Date(),
              },
            ],
            { session }
          );

          adjustmentsCreated.push(adjDoc[0]);
        }
      }

      return {
        adjustmentBatch: adjNum,
        adjustedItemsCount: adjustmentsCreated.length,
        totalItemsProcessed: input.items.length,
      };
    }, { strict: true });

    if (input.idempotencyKey) {
      await IdempotencyKey.findOneAndUpdate(
        { key: input.idempotencyKey },
        {
          key: input.idempotencyKey,
          endpoint: '/inventory/adjustments',
          accountId: new mongoose.Types.ObjectId(userContext.accountId),
          requestHash: 'adj-' + adjNum,
          responseStatus: 201,
          responseBody: result,
          status: 'RESOLVED',
        },
        { upsert: true }
      );
    }

    return result;
  }

  public static async getAdjustments(
    query: { branchId?: string; page?: number; limit?: number },
    userContext: UserContext
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (userContext.role !== 'SUPER_ADMIN') {
      filter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    } else if (query.branchId) {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    const [total, adjustments] = await Promise.all([
      StockAdjustment.countDocuments(filter),
      StockAdjustment.find(filter)
        .populate('branchId', 'name code shopNumber')
        .populate('stockLocationId', 'name code')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return {
      adjustments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ==========================================
  // 5. STOCK TRANSFERS (BRANCH-TO-BRANCH)
  // ==========================================

  public static async createTransfer(
    input: {
      fromBranchId?: string;
      toBranchId: string;
      fromStockLocationId: string;
      toStockLocationId: string;
      items: Array<{ sku: string; quantity: number }>;
      notes?: string;
    },
    userContext: UserContext
  ) {
    let sourceBranchId: string;
    if (userContext.role === 'SUPER_ADMIN') {
      sourceBranchId = input.fromBranchId || '';
      if (!sourceBranchId) {
        const loc = await StockLocation.findById(input.fromStockLocationId);
        if (!loc) throw new AppError('Source location not found.', 404, 'LOCATION_NOT_FOUND');
        sourceBranchId = loc.branchId.toString();
      }
    } else {
      sourceBranchId = userContext.branchId || '';
    }

    if (!sourceBranchId) {
      throw new AppError('Source branch must be specified.', 400, 'SOURCE_BRANCH_REQUIRED');
    }

    if (sourceBranchId === input.toBranchId && input.fromStockLocationId === input.toStockLocationId) {
      throw new AppError('Source and destination locations cannot be identical.', 400, 'SAME_LOCATION');
    }

    // Verify source location
    const fromLoc = await StockLocation.findOne({
      _id: input.fromStockLocationId,
      branchId: sourceBranchId,
    });
    if (!fromLoc) {
      throw new AppError('Source stock location does not belong to source branch.', 403, 'INVALID_SOURCE_LOCATION');
    }

    // Verify destination location
    const toLoc = await StockLocation.findOne({
      _id: input.toStockLocationId,
      branchId: input.toBranchId,
    });
    if (!toLoc) {
      throw new AppError('Destination location does not belong to destination branch.', 400, 'INVALID_DEST_LOCATION');
    }

    // Validate available stock for each transfer item
    const transferItems = [];
    for (const item of input.items) {
      const cleanSku = item.sku.toUpperCase().trim();
      const variant = await Variant.findOne({ sku: cleanSku });
      if (!variant) throw new AppError(`SKU '${cleanSku}' not found.`, 404, 'SKU_NOT_FOUND');

      const bal = await StockBalance.findOne({
        branchId: sourceBranchId,
        stockLocationId: fromLoc._id,
        sku: cleanSku,
      });

      const onHand = bal ? bal.onHand : 0;
      const reserved = bal ? bal.reserved : 0;
      const available = Math.max(0, onHand - reserved);

      if (available < item.quantity) {
        throw new AppError(
          `Insufficient available stock for SKU '${cleanSku}' at source location (Available: ${available}, Requested: ${item.quantity}).`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }

      transferItems.push({
        sku: cleanSku,
        variantId: variant._id,
        quantity: item.quantity,
      });
    }

    const transferNum = this.generateDocNumber('TRF');

    const transfer = await StockTransfer.create({
      transferNumber: transferNum,
      fromBranchId: new mongoose.Types.ObjectId(sourceBranchId),
      toBranchId: new mongoose.Types.ObjectId(input.toBranchId),
      fromStockLocationId: fromLoc._id,
      toStockLocationId: toLoc._id,
      items: transferItems,
      status: TRANSFER_STATUSES.PENDING_APPROVAL,
      initiatedBy: userContext.loginId,
      notes: input.notes,
    });

    return transfer;
  }

  public static async approveTransfer(transferId: string, userContext: UserContext) {
    return await runTransaction(async (session) => {
      const transfer = await StockTransfer.findById(transferId).session(session);
      if (!transfer) throw new AppError('Transfer not found.', 404, 'TRANSFER_NOT_FOUND');

      if (
        transfer.status !== TRANSFER_STATUSES.PENDING_APPROVAL &&
        transfer.status !== TRANSFER_STATUSES.DRAFT
      ) {
        throw new AppError(`Cannot approve transfer in status '${transfer.status}'.`, 400, 'INVALID_TRANSFER_STATUS');
      }

      // Check stock availability and atomically reserve at source
      for (const item of transfer.items) {
        const updated = await StockBalance.findOneAndUpdate(
          {
            branchId: transfer.fromBranchId,
            stockLocationId: transfer.fromStockLocationId,
            sku: item.sku,
            $expr: {
              $gte: [{ $subtract: ['$onHand', '$reserved'] }, item.quantity],
            },
          },
          {
            $inc: { reserved: item.quantity },
          },
          { session, new: true }
        );

        if (!updated) {
          throw new AppError(
            `Cannot approve: Insufficient available stock for SKU ${item.sku} at source.`,
            400,
            'INSUFFICIENT_STOCK_ON_APPROVAL'
          );
        }
      }

      transfer.status = TRANSFER_STATUSES.APPROVED;
      transfer.approvedBy = userContext.loginId;
      transfer.approvedAt = new Date();
      await transfer.save({ session });

      return transfer;
    }, { strict: true });
  }

  public static async dispatchTransfer(transferId: string, userContext: UserContext) {
    return await runTransaction(async (session) => {
      const transfer = await StockTransfer.findById(transferId).session(session);
      if (!transfer) throw new AppError('Transfer not found.', 404, 'TRANSFER_NOT_FOUND');

      if (transfer.status !== TRANSFER_STATUSES.APPROVED) {
        throw new AppError(
          `Transfer must be in APPROVED state before dispatch. Current: '${transfer.status}'.`,
          400,
          'TRANSFER_NOT_APPROVED'
        );
      }

      // Validate user branch authorization: only source branch or Super Admin can dispatch
      if (
        userContext.role !== 'SUPER_ADMIN' &&
        transfer.fromBranchId.toString() !== userContext.branchId
      ) {
        throw new AppError('Only the dispatching branch can dispatch this transfer.', 403, 'FORBIDDEN_DISPATCH');
      }

      for (const item of transfer.items) {
        // Atomic deduction from source: reduce onHand and reduce reserved
        const sourceBal = await StockBalance.findOneAndUpdate(
          {
            branchId: transfer.fromBranchId,
            stockLocationId: transfer.fromStockLocationId,
            sku: item.sku,
            onHand: { $gte: item.quantity },
            reserved: { $gte: item.quantity },
          },
          {
            $inc: {
              onHand: -item.quantity,
              reserved: -item.quantity,
            },
          },
          { session, new: true }
        );

        if (!sourceBal) {
          throw new AppError(
            `Failed to dispatch SKU ${item.sku}: Insufficient physical or reserved stock.`,
            400,
            'DISPATCH_STOCK_MISMATCH'
          );
        }

        // Record outgoing movement from source
        await StockMovement.create(
          [
            {
              movementNumber: this.generateDocNumber('MOV-TOUT'),
              branchId: transfer.fromBranchId,
              stockLocationId: transfer.fromStockLocationId,
              sku: item.sku,
              movementType: STOCK_MOVEMENT_TYPES.TRANSFER_OUT,
              quantityDifference: -item.quantity,
              previousBalance: sourceBal.onHand + item.quantity,
              newBalance: sourceBal.onHand,
              referenceType: 'STOCK_TRANSFER',
              referenceId: transfer.transferNumber,
              reason: `Dispatched to branch ${transfer.toBranchId}`,
              performedBy: userContext.loginId,
              timestamp: new Date(),
            },
          ],
          { session }
        );
      }

      // Important: Items are now IN TRANSIT. Destination onHand is NOT increased yet.
      transfer.status = TRANSFER_STATUSES.DISPATCHED;
      transfer.dispatchedAt = new Date();
      await transfer.save({ session });

      return transfer;
    }, { strict: true });
  }

  public static async receiveTransfer(transferId: string, userContext: UserContext) {
    return await runTransaction(async (session) => {
      const transfer = await StockTransfer.findById(transferId).session(session);
      if (!transfer) throw new AppError('Transfer not found.', 404, 'TRANSFER_NOT_FOUND');

      if (transfer.status !== TRANSFER_STATUSES.DISPATCHED) {
        throw new AppError(
          `Only DISPATCHED transfers can be received. Current state: '${transfer.status}'.`,
          400,
          'TRANSFER_NOT_DISPATCHED'
        );
      }

      // Authorization: only destination branch or Super Admin can receive
      if (
        userContext.role !== 'SUPER_ADMIN' &&
        transfer.toBranchId.toString() !== userContext.branchId
      ) {
        throw new AppError('Only the destination branch can receive this transfer.', 403, 'FORBIDDEN_RECEIVE');
      }

      for (const item of transfer.items) {
        // Fetch destination previous onHand
        const currentDestBal = await StockBalance.findOne({
          branchId: transfer.toBranchId,
          stockLocationId: transfer.toStockLocationId,
          sku: item.sku,
        }).session(session);

        const prevOnHand = currentDestBal ? currentDestBal.onHand : 0;
        const newOnHand = prevOnHand + item.quantity;

        // Increase destination stock
        await StockBalance.findOneAndUpdate(
          {
            branchId: transfer.toBranchId,
            stockLocationId: transfer.toStockLocationId,
            sku: item.sku,
          },
          {
            $inc: { onHand: item.quantity },
            $set: { variantId: item.variantId },
            $setOnInsert: { reserved: 0, reorderLevel: 5 },
          },
          { upsert: true, session, new: true }
        );

        // Record incoming movement at destination
        await StockMovement.create(
          [
            {
              movementNumber: this.generateDocNumber('MOV-TIN'),
              branchId: transfer.toBranchId,
              stockLocationId: transfer.toStockLocationId,
              sku: item.sku,
              movementType: STOCK_MOVEMENT_TYPES.TRANSFER_IN,
              quantityDifference: item.quantity,
              previousBalance: prevOnHand,
              newBalance: newOnHand,
              referenceType: 'STOCK_TRANSFER',
              referenceId: transfer.transferNumber,
              reason: `Received transfer from branch ${transfer.fromBranchId}`,
              performedBy: userContext.loginId,
              timestamp: new Date(),
            },
          ],
          { session }
        );
      }

      transfer.status = TRANSFER_STATUSES.RECEIVED;
      transfer.receivedBy = userContext.loginId;
      transfer.receivedAt = new Date();
      await transfer.save({ session });

      return transfer;
    }, { strict: true });
  }

  public static async cancelTransfer(transferId: string, userContext: UserContext) {
    return await runTransaction(async (session) => {
      const transfer = await StockTransfer.findById(transferId).session(session);
      if (!transfer) throw new AppError('Transfer not found.', 404, 'TRANSFER_NOT_FOUND');

      if (transfer.status === TRANSFER_STATUSES.RECEIVED) {
        throw new AppError('Cannot cancel a transfer that has already been received.', 400, 'ALREADY_RECEIVED');
      }

      if (transfer.status === TRANSFER_STATUSES.CANCELLED) {
        throw new AppError('Transfer is already cancelled.', 400, 'ALREADY_CANCELLED');
      }

      // Case 1: Before approval (DRAFT, PENDING_APPROVAL) - simply cancel
      if (
        transfer.status === TRANSFER_STATUSES.DRAFT ||
        transfer.status === TRANSFER_STATUSES.PENDING_APPROVAL
      ) {
        transfer.status = TRANSFER_STATUSES.CANCELLED;
        await transfer.save({ session });
        return transfer;
      }

      // Case 2: APPROVED (reserved at source, not dispatched) - release reserved stock
      if (transfer.status === TRANSFER_STATUSES.APPROVED) {
        for (const item of transfer.items) {
          await StockBalance.findOneAndUpdate(
            {
              branchId: transfer.fromBranchId,
              stockLocationId: transfer.fromStockLocationId,
              sku: item.sku,
            },
            {
              $inc: { reserved: -item.quantity },
            },
            { session }
          );
        }
        transfer.status = TRANSFER_STATUSES.CANCELLED;
        await transfer.save({ session });
        return transfer;
      }

      // Case 3: DISPATCHED (in transit) - Cannot cancel once physically dispatched
      if (transfer.status === TRANSFER_STATUSES.DISPATCHED) {
        throw new AppError(
          'Cannot cancel a transfer that has already been dispatched. In-transit goods must be received at destination or reconciled through documented physical return.',
          400,
          'TRANSFER_ALREADY_DISPATCHED'
        );
      }

      return transfer;
    }, { strict: true });
  }

  public static async getTransfers(
    query: {
      fromBranchId?: string;
      toBranchId?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
    userContext: UserContext
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (userContext.role !== 'SUPER_ADMIN') {
      const bId = new mongoose.Types.ObjectId(userContext.branchId);
      filter.$or = [{ fromBranchId: bId }, { toBranchId: bId }];
    } else {
      if (query.fromBranchId) filter.fromBranchId = new mongoose.Types.ObjectId(query.fromBranchId);
      if (query.toBranchId) filter.toBranchId = new mongoose.Types.ObjectId(query.toBranchId);
    }

    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    }

    const [total, transfers] = await Promise.all([
      StockTransfer.countDocuments(filter),
      StockTransfer.find(filter)
        .populate('fromBranchId', 'name code shopNumber')
        .populate('toBranchId', 'name code shopNumber')
        .populate('fromStockLocationId', 'name code')
        .populate('toStockLocationId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return {
      transfers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public static async getTransferById(id: string, userContext: UserContext) {
    const transfer = await StockTransfer.findById(id)
      .populate('fromBranchId', 'name code shopNumber')
      .populate('toBranchId', 'name code shopNumber')
      .populate('fromStockLocationId', 'name code')
      .populate('toStockLocationId', 'name code');

    if (!transfer) throw new AppError('Stock transfer not found.', 404, 'TRANSFER_NOT_FOUND');

    if (
      userContext.role !== 'SUPER_ADMIN' &&
      transfer.fromBranchId?._id?.toString() !== userContext.branchId &&
      transfer.toBranchId?._id?.toString() !== userContext.branchId
    ) {
      throw new AppError('Unauthorized access to stock transfer for another branch.', 403, 'FORBIDDEN_TRANSFER');
    }

    return transfer;
  }

  // ==========================================
  // 6. STOCK MOVEMENTS (HISTORY & AUDIT)
  // ==========================================

  public static async getStockMovements(
    query: {
      branchId?: string;
      stockLocationId?: string;
      sku?: string;
      movementType?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    userContext: UserContext
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (userContext.role !== 'SUPER_ADMIN') {
      filter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    } else if (query.branchId) {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    if (query.stockLocationId) {
      filter.stockLocationId = new mongoose.Types.ObjectId(query.stockLocationId);
    }

    if (query.sku) {
      filter.sku = query.sku.toUpperCase().trim();
    } else if (query.search) {
      filter.$or = [
        { sku: { $regex: query.search.trim(), $options: 'i' } },
        { movementNumber: { $regex: query.search.trim(), $options: 'i' } },
        { referenceId: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    if (query.movementType && query.movementType !== 'ALL') {
      filter.movementType = query.movementType;
    }

    if (query.dateFrom || query.dateTo) {
      const dFilter: Record<string, Date> = {};
      if (query.dateFrom) dFilter.$gte = new Date(query.dateFrom);
      if (query.dateTo) dFilter.$lte = new Date(query.dateTo);
      filter.timestamp = dFilter;
    }

    const [total, movements] = await Promise.all([
      StockMovement.countDocuments(filter),
      StockMovement.find(filter)
        .populate('branchId', 'name code shopNumber')
        .populate('stockLocationId', 'name code type')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return {
      movements,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public static async getStockMovementById(id: string, userContext: UserContext) {
    const movement = await StockMovement.findById(id)
      .populate('branchId', 'name code shopNumber')
      .populate('stockLocationId', 'name code type');

    if (!movement) throw new AppError('Stock movement not found.', 404, 'MOVEMENT_NOT_FOUND');

    if (userContext.role !== 'SUPER_ADMIN' && movement.branchId?._id?.toString() !== userContext.branchId) {
      throw new AppError('Unauthorized access to movement for another branch.', 403, 'FORBIDDEN_MOVEMENT');
    }

    return movement;
  }

  // ==========================================
  // 7. STOCK ALERTS
  // ==========================================

  public static async getStockAlerts(
    query: {
      branchId?: string;
      status?: 'ALL' | 'OUT_OF_STOCK' | 'LOW_STOCK';
      brandId?: string;
      categoryId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    userContext: UserContext
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 50));
    const skip = (page - 1) * limit;

    const branchFilter: Record<string, unknown> = {};
    if (userContext.role !== 'SUPER_ADMIN') {
      branchFilter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    } else if (query.branchId) {
      branchFilter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    if (query.search) {
      branchFilter.sku = { $regex: query.search.trim(), $options: 'i' };
    }

    // Populate balances
    const balances = await StockBalance.find(branchFilter)
      .populate('branchId', 'name code shopNumber')
      .populate('stockLocationId', 'name code')
      .populate({
        path: 'variantId',
        select: 'sku listPrice retailPrice wholesalePrice distributorPrice status',
        populate: [
          {
            path: 'productId',
            select: 'name brandId categoryId',
            populate: [
              { path: 'brandId', select: 'name code' },
              { path: 'categoryId', select: 'name code' },
            ],
          },
          { path: 'sizeId', select: 'displayLabel length width' },
          { path: 'thicknessId', select: 'displayLabel value' },
        ],
      });

    // Evaluate dynamic rules:
    // Out of Stock: available == 0
    // Low Stock: available > 0 && available <= reorderLevel
    // Normal: available > reorderLevel
    const alertItems: any[] = [];
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let normalCount = 0;

    for (const b of balances) {
      const onHand = b.onHand || 0;
      const reserved = b.reserved || 0;
      const available = Math.max(0, onHand - reserved);
      const reorderLevel = b.reorderLevel ?? 5;

      let statusType: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NORMAL';
      if (available <= 0) {
        statusType = 'OUT_OF_STOCK';
        outOfStockCount++;
      } else if (available <= reorderLevel) {
        statusType = 'LOW_STOCK';
        lowStockCount++;
      } else {
        statusType = 'NORMAL';
        normalCount++;
      }

      // Filter by status if requested
      if (query.status === 'OUT_OF_STOCK' && statusType !== 'OUT_OF_STOCK') continue;
      if (query.status === 'LOW_STOCK' && statusType !== 'LOW_STOCK') continue;
      if (query.status === 'ALL' && statusType === 'NORMAL') continue; // Alerts only include low and out of stock by default

      // Brand and category filters
      const variant = b.variantId as any;
      const product = variant?.productId;
      if (query.brandId && product?.brandId?._id?.toString() !== query.brandId) continue;
      if (query.categoryId && product?.categoryId?._id?.toString() !== query.categoryId) continue;

      alertItems.push({
        id: b._id.toString(),
        sku: b.sku,
        branch: b.branchId,
        stockLocation: b.stockLocationId,
        onHand,
        reserved,
        available,
        reorderLevel,
        status: statusType,
        variant,
        updatedAt: b.updatedAt,
      });
    }

    const total = alertItems.length;
    const paginatedItems = alertItems.slice(skip, skip + limit);

    return {
      alerts: paginatedItems,
      metrics: {
        totalBalances: balances.length,
        outOfStock: outOfStockCount,
        lowStock: lowStockCount,
        healthy: normalCount,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ==========================================
  // 8. INVENTORY SUMMARY
  // ==========================================

  public static async getInventorySummary(userContext: UserContext) {
    const filter: Record<string, unknown> = {};
    if (userContext.role !== 'SUPER_ADMIN') {
      filter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    }

    const [balances, inTransitTransfers] = await Promise.all([
      StockBalance.find(filter),
      StockTransfer.countDocuments({
        ...(userContext.role !== 'SUPER_ADMIN'
          ? { $or: [{ fromBranchId: userContext.branchId }, { toBranchId: userContext.branchId }] }
          : {}),
        status: TRANSFER_STATUSES.DISPATCHED,
      }),
    ]);

    let totalOnHand = 0;
    let totalReserved = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const b of balances) {
      const onHand = b.onHand || 0;
      const reserved = b.reserved || 0;
      const available = Math.max(0, onHand - reserved);
      const reorderLevel = b.reorderLevel ?? 5;

      totalOnHand += onHand;
      totalReserved += reserved;

      if (available <= 0) {
        outOfStockCount++;
      } else if (available <= reorderLevel) {
        lowStockCount++;
      }
    }

    return {
      totalBalancesCount: balances.length,
      totalOnHandQuantity: totalOnHand,
      totalReservedQuantity: totalReserved,
      totalAvailableQuantity: Math.max(0, totalOnHand - totalReserved),
      lowStockAlertsCount: lowStockCount,
      outOfStockCount,
      inTransitTransfersCount: inTransitTransfers,
    };
  }
}
