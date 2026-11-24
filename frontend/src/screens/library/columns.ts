import type { StepColumnData } from '../../api';

/** A column while it is being edited; `key` keeps React rows stable when columns are added or removed. */
export interface EditableColumn {
  key: number;
  label: string;
  lines: string[];
}

let nextKey = 1;

export function newColumn(lines: string[] = ['']): EditableColumn {
  return { key: nextKey++, label: '', lines };
}

/** BR2.2: a new step form starts with 3 empty columns. */
export function initialColumns(): EditableColumn[] {
  return [newColumn(), newColumn(), newColumn()];
}

export function fromContent(columns: StepColumnData[]): EditableColumn[] {
  const cols = columns.map((c) => newColumn(c.lines.length > 0 ? [...c.lines] : ['']));
  columns.forEach((c, i) => {
    const col = cols[i];
    if (col) col.label = c.label ?? '';
  });
  return cols.length > 0 ? cols : initialColumns();
}

/** Empty lines and empty columns are sent as typed; the server drops them (BR2.2). */
export function toDraftColumns(columns: EditableColumn[]): StepColumnData[] {
  return columns.map((c) => ({ label: c.label.trim() === '' ? null : c.label, lines: c.lines }));
}

export function filledLineCount(column: EditableColumn): number {
  return column.lines.filter((l) => l.trim() !== '').length;
}
