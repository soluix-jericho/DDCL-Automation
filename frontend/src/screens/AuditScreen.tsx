import { useCallback, useEffect, useState } from 'react';
import { ApiError, AUDIT_TYPES, AuditEvent, listAuditEvents } from '../api';

const TYPE_LABEL: Record<(typeof AUDIT_TYPES)[number], string> = {
  login_success: 'Login berhasil',
  login_failed: 'Login gagal',
  login_locked: 'Login terkunci',
  logout: 'Keluar',
  account_created: 'Akun dibuat',
  role_changed: 'Role diubah',
  account_deactivated: 'Akun dinonaktifkan',
  account_reactivated: 'Akun diaktifkan kembali',
  password_changed: 'Kata sandi diganti',
  password_reset_by_admin: 'Kata sandi diatur ulang admin',
  lockout_cleared_by_admin: 'Kunci dibuka admin',
};

interface Filters {
  type: string;
  from: string;
  to: string;
}

/** Read-only audit list, newest first, with type and date filters and "Muat lagi" by cursor (BR4.20). */
export function AuditScreen() {
  const [filters, setFilters] = useState<Filters>({ type: '', from: '', to: '' });
  const [applied, setApplied] = useState<Filters>(filters);
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: Filters, from: string | null) => {
    try {
      const page = await listAuditEvents({ type: f.type, from: f.from, to: f.to, ...(from ? { cursor: from } : {}) });
      setItems((prev) => (from ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan.');
    }
  }, []);

  useEffect(() => {
    void load(applied, null);
  }, [applied, load]);

  return (
    <section data-testid="screen-audit" className="space-y-4 p-2">
      <h2 className="text-lg font-semibold">Catatan Audit</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="audit-type" className="block text-sm font-medium">
            Jenis
          </label>
          <select id="audit-type" data-testid="audit-type" className="rounded border border-gray-300 px-2 py-1" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
            <option value="">Semua jenis</option>
            {AUDIT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-from" className="block text-sm font-medium">
            Dari tanggal
          </label>
          <input id="audit-from" data-testid="audit-from" type="date" className="rounded border border-gray-300 px-2 py-1" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div>
          <label htmlFor="audit-to" className="block text-sm font-medium">
            Sampai tanggal
          </label>
          <input id="audit-to" data-testid="audit-to" type="date" className="rounded border border-gray-300 px-2 py-1" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <button type="button" data-testid="audit-apply" className="rounded bg-blue-700 px-3 py-1 text-white" onClick={() => setApplied({ ...filters })}>
          Terapkan
        </button>
      </div>
      {error && (
        <p role="alert" data-testid="audit-error" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {items.length === 0 && !error && (
        <p data-testid="audit-empty" className="text-sm text-gray-600">
          Belum ada catatan.
        </p>
      )}
      <ul data-testid="audit-list" className="divide-y divide-gray-200 text-sm">
        {items.map((ev) => (
          <li key={ev.id} data-testid="audit-item" className="flex flex-wrap gap-2 py-1">
            <time dateTime={ev.occurredAt}>{new Date(ev.occurredAt).toLocaleString('id-ID')}</time>
            <strong>{TYPE_LABEL[ev.type]}</strong>
            {ev.email && <span>{ev.email}</span>}
            {ev.ipAddress && <span className="text-gray-600">{ev.ipAddress}</span>}
            {ev.detail && <span className="text-gray-600">{ev.detail}</span>}
          </li>
        ))}
      </ul>
      {cursor && (
        <button type="button" data-testid="audit-more" className="rounded border border-blue-700 px-3 py-1 text-blue-700" onClick={() => void load(applied, cursor)}>
          Muat lagi
        </button>
      )}
    </section>
  );
}
