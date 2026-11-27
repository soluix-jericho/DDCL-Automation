import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { createStep, Role } from '../../src/api';
import { AuthProvider, useAuth } from '../../src/auth/AuthContext';
import { callsTo, json, listItem, me, mockFetch } from './mock';

beforeEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const STEP_ROUTE = { 'GET /api/v1/steps': () => json(200, [listItem({ id: 'a', name: 'Maju' })]) };

async function openAs(role: Role) {
  mockFetch(role, STEP_ROUTE);
  render(<App />);
  await screen.findByTestId('step-item');
}

describe('session handling (AC6.2.1, BR4.6, BR4.7)', () => {
  it('asks /auth/me on open and shows a loading state before it answers', async () => {
    const fetchMock = mockFetch('admin', STEP_ROUTE);
    render(<App />);
    expect(screen.getByTestId('auth-loading')).toBeInTheDocument();
    await screen.findByTestId('tab-library');
    expect(callsTo(fetchMock, 'GET', '/api/v1/auth/me')).toHaveLength(1);
  });

  it('goes back to Login when any API call answers 401 (expired or revoked session)', async () => {
    let expired = false;
    mockFetch('editor', {
      'GET /api/v1/steps': () => (expired ? json(401, { error: 'unauthorized' }) : json(200, [])),
    });
    render(<App />);
    await screen.findByTestId('tab-library');
    expired = true;
    await userEvent.setup().type(screen.getByTestId('library-search'), 'x');
    expect(await screen.findByTestId('login-form')).toBeInTheDocument();
  });

  it('logs out: calls the endpoint and shows Login, even when the server answers 401', async () => {
    const fetchMock = mockFetch('admin', {
      ...STEP_ROUTE,
      'POST /api/v1/auth/logout': () => json(401, { error: 'unauthorized' }),
    });
    render(<App />);
    await userEvent.setup().click(await screen.findByTestId('logout'));
    expect(await screen.findByTestId('login-form')).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST', '/api/v1/auth/logout')).toHaveLength(1);
  });

  it('keeps no token or session data in localStorage or sessionStorage', async () => {
    await openAs('admin');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe('menus per role (BR4.9)', () => {
  it('viewer: no write, delete, Akun or Audit', async () => {
    await openAs('viewer');
    expect(screen.queryByTestId('step-new')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bundle-new')).not.toBeInTheDocument();
    expect(screen.queryByTestId('step-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('step-delete')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-accounts')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-audit')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByTestId('tab-compose'));
    expect(screen.getByTestId('compose-readonly')).toBeInTheDocument();
    expect(screen.queryByTestId('ddcl-submit')).not.toBeInTheDocument();
  });

  it('editor: writes but cannot delete and has no Akun or Audit', async () => {
    await openAs('editor');
    expect(screen.getByTestId('step-new')).toBeInTheDocument();
    expect(screen.getByTestId('step-edit')).toBeInTheDocument();
    expect(screen.queryByTestId('step-delete')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-accounts')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-audit')).not.toBeInTheDocument();
  });

  it('admin: everything, including the Akun and Audit tabs', async () => {
    await openAs('admin');
    expect(screen.getByTestId('step-delete')).toBeInTheDocument();
    expect(screen.getByTestId('tab-accounts')).toBeInTheDocument();
    expect(screen.getByTestId('tab-audit')).toBeInTheDocument();
  });

  it('every role can open Ganti Kata Sandi from the user menu', async () => {
    await openAs('viewer');
    await userEvent.setup().click(screen.getByTestId('change-password-open'));
    expect(screen.getByTestId('change-password')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByTestId('cp-close'));
    expect(screen.queryByTestId('change-password')).not.toBeInTheDocument();
  });

  it('does not show the previous user\'s screen to the next person who signs in', async () => {
    let signedIn = true;
    mockFetch('admin', {
      ...STEP_ROUTE,
      'GET /api/v1/auth/me': () => (signedIn ? json(200, me('admin')) : json(401, {})),
      'POST /api/v1/auth/logout': () => {
        signedIn = false;
        return new Response(null, { status: 204 });
      },
    });
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('tab-compose'));
    expect(screen.getByTestId('screen-compose')).toBeInTheDocument();
    await user.click(screen.getByTestId('logout'));
    await screen.findByTestId('login-form');
    expect(screen.queryByTestId('screen-compose')).not.toBeInTheDocument();
    signedIn = true; // the next person signs in: back on the Library tab, not on Susun DDCL
    mockFetch('admin', {
      ...STEP_ROUTE,
      'POST /api/v1/auth/login': () => json(200, { sessionToken: 't', user: me('viewer') }),
    });
    await user.type(screen.getByTestId('login-email'), 'v@example.test');
    await user.type(screen.getByTestId('login-password'), 'kata-sandi-panjang');
    await user.click(screen.getByTestId('login-submit'));
    expect(await screen.findByTestId('screen-library')).toBeInTheDocument();
    expect(screen.queryByTestId('screen-compose')).not.toBeInTheDocument();
  });
});

function RoleProbe() {
  const { user, status } = useAuth();
  return (
    <div>
      <span data-testid="probe-role">{status}:{user?.role ?? '-'}</span>
      <button type="button" data-testid="probe-write" onClick={() => void createStep({ name: 'x', category: 'Database', kind: 'forward', columns: [], attachments: [] }).catch(() => undefined)}>
        write
      </button>
    </div>
  );
}

describe('a 403 on a write reloads the role (read mode)', () => {
  it('shows the lowered role after the server refuses a write', async () => {
    let role: Role = 'editor';
    mockFetch('editor', {
      'GET /api/v1/auth/me': () => json(200, me(role)),
      'POST /api/v1/steps': () => json(403, { error: 'forbidden' }),
    });
    render(
      <AuthProvider>
        <RoleProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('probe-role')).toHaveTextContent('authenticated:editor'));
    role = 'viewer';
    await userEvent.setup().click(screen.getByTestId('probe-write'));
    await waitFor(() => expect(screen.getByTestId('probe-role')).toHaveTextContent('authenticated:viewer'));
  });

  it('useAuth outside a provider is a programming error, not a silent default', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<RoleProbe />)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
