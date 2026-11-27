import { describe, expect, it } from 'vitest';
import { cookieOptions, hashToken, newToken, readToken, SESSION_COOKIE } from '../../src/sessionToken';

describe('session token (BR4.5, BR4.6)', () => {
  it('makes unique tokens of at least 43 URL-safe characters (256 bits)', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newToken()));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });

  it('hashes with SHA-256 consistently and differently per token', () => {
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abd')).not.toBe(hashToken('abc'));
  });

  it('reads Bearer first, then the cookie; Bearer wins when both are present', () => {
    expect(readToken({ authorization: 'Bearer tok1' }, { [SESSION_COOKIE]: 'cook' })).toBe('tok1');
    expect(readToken({ authorization: 'bearer tok1' }, undefined)).toBe('tok1');
    expect(readToken({}, { [SESSION_COOKIE]: 'cook' })).toBe('cook');
  });

  it('returns null when nothing usable is sent (other schemes, empty values, other cookies)', () => {
    expect(readToken({}, undefined)).toBeNull();
    expect(readToken({ authorization: 'Basic abc' }, {})).toBeNull();
    expect(readToken({ authorization: 'Bearer ' }, { other: 'x' })).toBeNull();
    expect(readToken({ authorization: 'Bearer a b' }, {})).toBeNull();
  });

  it('builds a httpOnly, SameSite=Lax cookie without Max-Age; Secure follows the setting', () => {
    expect(cookieOptions(false)).toEqual({ httpOnly: true, sameSite: 'lax', path: '/', secure: false });
    expect(cookieOptions(true).secure).toBe(true);
    expect('maxAge' in cookieOptions(true)).toBe(false);
    expect('expires' in cookieOptions(true)).toBe(false);
  });
});
