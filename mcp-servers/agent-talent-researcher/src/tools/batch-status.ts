import crypto from 'crypto';
import { getDb } from '../db/database.js';
import type { BatchRow, RoleRow, BatchStatusSummary, RoleStatusRow } from '../engine/types.js';

interface BatchStatusParams {
  batch_id?: string;
}

/**
 * Returns a formatted ASCII table showing progress across all roles
 * in a batch. If no batch_id is provided, lists all batches as a summary.
 */
export async function batchStatus(params: BatchStatusParams): Promise<string> {
  const { batch_id } = params;
  const db = getDb();

  // If no batch_id, show summary of all batches
  if (!batch_id) {
    return buildBatchListTable(db);
  }

  // Fetch the batch
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batch_id) as BatchRow | undefined;
  if (!batch) {
    return `Error: Batch "${batch_id}" not found.`;
  }

  // Fetch all roles for this batch, ordered by role_index
  const roles = db.prepare(
    'SELECT * FROM roles WHERE batch_id = ? ORDER BY role_index ASC',
  ).all(batch_id) as RoleRow[];

  if (roles.length === 0) {
    return `Batch "${batch.name}" has no roles.`;
  }

  return buildRoleTable(batch, roles);
}

// ── Table Builders ──────────────────────────────────────────────────

function buildBatchListTable(db: ReturnType<typeof getDb>): string {
  const batches = db.prepare(
    'SELECT * FROM batches ORDER BY created_at DESC',
  ).all() as BatchRow[];

  if (batches.length === 0) {
    return 'No batches found. Create one with batch-create.';
  }

  const lines: string[] = [];
  lines.push('');
  lines.push('  All Batches');
  lines.push('  ' + '─'.repeat(70));

  for (const b of batches) {
    const pct = b.total_roles > 0
      ? Math.round((b.completed_roles / b.total_roles) * 100)
      : 0;
    const bar = progressBar(pct, 16);
    lines.push(
      `  ${b.id.slice(0, 8)}  ${pad(b.name, 24)}  ${pad(b.status, 10)}  ${b.completed_roles}/${b.total_roles}  ${bar} ${pct}%`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

function buildRoleTable(batch: BatchRow, roles: RoleRow[]): string {
  // Column widths
  const colNum = 5;
  const colRole = 38;
  const colStatus = 11;
  const colFound = 7;
  const colProgress = 18;

  // Status display map
  const statusLabel = (s: string): string => {
    switch (s) {
      case 'queued':       return 'Queued';
      case 'researching':  return 'Research';
      case 'complete':     return '\u2713 Done';
      case 'failed':       return '\u2717 Failed';
      case 'exporting':    return 'Export';
      case 'submitting':   return 'Submit';
      default:             return s;
    }
  };

  const lines: string[] = [];

  // Top border
  lines.push(
    `\u250C${'\u2500'.repeat(colNum)}\u252C${'\u2500'.repeat(colRole)}\u252C${'\u2500'.repeat(colStatus)}\u252C${'\u2500'.repeat(colFound)}\u252C${'\u2500'.repeat(colProgress)}\u2510`,
  );

  // Header
  lines.push(
    `\u2502${pad('  #', colNum)}\u2502${pad(' Role', colRole)}\u2502${pad(' Status', colStatus)}\u2502${pad(' Found', colFound)}\u2502${pad(' Progress', colProgress)}\u2502`,
  );

  // Header separator
  lines.push(
    `\u251C${'\u2500'.repeat(colNum)}\u253C${'\u2500'.repeat(colRole)}\u253C${'\u2500'.repeat(colStatus)}\u253C${'\u2500'.repeat(colFound)}\u253C${'\u2500'.repeat(colProgress)}\u2524`,
  );

  // Data rows
  let completedCount = 0;
  let researchingCount = 0;
  let queuedCount = 0;
  let failedCount = 0;
  const completedTimes: number[] = [];

  for (const role of roles) {
    const idx = String(role.role_index).padStart(3, ' ');
    const title = truncate(`${role.title} - ${role.location}`, colRole - 2);
    const status = statusLabel(role.status);
    const found = role.status === 'queued' ? '   -' : String(role.candidates_found).padStart(4, ' ');
    const pct = role.progress;
    const bar = progressBar(pct, 12);

    lines.push(
      `\u2502 ${pad(idx, colNum - 1)}\u2502 ${pad(title, colRole - 1)}\u2502 ${pad(status, colStatus - 1)}\u2502 ${pad(found, colFound - 1)}\u2502 ${bar} ${String(pct).padStart(3, ' ')}%\u2502`,
    );

    // Tally counts
    switch (role.status) {
      case 'complete':
        completedCount++;
        if (role.started_at && role.completed_at) {
          const start = new Date(role.started_at).getTime();
          const end = new Date(role.completed_at).getTime();
          if (end > start) completedTimes.push(end - start);
        }
        break;
      case 'researching':
      case 'submitting':
      case 'exporting':
        researchingCount++;
        break;
      case 'failed':
        failedCount++;
        break;
      case 'queued':
        queuedCount++;
        break;
    }
  }

  // Bottom border
  lines.push(
    `\u2514${'\u2500'.repeat(colNum)}\u2534${'\u2500'.repeat(colRole)}\u2534${'\u2500'.repeat(colStatus)}\u2534${'\u2500'.repeat(colFound)}\u2534${'\u2500'.repeat(colProgress)}\u2518`,
  );

  // Summary line
  const totalRoles = roles.length;
  const etaStr = calculateEta(completedTimes, queuedCount + researchingCount);

  const summaryParts: string[] = [];
  summaryParts.push(`${completedCount}/${totalRoles} complete`);
  if (researchingCount > 0) summaryParts.push(`${researchingCount} researching`);
  if (queuedCount > 0) summaryParts.push(`${queuedCount} queued`);
  if (failedCount > 0) summaryParts.push(`${failedCount} failed`);
  summaryParts.push(etaStr);

  lines.push(` Batch: ${summaryParts.join(' \u2502 ')}`);
  lines.push('');

  return lines.join('\n');
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Build a progress bar string of the given width. */
function progressBar(pct: number, width: number): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

/** Pad or truncate a string to a fixed width. */
function pad(str: string, width: number): string {
  if (str.length >= width) return str.slice(0, width);
  return str + ' '.repeat(width - str.length);
}

/** Truncate a string and add ellipsis if needed. */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}

/** Calculate ETA based on average completion time of finished roles. */
function calculateEta(completedTimesMs: number[], remaining: number): string {
  if (completedTimesMs.length === 0 || remaining <= 0) {
    return remaining > 0 ? 'ETA: calculating...' : 'ETA: --';
  }

  const avgMs = completedTimesMs.reduce((a, b) => a + b, 0) / completedTimesMs.length;
  const etaMs = avgMs * remaining;
  const etaHours = etaMs / (1000 * 60 * 60);

  if (etaHours < 0.1) {
    const etaMinutes = etaMs / (1000 * 60);
    return `ETA: ~${etaMinutes.toFixed(0)} minutes`;
  }

  return `ETA: ~${etaHours.toFixed(1)} hours`;
}
