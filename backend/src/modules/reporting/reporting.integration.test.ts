import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import { Account, Branch } from '../../models/index.js';

describe('Real-Time Reporting, Dashboards & Financial Reconciliation Integration Tests (Flow 07)', () => {
  const app = createApp();

  let adminCookie: string;
  let branchWithReportsCookie: string;
  let branchWithoutReportsCookie: string;
  let branch1Id: string;
  let branch2Id: string;

  const branchPassword = process.env.SEED_BRANCH_PASSWORD || 'Branch@Molty2026!';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@Molty2026!';

  beforeAll(async () => {
    await connectDatabase();

    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'admin', password: adminPassword });
    const adminCookies = adminRes.headers['set-cookie'];
    adminCookie = (Array.isArray(adminCookies) ? adminCookies.join(';') : (adminCookies as string)).split(';')[0];

    // 2. Fetch Branches
    const mainBranch = await Branch.findOne({ loginId: 'mainbranch' });
    const wholesaleBranch = await Branch.findOne({ loginId: 'wholesaledepot' });
    branch1Id = mainBranch!._id.toString();
    branch2Id = wholesaleBranch!._id.toString();

    // 3. Setup Branch 1 with reports permission
    await Account.updateOne(
      { loginId: 'mainbranch' },
      { $set: { 'permissions.reports': true, 'permissions.pos': true, 'permissions.purchases': true } }
    );
    const b1Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'mainbranch', password: branchPassword });
    const b1Cookies = b1Res.headers['set-cookie'];
    branchWithReportsCookie = (Array.isArray(b1Cookies) ? b1Cookies.join(';') : (b1Cookies as string)).split(';')[0];

    // 4. Setup Branch 2 without reports permission
    await Account.updateOne(
      { loginId: 'wholesaledepot' },
      { $set: { 'permissions.reports': false } }
    );
    const b2Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginId: 'wholesaledepot', password: branchPassword });
    const b2Cookies = b2Res.headers['set-cookie'];
    branchWithoutReportsCookie = (Array.isArray(b2Cookies) ? b2Cookies.join(';') : (b2Cookies as string)).split(';')[0];
  });

  afterAll(async () => {
    // Restore permissions
    await Account.updateOne(
      { loginId: 'mainbranch' },
      { $set: { 'permissions.reports': false } }
    );
    await disconnectDatabase();
  });

  // --- 1. Consolidated Admin Dashboard ---
  describe('Super Admin Consolidated Dashboard', () => {
    it('should return consolidated metrics for Super Admin', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboard/admin?preset=thisMonth')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const { sales, collections, inventory, purchases, branches } = res.body.data;
      expect(sales).toBeDefined();
      expect(sales).toHaveProperty('grossSales');
      expect(sales).toHaveProperty('netSales');
      expect(sales).toHaveProperty('invoiceCount');

      expect(collections).toBeDefined();
      expect(collections).toHaveProperty('totalCustomerReceivables');
      expect(collections).toHaveProperty('totalConfirmedCollections');

      expect(inventory).toBeDefined();
      expect(inventory).toHaveProperty('totalStockUnits');
      expect(inventory).toHaveProperty('valuationStatus');

      expect(purchases).toBeDefined();
      expect(purchases).toHaveProperty('outstandingSupplierPayables');

      expect(Array.isArray(branches)).toBe(true);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/reports/dashboard/admin');
      expect(res.status).toBe(401);
    });

    it('should reject branch account with 403', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboard/admin')
        .set('Cookie', branchWithReportsCookie);
      expect(res.status).toBe(403);
    });
  });

  // --- 2. Branch Dashboard ---
  describe('Branch Dashboard & Permissions', () => {
    it('should allow branch with reports permission to view own dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboard/branch?preset=today')
        .set('Cookie', branchWithReportsCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.branch).toBeDefined();
      expect(res.body.data.today).toHaveProperty('invoicesCount');
    });

    it('should deny branch without reports permission with 403', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboard/branch')
        .set('Cookie', branchWithoutReportsCookie);

      expect(res.status).toBe(403);
    });

    it('should prevent cross-branch access tampering by branch account', async () => {
      // Trying to request branch2Id with branch1 cookie
      const res = await request(app)
        .get(`/api/v1/reports/dashboard/branch?branchId=${branch2Id}`)
        .set('Cookie', branchWithReportsCookie);

      // enforceBranchBoundary rejects cross-branch query param
      expect([400, 403]).toContain(res.status);
    });

    it('should allow Super Admin to view specific branch dashboard with branchId param', async () => {
      const res = await request(app)
        .get(`/api/v1/reports/dashboard/branch?branchId=${branch1Id}&preset=today`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.branch.id).toBe(branch1Id);
    });
  });

  // --- 3. Date Presets & Filtering ---
  describe('Date Range Presets in Karachi Time (UTC+5)', () => {
    const presets = ['today', 'yesterday', 'last7days', 'thisMonth', 'lastMonth', 'all'];

    for (const preset of presets) {
      it(`should accept preset "${preset}" successfully`, async () => {
        const res = await request(app)
          .get(`/api/v1/reports/sales/summary?preset=${preset}`)
          .set('Cookie', adminCookie);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.period.preset).toBe(preset);
      });
    }

    it('should accept custom date range', async () => {
      const res = await request(app)
        .get('/api/v1/reports/sales/summary?preset=custom&startDate=2026-01-01&endDate=2026-12-31')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.period.preset).toBe('custom');
    });
  });

  // --- 4. Sales Reports ---
  describe('Sales Reports Endpoints', () => {
    it('GET /sales/summary returns breakdown by payment method and sale type', async () => {
      const res = await request(app)
        .get('/api/v1/reports/sales/summary')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('grossSales');
      expect(res.body.data).toHaveProperty('netSales');
      expect(res.body.data).toHaveProperty('paymentMethods');
    });

    it('GET /sales/trends returns daily trend series', async () => {
      const res = await request(app)
        .get('/api/v1/reports/sales/trends?preset=last7days')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.trends)).toBe(true);
    });

    it('GET /sales/by-branch is restricted to Super Admin', async () => {
      const adminRes = await request(app)
        .get('/api/v1/reports/sales/by-branch')
        .set('Cookie', adminCookie);
      expect(adminRes.status).toBe(200);
      expect(Array.isArray(adminRes.body.data.branches)).toBe(true);

      const branchRes = await request(app)
        .get('/api/v1/reports/sales/by-branch')
        .set('Cookie', branchWithReportsCookie);
      expect(branchRes.status).toBe(403);
    });

    it('GET /sales/by-tier returns sales breakdown by customer tier', async () => {
      const res = await request(app)
        .get('/api/v1/reports/sales/by-tier')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.tiers)).toBe(true);
    });

    it('GET /sales/by-product returns top selling products', async () => {
      const res = await request(app)
        .get('/api/v1/reports/sales/by-product')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.products)).toBe(true);
    });
  });

  // --- 5. Receivables & Aging Reports ---
  describe('Receivables & Aging Reports', () => {
    it('GET /receivables/summary returns customer receivables snapshot', async () => {
      const res = await request(app)
        .get('/api/v1/reports/receivables/summary')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalOutstanding');
      expect(res.body.data).toHaveProperty('customersCount');
    });

    it('GET /receivables/aging returns aging buckets with notDue and overdue brackets', async () => {
      const res = await request(app)
        .get('/api/v1/reports/receivables/aging')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.buckets)).toBe(true);
      expect(res.body.data.buckets.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /collections/summary returns collections summary', async () => {
      const res = await request(app)
        .get('/api/v1/reports/collections/summary')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalCollected');
      expect(res.body.data).toHaveProperty('byMethod');
    });
  });

  // --- 6. Inventory Reports ---
  describe('Inventory Reports', () => {
    it('GET /inventory/summary returns stock totals and counts', async () => {
      const res = await request(app)
        .get('/api/v1/reports/inventory/summary')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalOnHand');
      expect(res.body.data).toHaveProperty('totalAvailable');
    });

    it('GET /inventory/low-stock returns alert items', async () => {
      const res = await request(app)
        .get('/api/v1/reports/inventory/low-stock')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
    });

    it('GET /inventory/valuation is restricted to Super Admin', async () => {
      const adminRes = await request(app)
        .get('/api/v1/reports/inventory/valuation')
        .set('Cookie', adminCookie);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.data).toHaveProperty('totalValuation');
      expect(adminRes.body.data).toHaveProperty('costBasisMethod');

      const branchRes = await request(app)
        .get('/api/v1/reports/inventory/valuation')
        .set('Cookie', branchWithReportsCookie);
      expect(branchRes.status).toBe(403);
    });

    it('GET /inventory/movements returns stock ledger audit trail', async () => {
      const res = await request(app)
        .get('/api/v1/reports/inventory/movements')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.movements)).toBe(true);
    });
  });

  // --- 7. Purchasing & Payables Reports ---
  describe('Purchasing & Payables Reports', () => {
    it('GET /purchases/summary returns procurement metrics', async () => {
      const res = await request(app)
        .get('/api/v1/reports/purchases/summary')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('purchaseOrdersCount');
      expect(res.body.data).toHaveProperty('postedBillsCount');
    });

    it('GET /purchases/by-supplier is restricted to Super Admin', async () => {
      const res = await request(app)
        .get('/api/v1/reports/purchases/by-supplier')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.suppliers)).toBe(true);

      const branchRes = await request(app)
        .get('/api/v1/reports/purchases/by-supplier')
        .set('Cookie', branchWithReportsCookie);
      expect(branchRes.status).toBe(403);
    });

    it('GET /purchases/by-branch is restricted to Super Admin', async () => {
      const res = await request(app)
        .get('/api/v1/reports/purchases/by-branch')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.branches)).toBe(true);
    });

    it('GET /payables/summary returns accounts payable metrics', async () => {
      const res = await request(app)
        .get('/api/v1/reports/payables/summary')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalOutstandingPayables');
      expect(res.body.data).toHaveProperty('totalSuppliersCount');
    });

    it('GET /payables/aging returns aging buckets for accounts payable', async () => {
      const res = await request(app)
        .get('/api/v1/reports/payables/aging')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.buckets)).toBe(true);
      expect(res.body.data.buckets.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- 8. Financial Reconciliation Audit ---
  describe('Cross-Module Financial Reconciliation Audit', () => {
    it('GET /reconciliation is restricted to Super Admin', async () => {
      const branchRes = await request(app)
        .get('/api/v1/reports/reconciliation')
        .set('Cookie', branchWithReportsCookie);
      expect(branchRes.status).toBe(403);

      const adminRes = await request(app)
        .get('/api/v1/reports/reconciliation')
        .set('Cookie', adminCookie);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.success).toBe(true);
      expect(adminRes.body.data).toBeDefined();

      const { summary, checks } = adminRes.body.data;
      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('totalChecks');
      expect(summary).toHaveProperty('passedChecks');
      expect(summary).toHaveProperty('overallStatus');
      expect(Array.isArray(checks)).toBe(true);
    });
  });
});
