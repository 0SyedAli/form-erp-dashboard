import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';
import { SESSION_COOKIE_NAME } from './auth.middleware.js';

/**
 * Validates Origin / Referer on state-changing cookie-authenticated requests
 * to prevent Cross-Site Request Forgery (CSRF).
 */
export function validateCsrf(req: Request, res: Response, next: NextFunction): void {
  // Safe HTTP methods do not change state
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // If request has cookie, origin checking is enforced
  const hasSessionCookie = Boolean(
    req.cookies?.[SESSION_COOKIE_NAME] || req.signedCookies?.[SESSION_COOKIE_NAME]
  );

  // If there's no session cookie, authorization might be Bearer token or pre-auth request
  if (!hasSessionCookie) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  const trustedOrigins = [
    env.FRONTEND_URL,
    ...env.CORS_ORIGINS,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].map((o) => o.replace(/\/$/, ''));

  if (origin) {
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (trustedOrigins.includes(normalizedOrigin) || env.NODE_ENV === 'development') {
      return next();
    }
    sendError(res, 'CSRF verification failed: Untrusted Origin.', 403, 'CSRF_VALIDATION_FAILED');
    return;
  }

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin.replace(/\/$/, '');
      if (trustedOrigins.includes(refererOrigin) || env.NODE_ENV === 'development') {
        return next();
      }
    } catch {
      // invalid referer url
    }
    sendError(res, 'CSRF verification failed: Untrusted Referer.', 403, 'CSRF_VALIDATION_FAILED');
    return;
  }

  // If in production and session cookie is present but no Origin/Referer header provided
  if (env.NODE_ENV === 'production') {
    sendError(res, 'CSRF verification failed: Missing Origin or Referer header.', 403, 'CSRF_VALIDATION_FAILED');
    return;
  }

  next();
}

