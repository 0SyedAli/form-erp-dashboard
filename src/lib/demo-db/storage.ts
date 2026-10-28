import { DEMO_DB_VERSION, STORAGE_KEYS } from './schema';

/**
 * SSR-safe, typed browser storage engine for the Molty Foam demo database.
 * Dual-tier storage: Uses window.localStorage when in browser environment,
 * and an in-memory Map fallback during SSR and Node.js testing.
 */
class DemoStorageEngine {
  private memoryStore: Map<string, string> = new Map();

  private isBrowser(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined' &&
      window.localStorage !== null
    );
  }

  public getItem<T>(key: string, fallback: T): T {
    try {
      let raw: string | null = null;
      if (this.isBrowser()) {
        raw = window.localStorage.getItem(key);
      } else {
        raw = this.memoryStore.get(key) || null;
      }

      if (!raw) {
        return fallback;
      }
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`[DemoStorage] Failed to parse key "${key}", using fallback.`, err);
      return fallback;
    }
  }

  public setItem<T>(key: string, value: T): boolean {
    try {
      const serialized = JSON.stringify(value);
      if (this.isBrowser()) {
        window.localStorage.setItem(key, serialized);
      } else {
        this.memoryStore.set(key, serialized);
      }
      return true;
    } catch (err) {
      console.error(`[DemoStorage] Failed to write key "${key}". Storage quota may be exceeded.`, err);
      return false;
    }
  }

  public removeItem(key: string): void {
    try {
      if (this.isBrowser()) {
        window.localStorage.removeItem(key);
      } else {
        this.memoryStore.delete(key);
      }
    } catch (err) {
      console.warn(`[DemoStorage] Failed to remove key "${key}".`, err);
    }
  }

  public clearAllDemoData(): void {
    try {
      if (this.isBrowser()) {
        Object.values(STORAGE_KEYS).forEach((k) => window.localStorage.removeItem(k));
      }
      this.memoryStore.clear();
    } catch (err) {
      console.warn('[DemoStorage] Failed during clearAllDemoData.', err);
    }
  }

  public getVersion(): string | null {
    if (this.isBrowser()) {
      return window.localStorage.getItem(STORAGE_KEYS.DB_VERSION);
    }
    return this.memoryStore.get(STORAGE_KEYS.DB_VERSION) || null;
  }

  public setVersion(version: string = DEMO_DB_VERSION): void {
    if (this.isBrowser()) {
      window.localStorage.setItem(STORAGE_KEYS.DB_VERSION, version);
    } else {
      this.memoryStore.set(STORAGE_KEYS.DB_VERSION, version);
    }
  }
}

export const demoStorage = new DemoStorageEngine();
