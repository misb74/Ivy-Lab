import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { join } from 'path';

export interface PdfInput {
  title: string;
  content: string;
  outputDir?: string;
}

export async function generatePdf(input: PdfInput): Promise<string> {
  const outputDir = input.outputDir || process.cwd();
  const filename = `${input.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const filepath = join(outputDir, filename);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = createWriteStream(filepath);
    doc.pipe(stream);

    doc.fontSize(24).text(input.title, { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(12).text(input.content);

    doc.end();
    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
  });
}
