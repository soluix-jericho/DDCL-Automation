import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  AttachmentData,
  CATEGORIES,
  createStep,
  listSteps,
  StepContent,
  StepDraft,
  StepDraftBase,
  StepListItem,
  updateStep,
} from '../../api';
import { ColumnsEditor } from './ColumnsEditor';
import { EditableColumn, fromContent, initialColumns, newColumn, toDraftColumns } from './columns';
import { DuplicateDialog } from './DuplicateDialog';
import { extractVariables } from './stepText';

interface Props {
  /** Present when editing; the form then starts filled with the current content (Alur 3). */
  initial?: StepContent;
  onSaved: (step: StepContent) => void;
  /** "Pakai step yang sudah ada" for a clash on the step itself: leave the form and use that step. */
  onUseExisting: (step: StepContent) => void;
  onCancel: () => void;
}

type PairMode = 'none' | 'existing' | 'new';

interface Duplicate {
  existing: StepContent;
  on: 'step' | 'rollbackStep';
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Nama step',
  category: 'Kategori',
  kind: 'Jenis',
  columns: 'Langkah',
};

/** Create or edit a step (Alur 1 and 3). The draft stays in component state until a save succeeds. */
export function StepForm({ initial, onSaved, onUseExisting, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<string>(initial?.category ?? '');
  const [kind, setKind] = useState<'forward' | 'rollback'>(initial?.kind ?? 'forward');
  const [columns, setColumns] = useState<EditableColumn[]>(
    initial ? fromContent(initial.columns) : initialColumns(),
  );
  const [attachments, setAttachments] = useState<AttachmentData[]>(initial?.attachments ?? []);
  const [pairMode, setPairMode] = useState<PairMode>(initial?.pairedRollbackStepId ? 'existing' : 'none');
  const [pairedId, setPairedId] = useState(initial?.pairedRollbackStepId ?? '');
  const [rbName, setRbName] = useState('');
  const [rbColumns, setRbColumns] = useState<EditableColumn[]>([newColumn()]);
  const [rollbackOptions, setRollbackOptions] = useState<StepListItem[]>([]);

  const [errorPaths, setErrorPaths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    listSteps()
      .then((all) => live && setRollbackOptions(all.filter((s) => s.kind === 'rollback')))
      .catch(() => live && setRollbackOptions([]));
    return () => {
      live = false;
    };
  }, []);

  const variables = extractVariables(columns.flatMap((c) => c.lines));

  function mainDraft(): StepDraftBase {
    return { name, category, columns: toDraftColumns(columns), attachments: cleanAttachments() };
  }

  function rollbackDraft(): StepDraftBase {
    return { name: rbName, category, columns: toDraftColumns(rbColumns), attachments: [] };
  }

  function cleanAttachments(): AttachmentData[] {
    return attachments.filter((a) => a.filename.trim() !== '' || a.content !== '');
  }

  function buildDraft(): StepDraft {
    const draft: StepDraft = { ...mainDraft(), kind };
    if (kind === 'forward') {
      if (pairMode === 'existing' && pairedId) draft.pairedRollbackStepId = pairedId;
      else if (pairMode === 'new') draft.rollbackStep = { ...rollbackDraft(), kind: 'rollback' };
      else draft.pairedRollbackStepId = null; // explicit null also clears the pair when editing
    }
    return draft;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorPaths([]);
    setBusy(true);
    try {
      const draft = buildDraft();
      const saved = initial ? await updateStep(initial.id, draft) : await createStep(draft);
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409 && err.existing && (err.conflictOn === 'step' || err.conflictOn === 'rollbackStep')) {
          setDuplicate({ existing: err.existing as StepContent, on: err.conflictOn });
        } else {
          setErrorPaths(err.fields);
          setError(err.message);
        }
      } else {
        setError('Terjadi kesalahan.');
      }
    } finally {
      setBusy(false);
    }
  }

  function useExisting() {
    if (!duplicate) return;
    const { existing, on } = duplicate;
    setDuplicate(null);
    if (on === 'step') {
      onUseExisting(existing);
    } else {
      // The new rollback step already exists: pair with that one instead; the user saves again.
      setPairMode('existing');
      setPairedId(existing.id);
      setRollbackOptions((opts) =>
        opts.some((o) => o.id === existing.id)
          ? opts
          : [...opts, { ...existing, columnCount: existing.columns.length, attachmentCount: existing.attachments.length, usageCount: 0, missingRollback: false }],
      );
    }
  }

  function rename() {
    setDuplicate(null);
    // The draft is untouched; put the cursor back on the name so it can be changed.
    queueMicrotask(() => nameRef.current?.focus());
  }

  const bad = (path: string) => errorPaths.includes(path);

  return (
    <form onSubmit={submit} noValidate data-testid="step-form" className="space-y-4">
      <h2 className="text-lg font-semibold">{initial ? 'Ubah Step' : 'Buat Step Baru'}</h2>

      <div>
        <label htmlFor="step-name" className="block text-sm font-medium">
          Nama step
        </label>
        <input
          id="step-name"
          ref={nameRef}
          data-testid="step-name-input"
          className={`w-full rounded border px-2 py-1 ${bad('name') ? 'border-red-600' : 'border-gray-300'}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {bad('name') && (
          <span role="alert" data-testid="error-name" className="text-sm text-red-700">
            {FIELD_LABELS.name} wajib diisi
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor="step-category" className="block text-sm font-medium">
            Kategori
          </label>
          <select
            id="step-category"
            data-testid="step-category-input"
            className={`rounded border px-2 py-1 ${bad('category') ? 'border-red-600' : 'border-gray-300'}`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">— pilih kategori —</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {bad('category') && (
            <span role="alert" data-testid="error-category" className="block text-sm text-red-700">
              {FIELD_LABELS.category} wajib dipilih
            </span>
          )}
        </div>
        <div>
          <label htmlFor="step-kind" className="block text-sm font-medium">
            Jenis
          </label>
          <select
            id="step-kind"
            data-testid="step-kind-input"
            className="rounded border border-gray-300 px-2 py-1"
            value={kind}
            disabled={Boolean(initial)}
            onChange={(e) => setKind(e.target.value as 'forward' | 'rollback')}
          >
            <option value="forward">Forward</option>
            <option value="rollback">Rollback</option>
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Langkah</legend>
        <ColumnsEditor idPrefix="main" columns={columns} onChange={setColumns} errorPaths={errorPaths} />
        {bad('columns') && (
          <span role="alert" data-testid="error-columns" className="text-sm text-red-700">
            Isi setidaknya satu langkah
          </span>
        )}
        <p data-testid="variables-detected" className="mt-2 text-sm text-gray-700">
          {variables.length > 0 ? (
            <>
              Variabel terdeteksi:{' '}
              {variables.map((v) => (
                <code key={v} data-testid="variable-chip" className="mr-1 rounded bg-gray-100 px-1">
                  {`{${v}}`}
                </code>
              ))}
            </>
          ) : (
            'Tidak ada variabel. Tulis {nama} di teks langkah untuk membuat isian per DDCL.'
          )}
        </p>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Lampiran (teks)</legend>
        {attachments.map((a, i) => (
          <div key={i} className="mb-2 rounded border border-gray-300 p-2">
            <input
              aria-label={`Nama file lampiran ${i + 1}`}
              placeholder="nama-file.yaml"
              data-testid={`attachment-name-${i}`}
              aria-invalid={bad(`attachments[${i}].filename`) || undefined}
              className={`mb-1 w-full rounded border px-2 py-1 ${bad(`attachments[${i}].filename`) ? 'border-red-600' : 'border-gray-300'}`}
              value={a.filename}
              onChange={(e) =>
                setAttachments(attachments.map((x, j) => (j === i ? { ...x, filename: e.target.value } : x)))
              }
            />
            <textarea
              aria-label={`Isi lampiran ${i + 1}`}
              data-testid={`attachment-content-${i}`}
              rows={4}
              className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-sm"
              value={a.content}
              onChange={(e) =>
                setAttachments(attachments.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))
              }
            />
            <button
              type="button"
              data-testid={`attachment-remove-${i}`}
              className="text-sm underline"
              onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
            >
              Hapus lampiran
            </button>
          </div>
        ))}
        <button
          type="button"
          data-testid="attachment-add"
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          onClick={() => setAttachments([...attachments, { filename: '', content: '' }])}
        >
          Tambah lampiran
        </button>
      </fieldset>

      {kind === 'forward' && (
        <fieldset data-testid="pair-section">
          <legend className="text-sm font-medium">Pasangan rollback</legend>
          <label className="mr-4">
            <input
              type="radio"
              name="pair-mode"
              data-testid="pair-none"
              checked={pairMode === 'none'}
              onChange={() => setPairMode('none')}
            />{' '}
            Lewati (ditandai &quot;Belum ada rollback&quot;)
          </label>
          <label className="mr-4">
            <input
              type="radio"
              name="pair-mode"
              data-testid="pair-existing"
              checked={pairMode === 'existing'}
              onChange={() => setPairMode('existing')}
            />{' '}
            Pilih step rollback yang ada
          </label>
          <label>
            <input
              type="radio"
              name="pair-mode"
              data-testid="pair-new"
              checked={pairMode === 'new'}
              onChange={() => setPairMode('new')}
            />{' '}
            Buat step rollback baru di sini
          </label>
          {pairMode === 'existing' && (
            <select
              aria-label="Step rollback"
              data-testid="pair-select"
              className="mt-2 block rounded border border-gray-300 px-2 py-1"
              value={pairedId}
              onChange={(e) => setPairedId(e.target.value)}
            >
              <option value="">— pilih step rollback —</option>
              {rollbackOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.category})
                </option>
              ))}
            </select>
          )}
          {pairMode === 'new' && (
            <div className="mt-2 rounded border border-gray-300 p-2" data-testid="rb-section">
              <label htmlFor="rb-name" className="block text-sm font-medium">
                Nama step rollback
              </label>
              <input
                id="rb-name"
                data-testid="rb-name-input"
                className={`mb-2 w-full rounded border px-2 py-1 ${bad('rollbackStep.name') ? 'border-red-600' : 'border-gray-300'}`}
                value={rbName}
                onChange={(e) => setRbName(e.target.value)}
              />
              <ColumnsEditor
                idPrefix="rb"
                columns={rbColumns}
                onChange={setRbColumns}
                errorPaths={errorPaths}
                pathPrefix="rollbackStep."
              />
            </div>
          )}
        </fieldset>
      )}

      {duplicate && (
        <DuplicateDialog
          existing={duplicate.existing}
          typed={duplicate.on === 'step' ? mainDraft() : rollbackDraft()}
          conflictOn={duplicate.on}
          onUseExisting={useExisting}
          onRename={rename}
        />
      )}

      {error && (
        <p role="alert" data-testid="form-error" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {initial && (
        <p data-testid="edit-note" className="text-sm text-gray-700">
          DDCL yang sudah memakai step ini tidak berubah. Hanya DDCL yang dibuat setelah ini memakai isi baru.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          data-testid="step-submit"
          disabled={busy}
          className="rounded bg-blue-700 px-3 py-1 text-white disabled:opacity-50"
        >
          Simpan step
        </button>
        <button
          type="button"
          data-testid="step-cancel"
          className="rounded border border-gray-400 px-3 py-1"
          onClick={onCancel}
        >
          Batal
        </button>
      </div>
    </form>
  );
}
