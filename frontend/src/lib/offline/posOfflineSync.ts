'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getPendingSales,
  removePendingSale,
  updatePendingSale,
  OfflineSaleRecord,
} from './posOfflineDb';
import { POSCheckoutInput } from '@/store/services/posApi';

export interface SyncResult {
  syncedCount: number;
  failedCount: number;
}

export function usePOSOfflineSync(
  completeCheckoutBackend: (payload: POSCheckoutInput) => Promise<any>,
  onSyncCompleted?: (result: SyncResult) => void
) {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  const [pendingSales, setPendingSales] = useState<OfflineSaleRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const sales = await getPendingSales();
      setPendingSales(sales);
    } catch {
      // ignore
    }
  }, []);

  const triggerSync = useCallback(async (): Promise<SyncResult> => {
    if (isSyncingRef.current) return { syncedCount: 0, failedCount: 0 };
    if (!navigator.onLine) return { syncedCount: 0, failedCount: 0 };

    isSyncingRef.current = true;
    setIsSyncing(true);

    let synced = 0;
    let failed = 0;

    try {
      const sales = await getPendingSales();
      if (sales.length === 0) {
        setIsSyncing(false);
        isSyncingRef.current = false;
        return { syncedCount: 0, failedCount: 0 };
      }

      for (const sale of sales) {
        try {
          await updatePendingSale({ ...sale, status: 'SYNCING' });

          await completeCheckoutBackend({
            ...sale.checkoutPayload,
            idempotencyKey: sale.idempotencyKey,
          });

          await removePendingSale(sale.id);
          synced++;
        } catch (err: any) {
          const errMsg = err?.data?.message || err?.message || '';
          // If server already processed it, remove it cleanly
          if (
            errMsg.includes('Idempotent replay') ||
            errMsg.includes('already exists') ||
            err?.status === 409
          ) {
            await removePendingSale(sale.id);
            synced++;
          } else {
            await updatePendingSale({
              ...sale,
              status: 'FAILED',
              retryCount: (sale.retryCount || 0) + 1,
              errorMessage: errMsg,
            });
            failed++;
          }
        }
      }

      await refreshPendingCount();

      const result: SyncResult = { syncedCount: synced, failedCount: failed };
      if (onSyncCompleted && synced > 0) {
        onSyncCompleted(result);
      }
      return result;
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, [completeCheckoutBackend, onSyncCompleted, refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Automatically attempt syncing any queued offline sales when connection returns
      setTimeout(() => {
        triggerSync();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial load of pending sales
    refreshPendingCount();

    // If online on mount, attempt sync of any residual sales
    if (navigator.onLine) {
      setTimeout(() => {
        triggerSync();
      }, 1500);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync, refreshPendingCount]);

  return {
    isOnline,
    pendingSales,
    pendingCount: pendingSales.length,
    isSyncing,
    refreshPendingCount,
    triggerSync,
  };
}

