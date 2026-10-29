import { ProductVariant, PricingHistoryRecord } from '@/types';
import {
  STORAGE_KEYS,
  UpdatePricingDTO,
  BulkUpdatePricingDTO,
  CatalogueValidationError,
} from './schema';
import { SEED_PRICING_HISTORY } from './seed';
import { demoStorage } from './storage';
import { variantsRepository } from './variants.repository';

class PricingRepository {
  private getHistoryInternal(): PricingHistoryRecord[] {
    const list = demoStorage.getItem<PricingHistoryRecord[]>(STORAGE_KEYS.PRICING_HISTORY, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.PRICING_HISTORY, [...SEED_PRICING_HISTORY]);
      return [...SEED_PRICING_HISTORY];
    }
    return list;
  }

  private saveHistoryInternal(records: PricingHistoryRecord[]): void {
    demoStorage.setItem(STORAGE_KEYS.PRICING_HISTORY, records);
  }

  public getHistory(variantId?: string): PricingHistoryRecord[] {
    let list = this.getHistoryInternal();
    if (variantId && variantId !== 'all') {
      list = list.filter((r) => r.variantId === variantId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public updateVariantPrice(
    variantId: string,
    input: {
      retailPrice?: number;
      walkInPrice?: number;
      wholesalePrice?: number;
      distributorPrice?: number;
      changedBy?: string;
      reason?: string;
    }
  ): {
    variant: ProductVariant;
    history: PricingHistoryRecord;
  } {
    return this.updatePrice({
      variantId,
      retailPrice: input.walkInPrice ?? input.retailPrice,
      walkInPrice: input.walkInPrice ?? input.retailPrice,
      wholesalePrice: input.wholesalePrice,
      distributorPrice: input.distributorPrice,
      changedBy: input.changedBy || 'System',
      changeReason: input.reason,
    });
  }

  public bulkUpdatePrices(input: {
    scope?: string;
    brandId?: string;
    productId?: string;
    retailAdjustmentType?: 'PERCENTAGE' | 'FIXED';
    retailAdjustmentValue?: number;
    wholesaleAdjustmentType?: 'PERCENTAGE' | 'FIXED';
    wholesaleAdjustmentValue?: number;
    changedBy?: string;
    reason?: string;
  }): {
    updatedCount: number;
    history: PricingHistoryRecord[];
  } {
    let variants = variantsRepository.getAll();
    if (input.productId && input.productId !== 'all') {
      variants = variants.filter((v) => v.productId === input.productId);
    } else if (input.brandId && input.brandId !== 'all') {
      variants = variants.filter((v) => v.brandId === input.brandId);
    }

    const updates = variants.map((v) => {
      let r = v.retailPrice;
      let w = v.wholesalePrice;
      let d = v.distributorPrice ?? Math.round(w * 0.88);
      if (input.retailAdjustmentType === 'PERCENTAGE' && input.retailAdjustmentValue) {
        r = Math.round(r * (1 + input.retailAdjustmentValue / 100));
      } else if (input.retailAdjustmentType === 'FIXED' && input.retailAdjustmentValue) {
        r = r + input.retailAdjustmentValue;
      }

      if (input.wholesaleAdjustmentType === 'PERCENTAGE' && input.wholesaleAdjustmentValue) {
        w = Math.round(w * (1 + input.wholesaleAdjustmentValue / 100));
        d = Math.round(d * (1 + input.wholesaleAdjustmentValue / 100));
      } else if (input.wholesaleAdjustmentType === 'FIXED' && input.wholesaleAdjustmentValue) {
        w = w + input.wholesaleAdjustmentValue;
        d = d + input.wholesaleAdjustmentValue;
      }

      return {
        variantId: v.id,
        retailPrice: Math.max(0, r),
        wholesalePrice: Math.max(0, w),
        distributorPrice: Math.max(0, d),
      };
    });

    return this.bulkUpdate({
      updates,
      changedBy: input.changedBy || 'System',
      changeReason: input.reason,
    });
  }

  public updatePrice(input: UpdatePricingDTO): {
    variant: ProductVariant;
    history: PricingHistoryRecord;
  } {
    const variant = variantsRepository.getById(input.variantId);
    if (!variant) {
      throw new CatalogueValidationError(`Variant with ID "${input.variantId}" not found.`, [
        { field: 'variantId', message: 'Variant does not exist.' },
      ]);
    }

    const errors: Array<{ field: string; message: string }> = [];

    const effectiveRetail = input.walkInPrice !== undefined ? input.walkInPrice : input.retailPrice;
    const newRetail = effectiveRetail !== undefined ? Math.round(Number(effectiveRetail)) : variant.retailPrice;
    const newWholesale = input.wholesalePrice !== undefined ? Math.round(Number(input.wholesalePrice)) : variant.wholesalePrice;
    const newDistributor = input.distributorPrice !== undefined ? Math.round(Number(input.distributorPrice)) : (variant.distributorPrice ?? Math.round(newWholesale * 0.88));

    if (newRetail < 0) {
      errors.push({ field: 'retailPrice', message: 'Retail / Walk-in price cannot be negative.' });
    }
    if (newWholesale < 0) {
      errors.push({ field: 'wholesalePrice', message: 'Wholesale price cannot be negative.' });
    }
    if (newDistributor < 0) {
      errors.push({ field: 'distributorPrice', message: 'Distributor price cannot be negative.' });
    }

    if (errors.length > 0) {
      throw new CatalogueValidationError('Price update failed', errors);
    }

    const updatedVariant = variantsRepository.update(variant.id, {
      retailPrice: newRetail,
      walkInPrice: newRetail,
      wholesalePrice: newWholesale,
      distributorPrice: newDistributor,
    });

    const now = new Date().toISOString();
    const historyRecord: PricingHistoryRecord = {
      id: `PRC-HIST-${Date.now().toString().slice(-6)}`,
      variantId: variant.id,
      sku: variant.sku,
      oldRetailPrice: variant.retailPrice,
      newRetailPrice: newRetail,
      oldWholesalePrice: variant.wholesalePrice,
      newWholesalePrice: newWholesale,
      oldDistributorPrice: variant.distributorPrice ?? Math.round(variant.wholesalePrice * 0.88),
      newDistributorPrice: newDistributor,
      changedBy: input.changedBy || 'ERP User',
      changeReason: input.changeReason?.trim() || 'Manual price adjustment',
      createdAt: now,
    };

    const historyList = this.getHistoryInternal();
    historyList.unshift(historyRecord);
    this.saveHistoryInternal(historyList);

    return {
      variant: updatedVariant,
      history: historyRecord,
    };
  }

  public bulkUpdate(input: BulkUpdatePricingDTO): {
    updatedCount: number;
    history: PricingHistoryRecord[];
  } {
    if (!input.updates || input.updates.length === 0) {
      throw new CatalogueValidationError('No pricing updates provided', [
        { field: 'updates', message: 'Please provide at least one price update.' },
      ]);
    }

    const createdHistory: PricingHistoryRecord[] = [];
    const historyList = this.getHistoryInternal();
    const now = new Date().toISOString();

    input.updates.forEach((u) => {
      const variant = variantsRepository.getById(u.variantId);
      if (!variant) return;

      const targetRetail = u.retailPrice !== undefined ? Math.round(Number(u.retailPrice)) : variant.retailPrice;
      const targetWholesale = u.wholesalePrice !== undefined ? Math.round(Number(u.wholesalePrice)) : variant.wholesalePrice;

      if (targetRetail < 0 || targetWholesale < 0) return;

      variantsRepository.update(variant.id, {
        retailPrice: targetRetail,
        wholesalePrice: targetWholesale,
      });

      const record: PricingHistoryRecord = {
        id: `PRC-HIST-${Date.now().toString().slice(-6)}-${variant.sku.slice(-4)}`,
        variantId: variant.id,
        sku: variant.sku,
        oldRetailPrice: variant.retailPrice,
        newRetailPrice: targetRetail,
        oldWholesalePrice: variant.wholesalePrice,
        newWholesalePrice: targetWholesale,
        changedBy: input.changedBy || 'ERP User',
        changeReason: input.changeReason?.trim() || 'Bulk catalogue price update',
        createdAt: now,
      };

      historyList.unshift(record);
      createdHistory.push(record);
    });

    this.saveHistoryInternal(historyList);

    return {
      updatedCount: createdHistory.length,
      history: createdHistory,
    };
  }

  public getPricingSummary(): {
    totalVariants: number;
    avgRetail: number;
    avgWholesale: number;
    minRetail: number;
    maxRetail: number;
  } {
    const variants = variantsRepository.getAll();
    if (variants.length === 0) {
      return { totalVariants: 0, avgRetail: 0, avgWholesale: 0, minRetail: 0, maxRetail: 0 };
    }

    const retailPrices = variants.map((v) => v.retailPrice);
    const wholesalePrices = variants.map((v) => v.wholesalePrice);

    const sumRetail = retailPrices.reduce((acc, p) => acc + p, 0);
    const sumWholesale = wholesalePrices.reduce((acc, p) => acc + p, 0);

    return {
      totalVariants: variants.length,
      avgRetail: Math.round(sumRetail / variants.length),
      avgWholesale: Math.round(sumWholesale / variants.length),
      minRetail: Math.min(...retailPrices),
      maxRetail: Math.max(...retailPrices),
    };
  }

  public resetToSeed(): void {
    this.saveHistoryInternal([...SEED_PRICING_HISTORY]);
  }
}

export const pricingRepository = new PricingRepository();
