import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { generatePptx } from './tools/pptx.js';
import { generateDocx, generateClonedReport } from './tools/docx.js';
import { generateExcel } from './tools/excel.js';
import { generatePdf } from './tools/pdf.js';
import { createVisualization, DASHBOARD_TYPES } from './tools/visualization.js';
import { listTemplates, getTemplate, getTemplateNames } from './presentation/registry.js';
import { suggestTemplate } from './presentation/selector.js';
import { executeScript } from './presentation/executor.js';
import { renderMermaid, renderChartPng, renderGraphPng } from './engine/diagram-renderer.js';

const server = new McpServer({ name: 'ivy-doc-generator', version: '2.1.0' });

// 1. create_presentation
server.tool('create_presentation', 'Generate a PowerPoint presentation from structured slide data', {
  title: z.string().describe('Presentation title'),
  subtitle: z.string().optional().describe('Presentation subtitle'),
  slides: z.array(z.object({
    title: z.string(),
    content: z.string().optional(),
    bullets: z.array(z.string()).optional(),
    table: z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional(),
    notes: z.string().optional(),
  })).describe('Slide data'),
}, async (input) => {
  const filepath = await generatePptx(input);
  return { content: [{ type: 'text', text: JSON.stringify({ success: true, filepath, format: 'pptx' }) }] };
});

// 2. create_document
server.tool('create_document', 'Generate a Word document from structured section data', {
  title: z.string(),
  subtitle: z.string().optional(),
  audience: z.string().optional(),
  sections: z.array(z.object({
    heading: z.string(),
    level: z.number().optional(),
    content: z.string().optional(),
    bullets: z.array(z.string()).optional(),
    table: z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional(),
  })),
  sources: z.array(z.string()).optional(),
}, async (input) => {
  const filepath = await generateDocx(input);
  return { content: [{ type: 'text', text: JSON.stringify({ success: true, filepath, format: 'docx' }) }] };
});

// 3. create_spreadsheet
server.tool('create_spreadsheet', 'Generate an Excel spreadsheet', {
  title: z.string(),
  sheets: z.array(z.object({
    name: z.string(),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number()]))),
  })),
}, async (input) => {
  const filepath = await generateExcel(input);
  return { content: [{ type: 'text', text: JSON.stringify({ success: true, filepath, format: 'xlsx' }) }] };
});

// 4. create_pdf
server.tool('create_pdf', 'Generate a PDF document', {
  title: z.string(),
  content: z.string().describe('Document content (plain text)'),
}, async (input) => {
  const filepath = await generatePdf(input);
  return { content: [{ type: 'text', text: JSON.stringify({ success: true, filepath, format: 'pdf' }) }] };
});

// 5. create_executive_report (combines research + docx generation)
server.tool('create_executive_report', 'Generate a formatted executive report as a Word document', {
  title: z.string(),
  subtitle: z.string().optional(),
  audience: z.string().optional(),
  sections: z.array(z.object({
    heading: z.string(),
    level: z.number().optional(),
    content: z.string().optional(),
    bullets: z.array(z.string()).optional(),
    table: z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional(),
  })),
  sources: z.array(z.string()).optional(),
}, async (input) => {
  const filepath = await generateDocx(input);
  return { content: [{ type: 'text', text: JSON.stringify({ success: true, filepath, format: 'docx', type: 'executive_report' }) }] };
});

