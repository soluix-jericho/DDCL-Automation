import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'ddcl_session';

/** 32 random bytes as URL-safe text (43 characters; BR4.5). */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only this hash is stored (BR4.5). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Bearer wins over the cookie when both are present (BR4.6). */
export function readToken(
  headers: { authorization?: string | undefined },
  cookies: Record<string, string | undefined> | undefined,
): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(headers.authorization ?? '');
  if (m?.[1]) return m[1];
  return cookies?.[SESSION_COOKIE] || null;
}

/** Session cookie without Max-Age: the server enforces the lifetime (BR4.5, BR4.6). */
export function cookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure };
}
