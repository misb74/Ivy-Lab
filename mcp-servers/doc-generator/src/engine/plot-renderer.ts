/**
 * Server-side Observable Plot SVG renderer.
 * Uses @observablehq/plot + jsdom to generate self-contained HTML with inline SVG charts.
 * No CDN, no client-side JS required.
 */
import * as Plot from '@observablehq/plot';
import { JSDOM } from 'jsdom';

export interface PlotSpec {
  chart_type: 'bar' | 'line' | 'dot' | 'area' | 'cell' | 'text' | 'rule' | 'heatmap';
  data: Record<string, unknown>[];
  x: string;
  y?: string;
  color?: string;
  size?: string;
  label?: string;
  sort?: { field: string; order?: 'ascending' | 'descending' };
  facet?: { x?: string; y?: string };
  width?: number;
  height?: number;
  color_scheme?: string;
  title?: string;
}

/**
 * Build Plot marks array from the chart_type and spec channels.
 */
function buildMarks(spec: PlotSpec): Plot.Markish[] {
  const { chart_type, data, x, y, color, size, label } = spec;
  const marks: Plot.Markish[] = [];

  const channels: Record<string, unknown> = { x, y };
  if (color) channels.fill = color;
  if (size) channels.r = size;

  switch (chart_type) {
    case 'bar':
      marks.push(Plot.barY(data, { x, y: y ?? 'count', fill: color ?? '#667eea', ...buildTip(x, y) }));
      marks.push(Plot.ruleY([0]));
      break;

    case 'line':
      marks.push(Plot.lineY(data, { x, y, stroke: color ?? '#667eea', strokeWidth: 2, ...buildTip(x, y) }));
      marks.push(Plot.dot(data, { x, y, fill: color ?? '#667eea', r: 3 }));
      break;

    case 'dot':
      marks.push(Plot.dot(data, { x, y, fill: color ?? '#667eea', r: size ?? 5, ...buildTip(x, y) }));
      break;

    case 'area':
      marks.push(Plot.areaY(data, { x, y, fill: color ?? '#667eea', fillOpacity: 0.3 }));
      marks.push(Plot.lineY(data, { x, y, stroke: color ?? '#667eea', strokeWidth: 2 }));
      break;

    case 'cell':
      marks.push(Plot.cell(data, { x, y, fill: color ?? y, ...buildTip(x, y) }));
      break;

    case 'text':
      marks.push(Plot.text(data, { x, y, text: label ?? x, fill: color ?? '#333', fontSize: 12 }));
      break;

    case 'rule':
      marks.push(Plot.ruleY(data, { x, y, stroke: color ?? '#667eea', strokeWidth: 2 }));
      break;

    case 'heatmap':
      marks.push(Plot.cell(data, { x, y, fill: color ?? y, ...buildTip(x, y) }));
      break;

    default:
      marks.push(Plot.barY(data, { x, y: y ?? 'count', fill: color ?? '#667eea' }));
      break;
  }

  return marks;
}

/**
 * Build tip channel for hover labels (Observable Plot 0.6+ tip mark).
 */
function buildTip(x?: string, y?: string): Record<string, unknown> {
  return { tip: true };
}

/**
 * Build the full Plot.plot() options object from a PlotSpec.
 */
function buildPlotOptions(spec: PlotSpec, document: Document): Plot.PlotOptions {
  const marks = buildMarks(spec);

  const options: Plot.PlotOptions = {
    width: spec.width ?? 720,
    height: spec.height ?? 400,
    marks,
    document: document as unknown as Document,
    style: {
      background: 'transparent',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: '12px',
    },
  };

  // Apply color scheme
  if (spec.color_scheme) {
    options.color = { scheme: spec.color_scheme as any };
  } else if (spec.chart_type === 'cell' || spec.chart_type === 'heatmap') {
    options.color = { scheme: 'YlOrRd' };
  }

  // Apply sort by computing sorted domain from the data
  if (spec.sort) {
    const sortField = spec.sort.field;
    const desc = spec.sort.order === 'descending';
    const sorted = [...spec.data].sort((a, b) => {
      const av = a[sortField] as number, bv = b[sortField] as number;
      return desc ? bv - av : av - bv;
    });
    const domain = sorted.map(d => d[spec.x]);
    options.x = { ...((options.x as Record<string, unknown>) ?? {}), domain };
  }

  // Apply facet
  if (spec.facet) {
    (options as any).fx = spec.facet.x ?? undefined;
    (options as any).fy = spec.facet.y ?? undefined;
  }

  return options;
}

/**
 * Render a PlotSpec to a self-contained HTML string with inline SVG.
 * No external CDN, no client-side JavaScript required.
 */
export function renderPlotToSvg(spec: PlotSpec): string {
  // Create a jsdom instance for server-side DOM operations
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const document = dom.window.document;

  // Build and render the plot
  const options = buildPlotOptions(spec, document as unknown as Document);
  const plot = Plot.plot(options);

  // Extract the SVG outerHTML
  const svgHtml = plot.outerHTML;

  // Build self-contained HTML page
  const title = spec.title ?? 'Visualization';
  const generatedAt = new Date().toISOString();
  const width = spec.width ?? 720;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      padding: 2rem;
    }
    .dashboard {
      max-width: ${Math.max(width + 80, 800)}px;
      margin: 0 auto;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      border-radius: 12px;
      margin-bottom: 2rem;
    }
    .header h1 {
      font-size: 1.8rem;
      margin-bottom: 0.5rem;
    }
    .header .meta {
      opacity: 0.8;
      font-size: 0.9rem;
    }
    .chart-card {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      margin-bottom: 2rem;
      overflow-x: auto;
    }
    .chart-card svg {
      display: block;
      margin: 0 auto;
    }
    .data-table {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      margin-bottom: 2rem;
      overflow-x: auto;
    }
    .data-table h3 {
      color: #667eea;
      margin-bottom: 1rem;
      font-size: 1.1rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    th, td {
      padding: 0.6rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #555;
      position: sticky;
      top: 0;
    }
    tr:hover td { background: #f8f9ff; }
    .footer {
      text-align: center;
      color: #999;
      font-size: 0.8rem;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <div class="dashboard">
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${escapeHtml(spec.chart_type)} chart | Generated ${generatedAt} | Powered by Observable Plot</div>
    </div>
    <div class="chart-card">
      ${svgHtml}
    </div>
    ${buildDataTable(spec)}
    <div class="footer">Generated by Ivy &mdash; WorkVine.ai</div>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Build an HTML data table from the spec's data array.
 * Provides an accessible fallback and data reference alongside the chart.
 */
function buildDataTable(spec: PlotSpec): string {
  if (!spec.data || spec.data.length === 0) return '';

  const keys = Object.keys(spec.data[0]);
  if (keys.length === 0) return '';

  const headerCells = keys.map(k => `<th>${escapeHtml(k)}</th>`).join('');
  const rows = spec.data.map(row => {
    const cells = keys.map(k => {
      const val = row[k];
      return `<td>${escapeHtml(String(val ?? ''))}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('\n      ');

  return `<div class="data-table">
      <h3>Data</h3>
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}

/**
 * Escape HTML entities to prevent XSS in generated output.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