// 6. create_visualization
server.tool('create_visualization', 'Generate a self-contained HTML visualization using Observable Plot (server-side SVG). Supports two modes: (1) Legacy: pass dashboard_type for predefined chart layouts (role_duplication, skill_extraction, etc.). (2) New: pass chart_type with explicit data channels (x, y, color, etc.) for any chart.', {
  dashboard_type: z.enum(['role_duplication', 'skill_extraction', 'job_analysis', 'workforce_planning', 'org_design', 'career_path', 'compensation', 'process_analysis']).optional().describe('Legacy dashboard type. Maps to a chart_type with default x/y channels. Provide this OR chart_type.'),
  chart_type: z.enum(['bar', 'line', 'dot', 'area', 'cell', 'text', 'rule', 'heatmap']).optional().describe('Observable Plot chart type. Provide this OR dashboard_type.'),
  title: z.string().describe('Chart / dashboard title'),
  data: z.any().describe('Data: array of objects [{x: ..., y: ...}, ...], object with metrics/chart/table/summary, or JSON string of either.'),
  x: z.string().optional().describe('X channel field name (key in data objects)'),
  y: z.string().optional().describe('Y channel field name (key in data objects)'),
  color: z.string().optional().describe('Color channel field name'),
  size: z.string().optional().describe('Size channel field name (for dot charts)'),
  label: z.string().optional().describe('Label channel field name (for text charts)'),
  sort: z.object({
    field: z.string(),
    order: z.enum(['ascending', 'descending']).optional(),
  }).optional().describe('Sort the x-axis by a field'),
  facet: z.object({
    x: z.string().optional(),
    y: z.string().optional(),
  }).optional().describe('Facet (small multiples) by field(s)'),
  width: z.number().optional().describe('Chart width in pixels (default 720)'),
  height: z.number().optional().describe('Chart height in pixels (default 400)'),
  color_scheme: z.string().optional().describe('D3 color scheme name (e.g. "Tableau10", "YlOrRd", "Blues")'),
  output_dir: z.string().optional().describe('Output directory path. Defaults to .outputs/'),
}, async (input) => {
  try {
    // Validate: at least one of dashboard_type or chart_type must be provided
    if (!input.dashboard_type && !input.chart_type) {
      throw new Error('Either dashboard_type or chart_type must be provided.');
    }

    const parsedData = typeof input.data === 'string' ? JSON.parse(input.data) : input.data;
    const result = await createVisualization({
      ...input,
      data: parsedData,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: (err as Error).message }) }], isError: true };
  }
});

// 7. list_presentation_templates
server.tool(
  'list_presentation_templates',
  'Browse available presentation design templates. Each template defines a complete visual identity (design tokens, layout DNA, code patterns) that Claude uses to write bespoke pptxgenjs scripts. Optionally filter by tag (e.g. "dark", "consulting", "minimal") or get suggestions for a topic.',
  {
    tag: z.string().optional().describe('Filter templates by tag (e.g. "dark", "light", "consulting", "tech", "minimal")'),
    topic: z.string().optional().describe('Topic string to suggest best-matching templates (e.g. "AI strategy keynote")'),
  },
  async (input) => {
    try {
      let templates;
      if (input.topic) {
        templates = suggestTemplate(input.topic);
      } else {
        templates = listTemplates(input.tag);
      }
      return { content: [{ type: 'text', text: JSON.stringify({ templates, count: templates.length }) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: (err as Error).message }) }], isError: true };
    }
  },
);

// 8. get_presentation_template
server.tool(
  'get_presentation_template',
  'Get full details for a specific presentation template, including design tokens, layout DNA, code patterns, and a pre-built synthesis prompt that Claude uses to write a bespoke pptxgenjs script. Templates: apex, prism, folio, volt, nexus, atlas, forge, terrain, helix, cedar, nimbus, solstice, graphite, aurora-borealis, sandstone, cobalt, mosaic, circuit, dusk, silk. Legacy names (obsidian, ivory, slate, ember, aurora, copper, onyx, meridian, rosewood, carbon) still work via aliases.',
  {
    template_name: z.enum(getTemplateNames() as [string, ...string[]]).describe('Template slug name (e.g. "apex", "silk", "helix", "cobalt")'),
  },
  async (input) => {
    try {
      const details = getTemplate(input.template_name);
      if (!details) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: `Template "${input.template_name}" not found` }) }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(details) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: (err as Error).message }) }], isError: true };
    }
  },
);

// 9. generate_themed_presentation
server.tool(
  'generate_themed_presentation',
  'Execute a bespoke pptxgenjs Node.js script to generate a themed .pptx file. The script should be a complete Node.js program that uses pptxgenjs to create slides. It runs in a sandboxed subprocess with a 60-second timeout.',
  {
    script: z.string().describe('Complete Node.js pptxgenjs script to execute'),
    filename: z.string().optional().describe('Output filename (without extension). Defaults to "presentation"'),
    output_dir: z.string().optional().describe('Output directory path. Defaults to .outputs/'),
  },
  async (input) => {
    try {
      const result = await executeScript(input);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: !result.success,
      };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: (err as Error).message }) }], isError: true };
    }
  },
);

