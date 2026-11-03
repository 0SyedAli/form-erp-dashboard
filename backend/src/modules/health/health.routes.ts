import { Router } from 'express';
import { HealthController } from './health.controller.js';

export const healthRoutes = Router();

healthRoutes.get('/health', HealthController.getHealth);

