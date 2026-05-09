import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUTS_DIR = join(__dirname, '..', '..', '.outputs');

export interface PdfSection {
  heading?: string;
  text?: string;
  table?: {
    headers: string[];
    rows: string[][];
  };
  chart?: string; // Text description of chart data
}

export interface PdfData {
  title: string;
  sections: PdfSection[];
}

export async function renderPdf(data: PdfData, filename: string): Promise<{ filePath: string; fileSize: number }> {
  mkdirSync(OUTPUTS_DIR, { recursive: true });

  const filePath = join(OUTPUTS_DIR, filename.endsWith('.pdf') ? filename : `${filename}.pdf`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = createWriteStream(filePath);

    stream.on('finish', () => {
      try {
        const stats = statSync(filePath);
        resolve({ filePath, fileSize: stats.size });
      } catch (err) {
        reject(err);
      }
    });

    stream.on('error', reject);
    doc.pipe(stream);

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text(data.title, { align: 'center' });
    doc.moveDown(1.5);

    // Sections
    for (const section of data.sections) {
      if (section.heading) {
        doc.fontSize(16).font('Helvetica-Bold').text(section.heading);
        doc.moveDown(0.5);
      }

      if (section.text) {
        doc.fontSize(11).font('Helvetica').text(section.text, { align: 'left', lineGap: 4 });
        doc.moveDown(0.8);
      }

      if (section.table) {
        renderTable(doc, section.table.headers, section.table.rows);
        doc.moveDown(1);
      }

      if (section.chart) {
        doc.fontSize(11).font('Helvetica-Oblique').text(`[Chart: ${section.chart}]`, {
          align: 'center',
          color: '#666666',
        });
        doc.moveDown(1);
      }
    }

    doc.end();
  });
}

function renderTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][]): void {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colCount = headers.length;
  const colWidth = pageWidth / colCount;
  const startX = doc.page.margins.left;
  let y = doc.y;

  const rowHeight = 22;
  const cellPadding = 5;

  // Header row background
  doc.fillColor('#2c3e50').rect(startX, y, pageWidth, rowHeight).fill();

  // Header text
  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], startX + i * colWidth + cellPadding, y + 6, {
      width: colWidth - cellPadding * 2,
      height: rowHeight,
      lineBreak: false,
    });
  }

  y += rowHeight;

  // Data rows
  doc.font('Helvetica').fontSize(10).fillColor('#333333');
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];

    // Alternate row background
    if (r % 2 === 0) {
      doc.fillColor('#f5f5f5').rect(startX, y, pageWidth, rowHeight).fill();
    }

    doc.fillColor('#333333');
    for (let c = 0; c < colCount; c++) {
      const cellText = row[c] ?? '';
      doc.text(cellText, startX + c * colWidth + cellPadding, y + 6, {
        width: colWidth - cellPadding * 2,
        height: rowHeight,
        lineBreak: false,
      });
    }

    y += rowHeight;

    // Check for page break
    if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
      doc.addPage();
      y = doc.page.margins.top;
    }
  }

  doc.y = y;
}
