import fs from 'fs';
import path from 'path';
import type { ResearchTask } from '../engine/task-manager.js';

const CACHE_DIR = path.resolve(process.cwd(), 'data', 'research');

export function saveResearchResult(task: ResearchTask): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const filePath = path.join(CACHE_DIR, `${task.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(task, null, 2));
  } catch (error) {
    console.error('Failed to cache research result:', (error as Error).message);
  }
}

export function loadResearchResult(taskId: string): ResearchTask | null {
  try {
    const filePath = path.join(CACHE_DIR, `${taskId}.json`);
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function listCachedResults(): string[] {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    return fs.readdirSync(CACHE_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}
