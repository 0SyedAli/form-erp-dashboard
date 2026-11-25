import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js 16 Proxy / Middleware
 *
 * Rules:
 * 1. ONLY /login is public.
 * 2. ALL other application pages are PRIVATE and strictly guarded.
 * 3. Fast, optimized execution in edge/node runtime with zero roundtrip DB delays.
 * 4. Automatic smart redirection:
 *    - Unauthenticated users on private routes -> /login?callbackUrl=...
 *    - Authenticated users on /login -> appropriate role destination (/admin/dashboard or /pos)
 *    - Role-based boundaries (Branch accounts restricted from /admin/*)
 */

const SESSION_COOKIE_NAME = 'molty_session_id';
const AUTH_COOKIE_NAME = 'molty_auth_token';
const ROLE_COOKIE_NAME = 'molty_user_role';

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  // Extract session tokens and role from cookies
  const sessionToken =
    request.cookies.get(SESSION_COOKIE_NAME)?.value ||
    request.cookies.get(AUTH_COOKIE_NAME)?.value;

  const userRole = request.cookies.get(ROLE_COOKIE_NAME)?.value;
  const isAuthenticated = Boolean(sessionToken && sessionToken.trim() !== '');

  // 1. PUBLIC ROUTE: /login
  if (pathname === '/login') {
    if (isAuthenticated) {
      // User is already logged in, redirect away from /login
      const callbackUrl = request.nextUrl.searchParams.get('callbackUrl');
      if (callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') && callbackUrl !== '/login') {
        return NextResponse.redirect(new URL(callbackUrl, request.url));
      }

      if (userRole === 'SUPER_ADMIN') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
      return NextResponse.redirect(new URL('/pos', request.url));
    }

    // Unauthenticated user allowed on /login
    return NextResponse.next();
  }

  // 2. ROOT ROUTE: /
  if (pathname === '/') {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (userRole === 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/pos', request.url));
  }

  // 3. ALL OTHER ROUTES ARE PRIVATE:
  // If not authenticated, instantly redirect to /login with callbackUrl
  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    const fullOriginalPath = `${pathname}${search}`;
    loginUrl.searchParams.set('callbackUrl', fullOriginalPath);
    return NextResponse.redirect(loginUrl);
  }

  // 4. ROLE-BASED ACCESS CONTROL (RBAC) FOR AUTHENTICATED USERS:
  // Super Admin section (/admin/*) requires SUPER_ADMIN role
  if (pathname.startsWith('/admin')) {
    if (userRole && userRole !== 'SUPER_ADMIN') {
      // Branch user attempting to access /admin -> redirect to /unauthorized
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Allow authorized access to private route
  const response = NextResponse.next();
  // Optional security headers
  response.headers.set('x-authenticated-user', 'true');
  return response;
}

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API route handlers)
     * - _next/static (static chunks)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     * - manifest.json (PWA manifest)
     * - static assets in public/ (images, icons, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
