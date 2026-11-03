import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import { Session, Account, hashToken } from '../../models/index.js';

describe('Authentication & Session Management Integration', () => {
  const app = createApp();
  let adminSessionCookie: string = '';
  let branchSessionCookie: string = '';

  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('POST /api/v1/auth/login', () => {
    it('rejects invalid password with 401 and generic message', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ loginId: 'admin', password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid login ID or password.');
    });

    it('rejects non-existent account with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ loginId: 'nonexistentuser', password: 'Password123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('authenticates Super Admin successfully and sets HttpOnly session cookie', async () => {
      const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@Molty2026!';
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ loginId: 'admin', password: adminPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.account.role).toBe('SUPER_ADMIN');
      expect(res.body.data.account.loginId).toBe('admin');
      // Verify raw session token is NOT leaked in body
      expect(res.body.data).not.toHaveProperty('rawToken');
      expect(res.body.data).not.toHaveProperty('sessionId');

      // Verify Set-Cookie header exists and is HttpOnly
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join(';') : (cookies as string);
      expect(cookieStr).toContain('molty_session_id=');
      expect(cookieStr.toLowerCase()).toContain('httponly');

      adminSessionCookie = cookieStr.split(';')[0];

      // Verify the session in MongoDB stores ONLY the SHA-256 hash of the token
      const rawToken = adminSessionCookie.replace('molty_session_id=', '');
      const expectedHash = hashToken(rawToken);

      const dbSession = await Session.findOne({ tokenHash: expectedHash });
      expect(dbSession).toBeDefined();
      expect(dbSession?.isValid).toBe(true);
    });

    it('authenticates Branch account and includes branch info', async () => {
      const branchPassword = process.env.SEED_BRANCH_PASSWORD || 'Branch@Molty2026!';
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ loginId: 'mainbranch', password: branchPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.account.role).toBe('BRANCH');
      expect(res.body.data.account.branch).toBeDefined();
      expect(res.body.data.account.branch.code).toBe('SHOP-12');

      const cookies = res.headers['set-cookie'];
      branchSessionCookie = (Array.isArray(cookies) ? cookies.join(';') : (cookies as string)).split(';')[0];
    });

    it('blocks login for inactive account with 403', async () => {
      // Find an account and temporarily mark inactive
      const account = await Account.findOne({ loginId: 'expresscounter' });
      expect(account).toBeDefined();
      if (account) {
        account.isActive = false;
        await account.save();

        const branchPassword = process.env.SEED_BRANCH_PASSWORD || 'Branch@Molty2026!';
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ loginId: 'expresscounter', password: branchPassword });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');

        // Restore account active status
        account.isActive = true;
        await account.save();
      }
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns authenticated user profile when session cookie is provided', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', [adminSessionCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.loginId).toBe('admin');
      expect(res.body.data.role).toBe('SUPER_ADMIN');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('invalidates the session and clears session cookie', async () => {
      const rawToken = branchSessionCookie.replace('molty_session_id=', '');
      const expectedHash = hashToken(rawToken);

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [branchSessionCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify the session in MongoDB is now isValid: false
      const dbSession = await Session.findOne({ tokenHash: expectedHash });
      expect(dbSession?.isValid).toBe(false);

      // Subsequent requests with this cookie should now be rejected
      const retryRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', [branchSessionCookie]);

      expect(retryRes.status).toBe(401);
      expect(retryRes.body.error.code).toBe('SESSION_EXPIRED');
    });
  });
});

