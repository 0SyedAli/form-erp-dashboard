import { EventEmitter } from 'node:events';
import mongoose from 'mongoose';
import { afterEach, expect, it, vi } from 'vitest';
import { Brand, Branch, Category, Product, ProductLine, Size, StockBalance, Thickness, Variant } from '../../models/index.js';
import { PosService } from './pos.service.js';
import { subscribeToPOSChanges } from './posChanges.js';

afterEach(() => {
  PosService.invalidatePOSCache();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('shares a bootstrap load and refreshes it when received stock changes', async () => {
  vi.useFakeTimers();
  const changes = Object.assign(new EventEmitter(), { close: async () => {} });
  const watch = vi.spyOn(mongoose.connection, 'watch').mockReturnValue(
    changes as unknown as ReturnType<typeof mongoose.connection.watch>
  );
  vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

  const variantId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  let onHand = 0;
  const mockQuery = (getRows: () => unknown[]) => ({
    select: () => ({ lean: async () => getRows() }),
  });
  for (const model of [Brand, Branch, Category, ProductLine, Size, Thickness]) {
    vi.spyOn(model, 'find').mockReturnValue(mockQuery(() => []) as never);
  }
  const stockQuery = vi.spyOn(StockBalance, 'find').mockReturnValue(mockQuery(() =>
    onHand > 0 ? [{ _id: variantId, variantId, sku: 'PILLOW-1', onHand, reserved: 1 }] : []
  ) as never);
  vi.spyOn(Variant, 'find').mockReturnValue(mockQuery(() =>
    onHand > 0 ? [{ _id: variantId, productId, sku: 'PILLOW-1' }] : []
  ) as never);
  vi.spyOn(Product, 'find').mockReturnValue(mockQuery(() =>
    onHand > 0 ? [{ _id: productId, name: 'Pillow' }] : []
  ) as never);

  const notify = vi.fn();
  const unsubscribe = subscribeToPOSChanges(notify);
  try {
    const [initial] = await Promise.all([PosService.getPOSBootstrap(), PosService.getPOSBootstrap()]);
    expect(watch).toHaveBeenCalledTimes(1);
    expect(stockQuery).toHaveBeenCalledTimes(1);
    expect(initial.products).toEqual([]);

    onHand = 4;
    changes.emit('change');
    changes.emit('change');
    await vi.advanceTimersByTimeAsync(150);
    expect(notify).toHaveBeenCalledTimes(1);
    const received = await PosService.getPOSBootstrap(undefined, initial.versionHash);
    expect(received.products).toEqual([expect.objectContaining({ name: 'Pillow' })]);
    expect(received.inventoryBalances).toEqual([expect.objectContaining({ available: 3 })]);

    onHand = 5;
    changes.emit('change');
    await vi.advanceTimersByTimeAsync(150);
    const updated = await PosService.getPOSBootstrap(undefined, received.versionHash);
    expect(updated.versionHash).not.toBe(received.versionHash);
    expect(updated.inventoryBalances[0].available).toBe(4);
  } finally {
    unsubscribe();
  }
});