// 10. create_cloned_report
server.tool(
  'create_cloned_report',
  'Generate a styled Word document that replicates an original report structure with fresh data. Supports rich inline formatting (bold, italic, color, font per run), styled tables with cell-level formatting, and a style profile (fonts, colors, sizes) to match the original document.',
  {
    title: z.string().describe('Report title'),
    subtitle: z.string().optional().describe('Report subtitle'),
    audience: z.string().optional().describe('Target audience, e.g. "Board of Directors"'),
    include_toc: z.boolean().optional().describe('Include a Table of Contents at the start'),
    header_text: z.string().optional().describe('Right-aligned header text on every page'),
    footer_text: z.string().optional().describe('Footer text on every page (page numbers added automatically)'),
    style_profile: z.object({
      font_body: z.string().optional().describe('Body font, e.g. "Calibri"'),
      font_heading: z.string().optional().describe('Heading font, e.g. "Georgia"'),
      font_size_body: z.number().optional().describe('Body font size in half-points (22 = 11pt)'),
      font_size_h1: z.number().optional().describe('H1 font size in half-points (32 = 16pt)'),
      font_size_h2: z.number().optional().describe('H2 font size in half-points (26 = 13pt)'),
      primary_color: z.string().optional().describe('Primary color hex without #, e.g. "003366"'),
      accent_color: z.string().optional().describe('Accent color hex without #, e.g. "E63946"'),
      heading_color: z.string().optional().describe('Heading color hex without #, e.g. "003366"'),
    }).optional().describe('Visual style profile to match the original document'),
    sections: z.array(z.object({
      heading: z.string().describe('Section heading text'),
      level: z.number().optional().describe('Heading level: 1 or 2'),
      page_break_before: z.boolean().optional().describe('Insert a page break before this section'),
      content: z.string().optional().describe('Plain text paragraph content (split on double newlines)'),
      rich_content: z.array(z.object({
        runs: z.array(z.object({
          text: z.string(),
          bold: z.boolean().optional(),
          italic: z.boolean().optional(),
          color: z.string().optional().describe('Hex color without #'),
          font: z.string().optional(),
          size: z.number().optional().describe('Half-points'),
        })),
        alignment: z.enum(['left', 'center', 'right', 'justify']).optional(),
        spacing_after: z.number().optional(),
      })).optional().describe('Rich paragraphs with inline formatting — preferred over plain content'),
      bullets: z.array(z.string()).optional().describe('Plain bullet points'),
      rich_bullets: z.array(z.object({
        runs: z.array(z.object({
          text: z.string(),
          bold: z.boolean().optional(),
          italic: z.boolean().optional(),
          color: z.string().optional(),
          font: z.string().optional(),
          size: z.number().optional(),
        })),
      })).optional().describe('Bullets with inline formatting'),
      callout: z.object({
        text: z.string().describe('Callout body text'),
        title: z.string().optional().describe('Callout title'),
        accent_color: z.string().optional().describe('Left border accent color hex without #'),
        bg_color: z.string().optional().describe('Background fill color hex without #'),
      }).optional().describe('Callout/highlight box with left accent bar'),
      table: z.object({
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string())),
      }).optional().describe('Plain table'),
      styled_table: z.object({
        headers: z.array(z.object({
          text: z.string(),
          bold: z.boolean().optional(),
          bg_color: z.string().optional(),
          color: z.string().optional(),
        })),
        rows: z.array(z.object({
          cells: z.array(z.object({
            text: z.string(),
            bold: z.boolean().optional(),
            italic: z.boolean().optional(),
            bg_color: z.string().optional(),
            color: z.string().optional(),
            merge_right: z.number().optional().describe('Number of columns to merge right (columnSpan = merge_right + 1)'),
            merge_down: z.number().optional().describe('Number of rows to merge down (rowSpan = merge_down + 1)'),
            alignment: z.enum(['left', 'center', 'right']).optional().describe('Cell text alignment'),
          })),
          row_type: z.enum(['header', 'data', 'subtotal', 'total']).optional().describe('Row type for auto-styling (subtotal=bold+light gray, total=bold+gray+top border)'),
        })),
        column_widths: z.array(z.number()).optional(),
        alternate_row_shading: z.string().optional().describe('Hex color for even-row shading, e.g. "F5F5F5"'),
        border_style: z.enum(['grid', 'horizontal', 'none']).optional().describe('Table border style (default: grid)'),
      }).optional().describe('Styled table with cell-level formatting, merging, row types, and alternating shading'),
    })).describe('Report sections in order'),
    output_dir: z.string().optional().describe('Output directory path. Defaults to cwd'),
  },
  async (input) => {
    try {
      const filepath = await generateClonedReport(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, filepath, format: 'docx' }) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: (err as Error).message }) }], isError: true };
    }
  },
);

