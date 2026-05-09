/**
 * Standalone seed script: npx tsx src/seed.ts [path-to-skills_data.json]
 * Defaults to /Users/moraybrown/Desktop/Skills_Master/skills_data.json
 */
import fs from 'fs';
import { getDb, seed, isSeeded, type SkillRow } from './database.js';

const jsonPath = process.argv[2] || '/Users/moraybrown/Desktop/Skills_Master/skills_data.json';

if (!fs.existsSync(jsonPath)) {
  console.error(`File not found: ${jsonPath}`);
  process.exit(1);
}

const data: SkillRow[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
console.log(`Loaded ${data.length} skills from ${jsonPath}`);

// Force reseed
getDb().exec('DELETE FROM skills');
seed(data);

const count = (getDb().prepare('SELECT COUNT(*) as c FROM skills').get() as { c: number }).c;
const ftsCount = (getDb().prepare('SELECT COUNT(*) as c FROM skills_fts').get() as { c: number }).c;
console.log(`Seeded: ${count} skills, ${ftsCount} FTS entries`);

process.exit(0);
