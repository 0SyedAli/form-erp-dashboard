import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

describe('API Foundation & Health Endpoints', () => {
  const app = createApp();

  it('GET /api/v1/health returns 200 with operational metrics and database status', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('status', 'healthy');
    expect(res.body.data).toHaveProperty('service', 'molty-foam-erp-backend');
    expect(res.body.data).toHaveProperty('version', '1.0.0');
    expect(res.body.data).toHaveProperty('database');
    expect(res.body.data.database).toHaveProperty('connected');
    expect(res.body.data).toHaveProperty('memoryUsageMb');
  });

  it('GET /api/v1/docs.json serves valid OpenAPI 3.0 specification', async () => {
    const res = await request(app).get('/api/v1/docs.json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('openapi', '3.0.0');
    expect(res.body.info).toHaveProperty('title');
    expect(res.body.paths).toHaveProperty('/health');
    expect(res.body.paths).toHaveProperty('/auth/login');
  });

  it('returns structured 404 JSON for non-existent routes', async () => {
    const res = await request(app).get('/api/v1/non-existent-route-endpoint');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(res.body.error.message).toContain('/api/v1/non-existent-route-endpoint');
  });

  it('POST /api/v1/auth/login rejects requests with missing credentials (400 Bad Request)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });
});

