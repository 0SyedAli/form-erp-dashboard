import { Request, Response } from 'express';
import { getDatabaseStatus } from '../../config/database.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export class HealthController {
  public static async getHealth(_req: Request, res: Response): Promise<void> {
    const dbStatus = getDatabaseStatus();

    const data = {
      status: 'healthy',
      service: 'molty-foam-erp-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      database: dbStatus,
      memoryUsageMb: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };

    sendSuccess(res, data, 'Molty Foam ERP Backend service is operational');
  }
}

