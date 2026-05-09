/**
 * Email-safe HTML shell and utility functions.
 * Table-based layout, all inline CSS, system font stack.
 */

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const TEXT_COLOR = '#1a1a1a';
const MUTED_COLOR = '#6b7280';
const DIVIDER_COLOR = '#e5e7eb';
const BG_COLOR = '#ffffff';

const SEMANTIC_COLORS: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
  purple: '#8b5cf6',
  gold: '#eab308',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#9ca3af',
};

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strip HTML tags and decode entities to produce a plain-text fallback.
 */
export function htmlToPlainText(html: string): string {
  // Extract only the inner content table — skip the outer wrapper/background
  const innerMatch = html.match(/<table width="100%" cellpadding="0" cellspacing="0" border="0">\s*([\s\S]*?)\s*<\/table>\s*<\/td>\s*<\/tr>\s*<\/table>\s*<\/td>\s*<\/tr>\s*<\/table>/);
  const source = innerMatch ? innerMatch[1] : html;

  return source
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '')
    .replace(/<\/th>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&bull;/g, '\u2022')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/^[ \t]+/gm, '')        // leading whitespace per line
    .replace(/[ \t]+$/gm, '')       // trailing whitespace per line
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Render a section divider with a label (e.g. "Executive Summary").
 */
export function sectionDivider(label: string): string {
  return `
    <tr>
      <td style="padding: 24px 0 8px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family: ${FONT_STACK}; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${MUTED_COLOR}; padding-bottom: 8px; border-bottom: 1px solid ${DIVIDER_COLOR};">
              ${escapeHtml(label)}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/**
 * Render a paragraph of body text.
 */
export function paragraph(text: string): string {
  return `
    <tr>
      <td style="font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.6; color: ${TEXT_COLOR}; padding: 8px 0;">
        ${text}
      </td>
    </tr>`;
}

/**
 * Render the Ivy sign-off block.
 */
export function signOff(closingLine?: string): string {
  const closing = closingLine
    ? `<tr><td style="font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.6; color: ${TEXT_COLOR}; padding: 16px 0 8px 0;">${escapeHtml(closingLine)}</td></tr>`
    : '';

  return `
    ${closing}
    <tr>
      <td style="font-family: ${FONT_STACK}; font-size: 15px; color: ${TEXT_COLOR}; padding: 24px 0 0 0;">
        &mdash; Ivy
      </td>
    </tr>`;
}

/**
 * Wrap inner content rows in the full email-safe HTML shell.
 */
export function wrapHtml(bodyRows: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ivy</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: ${BG_COLOR}; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${bodyRows}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Render a stat line like "  12 strong matches"
 */
export function statLine(value: string | number, label: string): string {
  return `
    <tr>
      <td style="font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.6; color: ${TEXT_COLOR}; padding: 2px 0 2px 16px;">
        <strong>${escapeHtml(String(value))}</strong> ${escapeHtml(label)}
      </td>
    </tr>`;
}

/**
 * Render a bullet point.
 */
export function bulletPoint(text: string): string {
  return `
    <tr>
      <td style="font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.6; color: ${TEXT_COLOR}; padding: 2px 0 2px 16px;">
        &bull; ${text}
      </td>
    </tr>`;
}

/**
 * Render a metric card with bold value, label, optional color dot, and delta.
 */
export function metricCard(
  label: string,
  value: string | number,
  color?: string,
  delta?: { value: string; direction: 'up' | 'down'; sentiment: 'positive' | 'negative' | 'neutral' },
): string {
  const hex = color ? (SEMANTIC_COLORS[color] || MUTED_COLOR) : MUTED_COLOR;
  const dot = `<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${hex}; margin-right: 6px; vertical-align: middle;"></span>`;
  const deltaHtml = delta
    ? ` <span style="font-size: 13px; color: ${MUTED_COLOR};">${delta.direction === 'up' ? '\u2191' : '\u2193'} ${escapeHtml(delta.value)}</span>`
    : '';
  return `
    <tr>
      <td style="font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.6; color: ${TEXT_COLOR}; padding: 4px 0 4px 16px;">
        ${dot}<strong>${escapeHtml(String(value))}</strong> ${escapeHtml(label)}${deltaHtml}
      </td>
    </tr>`;
}

/**
 * Render an email-safe data table with optional column highlighting.
 */
export function tableBlock(headers: string[], rows: string[][], highlightColumn?: number): string {
  const headerCells = headers
    .map((h, i) => {
      const bg = i === highlightColumn ? '#eef2ff' : 'transparent';
      return `<th style="font-family: ${FONT_STACK}; font-size: 13px; font-weight: 600; color: ${MUTED_COLOR}; text-align: left; padding: 8px 12px; border-bottom: 2px solid ${DIVIDER_COLOR}; background-color: ${bg};">${escapeHtml(h)}</th>`;
    })
    .join('');

  const bodyRows = rows
    .map((row, rowIdx) => {
      const rowBg = rowIdx % 2 === 1 ? '#f9fafb' : BG_COLOR;
      const cells = row
        .map((cell, i) => {
          const bg = i === highlightColumn ? '#eef2ff' : rowBg;
          const weight = i === highlightColumn ? 'font-weight: 600;' : '';
          return `<td style="font-family: ${FONT_STACK}; font-size: 14px; color: ${TEXT_COLOR}; padding: 6px 12px; border-bottom: 1px solid ${DIVIDER_COLOR}; background-color: ${bg}; ${weight}">${escapeHtml(cell)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `
    <tr>
      <td style="padding: 8px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
          <tr>${headerCells}</tr>
          ${bodyRows}
        </table>
      </td>
    </tr>`;
}

/**
 * Render an inline priority badge (critical/high/medium/low).
 * Returns an HTML string, not a table row — embed inside paragraph() or bulletPoint().
 */
export function priorityBadge(priority: string): string {
  const bg = PRIORITY_COLORS[priority.toLowerCase()] || PRIORITY_COLORS.low;
  return `<span style="display: inline-block; font-family: ${FONT_STACK}; font-size: 11px; font-weight: 600; color: #ffffff; background-color: ${bg}; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; vertical-align: middle; margin-right: 6px;">${escapeHtml(priority)}</span>`;
}
