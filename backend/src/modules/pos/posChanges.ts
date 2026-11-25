import mongoose from 'mongoose';
import { Brand, Branch, Category, Product, ProductLine, Size, StockBalance, Thickness, Variant } from '../../models/index.js';
import { PosService } from './pos.service.js';

const collections = [Brand, Branch, Category, Product, ProductLine, Size, StockBalance, Thickness, Variant]
  .map((model) => model.collection.name);
const subscribers = new Set<() => void>();
let stream: ReturnType<typeof mongoose.connection.watch> | undefined;
let pendingNotification: ReturnType<typeof setTimeout> | undefined;

function startWatching() {
  if (stream || !subscribers.size || mongoose.connection.readyState !== 1) return;
  const watcher = mongoose.connection.watch([{ $match: { 'ns.coll': { $in: collections } } }]);
  stream = watcher;

  watcher.on('change', () => {
    PosService.invalidatePOSCache();
    if (pendingNotification) return;
    pendingNotification = setTimeout(() => {
      pendingNotification = undefined;
      for (const notify of subscribers) notify();
    }, 150);
  });

  watcher.on('error', () => void watcher.close().catch(() => undefined));
  watcher.on('close', () => {
    if (stream === watcher) stream = undefined;
  });
}

export function subscribeToPOSChanges(notify: () => void) {
  subscribers.add(notify);
  startWatching();
  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0 && stream) {
      const watcher = stream;
      stream = undefined;
      void watcher.close().catch(() => undefined);
    }
  };
}
