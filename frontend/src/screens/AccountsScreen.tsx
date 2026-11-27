import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  AccountUser,
  ApiError,
  createUser,
  listUsers,
  patchUser,
  resetUserPassword,
  Role,
  unlockUser,
} from '../api';

const ROLES: Role[] = ['admin', 'editor', 'viewer'];

function formatTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('id-ID') : '-';
}

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Terjadi kesalahan.');

/** Account administration for admins (BR4.10, BR4.13, BR4.14, BR4.18). Reactivation is not offered: server script only. */
export function AccountsScreen() {
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [form, setForm] = useState({ name: '', email: '', role: 'viewer' as Role, password: '' });

  const reload = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setLoadError(null);
    } catch (err) {
      setLoadError(messageOf(err));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Runs one account action, shows the outcome, and reloads the list. */
  async function act(run: () => Promise<unknown>, done: string) {
    setError(null);
    setNotice(null);
    try {
      await run();
      setNotice(done);
    } catch (err) {
      setError(messageOf(err));
    }
    await reload();
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    await act(async () => {
      await createUser(form);
      setForm({ name: '', email: '', role: 'viewer', password: '' });
    }, 'Akun dibuat.');
  }

  return (
    <section data-testid="screen-accounts" className="space-y-4 p-2">
      <h2 className="text-lg font-semibold">Akun</h2>
      {notice && (
        <p role="status" data-testid="accounts-notice" className="text-sm text-green-800">
          {notice}
        </p>
      )}
      {(error || loadError) && (
        <p role="alert" data-testid="accounts-error" className="text-sm text-red-700">
          {error ?? loadError}
        </p>
      )}

      <form data-testid="account-form" onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="acc-name" className="block text-sm font-medium">
            Nama
          </label>
          <input id="acc-name" data-testid="account-name" className="rounded border border-gray-300 px-2 py-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="acc-email" className="block text-sm font-medium">
            Email
          </label>
          <input id="acc-email" data-testid="account-email" className="rounded border border-gray-300 px-2 py-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label htmlFor="acc-role" className="block text-sm font-medium">
            Role
          </label>
          <select id="acc-role" data-testid="account-role" className="rounded border border-gray-300 px-2 py-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="acc-password" className="block text-sm font-medium">
            Kata sandi awal
          </label>
          <input id="acc-password" data-testid="account-password" type="password" autoComplete="new-password" className="rounded border border-gray-300 px-2 py-1" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button type="submit" data-testid="account-add" className="rounded bg-blue-700 px-3 py-1 text-white">
          Tambah Akun
        </button>
      </form>
      <p className="text-xs text-gray-600">Kata sandi awal 10 sampai 128 karakter; sampaikan ke pemiliknya di luar portal.</p>

      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th>Nama</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Login terakhir</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody data-testid="account-list">
          {users.map((u) => (
            <tr key={u.id} data-testid="account-row" className="border-t border-gray-200 align-top">
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>
                {u.status === 'active' ? (
                  <select
                    data-testid="account-role-select"
                    aria-label={`Role ${u.email}`}
                    className="rounded border border-gray-300 px-1"
                    value={u.role}
                    onChange={(e) => void act(() => patchUser(u.id, { role: e.target.value as Role }), 'Role diubah.')}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : (
                  u.role
                )}
              </td>
              <td data-testid="account-status">{u.status === 'active' ? 'Aktif' : 'Nonaktif'}</td>
              <td>{formatTime(u.lastLoginAt)}</td>
              <td className="space-x-2">
                {u.status === 'active' && (
                  <>
                    {confirming === u.id ? (
                      <span data-testid="deactivate-confirm">
                        Nonaktifkan {u.name}?{' '}
                        <button
                          type="button"
                          data-testid="deactivate-yes"
                          className="text-red-700 underline"
                          onClick={() => {
                            setConfirming(null);
                            void act(() => patchUser(u.id, { status: 'inactive' }), 'Akun dinonaktifkan.');
                          }}
                        >
                          Ya, nonaktifkan
                        </button>{' '}
                        <button type="button" data-testid="deactivate-no" className="underline" onClick={() => setConfirming(null)}>
                          Batal
                        </button>
                      </span>
                    ) : (
                      <button type="button" data-testid="account-deactivate" className="text-red-700 underline" onClick={() => setConfirming(u.id)}>
                        Nonaktifkan
                      </button>
                    )}
                    {resetting === u.id ? (
                      <span data-testid="reset-form">
                        <input
                          data-testid="reset-password"
                          type="password"
                          autoComplete="new-password"
                          aria-label={`Kata sandi baru ${u.email}`}
                          className="rounded border border-gray-300 px-1"
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                        />{' '}
                        <button
                          type="button"
                          data-testid="reset-save"
                          className="underline"
                          onClick={() => {
                            const pw = resetPassword;
                            setResetting(null);
                            setResetPassword('');
                            void act(() => resetUserPassword(u.id, pw), 'Kata sandi diatur ulang.');
                          }}
                        >
                          Simpan
                        </button>{' '}
                        <button type="button" data-testid="reset-cancel" className="underline" onClick={() => setResetting(null)}>
                          Batal
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        data-testid="account-reset"
                        className="underline"
                        onClick={() => {
                          setResetPassword('');
                          setResetting(u.id);
                        }}
                      >
                        Atur ulang kata sandi
                      </button>
                    )}
                    <button type="button" data-testid="account-unlock" className="underline" onClick={() => void act(() => unlockUser(u.id), 'Kunci login dibuka.')}>
                      Buka kunci login
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
