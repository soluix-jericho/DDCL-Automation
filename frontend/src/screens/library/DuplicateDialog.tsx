import type { StepContent, StepDraftBase } from '../../api';
import { StepView } from './StepView';

interface Props {
  existing: StepContent;
  /** What the user just typed: the main step, or the inline rollback step when that one clashed. */
  typed: StepDraftBase;
  conflictOn: 'step' | 'rollbackStep';
  onUseExisting: () => void;
  onRename: () => void;
}

/** BR2.3 / AC1.1.2: a step with this name already exists in the category; compare, then choose. */
export function DuplicateDialog({ existing, typed, conflictOn, onUseExisting, onRename }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dup-title"
      data-testid="duplicate-dialog"
      className="my-3 rounded border-2 border-amber-500 bg-amber-50 p-4"
    >
      <h3 id="dup-title" className="font-semibold">
        Step dengan nama ini sudah ada di kategori {existing.category}
        {conflictOn === 'rollbackStep' ? ' (step rollback)' : ''}
      </h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-medium">Step yang sudah ada</p>
          <StepView
            testId="dup-existing"
            name={existing.name}
            category={existing.category}
            columns={existing.columns}
            attachments={existing.attachments}
          />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Yang baru Anda ketik</p>
          <StepView
            testId="dup-typed"
            name={typed.name}
            category={typed.category}
            columns={typed.columns}
            attachments={typed.attachments}
          />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          data-testid="dup-use-existing"
          className="rounded bg-blue-700 px-3 py-1 text-white"
          onClick={onUseExisting}
        >
          Pakai step yang sudah ada
        </button>
        <button
          type="button"
          data-testid="dup-rename"
          className="rounded border border-gray-400 px-3 py-1"
          onClick={onRename}
        >
          Ubah nama
        </button>
      </div>
    </div>
  );
}
