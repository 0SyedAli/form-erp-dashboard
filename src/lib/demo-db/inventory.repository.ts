import {
  InventoryBalance,
  StockStatus,
  StockReceivingInput,
  OpeningStockInput,
  StockAdjustmentInput,
  StockMovement,
  StockTransfer,
} from '@/types';
import { demoStorage } from './storage';
import { STORAGE_KEYS } from './schema';
import { SEED_INVENTORY_BALANCES } from './seed';
import { stockLocationsRepository } from './stock-locations.repository';
import { stockMovementsRepository } from './stock-movements.repository';
import { variantsRepository } from './variants.repository';
import { branchesRepository } from './branches.repository';

export interface InventoryValuationSummary {
  totalValue: number | null;
  isValuationAvailable: boolean;
  valuedUnitsCount: number;
  unvaluedUnitsCount: number;
  hasUnvaluedItems: boolean;
}

export interface InventoryDashboardKPIs {
  totalStockUnits: number;
  totalLocations: number;
  lowStockSKUs: number;
  outOfStockSKUs: number;
  pendingTransfers: number;
  stockReceivedThisMonth: number;
  damagedStockUnits: number;
  valuation: InventoryValuationSummary;
  branchDistribution: Array<{
    branchId: string;
    branchName: string;
    branchCode: string;
    totalUnits: number;
    availableUnits: number;
    lowStockCount: number;
  }>;
  brandDistribution: Array<{
    brandName: string;
    totalUnits: number;
    percentage: number;
  }>;
  frequentlyMovingSKUs: Array<{
    sku: string;
    productName: string;
    movementCount: number;
    totalQuantityMoved: number;
  }>;
  recentMovements: StockMovement[];
}

