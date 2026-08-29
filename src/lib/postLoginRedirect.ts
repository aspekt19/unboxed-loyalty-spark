/**
 * Mobile Google OAuth returns to the public app root (`/`), because a protected
 * route can bounce the user out before the Privy -> app session exchange
 * finishes. We remember where the user was when they started sign-in and send
 * them back there once the session exists.
 */
const KEY = 'loyal-spark:post-login-path';

function isSafePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}

export function rememberPostLoginPath(path?: string) {
  if (typeof window === 'undefined') return;
  const target =
    path ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (!isSafePath(target)) return;
  try {
    sessionStorage.setItem(KEY, target);
  } catch {
    /* private mode */
  }
}

export function consumePostLoginPath(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return value && isSafePath(value) ? value : null;
  } catch {
    return null;
  }
}
