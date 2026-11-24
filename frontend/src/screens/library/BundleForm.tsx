import { FormEvent, useEffect, useState } from 'react';
import {
  ApiError,
  BundleDetail,
  CATEGORIES,
  createBundle,
  listSteps,
  StepListItem,
  updateBundle,
} from '../../api';

interface Props {
  initial?: BundleDetail;
  onSaved: () => void;
  onCancel: () => void;
}

interface PickerProps {
  label: string;
  testPrefix: string;
  options: StepListItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
  invalid: boolean;
}

/** An ordered list of steps: choose from the Library, then move up/down or remove. Order is what is saved. */
function OrderedPicker({ label, testPrefix, options, selected, onChange, invalid }: PickerProps) {
  const [choice, setChoice] = useState('');
  const nameOf = (id: string) => options.find((o) => o.id === id)?.name ?? id;
  const available = options.filter((o) => !selected.includes(o.id));

  function move(index: number, delta: -1 | 1) {
    const next = [...selected];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target] as string, next[index] as string];
    onChange(next);
  }

  return (
    <fieldset className={`rounded border p-2 ${invalid ? 'border-red-600' : 'border-gray-300'}`}>
      <legend className="text-sm font-medium">{label}</legend>
      <ol className="space-y-1" data-testid={`${testPrefix}-list`}>
        {selected.map((id, i) => (
          <li key={id} data-testid={`${testPrefix}-item`} className="flex items-center gap-2">
            <span className="w-6 text-right text-sm text-gray-500">{i + 1}.</span>
            <span className="flex-1">{nameOf(id)}</span>
            <button type="button" aria-label={`Naikkan ${nameOf(id)}`} data-testid={`${testPrefix}-up-${i}`} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" aria-label={`Turunkan ${nameOf(id)}`} data-testid={`${testPrefix}-down-${i}`} onClick={() => move(i, 1)}>
              ↓
            </button>
            <button
              type="button"
              aria-label={`Keluarkan ${nameOf(id)}`}
              data-testid={`${testPrefix}-remove-${i}`}
              onClick={() => onChange(selected.filter((x) => x !== id))}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex gap-2">
        <select
          aria-label={`Pilih step untuk ${label}`}
          data-testid={`${testPrefix}-select`}
          className="rounded border border-gray-300 px-2 py-1"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value="">— pilih step —</option>
          {available.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.category})
            </option>
          ))}
        </select>
        <button
          type="button"
          data-testid={`${testPrefix}-add`}
          disabled={choice === ''}
          className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
          onClick={() => {
            onChange([...selected, choice]);
            setChoice('');
          }}
        >
          Tambah
        </button>
      </div>
    </fieldset>
  );
}

/** Create or edit a bundle (Alur 5): ordered forward steps plus an ordered rollback sequence of any length. */
export function BundleForm({ initial, onSaved, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [forwardIds, setForwardIds] = useState<string[]>(initial?.forward.map((s) => s.id) ?? []);
  const [rollbackIds, setRollbackIds] = useState<string[]>(initial?.rollback.map((s) => s.id) ?? []);
  const [steps, setSteps] = useState<StepListItem[]>([]);
  const [errorPaths, setErrorPaths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    listSteps()
      .then((all) => live && setSteps(all))
      .catch((err: unknown) => live && setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan.'));
    return () => {
      live = false;
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorPaths([]);
    setBusy(true);
    const draft = {
      name,
      category: category === '' ? null : category,
      forwardStepIds: forwardIds,
      rollbackStepIds: rollbackIds,
    };
    try {
      if (initial) await updateBundle(initial.id, draft);
      else await createBundle(draft);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorPaths(err.fields);
        setError(err.message);
      } else {
        setError('Terjadi kesalahan.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate data-testid="bundle-form" className="space-y-4">
      <h2 className="text-lg font-semibold">{initial ? 'Ubah Bundle' : 'Buat Bundle'}</h2>
      <div>
        <label htmlFor="bundle-name" className="block text-sm font-medium">
          Nama bundle
        </label>
        <input
          id="bundle-name"
          data-testid="bundle-name-input"
          className={`w-full rounded border px-2 py-1 ${errorPaths.includes('name') ? 'border-red-600' : 'border-gray-300'}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="bundle-category" className="block text-sm font-medium">
          Kategori (opsional)
        </label>
        <select
          id="bundle-category"
          data-testid="bundle-category-input"
          className="rounded border border-gray-300 px-2 py-1"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">— tanpa kategori —</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <OrderedPicker
        label="Step forward (berurutan)"
        testPrefix="bundle-forward"
        options={steps.filter((s) => s.kind === 'forward')}
        selected={forwardIds}
        onChange={setForwardIds}
        invalid={errorPaths.includes('forwardStepIds')}
      />
      <OrderedPicker
        label="Step rollback (berurutan, jumlah boleh berbeda)"
        testPrefix="bundle-rollback"
        options={steps.filter((s) => s.kind === 'rollback')}
        selected={rollbackIds}
        onChange={setRollbackIds}
        invalid={errorPaths.includes('rollbackStepIds')}
      />
      <p data-testid="bundle-counts" className="text-sm text-gray-700">
        {forwardIds.length} step forward, {rollbackIds.length} step rollback
      </p>
      {error && (
        <p role="alert" data-testid="bundle-error" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          data-testid="bundle-submit"
          disabled={busy}
          className="rounded bg-blue-700 px-3 py-1 text-white disabled:opacity-50"
        >
          Simpan bundle
        </button>
        <button type="button" data-testid="bundle-cancel" className="rounded border border-gray-400 px-3 py-1" onClick={onCancel}>
          Batal
        </button>
      </div>
    </form>
  );
}
