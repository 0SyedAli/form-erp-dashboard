import mongoose, { ClientSession } from 'mongoose';
import { logger } from './logger.js';
import { getDatabaseStatus } from '../config/database.js';
import { AppError } from './apiResponse.js';

export interface TransactionOptions {
  /**
   * When true (default), requires an active MongoDB Replica Set and fails safely if transactions are unavailable.
   * Only non-transactional operations should set strict: false.
   */
  strict?: boolean;
}

/**
 * Executes a callback within a managed MongoDB multi-document ACID transaction.
 * Strictly verifies replica-set capability; fails safely if transactions are unsupported.
 */
export async function withTransaction<T>(
  callback: (session: ClientSession | null) => Promise<T>,
  options: TransactionOptions = { strict: true }
): Promise<T> {
  const dbStatus = getDatabaseStatus();

  // If connected to MongoDB and the topology supports transactions (Replica Set / Sharded)
  if (mongoose.connection.readyState === 1 && dbStatus.isReplicaSet) {
    const session = await mongoose.startSession();
    const maxAttempts = 3;
    let attempts = 0;

    try {
      while (attempts < maxAttempts) {
        attempts++;
        session.startTransaction({
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
        });

        try {
          const result = await callback(session);
          await session.commitTransaction();
          return result;
        } catch (error: any) {
          if (session.inTransaction()) {
            await session.abortTransaction();
          }

          const isTransient =
            error?.errorLabels?.includes('TransientTransactionError') ||
            error?.code === 112 ||
            error?.codeName === 'WriteConflict';

          if (isTransient && attempts < maxAttempts) {
            logger.warn({ attempt: attempts }, 'Transient write conflict encountered, retrying atomic transaction...');
            await new Promise((r) => setTimeout(r, 20 * attempts));
            continue;
          }

          logger.error({ error }, 'Transaction aborted due to error during atomic operation');
          throw error;
        }
      }
    } finally {
      await session.endSession();
    }
  }

  // If transactions are required and replica set is absent, fail safely
  if (options.strict !== false) {
    logger.error('Attempted atomic operation but MongoDB is not running in Replica Set mode');
    throw new AppError(
      'Atomic transactions are unavailable: MongoDB Replica Set is required for financial or inventory multi-document consistency.',
      503,
      'TRANSACTIONS_UNAVAILABLE'
    );
  }

  logger.warn('Running non-strict operation without MongoDB transaction session (Replica Set not active)');
  return await callback(null);
}

export { withTransaction as runTransaction };
