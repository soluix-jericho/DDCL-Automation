import ExcelJS from 'exceljs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { CELLS, SHEETS } from '../../src/excel';

export const TMP_DIR = path.resolve(__dirname, '..', '.tmp');

/** Builds a small synthetic workbook with the same sheet names and merged areas the mapping uses. */
export async function buildFixtureTemplate(fileName = 'template.xlsx'): Promise<string> {
  await mkdir(TMP_DIR, { recursive: true });
  const wb = new ExcelJS.Workbook();

  const release = wb.addWorksheet(SHEETS.release);
  release.mergeCells('C11:D11');
  release.mergeCells('A15:J18');
  release.mergeCells('A21:J28');
  release.getCell('H8').value = 'SAMPLE-SYSTEM';
  release.getCell('C9').value = ': sample date';

  const checklist = wb.addWorksheet(SHEETS.checklist);
  checklist.getCell(CELLS.checklist.title).value = 'Deployment Document Check List <sample >';
  checklist.getCell('A13').value = 'sample-no';
  checklist.getCell('B13').value = 'sample activity';
  checklist.getCell('B14').value = 'sample leftover';
  checklist.getCell('A26').value = 'sample leftover 2';

  const params = wb.addWorksheet(SHEETS.parameters);
  for (let r = 7; r <= 23; r++) params.mergeCells(`C${r}:H${r}`);
  params.getCell('C7').value = 'sample-param';
  params.getCell('I7').value = 'sample-value';
  params.getCell('C12').value = 'sample-param-12';

  const file = path.join(TMP_DIR, fileName);
  await wb.xlsx.writeFile(file);
  return file;
}

export async function cleanTmp(): Promise<void> {
  await rm(TMP_DIR, { recursive: true, force: true });
}

export async function readBack(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}
