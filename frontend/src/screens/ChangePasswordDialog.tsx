import { FormEvent, useState } from 'react';
import { ApiError, changePassword } from '../api';

interface Props {
  onClose: () => void;
}

/** Own password change (BR4.12), for every role. The minimum length is shown; the server has the final say. */
export function ChangePasswordDialog({ onClose }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true);
      setCurrent('');
      setNext('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-testid="change-password" role="dialog" aria-label="Ganti Kata Sandi" className="space-y-3 rounded border border-gray-300 p-3">
      <h2 className="text-lg font-semibold">Ganti Kata Sandi</h2>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="cp-current" className="block text-sm font-medium">
            Kata sandi lama
          </label>
          <input
            id="cp-current"
            data-testid="cp-current"
            type="password"
            autoComplete="current-password"
            className="rounded border border-gray-300 px-2 py-1"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="cp-new" className="block text-sm font-medium">
            Kata sandi baru
          </label>
          <input
            id="cp-new"
            data-testid="cp-new"
            type="password"
            autoComplete="new-password"
            className="rounded border border-gray-300 px-2 py-1"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <p data-testid="cp-hint" className="text-xs text-gray-600">
            Minimal 10 karakter, maksimal 128.
          </p>
        </div>
        {error && (
          <p role="alert" data-testid="cp-error" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {done && (
          <p role="status" data-testid="cp-done" className="text-sm text-green-800">
            Kata sandi diganti. Sesi Anda di perangkat lain berakhir.
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" data-testid="cp-submit" disabled={busy} className="rounded bg-blue-700 px-3 py-1 text-white disabled:opacity-50">
            Simpan
          </button>
          <button type="button" data-testid="cp-close" className="rounded border border-gray-400 px-3 py-1" onClick={onClose}>
            Tutup
          </button>
        </div>
      </form>
    </section>
  );
}
