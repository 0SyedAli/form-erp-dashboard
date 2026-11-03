import { PriceListType, PriceListItem, ProductVariant } from '@/types';
import { STORAGE_KEYS } from './schema';
import { demoStorage } from './storage';
import { variantsRepository } from './variants.repository';

export class PriceListsRepository {
  private getItemsInternal(): PriceListItem[] {
    return demoStorage.getItem<PriceListItem[]>(STORAGE_KEYS.PRICE_LISTS, []);
  }

  private saveItemsInternal(items: PriceListItem[]): void {
    demoStorage.setItem(STORAGE_KEYS.PRICE_LISTS, items);
  }

  /**
   * Resolve unit price for a given variant and sale type / price list tier.
   * Checks custom price list item overrides first; falls back to variant model prices.
   * Accepts either (variant, priceListType) or (priceListType, variantId | variant).
   */
  public getPriceForVariant(
    firstArg: ProductVariant | PriceListType | string,
    secondArg?: PriceListType | string | ProductVariant
  ): number {
    let pType: PriceListType = 'WALK_IN';
    let variantObj: ProductVariant | null = null;
    let variantId = '';

    if (firstArg === 'WALK_IN' || firstArg === 'WHOLESALE' || firstArg === 'DISTRIBUTOR') {
      pType = firstArg as PriceListType;
      if (typeof secondArg === 'object' && secondArg !== null) {
        variantObj = secondArg as ProductVariant;
        variantId = variantObj.id;
      } else if (typeof secondArg === 'string') {
        variantId = secondArg;
        variantObj = variantsRepository.getAll().find((v) => v.id === variantId) || null;
      }
    } else if (typeof firstArg === 'object' && firstArg !== null) {
      variantObj = firstArg as ProductVariant;
      variantId = variantObj.id;
      pType = (secondArg as PriceListType) || 'WALK_IN';
    } else if (typeof firstArg === 'string') {
      variantId = firstArg;
      variantObj = variantsRepository.getAll().find((v) => v.id === variantId) || null;
      pType = (secondArg as PriceListType) || 'WALK_IN';
    }

    const customItems = this.getItemsInternal();
    const custom = customItems.find(
      (item) =>
        item.variantId === variantId &&
        item.priceListType === pType &&
        item.status === 'ACTIVE'
    );

    if (custom) {
      return custom.price;
    }

    if (!variantObj) {
      return 0;
    }

    if (pType === 'WALK_IN') {
      return variantObj.walkInPrice ?? variantObj.retailPrice ?? 0;
    } else if (pType === 'WHOLESALE') {
      return variantObj.wholesalePrice ?? 0;
    } else if (pType === 'DISTRIBUTOR') {
      return variantObj.distributorPrice ?? Math.round((variantObj.wholesalePrice || 0) * 0.88);
    }

    return variantObj.retailPrice ?? 0;
  }

  public getPriceBySku(sku: string, priceListType: PriceListType): number | null {
    const variant = variantsRepository.getAll().find((v) => v.sku === sku);
    if (!variant) return null;
    return this.getPriceForVariant(variant, priceListType);
  }

  public getAll(priceListType?: PriceListType, variantId?: string): PriceListItem[] {
    let items = this.getItemsInternal();
    if (priceListType) {
      items = items.filter((i) => i.priceListType === priceListType);
    }
    if (variantId) {
      items = items.filter((i) => i.variantId === variantId);
    }
    return items;
  }

  public setPrice(
    arg1: PriceListType | string,
    arg2: string,
    arg3: number | PriceListType,
    arg4?: number
  ): PriceListItem {
    let priceListType: PriceListType;
    let variantId: string;
    let price: number;
    let sku = '';

    if (arg1 === 'WALK_IN' || arg1 === 'WHOLESALE' || arg1 === 'DISTRIBUTOR') {
      priceListType = arg1;
      variantId = arg2;
      price = typeof arg3 === 'number' ? arg3 : 0;
      const v = variantsRepository.getAll().find((vr) => vr.id === variantId);
      sku = v ? v.sku : '';
    } else {
      variantId = arg1;
      sku = arg2;
      priceListType = arg3 as PriceListType;
      price = arg4 || 0;
    }

    const items = this.getItemsInternal();
    const existingIndex = items.findIndex(
      (it) => it.variantId === variantId && it.priceListType === priceListType
    );

    if (existingIndex >= 0) {
      items[existingIndex].price = price;
      items[existingIndex].status = 'ACTIVE';
      this.saveItemsInternal(items);
      return items[existingIndex];
    }

    const newItem: PriceListItem = {
      id: `PL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      variantId,
      sku,
      priceListType,
      price,
      status: 'ACTIVE',
    };

    items.push(newItem);
    this.saveItemsInternal(items);
    return newItem;
  }

  public resetToSeed(): PriceListItem[] {
    demoStorage.setItem(STORAGE_KEYS.PRICE_LISTS, []);
    return [];
  }
}

export const priceListsRepository = new PriceListsRepository();
