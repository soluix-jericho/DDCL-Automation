import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  BundleDetail,
  BundleListItem,
  CATEGORIES,
  deleteBundle,
  getBundle,
  getStep,
  listBundles,
  listSteps,
  StepContent,
  StepListItem,
} from '../api';
import { BundleForm } from './library/BundleForm';
import { DeleteStepDialog } from './library/DeleteStepDialog';
import { StepForm } from './library/StepForm';

interface Props {
  /** Called after any change so other screens (compose) can reload the step list. */
  onLibraryChanged: () => void;
}

type Mode =
  | { type: 'list' }
  | { type: 'step'; step?: StepContent }
  | { type: 'bundle'; bundle?: BundleDetail };

/** Library: steps and bundles with server-side search and category filter (Alur 1-5). */
export function LibraryScreen({ onLibraryChanged }: Props) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [steps, setSteps] = useState<StepListItem[]>([]);
  const [bundles, setBundles] = useState<BundleListItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [deleting, setDeleting] = useState<StepListItem | null>(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const ticket = ++latest.current; // a slower, older response must not overwrite a newer one
    try {
      const params = { q: q.trim() || undefined, category: category || undefined };
      const [s, b] = await Promise.all([listSteps(params), listBundles(params)]);
      if (ticket !== latest.current) return;
      setSteps(s);
      setBundles(b);
      setLoadError(null);
    } catch (err) {
      if (ticket === latest.current) setLoadError(err instanceof ApiError ? err.message : 'Terjadi kesalahan.');
    }
  }, [q, category]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function changed() {
    void reload();
    onLibraryChanged();
  }

  async function openEditStep(id: string) {
    setNotice(null);
    try {
      setMode({ type: 'step', step: await getStep(id) });
    } catch (err) {
      setNotice(err instanceof ApiError && err.status === 404 ? 'Step sudah tidak ada.' : (err as Error).message);
      changed();
    }
  }

  async function openEditBundle(id: string) {
    setNotice(null);
    try {
      setMode({ type: 'bundle', bundle: await getBundle(id) });
    } catch (err) {
      setNotice(err instanceof ApiError && err.status === 404 ? 'Bundle sudah tidak ada.' : (err as Error).message);
      changed();
    }
  }

  async function removeBundle(b: BundleListItem) {
    setNotice(null);
    try {
      await deleteBundle(b.id);
      setNotice(`Bundle "${b.name}" dihapus. Step di dalamnya tidak ikut terhapus.`);
    } catch (err) {
      setNotice(err instanceof ApiError && err.status === 404 ? 'Bundle sudah tidak ada.' : (err as Error).message);
    }
    changed();
  }

  if (mode.type === 'step') {
    return (
      <section data-testid="screen-library" className="p-2">
        <StepForm
          initial={mode.step}
          onSaved={(saved) => {
            setNotice(`Step "${saved.name}" disimpan.`);
            setMode({ type: 'list' });
            changed();
          }}
          onUseExisting={(existing) => {
            setNotice(`Memakai step yang sudah ada: "${existing.name}".`);
            setMode({ type: 'list' });
          }}
          onCancel={() => setMode({ type: 'list' })}
        />
      </section>
    );
  }

  if (mode.type === 'bundle') {
    return (
      <section data-testid="screen-library" className="p-2">
        <BundleForm
          initial={mode.bundle}
          onSaved={() => {
            setNotice('Bundle disimpan.');
            setMode({ type: 'list' });
            changed();
          }}
          onCancel={() => setMode({ type: 'list' })}
        />
      </section>
    );
  }

  const filtering = q.trim() !== '' || category !== '';

  return (
    <section data-testid="screen-library" className="space-y-4 p-2">
      <h2 className="text-lg font-semibold">Library Step</h2>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="library-search" className="block text-sm font-medium">
            Cari nama
          </label>
          <input
            id="library-search"
            data-testid="library-search"
            className="rounded border border-gray-300 px-2 py-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="library-category-filter" className="block text-sm font-medium">
            Kategori
          </label>
          <select
            id="library-category-filter"
            data-testid="library-category-filter"
            className="rounded border border-gray-300 px-2 py-1"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Semua kategori</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          data-testid="step-new"
          className="rounded bg-blue-700 px-3 py-1 text-white"
          onClick={() => {
            setNotice(null);
            setMode({ type: 'step' });
          }}
        >
          Buat Step Baru
        </button>
        <button
          type="button"
          data-testid="bundle-new"
          className="rounded border border-blue-700 px-3 py-1 text-blue-700"
          onClick={() => {
            setNotice(null);
            setMode({ type: 'bundle' });
          }}
        >
          Buat Bundle
        </button>
      </div>

      {notice && (
        <p role="status" data-testid="library-notice" className="text-sm text-green-800">
          {notice}
        </p>
      )}
      {loadError && (
        <p role="alert" data-testid="library-error" className="text-sm text-red-700">
          {loadError}
        </p>
      )}

      {deleting && (
        <DeleteStepDialog
          step={deleting}
          onCancel={() => setDeleting(null)}
          onDone={(result) => {
            setNotice(
              result === 'deleted'
                ? `Step "${deleting.name}" dihapus. DDCL yang memakainya tidak berubah.`
                : 'Step sudah tidak ada (dihapus lebih dulu).',
            );
            setDeleting(null);
            changed();
          }}
        />
      )}

      <div>
        <h3 className="font-medium">Step</h3>
        {steps.length === 0 && !loadError && (
          <p data-testid="step-list-empty" className="text-sm text-gray-600">
            {filtering ? 'Tidak ada step yang cocok.' : 'Belum ada step di Library.'}
          </p>
        )}
        <ul data-testid="step-list" className="divide-y divide-gray-200">
          {steps.map((s) => (
            <li key={s.id} data-testid="step-item" className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-medium">{s.name}</span>
              <small className="text-gray-600">({s.category})</small>
              <span data-testid="step-kind" className="rounded bg-gray-100 px-1 text-xs">
                {s.kind}
              </span>
              <span data-testid="step-usage" className="text-xs text-gray-600">
                dipakai {s.usageCount} DDCL
              </span>
              {s.missingRollback && (
                <span data-testid="step-missing-rollback" className="rounded bg-amber-100 px-1 text-xs text-amber-900">
                  Belum ada rollback
                </span>
              )}
              <span className="ml-auto flex gap-2">
                <button type="button" data-testid="step-edit" className="text-sm underline" onClick={() => openEditStep(s.id)}>
                  Ubah
                </button>
                <button
                  type="button"
                  data-testid="step-delete"
                  className="text-sm text-red-700 underline"
                  onClick={() => {
                    setNotice(null);
                    setDeleting(s);
                  }}
                >
                  Hapus
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div data-testid="bundle-section">
        <h3 className="font-medium">Bundle</h3>
        {bundles.length === 0 && !loadError && (
          <p data-testid="bundle-list-empty" className="text-sm text-gray-600">
            {filtering ? 'Tidak ada bundle yang cocok.' : 'Belum ada bundle.'}
          </p>
        )}
        <ul data-testid="bundle-list" className="divide-y divide-gray-200">
          {bundles.map((b) => (
            <li key={b.id} data-testid="bundle-item" className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-medium">{b.name}</span>
              {b.category && <small className="text-gray-600">({b.category})</small>}
              <span className="text-xs text-gray-600">
                {b.forwardCount} forward, {b.rollbackCount} rollback
              </span>
              <span className="ml-auto flex gap-2">
                <button type="button" data-testid="bundle-edit" className="text-sm underline" onClick={() => openEditBundle(b.id)}>
                  Ubah
                </button>
                <button type="button" data-testid="bundle-delete" className="text-sm text-red-700 underline" onClick={() => removeBundle(b)}>
                  Hapus
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
