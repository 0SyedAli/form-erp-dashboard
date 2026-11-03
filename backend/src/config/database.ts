import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export interface DatabaseStatus {
  connected: boolean;
  readyState: number;
  host?: string;
  name?: string;
  isReplicaSet: boolean;
}

export async function connectDatabase(uri?: string): Promise<typeof mongoose> {
  const targetUri = uri || env.MONGODB_URI;

  mongoose.connection.on('connected', () => {
    logger.info({ host: mongoose.connection.host, db: mongoose.connection.name }, 'MongoDB connected successfully');
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error occurred');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB connection disconnected');
  });

  try {
    const conn = await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: env.NODE_ENV !== 'production',
      maxPoolSize: 20,
      minPoolSize: 2,
    });
    return conn;
  } catch (error) {
    logger.error({ error, uri: targetUri }, 'Failed to establish initial MongoDB connection');
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed gracefully');
  }
}

export function getDatabaseStatus(): DatabaseStatus {
  const state = mongoose.connection.readyState;
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const isConnected = state === 1;
  const client = isConnected ? (mongoose.connection.getClient() as any) : null;
  const topologyType = (client?.topology?.description?.type || client?.topology?.s?.description?.type || '') as string;
  const isReplicaSet = Boolean(
    topologyType.includes('ReplicaSet') ||
    client?.topology?.description?.setName ||
    Boolean(client?.options?.replicaSet)
  );

  return {
    connected: isConnected,
    readyState: state,
    host: isConnected ? mongoose.connection.host : undefined,
    name: isConnected ? mongoose.connection.name : undefined,
    isReplicaSet,
  };
}

