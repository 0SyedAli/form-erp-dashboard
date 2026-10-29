import {
  StockTransfer,
  StockTransferStatus,
  StockTransferItem,
} from '@/types';
import { demoStorage } from './storage';
import { STORAGE_KEYS } from './schema';
import { SEED_STOCK_TRANSFERS } from './seed';
import { stockLocationsRepository } from './stock-locations.repository';
import { inventoryRepository } from './inventory.repository';
import { stockMovementsRepository } from './stock-movements.repository';
import { variantsRepository } from './variants.repository';

class StockTransfersRepository {
  private getTransfersInternal(): StockTransfer[] {
    const list = demoStorage.getItem<StockTransfer[]>(STORAGE_KEYS.STOCK_TRANSFERS, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.STOCK_TRANSFERS, [...SEED_STOCK_TRANSFERS]);
      return [...SEED_STOCK_TRANSFERS];
    }
    return list;
  }

  private saveTransfersInternal(transfers: StockTransfer[]): void {
    demoStorage.setItem(STORAGE_KEYS.STOCK_TRANSFERS, transfers);
  }

  public getAll(filter?: {
    sourceBranchId?: string;
    destinationBranchId?: string;
    branchId?: string;
    status?: StockTransferStatus | 'all';
    search?: string;
  }): StockTransfer[] {
    let list = this.getTransfersInternal();

    // Newest first
    list.sort((a, b) => new Date(b.requestedAt || b.createdAt || 0).getTime() - new Date(a.requestedAt || a.createdAt || 0).getTime());

    if (!filter) return list;

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.transferNumber.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q) ||
          t.requestedBy.toLowerCase().includes(q) ||
          t.items.some((i) => i.sku.toLowerCase().includes(q) || i.productName.toLowerCase().includes(q))
      );
    }

    if (filter.branchId && filter.branchId !== 'all') {
      list = list.filter(
        (t) => t.sourceBranchId === filter.branchId || t.destinationBranchId === filter.branchId
      );
    }

    if (filter.sourceBranchId && filter.sourceBranchId !== 'all') {
      list = list.filter((t) => t.sourceBranchId === filter.sourceBranchId);
    }

    if (filter.destinationBranchId && filter.destinationBranchId !== 'all') {
      list = list.filter((t) => t.destinationBranchId === filter.destinationBranchId);
    }

    if (filter.status && filter.status !== 'all') {
      list = list.filter((t) => t.status === filter.status);
    }

    return list;
  }

  public getById(id: string): StockTransfer | undefined {
    return this.getTransfersInternal().find((t) => t.id === id);
  }

  public getByTransferNumber(num: string): StockTransfer | undefined {
    return this.getTransfersInternal().find((t) => t.transferNumber === num);
  }

  /**
   * Create a new transfer request.
   */
  public createTransfer(dto: {
    sourceBranchId: string;
    sourceLocationId: string;
    destinationBranchId: string;
    destinationLocationId: string;
    items: Array<{ sku: string; requestedQuantity: number }>;
    notes?: string;
    requestedBy: string;
    isDraft?: boolean;
  }): StockTransfer {
    // 1. Validation: Source and destination cannot be identical
    if (dto.sourceLocationId === dto.destinationLocationId) {
      throw new Error('Source and destination stock locations cannot be identical.');
    }
    if (dto.sourceBranchId === dto.destinationBranchId && dto.sourceLocationId === dto.destinationLocationId) {
      throw new Error('Source and destination branches and locations cannot be identical.');
    }

    // 2. Validate locations exist and are active
    const sourceLoc = stockLocationsRepository.getById(dto.sourceLocationId);
    if (!sourceLoc || !sourceLoc.isActive) {
      throw new Error('Source stock location is inactive or invalid.');
    }
    const destLoc = stockLocationsRepository.getById(dto.destinationLocationId);
    if (!destLoc || !destLoc.isActive) {
      throw new Error('Destination stock location is inactive or invalid.');
    }

    // 3. Validate items and sufficient stock
    if (!dto.items || dto.items.length === 0) {
      throw new Error('At least one item is required for stock transfer.');
    }

    const items: StockTransferItem[] = [];
    for (const item of dto.items) {
      if (item.requestedQuantity <= 0 || !Number.isFinite(item.requestedQuantity)) {
        throw new Error(`Transfer quantity for SKU "${item.sku}" must be greater than zero.`);
      }

      const balance = inventoryRepository.getBalance(dto.sourceLocationId, item.sku);
      const available = balance ? balance.available : 0;
      if (available < item.requestedQuantity) {
        throw new Error(
          `Insufficient stock for SKU "${item.sku}" at source location. Available: ${available}, Requested: ${item.requestedQuantity}.`
        );
      }

      const variant = variantsRepository.getBySku(item.sku);
      items.push({
        sku: item.sku,
        variantId: variant?.id || '',
        productName: variant?.productName || balance?.productName || item.sku,
        sizeLabel: variant?.sizeLabel || balance?.sizeLabel || '',
        thicknessInches: balance?.thicknessInches || 6,
        requestedQuantity: item.requestedQuantity,
        unitCost: balance?.unitCost,
      });
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const transferNumber = `TRF-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();

    const transfer: StockTransfer = {
      id: `TRF-${Date.now().toString(36).toUpperCase()}`,
      transferNumber,
      sourceBranchId: dto.sourceBranchId,
      sourceLocationId: dto.sourceLocationId,
      destinationBranchId: dto.destinationBranchId,
      destinationLocationId: dto.destinationLocationId,
      status: dto.isDraft ? 'DRAFT' : 'PENDING_APPROVAL',
      items,
      notes: dto.notes?.trim(),
      requestedBy: dto.requestedBy,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const list = this.getTransfersInternal();
    list.unshift(transfer);
    this.saveTransfersInternal(list);
    return transfer;
  }

  /**
   * Approve a pending transfer.
   */
  public approveTransfer(transferId: string, approvedBy: string): StockTransfer {
    const list = this.getTransfersInternal();
    const idx = list.findIndex((t) => t.id === transferId);
    if (idx === -1) throw new Error(`Transfer "${transferId}" not found.`);

    const transfer = list[idx];
    if (transfer.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot approve transfer in status "${transfer.status}". Only PENDING_APPROVAL transfers can be approved.`);
    }

    // Verify stock is still available at source
    for (const item of transfer.items) {
      const balance = inventoryRepository.getBalance(transfer.sourceLocationId, item.sku);
      const available = balance ? balance.available : 0;
      if (available < item.requestedQuantity) {
        throw new Error(
          `Cannot approve: Insufficient stock for SKU "${item.sku}". Available: ${available}, Requested: ${item.requestedQuantity}.`
        );
      }
    }

    const now = new Date().toISOString();
    transfer.status = 'APPROVED';
    transfer.approvedBy = approvedBy;
    transfer.approvedAt = now;
    transfer.updatedAt = now;

    this.saveTransfersInternal(list);
    return transfer;
  }

  /**
   * Dispatch an approved transfer. Decrements source stock and logs dispatch movement.
   */
  public dispatchTransfer(
    transferId: string,
    dispatchedBy: string,
    itemDispatches?: Array<{ sku: string; dispatchedQuantity: number }>
  ): StockTransfer {
    const list = this.getTransfersInternal();
    const idx = list.findIndex((t) => t.id === transferId);
    if (idx === -1) throw new Error(`Transfer "${transferId}" not found.`);

    const transfer = list[idx];
    if (transfer.status !== 'APPROVED') {
      throw new Error(`Cannot dispatch transfer with status "${transfer.status}". Transfer must be APPROVED first.`);
    }

    const now = new Date().toISOString();

    // Process dispatches and update source stock
    for (const item of transfer.items) {
      const override = itemDispatches?.find((d) => d.sku === item.sku);
      const qtyToDispatch = override?.dispatchedQuantity ?? item.requestedQuantity;

      if (qtyToDispatch <= 0) {
        throw new Error(`Dispatched quantity for SKU "${item.sku}" must be positive.`);
      }

      const balance = inventoryRepository.getBalance(transfer.sourceLocationId, item.sku);
      if (!balance || balance.onHand < qtyToDispatch) {
        throw new Error(`Insufficient on-hand stock to dispatch SKU "${item.sku}".`);
      }

      // Atomically decrement source on-hand stock
      inventoryRepository.updateBalanceInternal(transfer.sourceLocationId, item.sku, (b) => {
        b.onHand -= qtyToDispatch;
      });

      // Record immutable movement
      stockMovementsRepository.logMovement({
        documentReference: transfer.transferNumber,
        sku: item.sku,
        productId: balance.productId,
        variantId: item.variantId,
        sourceLocationId: transfer.sourceLocationId,
        sourceBranchId: transfer.sourceBranchId,
        destinationLocationId: transfer.destinationLocationId,
        destinationBranchId: transfer.destinationBranchId,
        movementType: 'TRANSFER_DISPATCH',
        quantity: qtyToDispatch,
        unitCost: item.unitCost,
        createdBy: dispatchedBy,
        timestamp: now,
        notes: `Transfer dispatched: ${transfer.transferNumber} -> Destination: ${transfer.destinationBranchId}`,
        relatedTransactionId: transfer.id,
      });

      item.dispatchedQuantity = qtyToDispatch;
    }

    transfer.status = 'DISPATCHED';
    transfer.dispatchedBy = dispatchedBy;
    transfer.dispatchedAt = now;
    transfer.updatedAt = now;

    this.saveTransfersInternal(list);
    return transfer;
  }

  /**
   * Receive a dispatched transfer. Increments destination stock and logs receipt movement.
   */
  public receiveTransfer(
    transferId: string,
    receivedBy: string,
    itemReceipts?: Array<{ sku: string; receivedQuantity: number }>
  ): StockTransfer {
    const list = this.getTransfersInternal();
    const idx = list.findIndex((t) => t.id === transferId);
    if (idx === -1) throw new Error(`Transfer "${transferId}" not found.`);

    const transfer = list[idx];
    if (transfer.status !== 'DISPATCHED') {
      throw new Error(`Cannot receive transfer with status "${transfer.status}". Transfer must be in DISPATCHED state.`);
    }

    const now = new Date().toISOString();

    for (const item of transfer.items) {
      const override = itemReceipts?.find((r) => r.sku === item.sku);
      const qtyReceived = override?.receivedQuantity ?? item.dispatchedQuantity ?? item.requestedQuantity;

      if (qtyReceived <= 0) {
        throw new Error(`Received quantity for SKU "${item.sku}" must be positive.`);
      }

      // Atomically increment destination stock
      const destBalance = inventoryRepository.updateBalanceInternal(
        transfer.destinationLocationId,
        item.sku,
        (b) => {
          b.onHand += qtyReceived;
          if (item.unitCost !== undefined && item.unitCost > 0) {
            b.unitCost = item.unitCost;
          }
        }
      );

      // Record immutable movement
      stockMovementsRepository.logMovement({
        documentReference: transfer.transferNumber,
        sku: item.sku,
        productId: destBalance.productId,
        variantId: item.variantId,
        sourceLocationId: transfer.sourceLocationId,
        sourceBranchId: transfer.sourceBranchId,
        destinationLocationId: transfer.destinationLocationId,
        destinationBranchId: transfer.destinationBranchId,
        movementType: 'TRANSFER_RECEIPT',
        quantity: qtyReceived,
        unitCost: item.unitCost,
        createdBy: receivedBy,
        timestamp: now,
        notes: `Transfer received: ${transfer.transferNumber} at destination location`,
        relatedTransactionId: transfer.id,
      });

      item.receivedQuantity = qtyReceived;
    }

    transfer.status = 'RECEIVED';
    transfer.receivedBy = receivedBy;
    transfer.receivedAt = now;
    transfer.updatedAt = now;

    this.saveTransfersInternal(list);
    return transfer;
  }

  /**
   * Cancel transfer with controlled reversal process if already dispatched.
   */
  public cancelTransfer(
    transferId: string,
    cancelledBy: string,
    cancellationReason: string
  ): StockTransfer {
    if (!cancellationReason || !cancellationReason.trim()) {
      throw new Error('A cancellation reason is required.');
    }

    const list = this.getTransfersInternal();
    const idx = list.findIndex((t) => t.id === transferId);
    if (idx === -1) throw new Error(`Transfer "${transferId}" not found.`);

    const transfer = list[idx];

    if (transfer.status === 'RECEIVED') {
      throw new Error('Cannot cancel a transfer that has already been fully RECEIVED at destination.');
    }
    if (transfer.status === 'CANCELLED') {
      throw new Error('Transfer is already cancelled.');
    }

    const now = new Date().toISOString();

    // Controlled reversal if items were already dispatched
    if (transfer.status === 'DISPATCHED') {
      for (const item of transfer.items) {
        const qtyToRestore = item.dispatchedQuantity || item.requestedQuantity;
        inventoryRepository.updateBalanceInternal(transfer.sourceLocationId, item.sku, (b) => {
          b.onHand += qtyToRestore;
        });

        stockMovementsRepository.logMovement({
          documentReference: `${transfer.transferNumber}-REV`,
          sku: item.sku,
          productId: item.variantId,
          variantId: item.variantId,
          destinationLocationId: transfer.sourceLocationId,
          destinationBranchId: transfer.sourceBranchId,
          movementType: 'ADJUSTMENT_IN',
          quantity: qtyToRestore,
          unitCost: item.unitCost,
          createdBy: cancelledBy,
          timestamp: now,
          notes: `[Transfer Reversal] Cancelled dispatched transfer ${transfer.transferNumber}: ${cancellationReason.trim()}`,
          relatedTransactionId: transfer.id,
        });
      }
    }

    transfer.status = 'CANCELLED';
    transfer.cancelledBy = cancelledBy;
    transfer.cancelledAt = now;
    transfer.cancellationReason = cancellationReason.trim();
    transfer.updatedAt = now;

    this.saveTransfersInternal(list);
    return transfer;
  }

  public resetToSeed(): StockTransfer[] {
    demoStorage.setItem(STORAGE_KEYS.STOCK_TRANSFERS, [...SEED_STOCK_TRANSFERS]);
    return [...SEED_STOCK_TRANSFERS];
  }
}

export const stockTransfersRepository = new StockTransfersRepository();
