import { randomUUID } from 'crypto';
import { getDatabase } from '../db/database.js';
import { renderPdf, type PdfData } from '../engine/pdf-renderer.js';
import { renderPptx, type PptxData } from '../engine/pptx-renderer.js';
import { renderXlsx, type XlsxData } from '../engine/xlsx-renderer.js';

export interface ExportArtifactParams {
  title: string;
  format: 'pdf' | 'pptx' | 'xlsx';
  type: string;
  data: Record<string, unknown>;
}

export async function exportArtifact(params: ExportArtifactParams) {
  const { title, format, type, data } = params;
  const db = getDatabase();
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
  const filename = `${sanitizedTitle}_${id.slice(0, 8)}`;

  // Insert pending export record
  db.prepare(`
    INSERT INTO exports (id, type, title, source_data, format, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, type, title, JSON.stringify(data), format, createdAt);

  try {
    let filePath: string;
    let fileSize: number;

    switch (format) {
      case 'pdf': {
        const pdfData: PdfData = {
          title,
          sections: Array.isArray(data.sections)
            ? (data.sections as PdfData['sections'])
            : [{ text: JSON.stringify(data, null, 2) }],
        };
        const pdfResult = await renderPdf(pdfData, filename);
        filePath = pdfResult.filePath;
        fileSize = pdfResult.fileSize;
        break;
      }

      case 'pptx': {
        const pptxData: PptxData = {
          title,
          subtitle: (data.subtitle as string) || undefined,
          slides: Array.isArray(data.slides)
            ? (data.slides as PptxData['slides'])
            : [{ title: 'Data', bullets: [JSON.stringify(data, null, 2)] }],
        };
        const pptxResult = await renderPptx(pptxData, filename);
        filePath = pptxResult.filePath;
        fileSize = pptxResult.fileSize;
        break;
      }

      case 'xlsx': {
        const xlsxData: XlsxData = {
          title,
          sheets: Array.isArray(data.sheets)
            ? (data.sheets as XlsxData['sheets'])
            : [{
                name: 'Sheet1',
                headers: Object.keys(data),
                rows: [Object.values(data).map(String)],
              }],
        };
        const xlsxResult = await renderXlsx(xlsxData, filename);
        filePath = xlsxResult.filePath;
        fileSize = xlsxResult.fileSize;
        break;
      }

      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    const completedAt = new Date().toISOString();

    db.prepare(`
      UPDATE exports
      SET status = 'completed', output_path = ?, file_size = ?, completed_at = ?
      WHERE id = ?
    `).run(filePath, fileSize, completedAt, id);

    return {
      id,
      title,
      format,
      type,
      status: 'completed',
      outputPath: filePath,
      fileSize,
      createdAt,
      completedAt,
    };
  } catch (error) {
    db.prepare(`
      UPDATE exports SET status = 'failed' WHERE id = ?
    `).run(id);

    throw error;
  }
}
