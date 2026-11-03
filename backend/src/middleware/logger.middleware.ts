import pinoHttp from 'pino-http';
import { logger } from '../utils/logger.js';

export const httpLogger = (pinoHttp as any)({
  logger,
  customLogLevel: (_req: any, res: any, err: any) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req: any) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res: any) => ({
      statusCode: res.statusCode,
    }),
  },
});

