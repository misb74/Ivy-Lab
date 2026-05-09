import ExcelJS from 'exceljs';
import { mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUTS_DIR = join(__dirname, '..', '..', '.outputs');

export interface XlsxSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface XlsxData {
  title: string;
  sheets: XlsxSheet[];
}

export async function renderXlsx(data: XlsxData, filename: string): Promise<{ filePath: string; fileSize: number }> {
  mkdirSync(OUTPUTS_DIR, { recursive: true });

  const filePath = join(OUTPUTS_DIR, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ivy Agent Export';
  workbook.created = new Date();

  for (const sheetData of data.sheets) {
    const sheet = workbook.addWorksheet(sheetData.name);

    // Header row
    const headerRow = sheet.addRow(sheetData.headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2C3E50' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 24;

    // Data rows
    for (let r = 0; r < sheetData.rows.length; r++) {
      const row = sheet.addRow(sheetData.rows[r]);
      row.font = { size: 10, color: { argb: 'FF333333' } };
      row.alignment = { vertical: 'middle' };

      // Alternate row shading
      if (r % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5F5' },
        };
      }
    }

    // Auto-width columns
    for (let i = 0; i < sheetData.headers.length; i++) {
      const column = sheet.getColumn(i + 1);
      let maxLength = sheetData.headers[i].length;

      for (const row of sheetData.rows) {
        const cellValue = row[i];
        const cellLength = cellValue != null ? String(cellValue).length : 0;
        if (cellLength > maxLength) {
          maxLength = cellLength;
        }
      }

      column.width = Math.min(Math.max(maxLength + 4, 10), 50);
    }

    // Add border to all cells
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        };
      });
    });

    // Freeze header row
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  await workbook.xlsx.writeFile(filePath);

  const stats = statSync(filePath);
  return { filePath, fileSize: stats.size };
}
