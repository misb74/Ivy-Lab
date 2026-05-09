import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileManager } from '../src/file-manager.js';
import fs from 'fs';
import path from 'path';

const TEST_DIR = path.join(import.meta.dirname, 'test-uploads');
const PROJECT_DIR = path.join(import.meta.dirname, 'test-project');

describe('FileManager', () => {
  let fm: FileManager;

  beforeEach(() => {
    fm = new FileManager(TEST_DIR, PROJECT_DIR);
    fs.mkdirSync(PROJECT_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
  });

  it('saves a file and returns its path', () => {
    const result = fm.saveUpload('chat1', 'report.pdf', Buffer.from('PDF content'));
    expect(fs.existsSync(result)).toBe(true);
    expect(result).toContain('chat1');
    expect(result).toContain('report.pdf');
  });

  it('extracts file paths from tool results', () => {
    const testFile = path.join(PROJECT_DIR, 'output.pptx');
    fs.writeFileSync(testFile, 'test');

    const result = JSON.stringify({ filePath: testFile, message: 'Created' });
    const paths = fm.extractFilePaths(result);
    expect(paths).toEqual([testFile]);
  });

  it('rejects file paths outside the project directory', () => {
    const result = JSON.stringify({ filePath: '/etc/passwd' });
    const paths = fm.extractFilePaths(result);
    expect(paths).toEqual([]);
  });

  it('cleans up files older than maxAge', async () => {
    const filePath = fm.saveUpload('chat1', 'old.txt', Buffer.from('old'));
    // Set mtime to 2 days ago
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    fs.utimesSync(filePath, twoDaysAgo, twoDaysAgo);

    const cleaned = fm.cleanup(24 * 60 * 60 * 1000); // 24 hours
    expect(cleaned).toBe(1);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('does not clean up recent files', () => {
    fm.saveUpload('chat1', 'new.txt', Buffer.from('new'));
    const cleaned = fm.cleanup(24 * 60 * 60 * 1000);
    expect(cleaned).toBe(0);
  });
});
