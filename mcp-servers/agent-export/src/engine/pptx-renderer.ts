import PptxGenJS from 'pptxgenjs';
import { mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUTS_DIR = join(__dirname, '..', '..', '.outputs');

export interface PptxSlide {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  notes?: string;
}

export interface PptxData {
  title: string;
  subtitle?: string;
  slides: PptxSlide[];
}

export async function renderPptx(data: PptxData, filename: string): Promise<{ filePath: string; fileSize: number }> {
  mkdirSync(OUTPUTS_DIR, { recursive: true });

  const filePath = join(OUTPUTS_DIR, filename.endsWith('.pptx') ? filename : `${filename}.pptx`);

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Ivy Agent Export';
  pptx.title = data.title;

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.addText(data.title, {
    x: 0.5,
    y: 1.5,
    w: '90%',
    h: 1.5,
    fontSize: 36,
    fontFace: 'Arial',
    bold: true,
    color: '2c3e50',
    align: 'center',
  });

  if (data.subtitle) {
    titleSlide.addText(data.subtitle, {
      x: 0.5,
      y: 3.2,
      w: '90%',
      h: 1,
      fontSize: 18,
      fontFace: 'Arial',
      color: '7f8c8d',
      align: 'center',
    });
  }

  // Content slides
  for (const slideData of data.slides) {
    const slide = pptx.addSlide();

    let currentY = 0.5;

    if (slideData.title) {
      slide.addText(slideData.title, {
        x: 0.5,
        y: currentY,
        w: '90%',
        h: 0.8,
        fontSize: 24,
        fontFace: 'Arial',
        bold: true,
        color: '2c3e50',
      });
      currentY += 1.0;
    }

    if (slideData.subtitle) {
      slide.addText(slideData.subtitle, {
        x: 0.5,
        y: currentY,
        w: '90%',
        h: 0.5,
        fontSize: 14,
        fontFace: 'Arial',
        color: '7f8c8d',
      });
      currentY += 0.7;
    }

    if (slideData.bullets && slideData.bullets.length > 0) {
      const bulletText = slideData.bullets.map((b) => ({
        text: b,
        options: { bullet: true as const, fontSize: 16, fontFace: 'Arial', color: '333333' as const, breakLine: true as const },
      }));

      slide.addText(bulletText, {
        x: 0.8,
        y: currentY,
        w: '85%',
        h: 4.0,
        valign: 'top',
        lineSpacingMultiple: 1.5,
      });
    }

    if (slideData.table) {
      const tableRows: PptxGenJS.TableRow[] = [];

      // Header row
      const headerRow: PptxGenJS.TableCell[] = slideData.table.headers.map((h) => ({
        text: h,
        options: {
          bold: true,
          fontSize: 12,
          fontFace: 'Arial',
          fill: { color: '2c3e50' },
          color: 'ffffff',
          align: 'center' as const,
          valign: 'middle' as const,
        },
      }));
      tableRows.push(headerRow);

      // Data rows
      for (let r = 0; r < slideData.table.rows.length; r++) {
        const row = slideData.table.rows[r];
        const dataRow: PptxGenJS.TableCell[] = row.map((cell) => ({
          text: cell,
          options: {
            fontSize: 11,
            fontFace: 'Arial',
            fill: { color: r % 2 === 0 ? 'f5f5f5' : 'ffffff' },
            color: '333333',
            align: 'left' as const,
            valign: 'middle' as const,
          },
        }));
        tableRows.push(dataRow);
      }

      slide.addTable(tableRows, {
        x: 0.5,
        y: currentY,
        w: 12,
        border: { pt: 0.5, color: 'cccccc' },
        colW: Array(slideData.table.headers.length).fill(12 / slideData.table.headers.length),
        rowH: Array(tableRows.length).fill(0.4),
      });
    }

    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  }

  await pptx.writeFile({ fileName: filePath });

  const stats = statSync(filePath);
  return { filePath, fileSize: stats.size };
}
