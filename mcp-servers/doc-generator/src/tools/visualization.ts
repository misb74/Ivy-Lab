/**
 * HTML dashboard visualization generator.
 * Uses Observable Plot (server-side SVG) for chart rendering.
 * Retains backward compatibility with legacy dashboard_type enum.
 */
import fs from 'fs';
import path from 'path';
import { renderPlotToSvg, type PlotSpec } from '../engine/plot-renderer.js';

// Legacy dashboard types (retained for backward compat)
export const DASHBOARD_TYPES = [
  'role_duplication', 'skill_extraction', 'job_analysis',
  'workforce_planning', 'org_design', 'career_path',
  'compensation', 'process_analysis',
] as const;

export type DashboardType = typeof DASHBOARD_TYPES[number];

export type ChartType = 'bar' | 'line' | 'dot' | 'area' | 'cell' | 'text' | 'rule' | 'heatmap';

/** Legacy dashboard_type -> PlotSpec defaults mapping. */
const LEGACY_MAPPING: Record<DashboardType, { chart_type: ChartType; x: string; y: string }> = {
  skill_extraction: { chart_type: 'bar', x: 'skill', y: 'level' },
  compensation:     { chart_type: 'bar', x: 'role', y: 'salary_median' },
  workforce_planning: { chart_type: 'line', x: 'period', y: 'headcount' },
  job_analysis:     { chart_type: 'dot', x: 'requirement', y: 'importance' },
  role_duplication: { chart_type: 'cell', x: 'role1', y: 'role2' },
  career_path:      { chart_type: 'text', x: 'step', y: 'level' },
  org_design:       { chart_type: 'dot', x: 'span', y: 'level' },
  process_analysis: { chart_type: 'bar', x: 'step', y: 'duration' },
};

export interface VisualizationInput {
  /** Legacy dashboard type (maps to chart_type + default channels). */
  dashboard_type?: DashboardType;
  /** New: explicit chart type. Takes precedence over dashboard_type if both provided. */
  chart_type?: ChartType;
  title: string;
  /** Data: array of objects for Observable Plot, or legacy object with metrics/chart/table/summary. */
  data: Record<string, unknown>[] | Record<string, unknown>;
  /** X channel field name. */
  x?: string;
  /** Y channel field name. */
  y?: string;
  /** Color channel field name. */
  color?: string;
  /** Size channel field name. */
  size?: string;
  /** Text label channel field name. */
  label?: string;
  /** Sort spec. */
  sort?: { field: string; order?: 'ascending' | 'descending' };
  /** Facet spec. */
  facet?: { x?: string; y?: string };
  /** Chart width in pixels. */
  width?: number;
  /** Chart height in pixels. */
  height?: number;
  /** D3 color scheme name (e.g. 'Tableau10', 'YlOrRd'). */
  color_scheme?: string;
  /** Output directory path. */
  output_dir?: string;
}

/**
 * Resolve data to an array of objects for Observable Plot.
 *
 * Legacy callers pass a single object with nested chart/table/metrics.
 * New callers pass an array of row objects directly.
 */
function resolveDataArray(data: Record<string, unknown>[] | Record<string, unknown>): Record<string, unknown>[] {
  // Already an array of objects
  if (Array.isArray(data)) return data;

  // Legacy format: try to extract tabular data from known structures
  const obj = data as Record<string, any>;

  // Prefer chart.data if available
  if (obj.chart?.data && Array.isArray(obj.chart.data)) {
    return obj.chart.data as Record<string, unknown>[];
  }

  // Try table rows → objects
  if (obj.table?.headers && obj.table?.rows) {
    const headers = obj.table.headers as string[];
    return (obj.table.rows as unknown[][]).map(row => {
      const record: Record<string, unknown> = {};
      headers.forEach((h, i) => { record[h] = row[i]; });
      return record;
    });
  }

  // Try metrics array
  if (obj.metrics && Array.isArray(obj.metrics)) {
    return obj.metrics as Record<string, unknown>[];
  }

  // Fallback: wrap the object itself as a single-row dataset
  return [obj];
}

/**
 * Generate an HTML visualization using Observable Plot (server-side SVG).
 * Supports both the new chart_type API and legacy dashboard_type for backward compat.
 */
export async function createVisualization(input: VisualizationInput): Promise<{
  success: boolean;
  filepath: string;
  dashboard_type?: string;
  chart_type: string;
  message: string;
}> {
  const { title, output_dir } = input;

  // Resolve chart_type and default channels
  let chartType: ChartType;
  let xChannel: string;
  let yChannel: string | undefined;

  if (input.chart_type) {
    // New API: use chart_type directly
    chartType = input.chart_type;
    xChannel = input.x ?? 'x';
    yChannel = input.y;
  } else if (input.dashboard_type) {
    // Legacy API: map dashboard_type to chart_type + defaults
    const mapping = LEGACY_MAPPING[input.dashboard_type];
    chartType = mapping.chart_type;
    xChannel = input.x ?? mapping.x;
    yChannel = input.y ?? mapping.y;
  } else {
    throw new Error('Either chart_type or dashboard_type must be provided.');
  }

  // Resolve data to array form
  const dataArray = resolveDataArray(input.data);

  // Build PlotSpec
  const spec: PlotSpec = {
    chart_type: chartType,
    data: dataArray,
    x: xChannel,
    y: yChannel,
    color: input.color,
    size: input.size,
    label: input.label,
    sort: input.sort,
    facet: input.facet,
    width: input.width,
    height: input.height,
    color_scheme: input.color_scheme,
    title,
  };

  // Render to self-contained HTML via Observable Plot
  const html = renderPlotToSvg(spec);

  // Write output file
  const outDir = output_dir || path.join(process.cwd(), '.outputs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const prefix = input.dashboard_type ?? input.chart_type ?? 'chart';
  const filename = `${prefix}_${Date.now()}.html`;
  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, html);

  return {
    success: true,
    filepath,
    ...(input.dashboard_type ? { dashboard_type: input.dashboard_type } : {}),
    chart_type: chartType,
    message: `Generated ${chartType} visualization: ${filename}`,
  };
}
