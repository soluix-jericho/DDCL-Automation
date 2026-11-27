import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TemplateUnavailable } from '../../src/errors';
import { exportDdclToXlsx, formatDateId, SHEETS } from '../../src/excel';
import type { DdclRecord } from '../../src/repository';
import { buildFixtureTemplate, cleanTmp, readBack, TMP_DIR } from '../helpers/template';

let templatePath: string;

beforeAll(async () => {
  templatePath = await buildFixtureTemplate();
});
afterAll(async () => {
  await cleanTmp();
});

function ddcl(over: Partial<DdclRecord> = {}, params: Record<string, string> | null = null): DdclRecord {
  return {
    id: 'd1',
    title: 'DDCL',
    status: 'Draft',
    createdBy: 'Pembuat Uji',
    createdByUserId: null,
    createdAt: '2026-11-23T00:00:00.000Z',
    releaseHeader: {
      date: '2026-10-26',
      startDate: '2026-10-26',
      impactedSystem: 'CES',
      environment: 'PROD',
      phaseRelease: '#1',
      releaseObjective: '1. Fixing sesuatu',
      technicalChange: 'Ubah image',
    },
    checklistItems: [
      {
        id: 'c1',
        ddclId: 'd1',
        stepId: 's1',
        order: 1,
        parameterValues: params,
        step: { id: 's1', name: 'Update Image', category: 'Image', kind: 'forward', pairedRollbackStepId: null },
      },
    ],
    ...over,
  };
}

describe('ExcelExportService', () => {
  it('formats dates the way the template does', () => {
    expect(formatDateId('2026-10-26')).toBe('26 Oktober 2026');
    expect(formatDateId('2026-01-05')).toBe('5 Januari 2026');
  });

  it('fills the Release Document header cells per the mapping', async () => {
    const wb = await readBack(await exportDdclToXlsx(templatePath, ddcl()));
    const ws = wb.getWorksheet(SHEETS.release)!;
    expect(ws.getCell('H8').value).toBe('CES');
    expect(ws.getCell('C9').value).toBe(': 26 Oktober 2026');
    expect(ws.getCell('C10').value).toBe(': 26 Oktober 2026');
    expect(ws.getCell('C11').value).toBe(': PROD');
    expect(ws.getCell('C12').value).toBe(': #1');
    expect(ws.getCell('A15').value).toBe('1. Fixing sesuatu');
    expect(ws.getCell('A21').value).toBe('Ubah image');
  });

  it('writes the single checklist row and clears the template sample rows', async () => {
    const wb = await readBack(await exportDdclToXlsx(templatePath, ddcl()));
    const ws = wb.getWorksheet(SHEETS.checklist)!;
    expect(ws.getCell('A1').value).toBe('Deployment Document Check List <26 Oktober 2026 >');
    expect(ws.getCell('A13').value).toBe('1');
    expect(ws.getCell('B13').value).toBe('Update Image');
    expect(ws.getCell('B14').value).toBeNull();
    expect(ws.getCell('A26').value).toBeNull();
  });

  it('writes parameter names and values on the object/parameter sheet and clears samples', async () => {
    const wb = await readBack(
      await exportDdclToXlsx(templatePath, ddcl({}, { 'ces-customer': 'image:1.0', port: '8080' })),
    );
    const ws = wb.getWorksheet(SHEETS.parameters)!;
    expect(ws.getCell('C7').value).toBe('ces-customer');
    expect(ws.getCell('I7').value).toBe('image:1.0');
    expect(ws.getCell('B8').value).toBe('2');
    expect(ws.getCell('C8').value).toBe('port');
    expect(ws.getCell('I8').value).toBe('8080');
    expect(ws.getCell('C12').value).toBeNull();
  });

  it('writes values starting with "=" verbatim as text, not as a formula (BR1.6)', async () => {
    const wb = await readBack(await exportDdclToXlsx(templatePath, ddcl({}, { p: '=1+1' })));
    const cell = wb.getWorksheet(SHEETS.parameters)!.getCell('I7');
    expect(cell.value).toBe('=1+1');
    expect(cell.type).toBe(3 /* ExcelJS.ValueType.String */);
  });

  it('exports a DDCL without header or checklist without throwing', async () => {
    const buf = await exportDdclToXlsx(templatePath, ddcl({ releaseHeader: null, checklistItems: [] }));
    const wb = await readBack(buf);
    expect(wb.getWorksheet(SHEETS.checklist)!.getCell('B13').value).toBeNull();
  });

  it('throws TemplateUnavailable with the expected path when the template is missing', async () => {
    const missing = path.join(TMP_DIR, 'nope', 'missing.xlsx');
    const err = await exportDdclToXlsx(missing, ddcl()).catch((e) => e);
    expect(err).toBeInstanceOf(TemplateUnavailable);
    expect((err as TemplateUnavailable).expectedPath).toBe(missing);
    expect(existsSync(missing)).toBe(false); // nothing written to disk (BR1.4)
  });

  it('throws TemplateUnavailable when the file is not a valid workbook', async () => {
    const { writeFile } = await import('node:fs/promises');
    const bad = path.join(TMP_DIR, 'bad.xlsx');
    await writeFile(bad, 'not a zip');
    await expect(exportDdclToXlsx(bad, ddcl())).rejects.toBeInstanceOf(TemplateUnavailable);
  });

  it('throws TemplateUnavailable when an expected sheet is missing', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Other');
    const odd = path.join(TMP_DIR, 'odd.xlsx');
    await wb.xlsx.writeFile(odd);
    await expect(exportDdclToXlsx(odd, ddcl())).rejects.toBeInstanceOf(TemplateUnavailable);
  });
});
