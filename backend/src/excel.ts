import ExcelJS from 'exceljs';
import { TemplateUnavailable } from './errors';
import type { DdclRecord } from './repository';

/**
 * Minimal cell mapping of the DDCL template (ADR-005), derived from inspecting
 * "DDCL BCAS PROD 202611 - TEMPLATE.xlsx". Documented in code-summary.md.
 * Skeleton scope: header + ONE checklist row + parameter list. Fuller mapping is U3/U6.
 */
export const SHEETS = {
  release: 'Release Document',
  checklist: 'Deployment Check List',
  parameters: 'List Object & Parameter',
} as const;

export const CELLS = {
  release: {
    impactedSystem: 'H8',
    date: 'C9',
    startDate: 'C10',
    environment: 'C11',
    phaseRelease: 'C12',
    releaseObjective: 'A15', // merged A15:J18
    technicalChange: 'A21', // merged A21:J28
  },
  checklist: {
    title: 'A1',
    firstRow: 13, // first activity row: A = No, B = Activities, C = Plan date
    clearFromRow: 14, // sample rows 14-26 of the template's first section are cleared
    clearToRow: 26,
  },
  parameters: {
    title: 'C1',
    firstRow: 7, // B = No, C = parameter name (merged C:H), I = value
    lastRow: 23,
  },
} as const;

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/** "2026-10-26" -> "26 Oktober 2026" (the format the template uses). */
export function formatDateId(iso: string): string {
  const [y, m, d] = iso.split('-');
  const month = MONTHS_ID[Number(m) - 1];
  if (!y || !d || !month) return iso;
  return `${Number(d)} ${month} ${y}`;
}

function isoToUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

async function loadTemplate(templatePath: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(templatePath);
  } catch (err) {
    throw new TemplateUnavailable(templatePath, err);
  }
  for (const name of Object.values(SHEETS)) {
    if (!wb.getWorksheet(name)) {
      throw new TemplateUnavailable(templatePath, new Error(`Sheet "${name}" tidak ada`));
    }
  }
  return wb;
}

function sheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`Sheet ${name} missing`); // guarded by loadTemplate
  return ws;
}

/**
 * Fills the template with one DDCL and returns the .xlsx bytes. Nothing is written to disk
 * and nothing is returned if the template cannot be loaded (BR1.4, NFR3.3).
 * Parameter values are written verbatim (BR1.6): no escaping of leading "=" etc.
 */
export async function exportDdclToXlsx(templatePath: string, ddcl: DdclRecord): Promise<Buffer> {
  const wb = await loadTemplate(templatePath);
  const header = ddcl.releaseHeader;

  const release = sheet(wb, SHEETS.release);
  if (header) {
    const c = CELLS.release;
    if (header.impactedSystem != null) release.getCell(c.impactedSystem).value = header.impactedSystem;
    if (header.date) release.getCell(c.date).value = `: ${formatDateId(header.date)}`;
    if (header.startDate) release.getCell(c.startDate).value = `: ${formatDateId(header.startDate)}`;
    if (header.environment != null) release.getCell(c.environment).value = `: ${header.environment}`;
    if (header.phaseRelease != null) release.getCell(c.phaseRelease).value = `: ${header.phaseRelease}`;
    if (header.releaseObjective != null)
      release.getCell(c.releaseObjective).value = header.releaseObjective;
    if (header.technicalChange != null)
      release.getCell(c.technicalChange).value = header.technicalChange;
  }

  const checklist = sheet(wb, SHEETS.checklist);
  const cl = CELLS.checklist;
  if (header?.date) {
    checklist.getCell(cl.title).value = `Deployment Document Check List <${formatDateId(header.date)} >`;
  }
  for (let r = cl.clearFromRow; r <= cl.clearToRow; r++) {
    for (const col of ['A', 'B', 'C', 'D']) checklist.getCell(`${col}${r}`).value = null;
  }
  const item = ddcl.checklistItems[0];
  if (item) {
    const r = cl.firstRow;
    checklist.getCell(`A${r}`).value = String(item.order);
    checklist.getCell(`B${r}`).value = item.step?.name ?? '';
    checklist.getCell(`C${r}`).value = header?.date ? isoToUtcDate(header.date) : null;
    checklist.getCell(`D${r}`).value = null;
  } else {
    for (const col of ['A', 'B', 'C', 'D']) checklist.getCell(`${col}${cl.firstRow}`).value = null;
  }

  const params = sheet(wb, SHEETS.parameters);
  const pc = CELLS.parameters;
  if (header?.date) {
    params.getCell(pc.title).value = `Implementation Items < ${formatDateId(header.date)} >`;
  }
  for (let r = pc.firstRow; r <= pc.lastRow; r++) {
    params.getCell(`B${r}`).value = null;
    params.getCell(`C${r}`).value = null;
    params.getCell(`I${r}`).value = null;
  }
  const entries = Object.entries(item?.parameterValues ?? {});
  entries.slice(0, pc.lastRow - pc.firstRow + 1).forEach(([name, value], i) => {
    const r = pc.firstRow + i;
    params.getCell(`B${r}`).value = String(i + 1);
    params.getCell(`C${r}`).value = name;
    params.getCell(`I${r}`).value = value; // verbatim (BR1.6)
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
