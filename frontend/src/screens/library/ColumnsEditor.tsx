import { useState } from 'react';
import { EditableColumn, filledLineCount, newColumn } from './columns';

interface Props {
  /** Prefix of every data-testid, so the main step and the inline rollback step can be told apart. */
  idPrefix: string;
  columns: EditableColumn[];
  onChange: (columns: EditableColumn[]) => void;
  /** Field paths the server marked as bad, e.g. "columns[1].lines[0]". */
  errorPaths: string[];
  /** Path prefix used by the server for these columns ("" or "rollbackStep."). */
  pathPrefix?: string;
}

/** Numbered step lines in columns (BR2.2). Text is edited in plain inputs and never rendered as HTML (NFR2.8). */
export function ColumnsEditor({ idPrefix, columns, onChange, errorPaths, pathPrefix = '' }: Props) {
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function update(index: number, patch: Partial<EditableColumn>) {
    onChange(columns.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeColumn(index: number) {
    setMessage(null);
    if (columns.length === 1) {
      setMessage('Sebuah step minimal punya satu kolom.');
      return;
    }
    const col = columns[index];
    if (col && filledLineCount(col) > 0) {
      setPendingRemoval(index); // a column with content is never dropped without asking
      return;
    }
    onChange(columns.filter((_, i) => i !== index));
  }

  function confirmRemoval(index: number) {
    onChange(columns.filter((_, i) => i !== index));
    setPendingRemoval(null);
  }

  const bad = (path: string) => errorPaths.some((p) => p === `${pathPrefix}${path}`);

  return (
    <div data-testid={`${idPrefix}-columns`}>
      <div className="grid gap-3 md:grid-cols-3">
        {columns.map((col, ci) => (
          <div
            key={col.key}
            data-testid={`${idPrefix}-column`}
            className="rounded border border-gray-300 p-2"
          >
            <input
              aria-label={`Label kolom ${ci + 1}`}
              placeholder={`Kolom ${ci + 1} (label opsional)`}
              data-testid={`${idPrefix}-column-label-${ci}`}
              className="mb-2 w-full rounded border border-gray-300 px-2 py-1"
              value={col.label}
              onChange={(e) => update(ci, { label: e.target.value })}
            />
            <ol className="space-y-1">
              {col.lines.map((line, li) => (
                <li key={li} className="flex items-center gap-1">
                  <span className="w-6 text-right text-sm text-gray-500">{li + 1}.</span>
                  <input
                    aria-label={`Langkah ${li + 1} kolom ${ci + 1}`}
                    data-testid={`${idPrefix}-line-${ci}-${li}`}
                    aria-invalid={bad(`columns[${ci}].lines[${li}]`) || undefined}
                    className={`min-w-0 flex-1 rounded border px-2 py-1 ${
                      bad(`columns[${ci}].lines[${li}]`) ? 'border-red-600' : 'border-gray-300'
                    }`}
                    value={line}
                    onChange={(e) =>
                      update(ci, { lines: col.lines.map((l, i) => (i === li ? e.target.value : l)) })
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Hapus langkah ${li + 1} kolom ${ci + 1}`}
                    data-testid={`${idPrefix}-line-remove-${ci}-${li}`}
                    className="px-1 text-gray-600"
                    onClick={() =>
                      update(ci, {
                        lines: col.lines.length > 1 ? col.lines.filter((_, i) => i !== li) : [''],
                      })
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                data-testid={`${idPrefix}-line-add-${ci}`}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
                onClick={() => update(ci, { lines: [...col.lines, ''] })}
              >
                Tambah langkah
              </button>
              <button
                type="button"
                data-testid={`${idPrefix}-column-remove-${ci}`}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
                onClick={() => removeColumn(ci)}
              >
                Hapus kolom
              </button>
            </div>
            {pendingRemoval === ci && (
              <p role="alert" data-testid={`${idPrefix}-column-remove-confirm-${ci}`} className="mt-2 text-sm">
                Kolom {ci + 1} berisi {filledLineCount(col)} langkah yang ikut hilang.{' '}
                <button
                  type="button"
                  data-testid={`${idPrefix}-column-remove-yes-${ci}`}
                  className="underline"
                  onClick={() => confirmRemoval(ci)}
                >
                  Ya, hapus kolom
                </button>{' '}
                <button type="button" className="underline" onClick={() => setPendingRemoval(null)}>
                  Batal
                </button>
              </p>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        data-testid={`${idPrefix}-column-add`}
        className="mt-2 rounded border border-gray-300 px-2 py-1 text-sm"
        onClick={() => onChange([...columns, newColumn()])}
      >
        Tambah kolom
      </button>
      {message && (
        <p role="alert" data-testid={`${idPrefix}-columns-message`} className="mt-1 text-sm text-red-700">
          {message}
        </p>
      )}
    </div>
  );
}
