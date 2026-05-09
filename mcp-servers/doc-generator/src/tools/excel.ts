import ExcelJS from 'exceljs';
import { join } from 'path';

export interface ExcelInput {
  title: string;
  sheets: Array<{
    name: string;
    headers: string[];
    rows: (string | number)[][];
  }>;
  outputDir?: string;
}

export async function generateExcel(input: ExcelInput): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ivy — WorkVine.ai';

  for (const sheet of input.sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    ws.addRow(sheet.headers);
    // Style header row
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };

    for (const row of sheet.rows) {
      ws.addRow(row);
    }

    // Auto-fit columns
    ws.columns.forEach(col => { col.width = 20; });
  }

  const outputDir = input.outputDir || process.cwd();
  const filename = `${input.title.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
  const filepath = join(outputDir, filename);
  await workbook.xlsx.writeFile(filepath);

  return filepath;
}
