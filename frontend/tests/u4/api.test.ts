import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changePassword,
  createUser,
  FORBIDDEN_MESSAGE,
  getMe,
  hasRole,
  listAuditEvents,
  listUsers,
  login,
  logout,
  patchUser,
  resetUserPassword,
  setAuthHandlers,
  TOO_MANY_MESSAGE,
  unlockUser,
  UNAUTHORIZED_MESSAGE,
} from '../../src/api';
import { account, bodyOf, callsTo, json, me, mockFetch } from './mock';

const onUnauthorized = vi.fn();
const onForbidden = vi.fn();

beforeEach(() => {
  vi.unstubAllGlobals();
  onUnauthorized.mockClear();
  onForbidden.mockClear();
  setAuthHandlers({ onUnauthorized, onForbidden });
});
afterEach(() => setAuthHandlers({ onUnauthorized: null, onForbidden: null }));

describe('U4 API client', () => {
  it('sends every call with credentials and stores nothing in the browser', async () => {
    const fetchMock = mockFetch('viewer');
    await getMe();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
    expect(localStorage.length + sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });

  it('login posts the credentials and returns the user without keeping the token', async () => {
    const fetchMock = mockFetch(null, { 'POST /api/v1/auth/login': () => json(200, { sessionToken: 'tok', user: me('editor') }) });
    const user = await login('a@b.test', 'rahasia-panjang');
    expect(user).toEqual(me('editor'));
    expect(bodyOf(callsTo(fetchMock, 'POST', '/api/v1/auth/login')[0])).toEqual({ email: 'a@b.test', password: 'rahasia-panjang' });
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain('tok');
  });

  it('a failed login (401) is about the credentials: it does not trigger the session-expired handler', async () => {
    mockFetch(null, { 'POST /api/v1/auth/login': () => json(401, { error: 'unauthorized' }) });
    await expect(login('a@b.test', 'x')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('a 401 on any other call triggers the handler and gets the session message', async () => {
    mockFetch(null);
    await expect(getMe()).rejects.toMatchObject({ status: 401, message: UNAUTHORIZED_MESSAGE });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('maps 403 and 429 to their messages; 403 also triggers the role reload', async () => {
    mockFetch('viewer', {
      'GET /api/v1/users': () => json(403, { error: 'forbidden', message: 'apa pun' }),
      'POST /api/v1/auth/password': () => json(429, { error: 'too_many_attempts' }),
    });
    await expect(listUsers()).rejects.toMatchObject({ status: 403, message: FORBIDDEN_MESSAGE });
    expect(onForbidden).toHaveBeenCalledTimes(1);
    await expect(changePassword('a', 'b')).rejects.toMatchObject({ status: 429, message: TOO_MANY_MESSAGE });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('sends the account calls to the documented endpoints with the documented bodies', async () => {
    const fetchMock = mockFetch('admin', {
      'POST /api/v1/auth/logout': () => new Response(null, { status: 204 }),
      'POST /api/v1/users': () => json(201, account()),
      'PATCH /api/v1/users/a%2F1': () => json(200, account()),
      'POST /api/v1/users/a1/password': () => new Response(null, { status: 204 }),
      'POST /api/v1/users/a1/unlock': () => new Response(null, { status: 204 }),
    });
    await logout();
    await createUser({ name: 'N', email: 'n@x.test', role: 'viewer', password: 'kata-sandi-awal-1' });
    await patchUser('a/1', { role: 'editor' });
    await resetUserPassword('a1', 'sandi-baru-dari-admin');
    await unlockUser('a1');
    expect(callsTo(fetchMock, 'POST', '/api/v1/auth/logout')).toHaveLength(1);
    expect(bodyOf(callsTo(fetchMock, 'PATCH', '/api/v1/users/a%2F1')[0])).toEqual({ role: 'editor' });
    expect(bodyOf(callsTo(fetchMock, 'POST', '/api/v1/users/a1/password')[0])).toEqual({ newPassword: 'sandi-baru-dari-admin' });
    expect(callsTo(fetchMock, 'POST', '/api/v1/users/a1/unlock')).toHaveLength(1);
  });

  it('listAuditEvents sends only the filters that are set', async () => {
    const fetchMock = mockFetch('admin', { 'GET /api/v1/audit-events': () => json(200, { items: [], nextCursor: null }) });
    await listAuditEvents({ type: 'logout', from: '', cursor: 'C' });
    const url = new URL(String(callsTo(fetchMock, 'GET', '/api/v1/audit-events')[0]?.[0]));
    expect([...url.searchParams.keys()].sort()).toEqual(['cursor', 'type']);
  });

  it('hasRole ranks viewer < editor < admin', () => {
    expect(hasRole('admin', 'editor')).toBe(true);
    expect(hasRole('viewer', 'editor')).toBe(false);
    expect(hasRole('editor', 'editor')).toBe(true);
  });
});
