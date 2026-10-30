import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '@/types';
import {
  STORAGE_KEYS,
  CreatePurchaseOrderDTO,
  UpdatePurchaseOrderDTO,
  PurchaseOrderFilterOptions,
} from './schema';
import { demoStorage } from './storage';
import { SEED_PURCHASE_ORDERS } from './seed';
import { suppliersRepository } from './suppliers.repository';
import { branchesRepository } from './branches.repository';
import { stockLocationsRepository } from './stock-locations.repository';
import { variantsRepository } from './variants.repository';
import { productsRepository } from './products.repository';
import { brandsRepository } from './brands.repository';
import { categoriesRepository } from './categories.repository';
import { sizesRepository } from './sizes.repository';
import { thicknessRepository } from './thickness.repository';

export class PurchaseOrdersRepository {
  private getPOsInternal(): PurchaseOrder[] {
    const list = demoStorage.getItem<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, [...SEED_PURCHASE_ORDERS]);
      return [...SEED_PURCHASE_ORDERS];
    }
    return list;
  }

  private savePOsInternal(pos: PurchaseOrder[]): void {
    demoStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, pos);
  }

  public getAll(filter?: PurchaseOrderFilterOptions): PurchaseOrder[] {
    let list = this.getPOsInternal();

    if (!filter) {
      return [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    if (filter.status && filter.status !== 'ALL') {
      list = list.filter((p) => p.status === filter.status);
    }

    if (filter.supplierId && filter.supplierId !== 'ALL') {
      list = list.filter((p) => p.supplierId === filter.supplierId);
    }

    if (filter.branchId && filter.branchId !== 'all' && filter.branchId !== 'ALL') {
      list = list.filter((p) => p.destinationBranchId === filter.branchId);
    }

    if (filter.startDate) {
      const start = new Date(filter.startDate).getTime();
      list = list.filter((p) => new Date(p.orderDate).getTime() >= start);
    }

    if (filter.endDate) {
      const end = new Date(filter.endDate).getTime();
      list = list.filter((p) => new Date(p.orderDate).getTime() <= end);
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.poNumber.toLowerCase().includes(q) ||
          p.supplierName.toLowerCase().includes(q) ||
          (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q)) ||
          p.destinationBranchName.toLowerCase().includes(q)
      );
    }

    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getById(id: string): PurchaseOrder | null {
    const list = this.getPOsInternal();
    return list.find((p) => p.id === id || p.poNumber === id) || null;
  }

  public getNextPONumber(): string {
    const list = this.getPOsInternal();
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todays = list.filter((p) => p.poNumber.includes(todayStr));
    const nextSeq = String(todays.length + 1).padStart(4, '0');
    return `PO-${todayStr}-${nextSeq}`;
  }

  public create(dto: CreatePurchaseOrderDTO): PurchaseOrder {
    if (!dto.items || dto.items.length === 0) {
      throw new Error('Purchase order must contain at least one line item.');
    }

    const supplier = suppliersRepository.getById(dto.supplierId);
    if (!supplier) {
      throw new Error(`Supplier with ID "${dto.supplierId}" not found.`);
    }
    if (supplier.status === 'INACTIVE') {
      throw new Error(`Supplier "${supplier.name}" is inactive. Cannot create purchase order.`);
    }

    const branch = branchesRepository.getById(dto.destinationBranchId);
    if (!branch) {
      throw new Error(`Branch with ID "${dto.destinationBranchId}" not found.`);
    }

    const location = stockLocationsRepository.getById(dto.destinationLocationId);
    if (!location) {
      throw new Error(`Stock location with ID "${dto.destinationLocationId}" not found.`);
    }

    const poNumber = this.getNextPONumber();
    const now = new Date().toISOString();

    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    const poItems: PurchaseOrderItem[] = dto.items.map((item, idx) => {
      if (item.orderedQuantity <= 0) {
        throw new Error(`Ordered quantity for item #${idx + 1} must be greater than zero.`);
      }
      if (item.unitCost < 0) {
        throw new Error(`Unit cost for item #${idx + 1} cannot be negative.`);
      }

      const variant = variantsRepository.getById(item.variantId);
      if (!variant) {
        throw new Error(`Variant with ID "${item.variantId}" not found.`);
      }

      const product = productsRepository.getById(variant.productId);
      const brand = product ? brandsRepository.getById(product.brandId) : null;
      const category = product ? categoriesRepository.getById(product.categoryId) : null;
      const size = sizesRepository.getById(variant.sizeId);
      const thickness = thicknessRepository.getById(variant.thicknessId);

      const discount = Math.max(0, item.lineDiscount || 0);
      const tax = Math.max(0, item.taxAmount || 0);
      const lineSubtotal = item.orderedQuantity * item.unitCost;
      const lineTotal = Math.max(0, lineSubtotal - discount + tax);

      subtotal += lineSubtotal;
      totalDiscount += discount;
      totalTax += tax;

      return {
        id: `POI-${Date.now().toString().slice(-6)}-${idx + 1}`,
        variantId: variant.id,
        productId: variant.productId,
        productName: product?.name || 'Mattress Product',
        brandName: brand?.name || 'Brand',
        categoryName: category?.name || 'Category',
        sku: variant.sku,
        sizeLabel: size?.displayLabel || 'Standard',
        thicknessLabel: thickness?.displayLabel || 'Standard',
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: 0,
        unitCost: item.unitCost,
        lineDiscount: discount,
        taxAmount: tax,
        lineTotal,
      };
    });

    const grandTotal = Math.max(0, subtotal - totalDiscount + totalTax);

    const newPO: PurchaseOrder = {
      id: `PO-${Date.now().toString().slice(-6)}`,
      poNumber,
      supplierId: supplier.id,
      supplierCode: supplier.code,
      supplierName: supplier.name,
      destinationBranchId: branch.id,
      destinationBranchName: branch.name,
      destinationLocationId: location.id,
      destinationLocationName: location.name,
      orderDate: dto.orderDate || now.slice(0, 10),
      expectedDeliveryDate: dto.expectedDeliveryDate || now.slice(0, 10),
      paymentTerms: dto.paymentTerms || '30 Days Net Credit',
      referenceNumber: dto.referenceNumber?.trim() || undefined,
      status: 'PENDING_APPROVAL',
      items: poItems,
      subtotal,
      discountAmount: totalDiscount,
      taxAmount: totalTax,
      grandTotal,
      notes: dto.notes?.trim() || undefined,
      createdBy: dto.createdBy || 'Purchasing Officer',
      createdByName: dto.createdByName || dto.createdBy || 'Purchasing Officer',
      createdAt: now,
      updatedAt: now,
    };

    const list = this.getPOsInternal();
    list.unshift(newPO);
    this.savePOsInternal(list);
    return newPO;
  }

  public update(id: string, dto: UpdatePurchaseOrderDTO): PurchaseOrder {
    const list = this.getPOsInternal();
    const index = list.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Purchase order with ID "${id}" not found.`);
    }

    const current = list[index];
    if (current.status !== 'DRAFT' && current.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot modify purchase order in "${current.status}" status.`);
    }

    let items = current.items;
    let subtotal = current.subtotal;
    let discountAmount = current.discountAmount;
    let taxAmount = current.taxAmount;
    let grandTotal = current.grandTotal;

    if (dto.items && dto.items.length > 0) {
      subtotal = 0;
      discountAmount = 0;
      taxAmount = 0;

      items = dto.items.map((item, idx) => {
        const variant = variantsRepository.getById(item.variantId);
        if (!variant) throw new Error(`Variant "${item.variantId}" not found.`);
        const product = productsRepository.getById(variant.productId);
        const brand = product ? brandsRepository.getById(product.brandId) : null;
        const category = product ? categoriesRepository.getById(product.categoryId) : null;
        const size = sizesRepository.getById(variant.sizeId);
        const thickness = thicknessRepository.getById(variant.thicknessId);

        const discount = Math.max(0, item.lineDiscount || 0);
        const tax = Math.max(0, item.taxAmount || 0);
        const lineSubtotal = item.orderedQuantity * item.unitCost;
        const lineTotal = Math.max(0, lineSubtotal - discount + tax);

        subtotal += lineSubtotal;
        discountAmount += discount;
        taxAmount += tax;

        return {
          id: `POI-${Date.now().toString().slice(-6)}-${idx + 1}`,
          variantId: variant.id,
          productId: variant.productId,
          productName: product?.name || 'Mattress Product',
          brandName: brand?.name || 'Brand',
          categoryName: category?.name || 'Category',
          sku: variant.sku,
          sizeLabel: size?.displayLabel || 'Standard',
          thicknessLabel: thickness?.displayLabel || 'Standard',
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: 0,
          unitCost: item.unitCost,
          lineDiscount: discount,
          taxAmount: tax,
          lineTotal,
        };
      });

      grandTotal = Math.max(0, subtotal - discountAmount + taxAmount);
    }

    const updated: PurchaseOrder = {
      ...current,
      destinationLocationId: dto.destinationLocationId || current.destinationLocationId,
      expectedDeliveryDate: dto.expectedDeliveryDate || current.expectedDeliveryDate,
      paymentTerms: dto.paymentTerms || current.paymentTerms,
      referenceNumber: dto.referenceNumber !== undefined ? dto.referenceNumber : current.referenceNumber,
      notes: dto.notes !== undefined ? dto.notes : current.notes,
      items,
      subtotal,
      discountAmount,
      taxAmount,
      grandTotal,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.savePOsInternal(list);
    return updated;
  }

  public approve(id: string, approvedBy: string, approvedByName?: string): PurchaseOrder {
    const list = this.getPOsInternal();
    const index = list.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Purchase order with ID "${id}" not found.`);
    }

    const current = list[index];
    if (current.status !== 'PENDING_APPROVAL' && current.status !== 'DRAFT') {
      throw new Error(`Cannot approve purchase order in "${current.status}" status.`);
    }

    const now = new Date().toISOString();
    const updated: PurchaseOrder = {
      ...current,
      status: 'APPROVED',
      approvedBy,
      approvedByName: approvedByName || approvedBy,
      approvedAt: now,
      updatedAt: now,
    };

    list[index] = updated;
    this.savePOsInternal(list);
    return updated;
  }

  public cancel(id: string, reason?: string): PurchaseOrder {
    const list = this.getPOsInternal();
    const index = list.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Purchase order with ID "${id}" not found.`);
    }

    const current = list[index];
    if (current.status === 'FULLY_RECEIVED' || current.status === 'PARTIALLY_RECEIVED') {
      throw new Error(`Cannot cancel purchase order with received goods.`);
    }

    const now = new Date().toISOString();
    const updated: PurchaseOrder = {
      ...current,
      status: 'CANCELLED',
      notes: reason ? `${current.notes ? current.notes + ' | ' : ''}Cancelled: ${reason}` : current.notes,
      updatedAt: now,
    };

    list[index] = updated;
    this.savePOsInternal(list);
    return updated;
  }

  /**
   * Update item received quantities and transition PO status to PARTIALLY_RECEIVED or FULLY_RECEIVED.
   */
  public updateReceivedQuantities(
    poId: string,
    receivedItems: Array<{ sku: string; receivedQuantity: number }>
  ): PurchaseOrder {
    const list = this.getPOsInternal();
    const index = list.findIndex((p) => p.id === poId || p.poNumber === poId);
    if (index === -1) {
      throw new Error(`Purchase order with ID "${poId}" not found.`);
    }

    const po = list[index];
    if (po.status === 'CANCELLED' || po.status === 'CLOSED') {
      throw new Error(`Cannot receive goods for ${po.status.toLowerCase()} purchase order.`);
    }

    const updatedItems = po.items.map((item) => {
      const match = receivedItems.find((r) => r.sku.toUpperCase() === item.sku.toUpperCase());
      if (match) {
        const newReceived = item.receivedQuantity + match.receivedQuantity;
        if (newReceived > item.orderedQuantity) {
          throw new Error(
            `Total received quantity (${newReceived}) exceeds ordered quantity (${item.orderedQuantity}) for SKU ${item.sku}. Over-receiving blocked.`
          );
        }
        return {
          ...item,
          receivedQuantity: newReceived,
        };
      }
      return item;
    });

    const allFulfilled = updatedItems.every((i) => i.receivedQuantity >= i.orderedQuantity);
    const anyReceived = updatedItems.some((i) => i.receivedQuantity > 0);

    const newStatus: PurchaseOrderStatus = allFulfilled
      ? 'FULLY_RECEIVED'
      : anyReceived
      ? 'PARTIALLY_RECEIVED'
      : po.status;

    const updated: PurchaseOrder = {
      ...po,
      status: newStatus,
      items: updatedItems,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.savePOsInternal(list);
    return updated;
  }

  public getSummary(branchId?: string): {
    totalOrders: number;
    pendingApproval: number;
    approved: number;
    partiallyReceived: number;
    fullyReceived: number;
    totalOrderedValue: number;
  } {
    let list = this.getPOsInternal();
    if (branchId && branchId !== 'all') {
      list = list.filter((p) => p.destinationBranchId === branchId);
    }

    return {
      totalOrders: list.length,
      pendingApproval: list.filter((p) => p.status === 'PENDING_APPROVAL').length,
      approved: list.filter((p) => p.status === 'APPROVED').length,
      partiallyReceived: list.filter((p) => p.status === 'PARTIALLY_RECEIVED').length,
      fullyReceived: list.filter((p) => p.status === 'FULLY_RECEIVED').length,
      totalOrderedValue: list
        .filter((p) => p.status !== 'CANCELLED')
        .reduce((sum, p) => sum + p.grandTotal, 0),
    };
  }

  public resetToSeed(): PurchaseOrder[] {
    const seed = [...SEED_PURCHASE_ORDERS];
    demoStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, seed);
    return seed;
  }
}

export const purchaseOrdersRepository = new PurchaseOrdersRepository();
