import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { httpLogger } from './middleware/logger.middleware.js';
import { standardRateLimiter } from './middleware/rateLimiter.middleware.js';
import { validateCsrf } from './middleware/csrf.middleware.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import { sendError } from './utils/apiResponse.js';
import { openApiSpec } from './docs/swagger.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { branchAccountRoutes } from './modules/branch-account/branch-account.routes.js';
import { catalogueRoutes } from './modules/catalogue/catalogue.routes.js';
import { inventoryRoutes } from './modules/inventory/inventory.routes.js';
import { posRoutes } from './modules/pos/pos.routes.js';
import { salesRoutes } from './modules/sales/sales.routes.js';
import { customerRoutes } from './modules/customer/customer.routes.js';
import { collectionRoutes } from './modules/collection/collection.routes.js';

export function createApp(): Express {
  const app = express();

  // 1. Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    })
  );

  // 2. CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, automated test suites)
        if (!origin) return callback(null, true);
        if (env.CORS_ORIGINS.includes(origin) || env.NODE_ENV === 'development') {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
    })
  );

  // 3. Body & Cookie Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(env.SESSION_SECRET));

  // 4. Request Logging & Rate Limiting
  if (env.NODE_ENV !== 'test') {
    app.use(httpLogger);
  }
  app.use('/api', standardRateLimiter);

  // 5. CSRF Protection for Cookie-Authenticated State-Changing Routes
  app.use(validateCsrf);

  // 6. OpenAPI Swagger Documentation
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/api/v1/docs.json', (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  // 7. API v1 Routes
  const apiV1 = express.Router();
  apiV1.use(healthRoutes);
  apiV1.use('/auth', authRoutes);
  apiV1.use('/admin', branchAccountRoutes);
  apiV1.use(catalogueRoutes);
  apiV1.use('/inventory', inventoryRoutes);
  apiV1.use('/pos', posRoutes);
  apiV1.use('/sales', salesRoutes);
  apiV1.use('/customers', customerRoutes);
  apiV1.use('/collections', collectionRoutes);

  app.use('/api/v1', apiV1);

  // 8. Root Redirect or info
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Molty Foam ERP Backend API',
      version: '1.0.0',
      documentation: '/api/v1/docs',
      health: '/api/v1/health',
    });
  });

  // 9. 404 Route Handler
  app.use((req: Request, res: Response) => {
    sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND');
  });

  // 10. Central Error Handler Middleware
  app.use(errorHandler);

  return app;
}
