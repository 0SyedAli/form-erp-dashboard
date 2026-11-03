import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../../app.js';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import { Session, Account, Branch, hashToken } from '../../models/index.js';

describe('Branch Account Management & Permission Control', () => {
  const app = createApp();
  let adminCookie: string = '';
  let branchCookie: string = '';
  let testBranchId: string = '';

  const branchPassword = process.env.SEED_BRANCH_PASSWORD || 'Branch@Molty2026!';

  beforeAll(async () => {
    await connectDatabase();

    // Reset test account state to guarantee test repeatability
    const displayAccount = await Account.findOne({ loginId: 'displaycenter' });
    if (displayAccount) {
      displayAccount.passwordHash = await bcrypt.hash(branchPassword, 10);
      displayAccount.isActive = true;
      await displayAccount.save();
    }

    // Log in as Super Admin
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@Molty2026!';
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'admin', password: adminPassword });

    const adminCookies = adminLoginRes.headers['set-cookie'];
    adminCookie = (Array.isArray(adminCookies) ? adminCookies.join(';') : (adminCookies as string)).split(';')[0];

    // Log in as Branch
    const branchLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'displaycenter', password: branchPassword });

    const branchCookies = branchLoginRes.headers['set-cookie'];
    branchCookie = (Array.isArray(branchCookies) ? branchCookies.join(';') : (branchCookies as string)).split(';')[0];

    // Find test branch
    const branch = await Branch.findOne({ code: 'SHOP-18' });
    testBranchId = branch?._id.toString() || '';
  });

  afterAll(async () => {
    // Restore original state
    const displayAccount = await Account.findOne({ loginId: 'displaycenter' });
    if (displayAccount) {
      displayAccount.passwordHash = await bcrypt.hash(branchPassword, 10);
      displayAccount.isActive = true;
      await displayAccount.save();
    }
    await disconnectDatabase();
  });

  describe('Authorization Guards', () => {
    it('denies branch operator access to branch management endpoints (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/branches/${testBranchId}/account`)
        .set('Cookie', [branchCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_NOT_ADMIN');
    });

    it('allows Super Admin to view branch account details without leaking passwordHash', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/branches/${testBranchId}/account`)
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasAccount).toBe(true);
      expect(res.body.data.account.loginId).toBe('displaycenter');
      expect(res.body.data.account).not.toHaveProperty('passwordHash');
    });
  });

  describe('Permission Modification & Immediate Reflection', () => {
    it('allows Admin to grant and revoke permissions, reflecting immediately', async () => {
      // Toggle manageStock: true
      const patchRes = await request(app)
        .patch(`/api/v1/admin/branches/${testBranchId}/permissions`)
        .set('Cookie', [adminCookie])
        .send({
          permissions: {
            manageStock: true,
            purchases: true,
          },
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.permissions.manageStock).toBe(true);
      expect(patchRes.body.data.permissions.purchases).toBe(true);

      // Verify immediate reflection on branch user's profile check without re-login
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', [branchCookie]);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.permissions.manageStock).toBe(true);
      expect(meRes.body.data.permissions.purchases).toBe(true);
    });
  });

  describe('Password Reset & Session Invalidation', () => {
    it('resets branch password and invalidates all active sessions for that branch', async () => {
      const rawToken = branchCookie.replace('molty_session_id=', '');
      const expectedHash = hashToken(rawToken);

      // Verify branch session was valid before reset
      let dbSession = await Session.findOne({ tokenHash: expectedHash });
      expect(dbSession?.isValid).toBe(true);

      // Admin resets the password
      const newPassword = 'NewSecretPassword2026!';
      const resetRes = await request(app)
        .post(`/api/v1/admin/branches/${testBranchId}/reset-password`)
        .set('Cookie', [adminCookie])
        .send({ newPassword });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // Verify session was terminated
      dbSession = await Session.findOne({ tokenHash: expectedHash });
      expect(dbSession?.isValid).toBe(false);

      // Branch request with old cookie must now be rejected
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', [branchCookie]);

      expect(meRes.status).toBe(401);
      expect(meRes.body.error.code).toBe('SESSION_EXPIRED');

      // Login with old password fails
      const oldLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ loginId: 'displaycenter', password: 'Branch@Molty2026!' });

      expect(oldLoginRes.status).toBe(401);

      // Login with new password succeeds
      const newLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ loginId: 'displaycenter', password: newPassword });

      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.success).toBe(true);
    });
  });

  describe('Account Deactivation', () => {
    it('deactivates branch account and prevents new sessions', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/branches/${testBranchId}/deactivate-account`)
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Try logging in with the newly reset password
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ loginId: 'displaycenter', password: 'NewSecretPassword2026!' });

      expect(loginRes.status).toBe(403);
      expect(loginRes.body.error.code).toBe('ACCOUNT_INACTIVE');

      // Re-activate for test cleanliness
      const account = await Account.findOne({ loginId: 'displaycenter' });
      if (account) {
        account.isActive = true;
        await account.save();
      }
    });
  });
});
