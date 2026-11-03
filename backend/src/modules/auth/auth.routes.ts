import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateRequest } from '../../middleware/validateRequest.middleware.js';
import { loginSchema, changePasswordSchema } from './auth.schema.js';
import { authRateLimiter } from '../../middleware/rateLimiter.middleware.js';
import { authenticate } from '../../middleware/auth.middleware.js';

export const authRoutes = Router();

authRoutes.post('/login', authRateLimiter, validateRequest(loginSchema), AuthController.login);
authRoutes.post('/logout', authenticate, AuthController.logout);
authRoutes.get('/me', authenticate, AuthController.me);
authRoutes.post(
  '/change-password',
  authenticate,
  validateRequest(changePasswordSchema),
  AuthController.changePassword
);
