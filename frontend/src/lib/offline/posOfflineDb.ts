import {
  Brand,
  Category,
  MattressSize,
  MattressThickness,
  CatalogueProduct,
  ProductVariant,
  InventoryBalance,
  Customer,
  Branch,
  Invoice,
} from '@/types';
import { POSCheckoutInput } from '@/store/services/posApi';

export interface POSMasterSnapshot {
  brands: Brand[];
  categories: Category[];
  sizes: MattressSize[];
  thicknesses: MattressThickness[];
  products: CatalogueProduct[];
  variants: ProductVariant[];
  inventoryBalances: InventoryBalance[];
  customers?: Customer[];
  activeBranch?: Branch | null;
  branches?: Branch[];
  lastUpdated: string;
}

export interface OfflineSaleRecord {
  id: string;
  idempotencyKey: string;
  checkoutPayload: POSCheckoutInput;
  invoice: Invoice;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  createdAt: string;
  errorMessage?: string;
}

const DB_NAME = 'foam_shop_pos_offline_db';
const DB_VERSION = 1;
const STORE_MASTER = 'master_data';
const STORE_SALES = 'pending_sales';

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_MASTER)) {
        db.createObjectStore(STORE_MASTER);
      }
      if (!db.objectStoreNames.contains(STORE_SALES)) {
        db.createObjectStore(STORE_SALES, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Master Data Snapshot Operations
// ---------------------------------------------------------------------------

export async function saveMasterSnapshot(snapshot: POSMasterSnapshot): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MASTER, 'readwrite');
      const store = tx.objectStore(STORE_MASTER);
      const req = store.put(snapshot, 'snapshot');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Fallback to localStorage if IndexedDB has issues
    try {
      localStorage.setItem('pos_master_snapshot', JSON.stringify(snapshot));
    } catch {
      // ignore storage quota errors
    }
  }
}

export async function getMasterSnapshot(): Promise<POSMasterSnapshot | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MASTER, 'readonly');
      const store = tx.objectStore(STORE_MASTER);
      const req = store.get('snapshot');
      req.onsuccess = () => resolve((req.result as POSMasterSnapshot) || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Fallback check in localStorage
    try {
      const raw = localStorage.getItem('pos_master_snapshot');
      if (raw) return JSON.parse(raw) as POSMasterSnapshot;
    } catch {
      // ignore
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Offline Sales Queue Operations
// ---------------------------------------------------------------------------

export async function queueOfflineSale(record: OfflineSaleRecord): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SALES, 'readwrite');
      const store = tx.objectStore(STORE_SALES);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // LocalStorage fallback
    try {
      const raw = localStorage.getItem('pos_offline_sales') || '[]';
      const list: OfflineSaleRecord[] = JSON.parse(raw);
      list.push(record);
      localStorage.setItem('pos_offline_sales', JSON.stringify(list));
    } catch {
      // ignore
    }
  }
}

export async function getPendingSales(): Promise<OfflineSaleRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SALES, 'readonly');
      const store = tx.objectStore(STORE_SALES);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as OfflineSaleRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    try {
      const raw = localStorage.getItem('pos_offline_sales') || '[]';
      return JSON.parse(raw) as OfflineSaleRecord[];
    } catch {
      return [];
    }
  }
}

export async function removePendingSale(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SALES, 'readwrite');
      const store = tx.objectStore(STORE_SALES);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem('pos_offline_sales') || '[]';
      const list: OfflineSaleRecord[] = JSON.parse(raw);
      const filtered = list.filter((s) => s.id !== id);
      localStorage.setItem('pos_offline_sales', JSON.stringify(filtered));
    } catch {
      // ignore
    }
  }
}

export async function updatePendingSale(record: OfflineSaleRecord): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SALES, 'readwrite');
      const store = tx.objectStore(STORE_SALES);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem('pos_offline_sales') || '[]';
      const list: OfflineSaleRecord[] = JSON.parse(raw);
      const idx = list.findIndex((s) => s.id === record.id);
      if (idx >= 0) {
        list[idx] = record;
      } else {
        list.push(record);
      }
      localStorage.setItem('pos_offline_sales', JSON.stringify(list));
    } catch {
      // ignore
    }
  }
}

