import { FormEvent, useState } from 'react';
import { addChecklistItem, ApiError, createDdcl, Ddcl, ReleaseHeaderInput, Step } from '../api';
import { tabLabel } from '../tabLabel';

interface Props {
  steps: Step[];
  ddcl: Ddcl | null;
  itemAdded: boolean;
  onDdclCreated: (ddcl: Ddcl) => void;
  onItemAdded: () => void;
}

const HEADER_FIELDS: Array<{ key: keyof ReleaseHeaderInput; label: string; type?: string }> = [
  { key: 'date', label: 'Tanggal', type: 'date' },
  { key: 'startDate', label: 'Tanggal mulai', type: 'date' },
  { key: 'impactedSystem', label: 'Impacted system' },
  { key: 'environment', label: 'Environment' },
  { key: 'phaseRelease', label: 'Phase / Release #' },
  { key: 'releaseObjective', label: 'Release objectives' },
  { key: 'technicalChange', label: 'Technical changes' },
];

export function ComposeScreen({ steps, ddcl, itemAdded, onDdclCreated, onItemAdded }: Props) {
  const [title, setTitle] = useState('');
  const [header, setHeader] = useState<ReleaseHeaderInput>({});
  const [stepId, setStepId] = useState('');
  const [paramName, setParamName] = useState('');
  const [paramValue, setParamValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const label = ddcl ? ddcl.tabLabel : tabLabel(header.date, title || 'DDCL baru');

  function setField(key: keyof ReleaseHeaderInput, value: string) {
    setHeader((h) => ({ ...h, [key]: value }));
  }

  async function submitDdcl(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const cleaned = Object.fromEntries(
        Object.entries(header).filter(([, v]) => typeof v === 'string' && v !== ''),
      ) as ReleaseHeaderInput;
      onDdclCreated(await createDdcl({ title, releaseHeader: cleaned }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  }

  async function submitItem(e: FormEvent) {
    e.preventDefault();
    if (!ddcl) return;
    setError(null);
    setBusy(true);
    try {
      const parameterValues = paramName.trim() ? { [paramName.trim()]: paramValue } : {};
      await addChecklistItem(ddcl.id, { stepId, parameterValues });
      onItemAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-testid="screen-compose">
      <h2>
        Susun DDCL — <span data-testid="tab-label">{label}</span>
      </h2>

      {!ddcl && (
        <form onSubmit={submitDdcl} noValidate>
          <div>
            <label htmlFor="ddcl-title">Judul DDCL</label>
            <input
              id="ddcl-title"
              data-testid="ddcl-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          {HEADER_FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`header-${f.key}`}>{f.label}</label>
              <input
                id={`header-${f.key}`}
                data-testid={`header-${f.key}-input`}
                type={f.type ?? 'text'}
                value={header[f.key] ?? ''}
                onChange={(e) => setField(f.key, e.target.value)}
              />
            </div>
          ))}
          <button type="submit" data-testid="ddcl-submit" disabled={busy}>
            Buat DDCL
          </button>
        </form>
      )}

      {ddcl && (
        <p data-testid="ddcl-created">
          DDCL dibuat — status: {ddcl.status}, oleh: {ddcl.createdBy}
        </p>
      )}

      {ddcl && !itemAdded && (
        <form onSubmit={submitItem} noValidate>
          <div>
            <label htmlFor="checklist-step">Step</label>
            <select
              id="checklist-step"
              data-testid="checklist-step-select"
              value={stepId}
              onChange={(e) => setStepId(e.target.value)}
            >
              <option value="">— pilih step —</option>
              {steps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="param-name">Nama object/parameter</label>
            <input
              id="param-name"
              data-testid="param-name-input"
              value={paramName}
              onChange={(e) => setParamName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="param-value">Nilai</label>
            <input
              id="param-value"
              data-testid="param-value-input"
              value={paramValue}
              onChange={(e) => setParamValue(e.target.value)}
            />
          </div>
          <button type="submit" data-testid="checklist-add" disabled={busy || stepId === ''}>
            Tambah ke checklist
          </button>
        </form>
      )}

      {itemAdded && <p data-testid="checklist-added">Satu baris checklist sudah ditambahkan.</p>}

      {error && (
        <p role="alert" data-testid="compose-error">
          {error}
        </p>
      )}
    </section>
  );
}