class InventoryRepository {
  private getBalancesInternal(): InventoryBalance[] {
    const list = demoStorage.getItem<InventoryBalance[]>(STORAGE_KEYS.INVENTORY_BALANCES, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.INVENTORY_BALANCES, [...SEED_INVENTORY_BALANCES]);
      return [...SEED_INVENTORY_BALANCES];
    }
    return list;
  }

  private saveBalancesInternal(balances: InventoryBalance[]): void {
    demoStorage.setItem(STORAGE_KEYS.INVENTORY_BALANCES, balances);
  }

  private calculateStockStatus(onHand: number, reorderLevel: number): StockStatus {
    if (onHand <= 0) return 'OUT_OF_STOCK';
    if (onHand <= reorderLevel) return 'LOW_STOCK';
    return 'IN_STOCK';
  }

  public getAll(filter?: {
    branchId?: string;
    stockLocationId?: string;
    search?: string;
    brandId?: string;
    categoryId?: string;
    stockStatus?: StockStatus | 'all';
    lowStockOnly?: boolean;
    excludeDamaged?: boolean;
    sortBy?: 'sku' | 'productName' | 'onHand' | 'available' | 'stockStatus' | 'brand';
    sortOrder?: 'asc' | 'desc';
  }): InventoryBalance[] {
    let list = this.getBalancesInternal();

    if (!filter) return list;

    if (filter.branchId && filter.branchId !== 'all') {
      list = list.filter((b) => b.branchId === filter.branchId);
    }

    if (filter.stockLocationId && filter.stockLocationId !== 'all') {
      list = list.filter((b) => b.stockLocationId === filter.stockLocationId);
    }

    if (filter.excludeDamaged) {
      const damagedLocs = stockLocationsRepository
        .getAll({ type: 'RETURNS_DAMAGED' })
        .map((l) => l.id);
      list = list.filter((b) => !damagedLocs.includes(b.stockLocationId));
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.sku.toLowerCase().includes(q) ||
          b.productName.toLowerCase().includes(q) ||
          b.brandName.toLowerCase().includes(q) ||
          b.categoryName.toLowerCase().includes(q) ||
          b.sizeLabel.toLowerCase().includes(q)
      );
    }

    if (filter.stockStatus && filter.stockStatus !== 'all') {
      list = list.filter((b) => b.stockStatus === filter.stockStatus);
    }

    if (filter.lowStockOnly) {
      list = list.filter((b) => b.stockStatus === 'LOW_STOCK' || b.stockStatus === 'OUT_OF_STOCK');
    }

    if (filter.sortBy) {
      const order = filter.sortOrder === 'desc' ? -1 : 1;
      list.sort((a, b) => {
        switch (filter.sortBy) {
          case 'sku':
            return order * a.sku.localeCompare(b.sku);
          case 'productName':
            return order * a.productName.localeCompare(b.productName);
          case 'brand':
            return order * a.brandName.localeCompare(b.brandName);
          case 'onHand':
            return order * (a.onHand - b.onHand);
          case 'available':
            return order * (a.available - b.available);
          case 'stockStatus':
            return order * a.stockStatus.localeCompare(b.stockStatus);
          default:
            return 0;
        }
      });
    }

    return list;
  }

  public getBalance(
    locationIdOrVariantIdOrSku: string,
    skuOrBranchId: string
  ): InventoryBalance | undefined {
    const list = this.getBalancesInternal();
    const byLocAndSku = list.find(
      (b) =>
        b.stockLocationId === locationIdOrVariantIdOrSku &&
        b.sku.toUpperCase() === skuOrBranchId.trim().toUpperCase()
    );
    if (byLocAndSku) return byLocAndSku;

    return list.find(
      (b) =>
        (b.variantId === locationIdOrVariantIdOrSku ||
          b.sku.toUpperCase() === locationIdOrVariantIdOrSku.trim().toUpperCase()) &&
        b.branchId === skuOrBranchId
    );
  }

  public getByBranchAndSku(branchId: string, sku: string): InventoryBalance[] {
    return this.getBalancesInternal().filter(
      (b) =>
        b.branchId === branchId &&
        b.sku.toUpperCase() === sku.trim().toUpperCase()
    );
  }

  public getTotalAvailableForBranchAndSku(branchId: string, sku: string): number {
    const damagedLocIds = stockLocationsRepository
      .getAll({ branchId, type: 'RETURNS_DAMAGED' })
      .map((l) => l.id);

    return this.getByBranchAndSku(branchId, sku)
      .filter((b) => !damagedLocIds.includes(b.stockLocationId))
      .reduce((sum, b) => sum + b.available, 0);
  }

  public getByBranch(branchId: string): InventoryBalance[] {
    return this.getAll({ branchId });
  }

  /**
   * Complete stock-in functionality (Goods Receiving Note / Stock Receipt).
   */
  public receiveStock(input: StockReceivingInput): {
    receiptNumber: string;
    updatedBalances: InventoryBalance[];
    movements: StockMovement[];
  } {
    if (!input.items || input.items.length === 0) {
      throw new Error('At least one item is required for stock receiving.');
    }

    const destinationLocation = stockLocationsRepository.getById(input.destinationLocationId);
    if (!destinationLocation) {
      throw new Error(`Destination stock location "${input.destinationLocationId}" not found.`);
    }
    if (!destinationLocation.isActive) {
      throw new Error(`Destination stock location "${destinationLocation.name}" is deactivated.`);
    }

    const branch = branchesRepository.getById(input.destinationBranchId);
    if (!branch || !branch.isActive) {
      throw new Error('Destination branch is invalid or deactivated.');
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const receiptNumber = `RCV-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();

    const balances = this.getBalancesInternal();
    const updatedBalances: InventoryBalance[] = [];
    const movements: StockMovement[] = [];

    for (const item of input.items) {
      if (item.quantity <= 0 || !Number.isFinite(item.quantity)) {
        throw new Error(`Invalid receiving quantity ${item.quantity} for SKU "${item.sku}". Must be positive.`);
      }

      const variant = variantsRepository.getBySku(item.sku);
      if (!variant) {
        throw new Error(`Variant SKU "${item.sku}" does not exist in the catalogue.`);
      }
      if (variant.status === 'INACTIVE') {
        throw new Error(`Cannot receive stock for deactivated SKU "${item.sku}".`);
      }

      const balance = balances.find(
        (b) =>
          b.stockLocationId === input.destinationLocationId &&
          b.sku.toUpperCase() === item.sku.trim().toUpperCase()
      );

      if (!balance) {
        const newBalance: InventoryBalance = {
          id: `BAL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
          stockLocationId: input.destinationLocationId,
          branchId: input.destinationBranchId,
          productId: variant.productId,
          variantId: variant.id,
          sku: variant.sku,
          productName: variant.productName || 'Mattress Product',
          brandName: variant.brandName || 'MoltyFoam',
          categoryName: variant.categoryName || 'Foam',
          sizeLabel: variant.sizeLabel || '',
          thicknessInches: parseFloat(variant.thicknessLabel?.replace(/"/g, '') || '6') || 6,
          onHand: item.quantity,
          reserved: 0,
          available: item.quantity,
          reorderLevel: 5,
          unitCost: item.unitCost,
          stockStatus: this.calculateStockStatus(item.quantity, 5),
          updatedAt: now,
        };
        balances.push(newBalance);
        updatedBalances.push(newBalance);
      } else {
        balance.onHand += item.quantity;
        balance.available = balance.onHand - balance.reserved;
        balance.stockStatus = this.calculateStockStatus(balance.onHand, balance.reorderLevel);
        if (item.unitCost !== undefined && item.unitCost > 0) {
          balance.unitCost = item.unitCost;
        }
        balance.updatedAt = now;
        updatedBalances.push({ ...balance });
      }

      // Record immutable movement
      const movement = stockMovementsRepository.logMovement({
        documentReference: input.referenceNumber?.trim() || receiptNumber,
        sku: variant.sku,
        productId: variant.productId,
        variantId: variant.id,
        destinationLocationId: input.destinationLocationId,
        destinationBranchId: input.destinationBranchId,
        movementType: 'STOCK_RECEIPT',
        quantity: item.quantity,
        unitCost: item.unitCost,
        createdBy: input.receivedBy,
        timestamp: now,
        notes: input.notes
          ? `${input.supplierName ? `Supplier: ${input.supplierName} — ` : ''}${input.notes}`
          : input.supplierName ? `Received from supplier ${input.supplierName}` : 'Inward stock receipt',
      });
      movements.push(movement);
    }

    this.saveBalancesInternal(balances);
    return { receiptNumber, updatedBalances, movements };
  }

  /**
   * Opening Stock workflow with duplicate initialization prevention.
   */
  public createOpeningStock(input: OpeningStockInput): {
    referenceNumber: string;
    updatedBalances: InventoryBalance[];
    movements: StockMovement[];
  } {
    if (!input.items || input.items.length === 0) {
      throw new Error('At least one item is required for opening stock.');
    }

    const location = stockLocationsRepository.getById(input.stockLocationId);
    if (!location) {
      throw new Error(`Stock location "${input.stockLocationId}" not found.`);
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const referenceNumber = input.referenceNumber?.trim() || `OB-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();

    const existingMovements = stockMovementsRepository.getAll({
      locationId: input.stockLocationId,
      movementType: 'OPENING_BALANCE',
    });

    const balances = this.getBalancesInternal();
    const updatedBalances: InventoryBalance[] = [];
    const movements: StockMovement[] = [];

    for (const item of input.items) {
      if (item.openingQuantity <= 0 || !Number.isFinite(item.openingQuantity)) {
        throw new Error(`Opening quantity must be a positive number for SKU "${item.sku}".`);
      }

      // Prevent duplicate opening stock initialization for the same SKU & location
      const alreadyInitialized = existingMovements.some(
        (m) => m.sku.toUpperCase() === item.sku.trim().toUpperCase()
      );
      if (alreadyInitialized) {
        throw new Error(
          `Opening stock has already been initialized for SKU "${item.sku}" at location "${location.name}". Use Stock Adjustment for corrections.`
        );
      }

      const variant = variantsRepository.getBySku(item.sku);
      if (!variant) {
        throw new Error(`Variant SKU "${item.sku}" not found in catalogue.`);
      }

      let balance = balances.find(
        (b) =>
          b.stockLocationId === input.stockLocationId &&
          b.sku.toUpperCase() === item.sku.trim().toUpperCase()
      );

      if (!balance) {
        balance = {
          id: `BAL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
          stockLocationId: input.stockLocationId,
          branchId: input.branchId,
          productId: variant.productId,
          variantId: variant.id,
          sku: variant.sku,
          productName: variant.productName || 'Mattress Product',
          brandName: variant.brandName || 'MoltyFoam',
          categoryName: variant.categoryName || 'Foam',
          sizeLabel: variant.sizeLabel || '',
          thicknessInches: parseFloat(variant.thicknessLabel?.replace(/"/g, '') || '6') || 6,
          onHand: item.openingQuantity,
          reserved: 0,
          available: item.openingQuantity,
          reorderLevel: 5,
          unitCost: item.unitCost,
          stockStatus: this.calculateStockStatus(item.openingQuantity, 5),
          updatedAt: now,
        };
        balances.push(balance);
      } else {
        balance.onHand = item.openingQuantity;
        balance.available = balance.onHand - balance.reserved;
        balance.stockStatus = this.calculateStockStatus(balance.onHand, balance.reorderLevel);
        if (item.unitCost !== undefined) balance.unitCost = item.unitCost;
        balance.updatedAt = now;
      }

      updatedBalances.push({ ...balance });

      const movement = stockMovementsRepository.logMovement({
        documentReference: referenceNumber,
        sku: variant.sku,
        productId: variant.productId,
        variantId: variant.id,
        destinationLocationId: input.stockLocationId,
        destinationBranchId: input.branchId,
        movementType: 'OPENING_BALANCE',
        quantity: item.openingQuantity,
        unitCost: item.unitCost,
        createdBy: input.createdBy,
        timestamp: now,
        notes: input.notes?.trim() || 'Initial opening balance ledger entry',
      });
      movements.push(movement);
    }

    this.saveBalancesInternal(balances);
    return { referenceNumber, updatedBalances, movements };
  }

  /**
   * Stock Adjustments with mandatory audit reason.
   */
  public adjustStock(input: StockAdjustmentInput): {
    adjustmentId: string;
    updatedBalance: InventoryBalance;
    movement: StockMovement;
  } {
    if (!input.reason || !input.reason.trim()) {
      throw new Error('A detailed reason is strictly mandatory for all stock adjustments.');
    }

    if (input.quantityDifference === 0) {
      throw new Error('Adjustment quantity difference cannot be zero.');
    }

    const balances = this.getBalancesInternal();
    const idx = balances.findIndex(
      (b) =>
        b.stockLocationId === input.stockLocationId &&
        b.sku.toUpperCase() === input.sku.trim().toUpperCase()
    );

    if (idx === -1) {
      throw new Error(`No stock balance record exists for SKU "${input.sku}" at location "${input.stockLocationId}".`);
    }

    const balance = balances[idx];
    const newOnHand = balance.onHand + input.quantityDifference;

    if (newOnHand < 0) {
      throw new Error(`Cannot adjust stock below zero. Current: ${balance.onHand}, adjustment: ${input.quantityDifference}.`);
    }

    const now = new Date().toISOString();
    const adjustmentId = `ADJ-${now.slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    let movementType: StockMovement['movementType'] =
      input.quantityDifference > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';

    // Handle damaged mattress write-off / quarantine routing
    if (input.adjustmentType === 'DAMAGED_MATTRESS') {
      movementType = 'DAMAGED_STOCK';
      // Find or create damaged area in the branch
      const damagedLoc = stockLocationsRepository
        .getByBranchId(input.branchId)
        .find((l) => l.type === 'RETURNS_DAMAGED');

      if (damagedLoc && input.quantityDifference < 0) {
        // Move damaged units to quarantine location
        const damagedQty = Math.abs(input.quantityDifference);
        let dmgBalance = balances.find(
          (b) =>
            b.stockLocationId === damagedLoc.id &&
            b.sku.toUpperCase() === input.sku.trim().toUpperCase()
        );
        if (!dmgBalance) {
          dmgBalance = {
            ...balance,
            id: `BAL-DMG-${Date.now().toString(36).toUpperCase()}`,
            stockLocationId: damagedLoc.id,
            onHand: damagedQty,
            reserved: 0,
            available: damagedQty,
            reorderLevel: 0,
            updatedAt: now,
          };
          balances.push(dmgBalance);
        } else {
          dmgBalance.onHand += damagedQty;
          dmgBalance.available = dmgBalance.onHand - dmgBalance.reserved;
          dmgBalance.updatedAt = now;
        }
      }
    } else if (input.adjustmentType === 'RETURN_TO_SALEABLE') {
      movementType = 'RETURN_TO_SALEABLE';
    }

    balance.onHand = newOnHand;
    balance.available = balance.onHand - balance.reserved;
    balance.stockStatus = this.calculateStockStatus(balance.onHand, balance.reorderLevel);
    balance.updatedAt = now;

    this.saveBalancesInternal(balances);

    const movement = stockMovementsRepository.logMovement({
      documentReference: adjustmentId,
      sku: balance.sku,
      productId: balance.productId,
      variantId: balance.variantId,
      sourceLocationId: input.quantityDifference < 0 ? input.stockLocationId : undefined,
      sourceBranchId: input.quantityDifference < 0 ? input.branchId : undefined,
      destinationLocationId: input.quantityDifference > 0 ? input.stockLocationId : undefined,
      destinationBranchId: input.quantityDifference > 0 ? input.branchId : undefined,
      movementType,
      quantity: Math.abs(input.quantityDifference),
      unitCost: balance.unitCost,
      createdBy: input.authorizedBy,
      timestamp: now,
      notes: `[${input.adjustmentType}] ${input.reason.trim()}${input.notes ? ` — ${input.notes.trim()}` : ''}`,
    });

    return { adjustmentId, updatedBalance: balance, movement };
  }

  public setReorderLevel(stockLocationId: string, sku: string, reorderLevel: number): InventoryBalance {
    if (reorderLevel < 0) {
      throw new Error('Reorder level cannot be negative.');
    }

    const balances = this.getBalancesInternal();
    const balance = balances.find(
      (b) =>
        b.stockLocationId === stockLocationId &&
        b.sku.toUpperCase() === sku.trim().toUpperCase()
    );

    if (!balance) {
      throw new Error(`Inventory balance not found for SKU "${sku}" at location "${stockLocationId}".`);
    }

    balance.reorderLevel = reorderLevel;
    balance.stockStatus = this.calculateStockStatus(balance.onHand, reorderLevel);
    balance.updatedAt = new Date().toISOString();

    this.saveBalancesInternal(balances);
    return balance;
  }

  /**
   * Internal direct balance update (used by transfers & counts repositories).
   */
  public updateBalanceInternal(
    stockLocationId: string,
    sku: string,
    updater: (current: InventoryBalance) => void
  ): InventoryBalance {
    const balances = this.getBalancesInternal();
    let balance = balances.find(
      (b) =>
        b.stockLocationId === stockLocationId &&
        b.sku.toUpperCase() === sku.trim().toUpperCase()
    );

    if (!balance) {
      const variant = variantsRepository.getBySku(sku);
      if (!variant) throw new Error(`SKU "${sku}" not found in catalogue.`);
      const loc = stockLocationsRepository.getById(stockLocationId);
      if (!loc) throw new Error(`Location "${stockLocationId}" not found.`);

      balance = {
        id: `BAL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
        stockLocationId,
        branchId: loc.branchId || '',
        productId: variant.productId,
        variantId: variant.id,
        sku: variant.sku,
        productName: variant.productName || 'Mattress Product',
        brandName: variant.brandName || 'MoltyFoam',
        categoryName: variant.categoryName || 'Foam',
        sizeLabel: variant.sizeLabel || '',
        thicknessInches: 6,
        onHand: 0,
        reserved: 0,
        available: 0,
        reorderLevel: 5,
        stockStatus: 'OUT_OF_STOCK',
        updatedAt: new Date().toISOString(),
      };
      balances.push(balance);
    }

    updater(balance);
    balance.available = balance.onHand - balance.reserved;
    balance.stockStatus = this.calculateStockStatus(balance.onHand, balance.reorderLevel);
    balance.updatedAt = new Date().toISOString();

    this.saveBalancesInternal(balances);
    return balance;
  }

  /**
   * Comprehensive Inventory Overview KPIs & Analytics.
   */
  public getDashboardKPIs(branchId?: string): InventoryDashboardKPIs {
    const isFiltered = branchId && branchId !== 'all';
    const balances = this.getAll({ branchId: isFiltered ? branchId : undefined });
    const damagedLocIds = stockLocationsRepository
      .getAll({ type: 'RETURNS_DAMAGED' })
      .map((l) => l.id);

    const saleableBalances = balances.filter((b) => !damagedLocIds.includes(b.stockLocationId));
    const damagedBalances = balances.filter((b) => damagedLocIds.includes(b.stockLocationId));

    const totalStockUnits = saleableBalances.reduce((sum, b) => sum + b.onHand, 0);
    const damagedStockUnits = damagedBalances.reduce((sum, b) => sum + b.onHand, 0);

    const activeLocations = stockLocationsRepository.getAll({
      branchId: isFiltered ? branchId : undefined,
      isActive: true,
    });

    const lowStockSKUs = saleableBalances.filter((b) => b.stockStatus === 'LOW_STOCK').length;
    const outOfStockSKUs = saleableBalances.filter((b) => b.stockStatus === 'OUT_OF_STOCK').length;

    // Transfers & monthly movements
    const movements = stockMovementsRepository.getAll({
      branchId: isFiltered ? branchId : undefined,
    });

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const stockReceivedThisMonth = movements
      .filter((m) => m.movementType === 'STOCK_RECEIPT' && m.timestamp.startsWith(currentYearMonth))
      .reduce((sum, m) => sum + m.quantity, 0);

    // Valuation calculation strictly using reliable unitCost data
    let totalValuation = 0;
    let valuedUnitsCount = 0;
    let unvaluedUnitsCount = 0;

    for (const b of saleableBalances) {
      if (b.unitCost !== undefined && b.unitCost > 0) {
        totalValuation += b.unitCost * b.onHand;
        valuedUnitsCount += b.onHand;
      } else {
        unvaluedUnitsCount += b.onHand;
      }
    }

    const isValuationAvailable = valuedUnitsCount > 0;
    const valuation: InventoryValuationSummary = {
      totalValue: isValuationAvailable ? totalValuation : null,
      isValuationAvailable,
      valuedUnitsCount,
      unvaluedUnitsCount,
      hasUnvaluedItems: unvaluedUnitsCount > 0,
    };

    // Branch Distribution
    const allBranches = branchesRepository.getAll();
    const branchDistribution = allBranches.map((br) => {
      const brBalances = this.getBalancesInternal().filter(
        (b) => b.branchId === br.id && !damagedLocIds.includes(b.stockLocationId)
      );
      const units = brBalances.reduce((s, b) => s + b.onHand, 0);
      const avail = brBalances.reduce((s, b) => s + b.available, 0);
      const low = brBalances.filter((b) => b.stockStatus === 'LOW_STOCK' || b.stockStatus === 'OUT_OF_STOCK').length;
      return {
        branchId: br.id,
        branchName: br.name,
        branchCode: br.code,
        totalUnits: units,
        availableUnits: avail,
        lowStockCount: low,
      };
    });

    // Brand Distribution
    const brandMap = new Map<string, number>();
    for (const b of saleableBalances) {
      brandMap.set(b.brandName, (brandMap.get(b.brandName) || 0) + b.onHand);
    }
    const brandDistribution: Array<{ brandName: string; totalUnits: number; percentage: number }> = [];
    brandMap.forEach((units, brandName) => {
      brandDistribution.push({
        brandName,
        totalUnits: units,
        percentage: totalStockUnits > 0 ? Math.round((units / totalStockUnits) * 100) : 0,
      });
    });

    // Frequently Moving SKUs (from ledger movements)
    const movingMap = new Map<string, { sku: string; productName: string; movementCount: number; totalQuantityMoved: number }>();
    for (const m of movements) {
      const existing = movingMap.get(m.sku) || {
        sku: m.sku,
        productName: saleableBalances.find((b) => b.sku === m.sku)?.productName || m.sku,
        movementCount: 0,
        totalQuantityMoved: 0,
      };
      existing.movementCount += 1;
      existing.totalQuantityMoved += m.quantity;
      movingMap.set(m.sku, existing);
    }
    const frequentlyMovingSKUs = Array.from(movingMap.values())
      .sort((a, b) => b.movementCount - a.movementCount)
      .slice(0, 6);

    const recentMovements = movements.slice(0, 8);

    // Dynamic pending transfer count from storage
    const allTransfers = demoStorage.getItem<StockTransfer[]>(STORAGE_KEYS.STOCK_TRANSFERS, []);
    const pendingTransfers = allTransfers.filter(
      (t) =>
        t.status === 'PENDING_APPROVAL' &&
        (!isFiltered || t.sourceBranchId === branchId || t.destinationBranchId === branchId)
    ).length;

    return {
      totalStockUnits,
      totalLocations: activeLocations.length,
      lowStockSKUs,
      outOfStockSKUs,
      pendingTransfers,
      stockReceivedThisMonth,
      damagedStockUnits,
      valuation,
      branchDistribution,
      brandDistribution,
      frequentlyMovingSKUs,
      recentMovements,
    };
  }

  /**
   * Flow 06: Atomically deduct stock balances for completed POS retail sale.
   * Logs a 'POS_SALE' movement referencing the invoice.
   */
  public deductStockForSale(
    branchId: string,
    stockLocationId: string,
    items: Array<{ sku: string; quantity: number }>,
    invoiceNumber: string,
    cashierName: string
  ): StockMovement[] {
    const balances = this.getBalancesInternal();
    const movements: StockMovement[] = [];
    const now = new Date().toISOString();

    // 1. Validation pass: ensure all items exist and have sufficient stock
    for (const item of items) {
      if (item.quantity <= 0 || !Number.isFinite(item.quantity)) {
        throw new Error(`Invalid sale quantity ${item.quantity} for SKU "${item.sku}". Must be positive.`);
      }

      const balance = balances.find(
        (b) =>
          b.stockLocationId === stockLocationId &&
          b.sku.toUpperCase() === item.sku.trim().toUpperCase()
      );

      if (!balance) {
        throw new Error(
          `No inventory record found for SKU "${item.sku}" at stock location "${stockLocationId}".`
        );
      }

      if (balance.available < item.quantity) {
        throw new Error(
          `Insufficient stock for "${item.sku}". Requested: ${item.quantity}, Available: ${balance.available}.`
        );
      }
    }

    // 2. Deduction pass: mutate balances and log movements
    for (const item of items) {
      const balance = balances.find(
        (b) =>
          b.stockLocationId === stockLocationId &&
          b.sku.toUpperCase() === item.sku.trim().toUpperCase()
      )!;

      balance.onHand -= item.quantity;
      balance.available = balance.onHand - balance.reserved;
      balance.stockStatus = this.calculateStockStatus(balance.onHand, balance.reorderLevel);
      balance.updatedAt = now;

      const movement = stockMovementsRepository.logMovement({
        documentReference: invoiceNumber,
        sku: balance.sku,
        productId: balance.productId,
        variantId: balance.variantId,
        sourceLocationId: stockLocationId,
        sourceBranchId: branchId,
        movementType: 'POS_SALE',
        quantity: item.quantity,
        unitCost: balance.unitCost,
        createdBy: cashierName,
        timestamp: now,
        notes: `Retail POS counter sale #${invoiceNumber}`,
      });

      movements.push(movement);
    }

    this.saveBalancesInternal(balances);
    return movements;
  }

  public resetToSeed(): InventoryBalance[] {
    demoStorage.setItem(STORAGE_KEYS.INVENTORY_BALANCES, [...SEED_INVENTORY_BALANCES]);
    return [...SEED_INVENTORY_BALANCES];
  }
}

export const inventoryRepository = new InventoryRepository();