// 11. render_mermaid — Mermaid diagram syntax → PNG
server.tool(
  'render_mermaid',
  'Render a Mermaid diagram definition to a PNG image file. Supports all Mermaid diagram types: flowchart, sequence, class, state, ER, Gantt, pie, mindmap, timeline, etc. Ideal for org charts, process flows, career paths, system architectures.',
  {
    definition: z.string().describe('Mermaid diagram definition (e.g. "graph TD; A-->B;")'),
    filename: z.string().optional().describe('Output filename without extension'),
    output_dir: z.string().optional().describe('Output directory (default: .outputs/diagrams/)'),
    background: z.string().optional().describe('Background color (default: white)'),
    width: z.number().optional().describe('Width in pixels (default: 800)'),
    theme: z.enum(['default', 'dark', 'forest', 'neutral']).optional().describe('Mermaid theme (default: default)'),
  },
  async (input) => {
    try {
      const result = await renderMermaid(input);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: (err as Error).message }) }], isError: true };
    }
  },
);

// 12. render_chart_png — Observable Plot chart → PNG
server.tool(
  'render_chart_png',
  'Render an Observable Plot chart to a PNG image file. Converts the existing chart spec (bar, line, dot, area, cell, heatmap) to a high-resolution PNG suitable for embedding in presentations, reports, and documents.',
  {
    chart_type: z.enum(['bar', 'line', 'dot', 'area', 'cell', 'text', 'rule', 'heatmap']).describe('Chart type'),
    title: z.string().describe('Chart title'),
    data: z.any().describe('Array of data objects [{x: ..., y: ...}, ...]'),
    x: z.string().describe('X channel field name'),
    y: z.string().optional().describe('Y channel field name'),
    color: z.string().optional().describe('Color channel field name'),
    size: z.string().optional().describe('Size channel field name'),
    label: z.string().optional().describe('Label field name'),
    sort: z.object({ field: z.string(), order: z.enum(['ascending', 'descending']).optional() }).optional(),
    facet: z.object({ x: z.string().optional(), y: z.string().optional() }).optional(),
    width: z.number().optional().describe('Chart width in px (default: 720)'),
    height: z.number().optional().describe('Chart height in px (default: 400)'),
    color_scheme: z.string().optional().describe('D3 color scheme (e.g. "Tableau10")'),
    filename: z.string().optional().describe('Output filename without extension'),
    output_dir: z.string().optional().describe('Output directory (default: .outputs/diagrams/)'),
    scale: z.number().optional().describe('Retina scale factor (default: 2)'),
    background: z.string().optional().describe('Background color (default: white)'),
  },
  async (input) => {
    try {
      const parsedData = typeof input.data === 'string' ? JSON.parse(input.data) : input.data;
      const result = await renderChartPng({ ...input, data: parsedData });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: (err as Error).message }) }], isError: true };
    }
  },
);

// 13. render_graph_png — D3 force-directed graph → PNG
server.tool(
  'render_graph_png',
  'Render a force-directed network graph to a PNG image. Takes nodes and edges (e.g. from the knowledge graph) and produces a colored, labeled graph visualization. Great for org structures, skill taxonomies, relationship maps.',
  {
    nodes: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      properties: z.record(z.unknown()).optional(),
    })).describe('Graph nodes'),
    edges: z.array(z.object({
      source: z.string().describe('Source node ID'),
      target: z.string().describe('Target node ID'),
      type: z.string(),
      properties: z.record(z.unknown()).optional(),
    })).describe('Graph edges'),
    filename: z.string().optional().describe('Output filename without extension'),
    output_dir: z.string().optional().describe('Output directory (default: .outputs/diagrams/)'),
    width: z.number().optional().describe('Width in px (default: 800)'),
    height: z.number().optional().describe('Height in px (default: 600)'),
    background: z.string().optional().describe('Background color (default: white)'),
    color_scheme: z.string().optional().describe('D3 color scheme for node types (default: Tableau10)'),
  },
  async (input) => {
    try {
      const result = await renderGraphPng(input);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: (err as Error).message }) }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
