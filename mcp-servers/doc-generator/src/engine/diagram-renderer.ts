/**
 * Diagram rendering engine — converts Mermaid, Observable Plot, and D3 graph data to PNG files.
 * All three paths: generate SVG string → sharp → PNG.
 */
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import { JSDOM } from 'jsdom';
import * as d3 from 'd3';
import { renderPlotToSvg, type PlotSpec } from './plot-renderer.js';

const execFileAsync = promisify(execFile);

const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), '.outputs', 'diagrams');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── 1. Mermaid → PNG ──────────────────────────────────────────────────────────

export interface MermaidInput {
  /** Mermaid diagram definition (e.g. "graph TD; A-->B;") */
  definition: string;
  /** Output filename without extension */
  filename?: string;
  /** Output directory */
  output_dir?: string;
  /** Background color (default: white) */
  background?: string;
  /** Width in pixels (default: 800) */
  width?: number;
  /** Theme: default, dark, forest, neutral */
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
}

export async function renderMermaid(input: MermaidInput): Promise<{
  success: boolean;
  filepath: string;
  format: 'png';
  message: string;
}> {
  const outDir = input.output_dir || DEFAULT_OUTPUT_DIR;
  ensureDir(outDir);

  const slug = input.filename || `mermaid_${Date.now()}`;
  const tmpMmd = path.join(outDir, `${slug}.mmd`);
  const outPng = path.join(outDir, `${slug}.png`);

  // Write temp .mmd file
  fs.writeFileSync(tmpMmd, input.definition, 'utf-8');

  try {
    // Find mmdc binary — prefer local node_modules
    const mmdc = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '..', '..', 'node_modules', '.bin', 'mmdc'
    );
    const mmdcBin = fs.existsSync(mmdc) ? mmdc : 'mmdc';

    const args = [
      '-i', tmpMmd,
      '-o', outPng,
      '-b', input.background || 'white',
      '-w', String(input.width || 800),
      '-t', input.theme || 'default',
      '--pdfFit',
    ];

    await execFileAsync(mmdcBin, args, { timeout: 30_000 });

    return {
      success: true,
      filepath: outPng,
      format: 'png',
      message: `Rendered Mermaid diagram: ${slug}.png`,
    };
  } finally {
    // Clean up temp .mmd file
    if (fs.existsSync(tmpMmd)) fs.unlinkSync(tmpMmd);
  }
}

// ── 2. Observable Plot → PNG ──────────────────────────────────────────────────

export interface ChartPngInput extends PlotSpec {
  /** Output filename without extension */
  filename?: string;
  /** Output directory */
  output_dir?: string;
  /** Scale factor for retina (default: 2) */
  scale?: number;
  /** Background color (default: white) */
  background?: string;
}

