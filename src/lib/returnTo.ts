/**
 * Where to send someone after they sign in: back to the page they were
 * on, not the home page. The shell records the last ordinary location;
 * the sign-in and onboarding pages consume it. Kept in sessionStorage so
 * it survives the full-page round trip a magic link or an email
 * confirmation makes.
 */
const KEY = 'lebanontcg.returnTo';

/** Pages that are steps of signing in, never destinations. */
const AUTH_PATHS = ['/signin', '/welcome', '/set-password'];

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function rememberReturnTo(pathname: string, search = ''): void {
  if (isAuthPath(pathname)) return;
  try {
    sessionStorage.setItem(KEY, `${pathname}${search}`);
  } catch {
    /* private mode — then it's just the home page */
  }
}

/** Where to go after signing in. Pure — safe to call during render —
    because landing anywhere ordinary overwrites it anyway. Only
    same-origin paths are honoured, so nothing in storage can send
    someone off-site. */
export function readReturnTo(): string {
  let value: string | null = null;
  try {
    value = sessionStorage.getItem(KEY);
  } catch {
    /* nothing stored */
  }
  if (!value || !value.startsWith('/') || value.startsWith('//') || isAuthPath(value)) return '/';
  return value;
}
