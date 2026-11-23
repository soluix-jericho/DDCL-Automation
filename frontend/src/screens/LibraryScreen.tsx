import { FormEvent, useState } from 'react';
import { ApiError, createStep, Step } from '../api';

interface Props {
  steps: Step[];
  onStepCreated: (step: Step) => void;
}

const FIELD_LABELS: Record<string, string> = { name: 'Nama step', category: 'Kategori' };

export function LibraryScreen({ steps, onStepCreated }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors([]);
    setError(null);
    setBusy(true);
    try {
      const step = await createStep({ name, category });
      onStepCreated(step);
      setName('');
      setCategory('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setFieldErrors(err.fields);
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-testid="screen-library">
      <h2>Library Step</h2>
      <form onSubmit={submit} noValidate>
        <div>
          <label htmlFor="step-name">Nama step</label>
          <input
            id="step-name"
            data-testid="step-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {fieldErrors.includes('name') && (
            <span role="alert" data-testid="error-name">
              {FIELD_LABELS.name} wajib diisi
            </span>
          )}
        </div>
        <div>
          <label htmlFor="step-category">Kategori</label>
          <input
            id="step-category"
            data-testid="step-category-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          {fieldErrors.includes('category') && (
            <span role="alert" data-testid="error-category">
              {FIELD_LABELS.category} wajib diisi
            </span>
          )}
        </div>
        <button type="submit" data-testid="step-submit" disabled={busy}>
          Simpan step
        </button>
        {error && fieldErrors.length === 0 && (
          <p role="alert" data-testid="library-error">
            {error}
          </p>
        )}
      </form>
      <ul data-testid="step-list">
        {steps.map((s) => (
          <li key={s.id} data-testid="step-item">
            {s.name} <small>({s.category})</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
