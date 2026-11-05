import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { SESSION_COOKIE_NAME } from '../../middleware/auth.middleware.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { env } from '../../config/env.js';

export class AuthController {
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.login(req.body, ipAddress, userAgent);

      // Set HttpOnly cookie with strict security flags
      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || env.COOKIE_SECURE;
      res.cookie(SESSION_COOKIE_NAME, result.rawToken, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        domain: env.COOKIE_DOMAIN && env.COOKIE_DOMAIN !== 'localhost' ? env.COOKIE_DOMAIN : undefined,
        path: '/',
        expires: result.expiresAt,
        maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
      });

      sendSuccess(
        res,
        {
          account: result.account,
          expiresAt: result.expiresAt,
          token: result.rawToken,
        },
        'Login successful',
        200
      );
    } catch (error) {
      if ((error as any).statusCode) {
        sendError(res, (error as any).message, (error as any).statusCode, (error as any).code);
        return;
      }
      sendError(res, 'An error occurred during authentication.', 500, 'INTERNAL_ERROR');
    }
  }

  public static async logout(req: Request, res: Response): Promise<void> {
    try {
      const rawToken =
        req.cookies?.[SESSION_COOKIE_NAME] ||
        req.signedCookies?.[SESSION_COOKIE_NAME] ||
        (req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.split(' ')[1]
          : undefined);
      const accountId = req.account?.id;

      if (rawToken) {
        await AuthService.logout(rawToken, accountId);
      }

      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || env.COOKIE_SECURE;
      res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        domain: env.COOKIE_DOMAIN && env.COOKIE_DOMAIN !== 'localhost' ? env.COOKIE_DOMAIN : undefined,
        path: '/',
      });

      sendSuccess(res, null, 'Logged out successfully');
    } catch {
      sendError(res, 'Logout failed', 500, 'LOGOUT_ERROR');
    }
  }

  public static async me(req: Request, res: Response): Promise<void> {
    try {
      if (!req.account) {
        sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
        return;
      }

      const profile = await AuthService.getProfile(req.account._id.toString());
      sendSuccess(res, profile);
    } catch {
      sendError(res, 'Failed to fetch current user profile', 500, 'FETCH_PROFILE_ERROR');
    }
  }

  public static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.account) {
        sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
        return;
      }

      const rawToken =
        req.cookies?.[SESSION_COOKIE_NAME] ||
        req.signedCookies?.[SESSION_COOKIE_NAME] ||
        (req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.split(' ')[1]
          : undefined);

      const result = await AuthService.changePassword(
        req.account._id.toString(),
        req.body,
        rawToken
      );

      sendSuccess(res, result, 'Password changed successfully');
    } catch (error) {
      if ((error as any).statusCode) {
        sendError(res, (error as any).message, (error as any).statusCode, (error as any).code);
        return;
      }
      sendError(res, 'Failed to change password', 500, 'PASSWORD_CHANGE_ERROR');
    }
  }
}
