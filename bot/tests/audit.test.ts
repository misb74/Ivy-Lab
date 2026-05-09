import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditLogger } from '../src/audit.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(path.dirname(new URL(import.meta.url).pathname), 'test-audit.db');

describe('AuditLogger', () => {
  let audit: AuditLogger;

  beforeEach(() => {
    audit = new AuditLogger(TEST_DB);
  });

  afterEach(() => {
    audit.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('logs a tool call and retrieves it', () => {
    audit.log({
      chatId: 'chat1',
      toolName: 'skills_extract',
      toolInput: { text: 'Python developer' },
      success: true,
      resultSummary: '{"skills": ["Python"]}',
      executionTimeMs: 150,
    });

    const entries = audit.query();
    expect(entries).toHaveLength(1);
    expect(entries[0].tool_name).toBe('skills_extract');
    expect(entries[0].success).toBe(1);
    expect(entries[0].execution_time_ms).toBe(150);
  });

  it('detects protected attributes in tool input', () => {
    audit.log({
      chatId: 'chat1',
      toolName: 'candidate_match',
      toolInput: { query: 'filter by gender and age over 40' },
      success: true,
      resultSummary: '...',
      executionTimeMs: 200,
    });

    const entries = audit.query();
    const attrs = JSON.parse(entries[0].protected_attributes_detected);
    expect(attrs).toContain('gender');
    expect(attrs).toContain('age');
  });

  it('stores null for protected_attributes when none detected', () => {
    audit.log({
      chatId: 'chat1',
      toolName: 'skills_extract',
      toolInput: { text: 'Python developer' },
      success: true,
      resultSummary: '...',
      executionTimeMs: 100,
    });

    const entries = audit.query();
    expect(entries[0].protected_attributes_detected).toBeNull();
  });

  it('truncates result_summary to 500 chars', () => {
    const longResult = 'x'.repeat(1000);
    audit.log({
      chatId: 'chat1',
      toolName: 'send_email',
      toolInput: {},
      success: true,
      resultSummary: longResult,
      executionTimeMs: 50,
    });

    const entries = audit.query();
    expect(entries[0].result_summary.length).toBeLessThanOrEqual(503); // 500 + '...'
  });

  it('filters by tool_name', () => {
    audit.log({ chatId: 'c1', toolName: 'send_email', toolInput: {}, success: true, resultSummary: '', executionTimeMs: 10 });
    audit.log({ chatId: 'c1', toolName: 'skills_extract', toolInput: {}, success: true, resultSummary: '', executionTimeMs: 10 });

    const entries = audit.query({ toolName: 'send_email' });
    expect(entries).toHaveLength(1);
    expect(entries[0].tool_name).toBe('send_email');
  });
});
