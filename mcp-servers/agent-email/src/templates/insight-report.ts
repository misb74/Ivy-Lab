import type {
  InsightReportVars,
  InsightSection,
  InsightMetricsSection,
  InsightCalloutSection,
  InsightTableSection,
  InsightChartSection,
  InsightListSection,
  InsightRecommendationsSection,
  InsightProseSection,
  InsightTimelineSection,
  InsightComparisonSection,
  RenderedEmail,
} from './types.js';
import { pickOpener } from './openers.js';
import {
  escapeHtml,
  htmlToPlainText,
  wrapHtml,
  sectionDivider,
  paragraph,
  bulletPoint,
  signOff,
  metricCard,
  tableBlock,
  priorityBadge,
} from './html-wrapper.js';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MUTED_COLOR = '#6b7280';

function renderReportHeader(pillLabel: string, title: string, subtitle: string): string {
  return `
    <tr>
      <td style="padding: 0 0 8px 0;">
        <span style="display: inline-block; font-family: ${FONT_STACK}; font-size: 11px; font-weight: 700; color: #ffffff; background-color: #1e3a5f; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.08em;">${escapeHtml(pillLabel)}</span>
      </td>
    </tr>
    <tr>
      <td style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #1a1a1a; padding: 0 0 4px 0; line-height: 1.3;">
        ${escapeHtml(title)}
      </td>
    </tr>
    <tr>
      <td style="font-family: ${FONT_STACK}; font-size: 14px; color: ${MUTED_COLOR}; padding: 0 0 16px 0; line-height: 1.5;">
        ${escapeHtml(subtitle)}
      </td>
    </tr>`;
}

function renderMetrics(section: InsightMetricsSection): string {
  let rows = '';
  rows += sectionDivider('Key Metrics');
  for (const item of section.items) {
    rows += metricCard(item.label, item.value, item.color, item.delta);
  }
  return rows;
}

function renderCallout(section: InsightCalloutSection): string {
  let rows = '';
  rows += sectionDivider(section.title || 'Key Finding');
  // description may contain trusted HTML from Ivy
  rows += paragraph(section.description);
  return rows;
}

function renderTable(section: InsightTableSection): string {
  let rows = '';
  rows += sectionDivider(section.title || 'Data');
  rows += tableBlock(section.headers, section.rows, section.highlightColumn);
  if (section.explainer) {
    const notes = Object.entries(section.explainer)
      .map(([col, desc]) => `<strong>${escapeHtml(col)}</strong>: ${escapeHtml(desc)}`)
      .join(' | ');
    rows += paragraph(`<em style="font-size: 13px; color: ${MUTED_COLOR};">${notes}</em>`);
  }
  return rows;
}

function renderChart(section: InsightChartSection): string {
  let rows = '';
  rows += sectionDivider(section.title || 'Chart Data');
  // Charts cannot render in email — degrade to a data table
  const headers = [section.xKey, ...section.yKeys];
  const dataRows = section.data.slice(0, 10).map((item) =>
    headers.map((key) => String(item[key] ?? ''))
  );
  rows += tableBlock(headers, dataRows);
  if (section.data.length > 10) {
    rows += paragraph(`<em style="font-size: 13px; color: ${MUTED_COLOR};">Showing 10 of ${section.data.length} rows. See attached report for full chart.</em>`);
  }
  return rows;
}

function renderList(section: InsightListSection): string {
  let rows = '';
  rows += sectionDivider('Key Findings');
  for (const item of section.items) {
    const badge = item.priority ? priorityBadge(item.priority) : '';
    const check = item.checked ? '\u2705 ' : '';
    rows += bulletPoint(`${badge}${check}${escapeHtml(item.text)}`);
  }
  return rows;
}

function renderRecommendations(section: InsightRecommendationsSection): string {
  let rows = '';
  rows += sectionDivider(section.title || 'Recommendations');
  for (const rec of section.items) {
    rows += paragraph(
      `${priorityBadge(rec.priority)}<strong>${escapeHtml(rec.title)}</strong><br>${escapeHtml(rec.description)}`
    );
  }
  return rows;
}

function renderProse(section: InsightProseSection): string {
  let rows = '';
  if (section.heading) {
    rows += sectionDivider(section.heading);
  }
  // body may contain trusted HTML from Ivy
  rows += paragraph(section.body);
  return rows;
}

function renderTimeline(section: InsightTimelineSection): string {
  let rows = '';
  rows += sectionDivider('Timeline');
  for (const node of section.nodes) {
    const icon = node.status === 'completed' ? '\u2713'
      : node.status === 'active' ? '\u25B6'
      : '\u25CB';
    rows += bulletPoint(`${icon} ${escapeHtml(node.label)}`);
  }
  return rows;
}

function renderComparison(section: InsightComparisonSection): string {
  let rows = '';
  rows += sectionDivider('Comparison');
  const headers = section.columns.map((col) =>
    col.recommended ? `${col.heading} \u2605` : col.heading
  );
  const maxItems = Math.max(...section.columns.map((c) => c.items.length));
  const dataRows: string[][] = [];
  for (let i = 0; i < maxItems; i++) {
    dataRows.push(section.columns.map((col) => col.items[i] || ''));
  }
  const recommendedIdx = section.columns.findIndex((c) => c.recommended);
  rows += tableBlock(headers, dataRows, recommendedIdx >= 0 ? recommendedIdx : undefined);
  return rows;
}

function renderSection(section: InsightSection): string {
  switch (section.kind) {
    case 'metrics':
      return renderMetrics(section);
    case 'callout':
      return renderCallout(section);
    case 'table':
      return renderTable(section);
    case 'chart':
      return renderChart(section);
    case 'list':
      return renderList(section);
    case 'recommendations':
      return renderRecommendations(section);
    case 'prose':
      return renderProse(section);
    case 'timeline':
      return renderTimeline(section);
    case 'comparison':
      return renderComparison(section);
    case 'simulation':
      // Interactive simulations cannot render in email
      return paragraph(`<em style="font-size: 13px; color: ${MUTED_COLOR};">Interactive simulation available in the web app.</em>`);
    default:
      return '';
  }
}

export function renderInsightReport(vars: InsightReportVars): RenderedEmail {
  const opener = pickOpener(vars);
  const { artifact } = vars;

  let bodyRows = '';

  // Opener
  bodyRows += paragraph(escapeHtml(opener));

  // Report header
  bodyRows += renderReportHeader(artifact.pillLabel, artifact.title, artifact.subtitle);

  // Render each section
  for (const section of artifact.sections) {
    bodyRows += renderSection(section);
  }

  // Data sources
  if (artifact.dataSources) {
    bodyRows += sectionDivider('Data Sources');
    bodyRows += paragraph(`<em style="font-size: 13px; color: ${MUTED_COLOR};">${escapeHtml(artifact.dataSources)}</em>`);
  }

  // Ivy's Take
  if (vars.ivysTake) {
    bodyRows += sectionDivider('Ivy\u2019s Take');
    bodyRows += paragraph(escapeHtml(vars.ivysTake));
  }

  // Sign-off
  bodyRows += signOff('Full report attached \u2014 let me know if you want me to dig into any section.');

  const html = wrapHtml(bodyRows);
  const text = htmlToPlainText(html);
  const subject = `${artifact.pillLabel}: ${artifact.title}`;

  return { subject, html, text };
}
