import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, ShadingType, convertInchesToTwip, Header, Footer, PageNumber, PageBreak, TableOfContents, VerticalAlign } from 'docx';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';

export interface SectionData {
  heading: string;
  level?: number;
  content?: string;
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
}

// ── Rich formatting types for cloned reports ──

export interface RichRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;       // hex without # e.g. "003366"
  font?: string;
  size?: number;        // half-points (24 = 12pt)
}

export interface RichParagraph {
  runs: RichRun[];
  alignment?: 'left' | 'center' | 'right' | 'justify';
  spacing_after?: number;
}

export interface StyledTableHeader {
  text: string;
  bold?: boolean;
  bg_color?: string;
  color?: string;
}

export interface StyledTableCell {
  text: string;
  bold?: boolean;
  italic?: boolean;
  bg_color?: string;
  color?: string;
  merge_right?: number;   // columnSpan = merge_right + 1
  merge_down?: number;    // rowSpan = merge_down + 1
  alignment?: 'left' | 'center' | 'right';
}

export interface StyledTableRow {
  cells: StyledTableCell[];
  row_type?: 'header' | 'data' | 'subtotal' | 'total';
}

export interface StyledTable {
  headers: StyledTableHeader[];
  rows: StyledTableRow[];
  column_widths?: number[];   // percentages
  alternate_row_shading?: string;  // hex color for even rows
  border_style?: 'grid' | 'horizontal' | 'none';
}

export interface CalloutBox {
  text: string;
  title?: string;
  accent_color?: string;  // left border color
  bg_color?: string;      // background fill
}

export interface RichSectionData {
  heading: string;
  level?: number;
  content?: string;
  rich_content?: RichParagraph[];
  bullets?: string[];
  rich_bullets?: RichParagraph[];
  table?: { headers: string[]; rows: string[][] };
  styled_table?: StyledTable;
  page_break_before?: boolean;
  callout?: CalloutBox;
}

export interface StyleProfile {
  font_body?: string;
  font_heading?: string;
  font_size_body?: number;    // half-points
  font_size_h1?: number;
  font_size_h2?: number;
  primary_color?: string;
  accent_color?: string;
  heading_color?: string;
}

export interface ClonedReportInput {
  title: string;
  subtitle?: string;
  audience?: string;
  style_profile?: StyleProfile;
  sections: RichSectionData[];
  output_dir?: string;
  include_toc?: boolean;
  header_text?: string;
  footer_text?: string;
}

export interface DocumentInput {
  title: string;
  subtitle?: string;
  audience?: string;
  sections: SectionData[];
  sources?: string[];
  outputDir?: string;
}

