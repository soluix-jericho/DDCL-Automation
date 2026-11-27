import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { bodyOf, callsTo, json, me, mockFetch } from './mock';

beforeEach(() => {
  vi.unstubAllGlobals();
});

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByTestId('login-email'), email);
  await user.type(screen.getByTestId('login-password'), password);
  await user.click(screen.getByTestId('login-submit'));
}

describe('Login screen (AC6.2.1, BR4.3, BR4.4)', () => {
  it('shows the login form, with no sign-up link, when /auth/me answers 401', async () => {
    mockFetch(null);
    render(<App />);
    expect(await screen.findByTestId('login-form')).toBeInTheDocument();
    expect(screen.queryByText(/daftar/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-library')).not.toBeInTheDocument();
  });

  it('opens the main page after a successful login and sends email and password', async () => {
    let signedIn = false;
    const fetchMock = mockFetch(null, {
      'GET /api/v1/auth/me': () => (signedIn ? json(200, me('editor')) : json(401, { error: 'unauthorized' })),
      'POST /api/v1/auth/login': () => {
        signedIn = true;
        return json(200, { sessionToken: 'tok', user: me('editor') });
      },
    });
    render(<App />);
    await fill('ana@example.test', 'kata-sandi-panjang');
    expect(await screen.findByTestId('tab-library')).toBeInTheDocument();
    expect(screen.getByTestId('user-name')).toHaveTextContent('editor Uji (editor)');
    expect(bodyOf(callsTo(fetchMock, 'POST', '/api/v1/auth/login')[0])).toEqual({
      email: 'ana@example.test',
      password: 'kata-sandi-panjang',
    });
  });

  it('shows one generic message for a 401, whatever the cause, and clears the password field', async () => {
    mockFetch(null, { 'POST /api/v1/auth/login': () => json(401, { error: 'unauthorized' }) });
    render(<App />);
    await fill('ana@example.test', 'salah-salah-1');
    expect(await screen.findByTestId('login-error')).toHaveTextContent('Email atau kata sandi salah.');
    expect(screen.getByTestId('login-password')).toHaveValue('');
    expect(screen.queryByTestId('tab-library')).not.toBeInTheDocument();
  });

  it('shows a different message for a 429 and does not say whether the email exists', async () => {
    mockFetch(null, {
      'POST /api/v1/auth/login': () => json(429, { error: 'too_many_attempts' }, { 'Retry-After': '900' }),
    });
    render(<App />);
    await fill('ana@example.test', 'kata-sandi-panjang');
    const msg = await screen.findByTestId('login-error');
    expect(msg).toHaveTextContent('Terlalu banyak percobaan, coba lagi nanti.');
    expect(msg).not.toHaveTextContent(/salah|tidak terdaftar/i);
  });

  it('shows the busy message for a 503 and the generic one for a 500', async () => {
    let status = 503;
    mockFetch(null, {
      'POST /api/v1/auth/login': () =>
        status === 503 ? json(503, { error: 'service_busy' }) : json(500, { error: 'internal_error' }),
    });
    render(<App />);
    await fill('ana@example.test', 'kata-sandi-panjang');
    expect(await screen.findByTestId('login-error')).toHaveTextContent('sibuk');
    status = 500;
    const user = userEvent.setup();
    await user.type(screen.getByTestId('login-password'), 'kata-sandi-panjang'); // the field was cleared
    await user.click(screen.getByTestId('login-submit'));
    await waitFor(() => expect(screen.getByTestId('login-error')).toHaveTextContent('Terjadi kesalahan pada server'));
  });
});
