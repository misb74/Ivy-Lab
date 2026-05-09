import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface PageExtraction {
  page_num: number;
  text: string;
  headings_detected: string[];
  tables: Array<{ headers: string[]; rows: string[][] }>;
}

export interface PdfExtraction {
  page_count: number;
  total_text_length: number;
  pages: PageExtraction[];
  extraction_quality: 'good' | 'partial' | 'poor';
}

export async function extractPdf(filePath: string): Promise<PdfExtraction> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${filePath}`);
  }

  // 1. Extract text using pdf-parse
  const pdfParseModule = await import('pdf-parse');
  const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
  const buffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(buffer);

  // Split text into pages (pdf-parse joins with form feeds)
  const pageTexts = pdfData.text.split(/\f/).filter(Boolean);
  const pageCount = pdfData.numpages;

  // 2. Extract tables using pdfplumber subprocess
  let tablePagesData: Array<{ page_num: number; tables: Array<{ headers: string[]; rows: string[][] }> }> = [];
  try {
    const scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'scripts', 'extract_tables.py');
    const { stdout } = await execFileAsync('python3', [scriptPath, filePath], {
      timeout: 60_000,
      maxBuffer: 50 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout);
    if (!parsed.error) {
      tablePagesData = parsed;
    }
  } catch {
    // pdfplumber extraction failed — continue with text only
  }

  // 3. Assemble pages
  const pages: PageExtraction[] = [];
  for (let i = 0; i < pageCount; i++) {
    const text = pageTexts[i] || '';
    const headings = detectHeadings(text);
    const tableData = tablePagesData.find(t => t.page_num === i + 1);

    pages.push({
      page_num: i + 1,
      text,
      headings_detected: headings,
      tables: tableData?.tables ?? [],
    });
  }

  const totalTextLength = pages.reduce((sum, p) => sum + p.text.length, 0);
  const extraction_quality = totalTextLength > 500 * pageCount ? 'good' :
    totalTextLength > 100 * pageCount ? 'partial' : 'poor';

  return {
    page_count: pageCount,
    total_text_length: totalTextLength,
    pages,
    extraction_quality,
  };
}

function detectHeadings(text: string): string[] {
  const lines = text.split('\n');
  const headings: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Heuristic: short lines that are likely headings
    // - All caps, or Title Case, or numbered sections
    if (trimmed.length < 80 && trimmed.length > 2) {
      const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
      const isNumbered = /^\d+[\.\)]\s/.test(trimmed);
      const isTitleCase = trimmed.split(' ').filter(w => w.length > 3).every(w => w[0] === w[0].toUpperCase());
      if (isAllCaps || isNumbered || (isTitleCase && trimmed.split(' ').length <= 8)) {
        headings.push(trimmed);
      }
    }
  }
  return headings;
}
