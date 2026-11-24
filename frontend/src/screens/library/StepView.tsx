import type { AttachmentData, StepColumnData } from '../../api';

interface Props {
  name: string;
  category: string;
  columns: StepColumnData[];
  attachments: AttachmentData[];
  testId: string;
}

/** Read-only view of a step's content. All text is rendered as React text nodes, never as HTML (NFR2.8). */
export function StepView({ name, category, columns, attachments, testId }: Props) {
  const filled = columns
    .map((c) => ({ ...c, lines: c.lines.filter((l) => l.trim() !== '') }))
    .filter((c) => c.lines.length > 0);
  return (
    <div data-testid={testId} className="rounded border border-gray-300 p-3">
      <p className="font-semibold">{name}</p>
      <p className="text-sm text-gray-600">Kategori: {category}</p>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        {filled.map((c, ci) => (
          <div key={ci}>
            {c.label && <p className="text-sm font-medium">{c.label}</p>}
            <ol className="list-decimal pl-5 text-sm">
              {c.lines.map((l, li) => (
                <li key={li}>{l}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      {attachments.length > 0 && (
        <ul className="mt-2 text-sm">
          {attachments
            .filter((a) => a.filename.trim() !== '')
            .map((a, i) => (
              <li key={i}>
                Lampiran: <span className="font-mono">{a.filename}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