export async function renderChartPng(input: ChartPngInput): Promise<{
  success: boolean;
  filepath: string;
  format: 'png';
  message: string;
}> {
  const outDir = input.output_dir || DEFAULT_OUTPUT_DIR;
  ensureDir(outDir);

  const slug = input.filename || `chart_${Date.now()}`;
  const outPng = path.join(outDir, `${slug}.png`);

  // Render to HTML (contains inline SVG)
  const html = renderPlotToSvg(input);

  // Extract just the SVG element from the HTML
  const svgMatch = html.match(/<svg[\s\S]*?<\/svg>/);
  if (!svgMatch) throw new Error('Failed to extract SVG from plot output');

  let svgString = svgMatch[0];
  const width = input.width || 720;
  const height = input.height || 400;
  const scale = input.scale || 2;
  const bg = input.background || 'white';

  // Ensure xmlns is present
  if (!svgString.includes('xmlns=')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Replace or add width/height attributes
  if (svgString.match(/\bwidth="[^"]*"/)) {
    svgString = svgString.replace(/\bwidth="[^"]*"/, `width="${width}"`);
  } else {
    svgString = svgString.replace('<svg', `<svg width="${width}"`);
  }
  if (svgString.match(/\bheight="[^"]*"/)) {
    svgString = svgString.replace(/\bheight="[^"]*"/, `height="${height}"`);
  } else {
    svgString = svgString.replace('<svg', `<svg height="${height}"`);
  }

  // Ensure viewBox exists
  if (!svgString.includes('viewBox')) {
    svgString = svgString.replace(/<svg([^>]*)>/, `<svg$1 viewBox="0 0 ${width} ${height}">`);
  }

  const wrappedSvg = svgString;

  await sharp(Buffer.from(wrappedSvg))
    .resize(width * scale, height * scale)
    .flatten({ background: bg })
    .png()
    .toFile(outPng);

  return {
    success: true,
    filepath: outPng,
    format: 'png',
    message: `Rendered chart PNG: ${slug}.png (${width * scale}x${height * scale})`,
  };
}

// ── 3. D3 Force Graph → PNG ──────────────────────────────────────────────────

export interface D3GraphNode {
  id: string;
  name: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface D3GraphEdge {
  source: string;
  target: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface GraphPngInput {
  nodes: D3GraphNode[];
  edges: D3GraphEdge[];
  /** Output filename without extension */
  filename?: string;
  /** Output directory */
  output_dir?: string;
  /** Width in pixels (default: 800) */
  width?: number;
  /** Height in pixels (default: 600) */
  height?: number;
  /** Background color (default: white) */
  background?: string;
  /** Color scheme for node types (D3 scheme name, default: Tableau10) */
  color_scheme?: string;
}

export async function renderGraphPng(input: GraphPngInput): Promise<{
  success: boolean;
  filepath: string;
  format: 'png';
  stats: { nodes: number; edges: number };
  message: string;
}> {
  const outDir = input.output_dir || DEFAULT_OUTPUT_DIR;
  ensureDir(outDir);

  const slug = input.filename || `graph_${Date.now()}`;
  const outPng = path.join(outDir, `${slug}.png`);

  const width = input.width || 800;
  const height = input.height || 600;
  const bg = input.background || 'white';

  // Build color scale from unique node types
  const nodeTypes = [...new Set(input.nodes.map(n => n.type))];
  const schemeName = input.color_scheme || 'Tableau10';
  const colorScale = d3.scaleOrdinal<string>()
    .domain(nodeTypes)
    .range((d3 as any)[`scheme${schemeName}`] || d3.schemeTableau10);

  // Run force simulation synchronously
  const simNodes = input.nodes.map(n => ({ ...n })) as (D3GraphNode & d3.SimulationNodeDatum)[];
  const simEdges = input.edges.map(e => ({ source: e.source, target: e.target, type: e.type }));

  const simulation = d3.forceSimulation(simNodes)
    .force('link', d3.forceLink(simEdges).id((d: any) => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide(25))
    .stop();

  // Tick to convergence
  for (let i = 0; i < 300; i++) simulation.tick();

  // Build SVG string manually (no DOM needed for simple SVG)
  const edgeLines = simEdges.map((e: any) => {
    const sx = e.source.x ?? 0;
    const sy = e.source.y ?? 0;
    const tx = e.target.x ?? 0;
    const ty = e.target.y ?? 0;
    return `<line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="#999" stroke-opacity="0.6" stroke-width="1.5"/>`;
  }).join('\n');

  const nodeCircles = simNodes.map(n => {
    const cx = (n as any).x ?? 0;
    const cy = (n as any).y ?? 0;
    const fill = colorScale(n.type);
    return `<circle cx="${cx}" cy="${cy}" r="8" fill="${fill}" stroke="#fff" stroke-width="1.5"/>`;
  }).join('\n');

  const nodeLabels = simNodes.map(n => {
    const cx = (n as any).x ?? 0;
    const cy = (n as any).y ?? 0;
    const label = escapeXml(n.name.length > 20 ? n.name.slice(0, 18) + '...' : n.name);
    return `<text x="${cx}" y="${cy - 12}" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#333">${label}</text>`;
  }).join('\n');

  // Legend
  const legendItems = nodeTypes.map((type, i) => {
    const y = 20 + i * 18;
    return `<rect x="${width - 140}" y="${y}" width="12" height="12" fill="${colorScale(type)}" rx="2"/>
<text x="${width - 122}" y="${y + 10}" font-size="11" font-family="sans-serif" fill="#555">${escapeXml(type)}</text>`;
  }).join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <g class="edges">${edgeLines}</g>
  <g class="nodes">${nodeCircles}</g>
  <g class="labels">${nodeLabels}</g>
  <g class="legend">${legendItems}</g>
</svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outPng);

  return {
    success: true,
    filepath: outPng,
    format: 'png',
    stats: { nodes: input.nodes.length, edges: input.edges.length },
    message: `Rendered graph PNG: ${slug}.png (${input.nodes.length} nodes, ${input.edges.length} edges)`,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
