import { GoodsReceiptNote, GoodsReceiptNoteItem, StockMovement } from '@/types';
import {
  STORAGE_KEYS,
  ReceiveGoodsDTO,
  GoodsReceiptFilterOptions,
} from './schema';
import { demoStorage } from './storage';
import { SEED_GOODS_RECEIPTS } from './seed';
import { purchaseOrdersRepository } from './purchase-orders.repository';
import { inventoryRepository } from './inventory.repository';
import { stockLocationsRepository } from './stock-locations.repository';

export class GoodsReceiptsRepository {
  private getGRNsInternal(): GoodsReceiptNote[] {
    const list = demoStorage.getItem<GoodsReceiptNote[]>(STORAGE_KEYS.GOODS_RECEIPTS, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.GOODS_RECEIPTS, [...SEED_GOODS_RECEIPTS]);
      return [...SEED_GOODS_RECEIPTS];
    }
    return list;
  }

  private saveGRNsInternal(grns: GoodsReceiptNote[]): void {
    demoStorage.setItem(STORAGE_KEYS.GOODS_RECEIPTS, grns);
  }

  public getAll(filter?: GoodsReceiptFilterOptions): GoodsReceiptNote[] {
    let list = this.getGRNsInternal();

    if (!filter) {
      return [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    if (filter.poId && filter.poId !== 'ALL') {
      list = list.filter((g) => g.poId === filter.poId);
    }

    if (filter.supplierId && filter.supplierId !== 'ALL') {
      list = list.filter((g) => g.supplierId === filter.supplierId);
    }

    if (filter.branchId && filter.branchId !== 'all' && filter.branchId !== 'ALL') {
      list = list.filter((g) => g.branchId === filter.branchId);
    }

    if (filter.startDate) {
      const start = new Date(filter.startDate).getTime();
      list = list.filter((g) => new Date(g.receivedDate).getTime() >= start);
    }

    if (filter.endDate) {
      const end = new Date(filter.endDate).getTime();
      list = list.filter((g) => new Date(g.receivedDate).getTime() <= end);
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (g) =>
          g.grnNumber.toLowerCase().includes(q) ||
          g.poNumber.toLowerCase().includes(q) ||
          g.supplierName.toLowerCase().includes(q) ||
          g.deliveryReference.toLowerCase().includes(q) ||
          g.locationName.toLowerCase().includes(q)
      );
    }

    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getById(id: string): GoodsReceiptNote | null {
    const list = this.getGRNsInternal();
    return list.find((g) => g.id === id || g.grnNumber === id) || null;
  }

  public getByPOId(poId: string): GoodsReceiptNote[] {
    const list = this.getGRNsInternal();
    return list.filter((g) => g.poId === poId || g.poNumber === poId);
  }

  public getNextGRNNumber(): string {
    const list = this.getGRNsInternal();
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todays = list.filter((g) => g.grnNumber.includes(todayStr));
    const nextSeq = String(todays.length + 1).padStart(4, '0');
    return `GRN-${todayStr}-${nextSeq}`;
  }

  /**
   * Receive goods against an approved purchase order.
   * Atomically:
   * 1. Validates quantities against remaining unreceived quantities on the PO.
   * 2. Deposits into target branch location via Flow 05 inventoryRepository.
   * 3. Logs immutable StockMovement records.
   * 4. Updates PO line item received quantities and overall PO status.
   * 5. Saves GRN record.
   */
  public receiveGoods(dto: ReceiveGoodsDTO): {
    grn: GoodsReceiptNote;
    movements: StockMovement[];
  } {
    if (!dto.items || dto.items.length === 0) {
      throw new Error('At least one item must be received.');
    }

    const po = purchaseOrdersRepository.getById(dto.poId);
    if (!po) {
      throw new Error(`Purchase order with ID "${dto.poId}" not found.`);
    }

    if (po.status !== 'APPROVED' && po.status !== 'PARTIALLY_RECEIVED') {
      throw new Error(
        `Cannot receive goods for purchase order with status "${po.status}". Must be APPROVED or PARTIALLY_RECEIVED.`
      );
    }

    const targetLocationId = dto.destinationLocationId || po.destinationLocationId;
    const location = stockLocationsRepository.getById(targetLocationId);
    if (!location) {
      throw new Error(`Stock location with ID "${targetLocationId}" not found.`);
    }

    if (!location.isActive) {
      throw new Error(`Stock location "${location.name}" is deactivated. Cannot receive stock.`);
    }

    // Check delivery reference uniqueness for this PO
    const existingGRNs = this.getByPOId(po.id);
    if (
      dto.deliveryReference &&
      existingGRNs.some(
        (g) => g.deliveryReference.trim().toLowerCase() === dto.deliveryReference.trim().toLowerCase()
      )
    ) {
      throw new Error(
        `A goods receipt with delivery reference "${dto.deliveryReference}" has already been processed for this PO.`
      );
    }

    let totalQty = 0;
    let totalVal = 0;

    const grnItems: GoodsReceiptNoteItem[] = [];
    const stockItemsToReceive: Array<{
      sku: string;
      receivedQuantity: number;
      unitCost: number;
      batchNumber?: string;
    }> = [];

    for (const rcv of dto.items) {
      if (rcv.receivedQuantity <= 0) continue;

      const poItem = po.items.find((i) => i.sku.toUpperCase() === rcv.sku.trim().toUpperCase());
      if (!poItem) {
        throw new Error(`SKU "${rcv.sku}" is not part of Purchase Order ${po.poNumber}.`);
      }

      const remainingAllowed = poItem.orderedQuantity - poItem.receivedQuantity;
      if (rcv.receivedQuantity > remainingAllowed) {
        throw new Error(
          `Received quantity (${rcv.receivedQuantity}) exceeds remaining unreceived quantity (${remainingAllowed}) for SKU "${rcv.sku}". Over-receiving is not permitted.`
        );
      }

      const cost = rcv.unitCost !== undefined ? rcv.unitCost : poItem.unitCost;
      const lineTotal = rcv.receivedQuantity * cost;

      totalQty += rcv.receivedQuantity;
      totalVal += lineTotal;

      grnItems.push({
        sku: poItem.sku,
        variantId: poItem.variantId,
        productName: poItem.productName,
        sizeLabel: poItem.sizeLabel,
        thicknessLabel: poItem.thicknessLabel,
        orderedQuantity: poItem.orderedQuantity,
        previouslyReceived: poItem.receivedQuantity,
        receivedQuantity: rcv.receivedQuantity,
        damagedQuantity: rcv.damagedQuantity || 0,
        unitCost: cost,
        lineTotal,
        batchNumber: rcv.batchNumber,
      });

      stockItemsToReceive.push({
        sku: poItem.sku,
        receivedQuantity: rcv.receivedQuantity,
        unitCost: cost,
        batchNumber: rcv.batchNumber,
      });
    }

    if (grnItems.length === 0) {
      throw new Error('All items specified had 0 received quantity.');
    }

    const grnNumber = this.getNextGRNNumber();
    const now = new Date().toISOString();

    // 1. Update Inventory via Flow 05 inventoryRepository
    const inventoryResult = inventoryRepository.receiveStock({
      destinationBranchId: po.destinationBranchId,
      destinationLocationId: location.id,
      supplierName: po.supplierName,
      referenceNumber: `PO #${po.poNumber} | Ref: ${dto.deliveryReference}`,
      receivedBy: dto.receivedBy,
      notes: `GRN #${grnNumber} against PO #${po.poNumber}: ${dto.notes || 'Goods receipt'}`,
      items: stockItemsToReceive.map((i) => ({
        sku: i.sku,
        quantity: i.receivedQuantity,
        unitCost: i.unitCost,
      })),
    });

    // 2. Update PO line item received quantities & status
    purchaseOrdersRepository.updateReceivedQuantities(
      po.id,
      stockItemsToReceive.map((i) => ({ sku: i.sku, receivedQuantity: i.receivedQuantity }))
    );

    // 3. Save GRN
    const newGRN: GoodsReceiptNote = {
      id: `GRN-${Date.now().toString().slice(-6)}`,
      grnNumber,
      poId: po.id,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      supplierName: po.supplierName,
      branchId: po.destinationBranchId,
      branchName: po.destinationBranchName,
      locationId: location.id,
      locationName: location.name,
      deliveryReference: dto.deliveryReference.trim(),
      receivedDate: dto.receivedDate || now.slice(0, 10),
      items: grnItems,
      totalReceivedQuantity: totalQty,
      totalReceivedValue: totalVal,
      receivedBy: dto.receivedBy,
      notes: dto.notes?.trim() || undefined,
      createdAt: now,
    };

    const list = this.getGRNsInternal();
    list.unshift(newGRN);
    this.saveGRNsInternal(list);

    return {
      grn: newGRN,
      movements: inventoryResult.movements,
    };
  }

  public resetToSeed(): GoodsReceiptNote[] {
    const seed = [...SEED_GOODS_RECEIPTS];
    demoStorage.setItem(STORAGE_KEYS.GOODS_RECEIPTS, seed);
    return seed;
  }
}

export const goodsReceiptsRepository = new GoodsReceiptsRepository();
