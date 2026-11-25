import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('Next.js 16 Proxy / Routing Middleware', () => {
  const BASE = 'http://localhost:3000';

  it('allows unauthenticated users to access /login', () => {
    const req = new NextRequest(new URL('/login', BASE));
    const res = proxy(req);

    // Should not redirect, next() returns 200 with x-middleware-next
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects unauthenticated users on root / to /login', () => {
    const req = new NextRequest(new URL('/', BASE));
    const res = proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/login`);
  });

  it('redirects unauthenticated users on private page (/admin/dashboard) to /login with callbackUrl', () => {
    const req = new NextRequest(new URL('/admin/dashboard', BASE));
    const res = proxy(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    expect(location).toContain('/login?callbackUrl=');
    expect(location).toContain('%2Fadmin%2Fdashboard');
  });

  it('redirects unauthenticated users on /inventory to /login with callbackUrl', () => {
    const req = new NextRequest(new URL('/inventory', BASE));
    const res = proxy(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    expect(location).toContain('/login?callbackUrl=%2Finventory');
  });

  it('redirects unauthenticated users on /pos to /login with callbackUrl', () => {
    const req = new NextRequest(new URL('/pos', BASE));
    const res = proxy(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    expect(location).toContain('/login?callbackUrl=%2Fpos');
  });

  it('redirects already authenticated Super Admin on /login to /admin/dashboard', () => {
    const req = new NextRequest(new URL('/login', BASE), {
      headers: {
        cookie: 'molty_session_id=valid-token-123; molty_user_role=SUPER_ADMIN',
      },
    });
    const res = proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/admin/dashboard`);
  });

  it('redirects already authenticated Branch user on /login to /pos', () => {
    const req = new NextRequest(new URL('/login', BASE), {
      headers: {
        cookie: 'molty_session_id=valid-token-123; molty_user_role=BRANCH',
      },
    });
    const res = proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/pos`);
  });

  it('honors callbackUrl when authenticated user navigates to /login?callbackUrl=...', () => {
    const req = new NextRequest(new URL('/login?callbackUrl=%2Fcustomers', BASE), {
      headers: {
        cookie: 'molty_session_id=valid-token-123; molty_user_role=SUPER_ADMIN',
      },
    });
    const res = proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/customers`);
  });

  it('allows authenticated Super Admin to access /admin/dashboard', () => {
    const req = new NextRequest(new URL('/admin/dashboard', BASE), {
      headers: {
        cookie: 'molty_session_id=valid-token-123; molty_user_role=SUPER_ADMIN',
      },
    });
    const res = proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('x-authenticated-user')).toBe('true');
  });

  it('blocks Branch user from accessing /admin/* and redirects to /unauthorized', () => {
    const req = new NextRequest(new URL('/admin/dashboard', BASE), {
      headers: {
        cookie: 'molty_session_id=valid-token-123; molty_user_role=BRANCH',
      },
    });
    const res = proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/unauthorized`);
  });

  it('allows authenticated Branch user to access /pos and /inventory', () => {
    const req = new NextRequest(new URL('/pos', BASE), {
      headers: {
        cookie: 'molty_session_id=valid-token-123; molty_user_role=BRANCH',
      },
    });
    const res = proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('x-authenticated-user')).toBe('true');
  });
});
