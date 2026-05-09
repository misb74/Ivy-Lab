import { randomUUID } from 'crypto';
import { getDatabase } from '../db/database.js';
import { storeEmbedToken, type EmbedData } from '../engine/embed-generator.js';

export interface ExportEmbedCodeParams {
  title: string;
  content: string;
  type: string;
  styles?: string;
  expiresInHours?: number;
}

export function exportEmbedCode(params: ExportEmbedCodeParams) {
  const { title, content, type, styles, expiresInHours = 72 } = params;
  const db = getDatabase();

  // Create an export record for tracking
  const exportId = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO exports (id, type, title, source_data, format, status, created_at, completed_at)
    VALUES (?, ?, ?, ?, 'embed', 'completed', ?, ?)
  `).run(
    exportId,
    type,
    title,
    JSON.stringify({ content, styles }),
    createdAt,
    createdAt
  );

  // Generate embed token and HTML
  const embedData: EmbedData = {
    title,
    content,
    styles,
  };

  const embedResult = storeEmbedToken(exportId, embedData, expiresInHours);

  return {
    exportId,
    tokenId: embedResult.tokenId,
    token: embedResult.token,
    embedCode: embedResult.embedCode,
    expiresAt: embedResult.expiresAt,
    title,
    type,
    createdAt,
  };
}
