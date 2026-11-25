/**
 * Utility for managing authentication cookies on the client side.
 * Ensures synchronization between client-side session state and
 * server-side Next.js Proxy/Middleware.
 */

export const AUTH_COOKIE_NAME = 'molty_auth_token';
export const SESSION_COOKIE_NAME = 'molty_session_id';
export const ROLE_COOKIE_NAME = 'molty_user_role';

const ONE_DAY_SECONDS = 24 * 60 * 60;

/**
 * Sets auth cookies across the frontend origin with strict SameSite=Lax.
 */
export function setAuthCookies(
  token: string,
  role: string,
  maxAgeSeconds: number = ONE_DAY_SECONDS
): void {
  if (typeof document === 'undefined') return;

  const cookieOptions = `; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}${cookieOptions}`;
  document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}${cookieOptions}`;
  document.cookie = `${ROLE_COOKIE_NAME}=${encodeURIComponent(role)}${cookieOptions}`;
}

/**
 * Removes all authentication cookies immediately.
 */
export function clearAuthCookies(): void {
  if (typeof document === 'undefined') return;

  const expireOptions = '; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  document.cookie = `${AUTH_COOKIE_NAME}=${expireOptions}`;
  document.cookie = `${SESSION_COOKIE_NAME}=${expireOptions}`;
  document.cookie = `${ROLE_COOKIE_NAME}=${expireOptions}`;
}

/**
 * Safely parses cookie value by name on the client.
 */
export function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const matches = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return matches ? decodeURIComponent(matches[1]) : null;
}