export async function generateDocx(input: DocumentInput): Promise<string> {
  const children: any[] = [];

  // Title
  children.push(new Paragraph({ text: input.title, heading: HeadingLevel.TITLE }));
  if (input.subtitle) {
    children.push(new Paragraph({ children: [new TextRun({ text: input.subtitle, italics: true, color: '666666' })] }));
  }
  if (input.audience) {
    children.push(new Paragraph({ children: [new TextRun({ text: `Prepared for: ${input.audience}`, color: '888888' })] }));
  }
  children.push(new Paragraph({ text: '' }));

  // Sections
  for (const section of input.sections) {
    const headingLevel = section.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1;
    children.push(new Paragraph({ text: section.heading, heading: headingLevel }));

    if (section.content) {
      children.push(new Paragraph({ text: section.content }));
    }

    if (section.bullets) {
      for (const bullet of section.bullets) {
        children.push(new Paragraph({ text: bullet, bullet: { level: 0 } }));
      }
    }

    if (section.table) {
      const headerRow = new TableRow({
        children: section.table.headers.map(h => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
          width: { size: Math.floor(100 / section.table!.headers.length), type: WidthType.PERCENTAGE },
        })),
      });
      const dataRows = section.table.rows.map(row => new TableRow({
        children: row.map(cell => new TableCell({
          children: [new Paragraph({ text: cell })],
          width: { size: Math.floor(100 / section.table!.headers.length), type: WidthType.PERCENTAGE },
        })),
      }));
      children.push(new Table({ rows: [headerRow, ...dataRows] }));
    }

    children.push(new Paragraph({ text: '' }));
  }

  // Sources
  if (input.sources?.length) {
    children.push(new Paragraph({ text: 'Sources', heading: HeadingLevel.HEADING_1 }));
    for (const source of input.sources) {
      children.push(new Paragraph({ text: source, bullet: { level: 0 } }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);

  const outputDir = input.outputDir || process.cwd();
  const filename = `${input.title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
  const filepath = join(outputDir, filename);
  await writeFile(filepath, buffer);

  return filepath;
}

// ── Cloned Report Generator ──

const ALIGNMENT_MAP: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

function buildTextRun(run: RichRun, defaults: StyleProfile): TextRun {
  return new TextRun({
    text: run.text,
    bold: run.bold,
    italics: run.italic,
    color: run.color ?? defaults.primary_color ?? '000000',
    font: run.font ?? defaults.font_body ?? 'Calibri',
    size: run.size ?? defaults.font_size_body ?? 22,
  });
}

function buildRichParagraph(para: RichParagraph, defaults: StyleProfile): Paragraph {
  return new Paragraph({
    children: para.runs.map(r => buildTextRun(r, defaults)),
    alignment: para.alignment ? ALIGNMENT_MAP[para.alignment] : undefined,
    spacing: para.spacing_after ? { after: para.spacing_after } : undefined,
  });
}

function buildTableBorders(borderStyle?: 'grid' | 'horizontal' | 'none') {
  const style = borderStyle ?? 'grid';
  if (style === 'none') return undefined;

  const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

  if (style === 'horizontal') {
    return { top: border, bottom: border, insideHorizontal: border, left: none, right: none, insideVertical: none };
  }
  // grid
  return { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
}

function resolveRowStyling(
  cell: StyledTableCell,
  rowType: StyledTableRow['row_type'],
  rowIndex: number,
  alternateShading?: string,
): { shading?: { type: typeof ShadingType.SOLID; color: string }; bold?: boolean } {
  // Explicit cell bg_color always wins
  if (cell.bg_color) {
    return { shading: { type: ShadingType.SOLID, color: cell.bg_color }, bold: cell.bold };
  }
  // Row type presets
  if (rowType === 'subtotal') {
    return { shading: { type: ShadingType.SOLID, color: 'F2F2F2' }, bold: true };
  }
  if (rowType === 'total') {
    return { shading: { type: ShadingType.SOLID, color: 'D9D9D9' }, bold: true };
  }
  // Alternating row shading for even data rows
  if (alternateShading && rowIndex % 2 === 0) {
    return { shading: { type: ShadingType.SOLID, color: alternateShading }, bold: cell.bold };
  }
  return { bold: cell.bold };
}

function splitContentIntoParagraphs(content: string, style: StyleProfile): Paragraph[] {
  const fontBody = style.font_body ?? 'Calibri';
  const fontSize = style.font_size_body ?? 22;

  return content.split('\n\n').filter(s => s.trim()).map(chunk => new Paragraph({
    children: [new TextRun({
      text: chunk.trim(),
      font: fontBody,
      size: fontSize,
    })],
    spacing: { after: 120 },
  }));
}

function buildCalloutBox(callout: CalloutBox, style: StyleProfile): Paragraph[] {
  const accent = callout.accent_color ?? style.accent_color ?? '2E75B6';
  const bg = callout.bg_color ?? 'F2F7FB';
  const fontBody = style.font_body ?? 'Calibri';
  const fontSize = style.font_size_body ?? 22;

  const borderLeft = { style: BorderStyle.SINGLE, size: 24, color: accent, space: 8 };
  const shadingFill = ShadingType.SOLID;
  const shading = { type: shadingFill, color: bg };

  const paragraphs: Paragraph[] = [];

  if (callout.title) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({
        text: callout.title,
        bold: true,
        font: fontBody,
        size: fontSize,
        color: accent,
      })],
      border: { left: borderLeft },
      shading,
      spacing: { before: 120, after: 40 },
      indent: { left: convertInchesToTwip(0.15) },
    }));
  }

  paragraphs.push(new Paragraph({
    children: [new TextRun({
      text: callout.text,
      font: fontBody,
      size: fontSize,
    })],
    border: { left: borderLeft },
    shading,
    spacing: { before: callout.title ? 0 : 120, after: 120 },
    indent: { left: convertInchesToTwip(0.15) },
  }));

  return paragraphs;
}

function buildPageHeader(headerText: string, _style: StyleProfile): Header {
  return new Header({
    children: [new Paragraph({
      children: [new TextRun({
        text: headerText,
        font: 'Calibri',
        size: 18,  // 9pt
        color: '888888',
      })],
      alignment: AlignmentType.RIGHT,
    })],
  });
}

function buildPageFooter(footerText: string, _style: StyleProfile): Footer {
  return new Footer({
    children: [new Paragraph({
      children: [
        new TextRun({
          text: `${footerText}  |  Page `,
          font: 'Calibri',
          size: 18,
          color: '888888',
        }),
        new TextRun({
          children: [PageNumber.CURRENT],
          font: 'Calibri',
          size: 18,
          color: '888888',
        }),
        new TextRun({
          text: ' of ',
          font: 'Calibri',
          size: 18,
          color: '888888',
        }),
        new TextRun({
          children: [PageNumber.TOTAL_PAGES],
          font: 'Calibri',
          size: 18,
          color: '888888',
        }),
      ],
      alignment: AlignmentType.CENTER,
    })],
  });
}

function buildStyledTable(st: StyledTable): Table {
  const colCount = st.headers.length;
  const widths = st.column_widths ?? st.headers.map(() => Math.floor(100 / colCount));
  const cellAlignmentMap: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: st.headers.map((h, i) => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({
          text: h.text,
          bold: h.bold ?? true,
          color: h.color ?? 'FFFFFF',
          size: 20,
        })],
        alignment: AlignmentType.CENTER,
      })],
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: h.bg_color ? { type: ShadingType.SOLID, color: h.bg_color } : undefined,
      verticalAlign: VerticalAlign.CENTER,
    })),
  });

  const dataRows = st.rows.map((row, rowIdx) => new TableRow({
    children: row.cells.map((cell, i) => {
      const styling = resolveRowStyling(cell, row.row_type, rowIdx, st.alternate_row_shading);
      const isTotal = row.row_type === 'total';

      return new TableCell({
        children: [new Paragraph({
          children: [new TextRun({
            text: cell.text,
            bold: styling.bold,
            italics: cell.italic,
            color: cell.color,
            size: 20,
          })],
          alignment: cell.alignment ? cellAlignmentMap[cell.alignment] : undefined,
        })],
        width: { size: widths[i], type: WidthType.PERCENTAGE },
        shading: styling.shading,
        columnSpan: cell.merge_right ? cell.merge_right + 1 : undefined,
        rowSpan: cell.merge_down ? cell.merge_down + 1 : undefined,
        verticalAlign: VerticalAlign.CENTER,
        borders: isTotal ? {
          top: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
        } : undefined,
      });
    }),
  }));

  const borders = buildTableBorders(st.border_style);

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
  });
}

export async function generateClonedReport(input: ClonedReportInput): Promise<string> {
  const style = input.style_profile ?? {};
  const fontBody = style.font_body ?? 'Calibri';
  const fontHeading = style.font_heading ?? 'Calibri';
  const sizeH1 = style.font_size_h1 ?? 32;
  const sizeH2 = style.font_size_h2 ?? 26;
  const headingColor = style.heading_color ?? '003366';

  const children: (Paragraph | Table | TableOfContents)[] = [];

  // TOC
  if (input.include_toc) {
    children.push(new TableOfContents('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-3',
    }));
    children.push(new Paragraph({
      children: [new PageBreak()],
    }));
  }

  // Title
  children.push(new Paragraph({
    children: [new TextRun({
      text: input.title,
      bold: true,
      font: fontHeading,
      size: sizeH1 + 8,
      color: headingColor,
    })],
    spacing: { after: 200 },
  }));

  if (input.subtitle) {
    children.push(new Paragraph({
      children: [new TextRun({
        text: input.subtitle,
        italics: true,
        font: fontBody,
        size: sizeH2,
        color: '666666',
      })],
      spacing: { after: 100 },
    }));
  }

  if (input.audience) {
    children.push(new Paragraph({
      children: [new TextRun({
        text: `Prepared for: ${input.audience}`,
        font: fontBody,
        size: style.font_size_body ?? 22,
        color: '888888',
      })],
      spacing: { after: 300 },
    }));
  }

  // Sections
  for (const section of input.sections) {
    const level = section.level ?? 1;
    const headingSize = level === 1 ? sizeH1 : sizeH2;
    const headingLevel = level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1;

    children.push(new Paragraph({
      children: [new TextRun({
        text: section.heading,
        bold: true,
        font: fontHeading,
        size: headingSize,
        color: headingColor,
      })],
      heading: headingLevel,
      spacing: { before: 240, after: 120 },
      pageBreakBefore: section.page_break_before ?? false,
    }));

    // Rich content (preferred) or plain content split on \n\n
    if (section.rich_content) {
      for (const para of section.rich_content) {
        children.push(buildRichParagraph(para, style));
      }
    } else if (section.content) {
      children.push(...splitContentIntoParagraphs(section.content, style));
    }

    // Rich bullets or plain bullets
    if (section.rich_bullets) {
      for (const para of section.rich_bullets) {
        children.push(new Paragraph({
          children: para.runs.map(r => buildTextRun(r, style)),
          bullet: { level: 0 },
        }));
      }
    } else if (section.bullets) {
      for (const bullet of section.bullets) {
        children.push(new Paragraph({
          children: [new TextRun({
            text: bullet,
            font: fontBody,
            size: style.font_size_body ?? 22,
          })],
          bullet: { level: 0 },
        }));
      }
    }

    // Callout box (after bullets, before table)
    if (section.callout) {
      children.push(...buildCalloutBox(section.callout, style));
    }

    // Styled table (preferred) or plain table
    if (section.styled_table) {
      children.push(buildStyledTable(section.styled_table));
    } else if (section.table) {
      const colCount = section.table.headers.length;
      const headerRow = new TableRow({
        children: section.table.headers.map(h => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, font: fontBody })] })],
          width: { size: Math.floor(100 / colCount), type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.SOLID, color: style.primary_color ?? '003366' },
        })),
      });
      const dataRows = section.table.rows.map(row => new TableRow({
        children: row.map(cell => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: cell, font: fontBody })] })],
          width: { size: Math.floor(100 / colCount), type: WidthType.PERCENTAGE },
        })),
      }));
      children.push(new Table({ rows: [headerRow, ...dataRows] }));
    }

    // Spacer after section
    children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
  }

  // Build headers/footers if specified
  const header = input.header_text ? buildPageHeader(input.header_text, style) : undefined;
  const footer = input.footer_text ? buildPageFooter(input.footer_text, style) : undefined;

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: fontBody,
            size: style.font_size_body ?? 22,
          },
        },
      },
    },
    features: input.include_toc ? { updateFields: true } : undefined,
    sections: [{
      children,
      headers: header ? { default: header } : undefined,
      footers: footer ? { default: footer } : undefined,
    }],
  });

  const buffer = await Packer.toBuffer(doc);

  const outputDir = resolve(input.output_dir || process.cwd());
  await mkdir(outputDir, { recursive: true });
  const filename = `${input.title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
  const filepath = join(outputDir, filename);
  await writeFile(filepath, buffer);

  return filepath;
}
