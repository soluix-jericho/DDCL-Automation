import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsScreen } from '../../src/screens/AccountsScreen';
import { account, bodyOf, callsTo, json, mockFetch } from './mock';

beforeEach(() => {
  vi.unstubAllGlobals();
});

const USERS = [
  account({ id: 'a1', name: 'Ana', email: 'ana@example.test', role: 'editor', lastLoginAt: '2026-11-03T08:00:00.000Z' }),
  account({ id: 'a2', name: 'Budi', email: 'budi@example.test', role: 'viewer', status: 'inactive' }),
];

function setup(routes = {}) {
  const fetchMock = mockFetch('admin', { 'GET /api/v1/users': () => json(200, USERS), ...routes });
  render(<AccountsScreen />);
  return fetchMock;
}

describe('Accounts screen (BR4.10, BR4.13, BR4.14, BR4.18)', () => {
  it('lists name, email, role, status and last login; inactive accounts get no actions', async () => {
    setup();
    const rows = await screen.findAllByTestId('account-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Ana');
    expect(rows[0]).toHaveTextContent('ana@example.test');
    expect(within(rows[0] as HTMLElement).getByTestId('account-status')).toHaveTextContent('Aktif');
    expect(within(rows[1] as HTMLElement).getByTestId('account-status')).toHaveTextContent('Nonaktif');
    expect(within(rows[1] as HTMLElement).queryByTestId('account-deactivate')).not.toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).queryByTestId('account-unlock')).not.toBeInTheDocument();
  });

  it('adds an account with the typed values, clears the form and reloads the list', async () => {
    const fetchMock = setup({ 'POST /api/v1/users': () => json(201, account({ id: 'a3' })) });
    await screen.findAllByTestId('account-row');
    const user = userEvent.setup();
    await user.type(screen.getByTestId('account-name'), 'Citra');
    await user.type(screen.getByTestId('account-email'), 'citra@example.test');
    await user.selectOptions(screen.getByTestId('account-role'), 'admin');
    await user.type(screen.getByTestId('account-password'), 'kata-sandi-awal-1');
    await user.click(screen.getByTestId('account-add'));
    await waitFor(() => expect(screen.getByTestId('accounts-notice')).toHaveTextContent('Akun dibuat.'));
    expect(bodyOf(callsTo(fetchMock, 'POST', '/api/v1/users')[0])).toEqual({
      name: 'Citra',
      email: 'citra@example.test',
      role: 'admin',
      password: 'kata-sandi-awal-1',
    });
    expect(screen.getByTestId('account-name')).toHaveValue('');
    expect(callsTo(fetchMock, 'GET', '/api/v1/users')).toHaveLength(2);
  });

  it('shows the server message for a 409 (duplicate email) and a 400 (short password)', async () => {
    let status = 409;
    setup({
      'POST /api/v1/users': () =>
        status === 409
          ? json(409, { error: 'conflict', message: 'Email sudah terdaftar.' })
          : json(400, { error: 'validation_error', message: 'Kata sandi harus 10 sampai 128 karakter', fields: ['password'] }),
    });
    await screen.findAllByTestId('account-row');
    const user = userEvent.setup();
    await user.click(screen.getByTestId('account-add'));
    expect(await screen.findByTestId('accounts-error')).toHaveTextContent('Email sudah terdaftar.');
    status = 400;
    await user.click(screen.getByTestId('account-add'));
    await waitFor(() => expect(screen.getByTestId('accounts-error')).toHaveTextContent('10 sampai 128'));
  });

  it('changes a role through the row select', async () => {
    const fetchMock = setup({ 'PATCH /api/v1/users/a1': () => json(200, account({ role: 'viewer' })) });
    const rows = await screen.findAllByTestId('account-row');
    await userEvent.setup().selectOptions(within(rows[0] as HTMLElement).getByTestId('account-role-select'), 'viewer');
    await waitFor(() => expect(callsTo(fetchMock, 'PATCH', '/api/v1/users/a1')).toHaveLength(1));
    expect(bodyOf(callsTo(fetchMock, 'PATCH', '/api/v1/users/a1')[0])).toEqual({ role: 'viewer' });
  });

  it('asks for confirmation before deactivating, and cancelling sends nothing', async () => {
    const fetchMock = setup({ 'PATCH /api/v1/users/a1': () => json(200, account({ status: 'inactive' })) });
    const row = (await screen.findAllByTestId('account-row'))[0] as HTMLElement;
    const user = userEvent.setup();
    await user.click(within(row).getByTestId('account-deactivate'));
    expect(within(row).getByTestId('deactivate-confirm')).toHaveTextContent('Nonaktifkan Ana?');
    await user.click(within(row).getByTestId('deactivate-no'));
    expect(callsTo(fetchMock, 'PATCH', '/api/v1/users/a1')).toHaveLength(0);
    await user.click(within(row).getByTestId('account-deactivate'));
    await user.click(within(row).getByTestId('deactivate-yes'));
    await waitFor(() => expect(callsTo(fetchMock, 'PATCH', '/api/v1/users/a1')).toHaveLength(1));
    expect(bodyOf(callsTo(fetchMock, 'PATCH', '/api/v1/users/a1')[0])).toEqual({ status: 'inactive' });
  });

  it('shows a clear message when deactivation is refused with 409 (last admin or yourself)', async () => {
    setup({
      'PATCH /api/v1/users/a1': () => json(409, { error: 'conflict', message: 'Harus tersisa sedikitnya satu admin aktif.' }),
    });
    const row = (await screen.findAllByTestId('account-row'))[0] as HTMLElement;
    const user = userEvent.setup();
    await user.click(within(row).getByTestId('account-deactivate'));
    await user.click(within(row).getByTestId('deactivate-yes'));
    expect(await screen.findByTestId('accounts-error')).toHaveTextContent('satu admin aktif');
  });

  it('resets a password with the typed value and unlocks a login through the right endpoints', async () => {
    const fetchMock = setup({
      'POST /api/v1/users/a1/password': () => new Response(null, { status: 204 }),
      'POST /api/v1/users/a1/unlock': () => new Response(null, { status: 204 }),
    });
    const row = (await screen.findAllByTestId('account-row'))[0] as HTMLElement;
    const user = userEvent.setup();
    await user.click(within(row).getByTestId('account-reset'));
    await user.type(within(row).getByTestId('reset-password'), 'sandi-baru-dari-admin');
    await user.click(within(row).getByTestId('reset-save'));
    await waitFor(() => expect(callsTo(fetchMock, 'POST', '/api/v1/users/a1/password')).toHaveLength(1));
    expect(bodyOf(callsTo(fetchMock, 'POST', '/api/v1/users/a1/password')[0])).toEqual({ newPassword: 'sandi-baru-dari-admin' });
    await user.click(within((await screen.findAllByTestId('account-row'))[0] as HTMLElement).getByTestId('account-unlock'));
    await waitFor(() => expect(callsTo(fetchMock, 'POST', '/api/v1/users/a1/unlock')).toHaveLength(1));
    expect(screen.getByTestId('accounts-notice')).toHaveTextContent('Kunci login dibuka.');
  });

  it('shows the load error when the list cannot be read', async () => {
    mockFetch('admin', { 'GET /api/v1/users': () => json(403, { error: 'forbidden' }) });
    render(<AccountsScreen />);
    expect(await screen.findByTestId('accounts-error')).toHaveTextContent('Hak akses tidak cukup');
  });

  it('renders account text as text, never as markup', async () => {
    mockFetch('admin', { 'GET /api/v1/users': () => json(200, [account({ name: '<img src=x onerror=alert(1)>' })]) });
    render(<AccountsScreen />);
    const row = await screen.findByTestId('account-row');
    expect(row).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(row.querySelector('img')).toBeNull();
  });
});
