import { dim, bold } from './format.js';

export interface TableOpts {
  maxColWidth?: number;
  indent?: number;
}

function stripAnsi(str: string): number {
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function truncate(str: string, max: number): string {
  const plain = str.replace(/\x1b\[[0-9;]*m/g, '');
  if (plain.length <= max) return str;
  // Truncate the plain text and hope we're not mid-escape
  return plain.slice(0, max - 1) + '\u2026';
}

export function renderTable(headers: string[], rows: string[][], opts: TableOpts = {}): string {
  const maxCol = opts.maxColWidth ?? 60;
  const indent = ' '.repeat(opts.indent ?? 2);

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const maxData = rows.reduce((w, r) => Math.max(w, stripAnsi(r[i] ?? '')), 0);
    return Math.min(Math.max(h.length, maxData), maxCol);
  });

  const lines: string[] = [];

  // Header
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('  ');
  lines.push(indent + bold(headerLine));

  // Separator
  const sep = widths.map(w => '\u2500'.repeat(w)).join('  ');
  lines.push(indent + dim(sep));

  // Rows
  for (const row of rows) {
    const cells = row.map((cell, i) => {
      const t = truncate(cell ?? '', widths[i]);
      const pad = widths[i] - stripAnsi(t);
      return t + ' '.repeat(Math.max(0, pad));
    });
    lines.push(indent + cells.join('  '));
  }

  return lines.join('\n');
}
