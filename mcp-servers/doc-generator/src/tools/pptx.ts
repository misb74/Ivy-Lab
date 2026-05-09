import PptxGenJS from 'pptxgenjs';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export interface SlideData {
  title: string;
  content?: string;
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
  chart?: { type: string; data: any };
  notes?: string;
}

export interface PresentationInput {
  title: string;
  subtitle?: string;
  author?: string;
  slides: SlideData[];
  outputDir?: string;
}

export async function generatePptx(input: PresentationInput): Promise<string> {
  const pptx = new PptxGenJS();
  pptx.title = input.title;
  pptx.author = input.author || 'Ivy — WorkVine.ai';

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.addText(input.title, { x: 0.5, y: 1.5, w: 9, h: 1.5, fontSize: 32, bold: true, color: '1a1a2e' });
  if (input.subtitle) {
    titleSlide.addText(input.subtitle, { x: 0.5, y: 3.2, w: 9, h: 1, fontSize: 18, color: '4a4a6a' });
  }

  // Content slides
  for (const slideData of input.slides) {
    const slide = pptx.addSlide();
    slide.addText(slideData.title, { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 24, bold: true, color: '1a1a2e' });

    if (slideData.bullets) {
      const bulletText = slideData.bullets.map(b => ({ text: b, options: { bullet: true, fontSize: 16 } }));
      slide.addText(bulletText, { x: 0.5, y: 1.5, w: 9, h: 4 });
    } else if (slideData.table) {
      const tableData = [slideData.table.headers, ...slideData.table.rows];
      slide.addTable(tableData, { x: 0.5, y: 1.5, w: 9, fontSize: 12, border: { pt: 1, color: 'cccccc' }, colW: Array(slideData.table.headers.length).fill(9 / slideData.table.headers.length) });
    } else if (slideData.content) {
      slide.addText(slideData.content, { x: 0.5, y: 1.5, w: 9, h: 4, fontSize: 16, color: '333333' });
    }

    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  }

  const outputDir = input.outputDir || process.cwd();
  const filename = `${input.title.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`;
  const filepath = join(outputDir, filename);

  const data = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
  await writeFile(filepath, data);

  return filepath;
}
