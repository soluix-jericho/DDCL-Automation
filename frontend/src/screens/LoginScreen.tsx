import { FormEvent, useState } from 'react';
import { ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';

const WRONG_CREDENTIALS = 'Email atau kata sandi salah.';

/** Login (BR4.3, BR4.4): one generic message for every failed credential, a different one for the lock. No sign-up link. */
export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError(WRONG_CREDENTIALS);
      else setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm space-y-4 p-4">
      <h1 className="text-xl font-semibold">Portal DDCL Otomatis</h1>
      <form data-testid="login-form" onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="login-email"
            data-testid="login-email"
            type="email"
            autoComplete="username"
            required
            className="w-full rounded border border-gray-300 px-2 py-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium">
            Kata sandi
          </label>
          <input
            id="login-password"
            data-testid="login-password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded border border-gray-300 px-2 py-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" data-testid="login-error" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          data-testid="login-submit"
          disabled={busy}
          className="rounded bg-blue-700 px-3 py-1 text-white disabled:opacity-50"
        >
          Masuk
        </button>
      </form>
    </main>
  );
}
