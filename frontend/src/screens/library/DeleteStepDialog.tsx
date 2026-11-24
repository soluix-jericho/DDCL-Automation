import { useEffect, useState } from 'react';
import { ApiError, DeleteImpact, deleteStep, getStepImpact, StepListItem } from '../../api';

interface Props {
  step: StepListItem;
  /** 'gone' = somebody else deleted it first (404); the list should refresh either way. */
  onDone: (result: 'deleted' | 'gone') => void;
  onCancel: () => void;
}

/** AC1.2.2 / BR2.7: show the consequences first; deleting is always allowed and never touches old DDCLs. */
export function DeleteStepDialog({ step, onDone, onCancel }: Props) {
  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    getStepImpact(step.id)
      .then((i) => live && setImpact(i))
      .catch((err: unknown) => {
        if (!live) return;
        if (err instanceof ApiError && err.status === 404) onDone('gone');
        else setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan.');
      });
    return () => {
      live = false;
    };
    // The dialog is mounted once per step; onDone is a fresh closure each render and must not re-trigger the load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await deleteStep(step.id);
      onDone('deleted');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) onDone('gone');
      else setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      data-testid="delete-dialog"
      className="my-3 rounded border-2 border-red-500 bg-red-50 p-4"
    >
      <h3 id="delete-title" className="font-semibold">
        Hapus step &quot;{step.name}&quot;?
      </h3>
      {!impact && !error && <p data-testid="delete-loading">Memeriksa dampak…</p>}
      {impact && (
        <ul className="mt-2 list-disc pl-5 text-sm">
          <li data-testid="delete-usage">Dipakai oleh {impact.usageCount} DDCL.</li>
          <li data-testid="delete-note">
            DDCL yang sudah memakai step ini tetap utuh: isinya tersimpan di DDCL itu sendiri.
          </li>
          {impact.bundlesRemoved.length > 0 && (
            <li data-testid="delete-bundles-removed">
              Bundle ini ikut terhapus karena step ini satu-satunya step forward-nya:{' '}
              {impact.bundlesRemoved.map((b) => b.name).join(', ')}
            </li>
          )}
          {impact.bundlesChanged.length > 0 && (
            <li data-testid="delete-bundles-changed">
              Step ini dikeluarkan dari bundle: {impact.bundlesChanged.map((b) => b.name).join(', ')}
            </li>
          )}
          {impact.pairLost.length > 0 && (
            <li data-testid="delete-pair-lost">
              Step forward ini kehilangan pasangan rollback:{' '}
              {impact.pairLost.map((s) => s.name).join(', ')}
            </li>
          )}
        </ul>
      )}
      {error && (
        <p role="alert" data-testid="delete-error" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          data-testid="delete-confirm"
          disabled={!impact || busy}
          className="rounded bg-red-700 px-3 py-1 text-white disabled:opacity-50"
          onClick={confirm}
        >
          Hapus step
        </button>
        <button
          type="button"
          data-testid="delete-cancel"
          className="rounded border border-gray-400 px-3 py-1"
          onClick={onCancel}
        >
          Batal
        </button>
      </div>
    </div>
  );
}
