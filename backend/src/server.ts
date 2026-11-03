import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  const app = createApp();

  // Establish MongoDB connection
  try {
    await connectDatabase();
  } catch (error) {
    logger.warn(
      { error },
      'MongoDB initial connection failed. Backend is running in resilient mode without active database session.'
    );
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`=======================================================`);
    logger.info(` Molty Foam ERP Backend API Server Started `);
    logger.info(` Environment : ${env.NODE_ENV}`);
    logger.info(` Port        : ${env.PORT}`);
    logger.info(` API Base    : http://localhost:${env.PORT}/api/v1`);
    logger.info(` Health Check: http://localhost:${env.PORT}/api/v1/health`);
    logger.info(` Swagger Docs: http://localhost:${env.PORT}/api/v1/docs`);
    logger.info(`=======================================================`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown signal received. Closing HTTP server and database connections...');
    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectDatabase();
      process.exit(0);
    });

    // Force close after 10s timeout
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal error during backend server bootstrap');
  process.exit(1);
});

