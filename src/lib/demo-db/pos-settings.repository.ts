import { POSSettings } from '@/types';
import { STORAGE_KEYS } from './schema';
import { demoStorage } from './storage';

export const DEFAULT_POS_SETTINGS: POSSettings = {
  selectedBranchId: 'BR-MAIN-01',
  cashierName: 'Admin',
  receiptFormat: 'THERMAL_80MM',
  autoPrint: false,
  showThumbnails: true,
  shiftName: 'Morning',
  taxRatePercent: 0,
  defaultPaymentMethod: 'CASH',
};

class POSSettingsRepository {
  public getSettings(): POSSettings {
    const settings = demoStorage.getItem<POSSettings | null>(STORAGE_KEYS.POS_SETTINGS, null);
    if (!settings) {
      demoStorage.setItem(STORAGE_KEYS.POS_SETTINGS, DEFAULT_POS_SETTINGS);
      return DEFAULT_POS_SETTINGS;
    }
    return { ...DEFAULT_POS_SETTINGS, ...settings };
  }

  public get(): POSSettings {
    return this.getSettings();
  }

  public updateSettings(partial: Partial<POSSettings>): POSSettings {
    const current = this.getSettings();
    const updated: POSSettings = {
      ...current,
      ...partial,
    };
    demoStorage.setItem(STORAGE_KEYS.POS_SETTINGS, updated);
    return updated;
  }

  public resetToSeed(): void {
    demoStorage.setItem(STORAGE_KEYS.POS_SETTINGS, DEFAULT_POS_SETTINGS);
  }
}

export const posSettingsRepository = new POSSettingsRepository();
