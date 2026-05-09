import fs from 'node:fs/promises';
import path from 'node:path';
import { SKILL_REGISTRY, SKILLS_DIR, PROJECT_ROOT } from '../constants.js';
import type { SkillDef } from '../types.js';

function parseFrontmatter(content: string): { name: string; description: string; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/);
  if (!match) return { name: '', description: '', body: content };

  const fm = match[1];
  const body = match[2];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*(.+)$/m);

  return {
    name: nameMatch?.[1]?.trim() ?? '',
    description: descMatch?.[1]?.trim() ?? '',
    body,
  };
}

async function readSkillFrontmatter(skillPath: string): Promise<{ name: string; description: string }> {
  try {
    const content = await fs.readFile(skillPath, 'utf-8');
    const { name, description } = parseFrontmatter(content);
    return { name, description };
  } catch {
    return { name: '', description: '' };
  }
}

export async function parseSkills(): Promise<SkillDef[]> {
  const registry = JSON.parse(await fs.readFile(SKILL_REGISTRY, 'utf-8'));
  const skills: SkillDef[] = [];

  // Tier 1
  for (const name of registry.tier1 as string[]) {
    const skillPath = path.join(SKILLS_DIR, name, 'SKILL.md');
    const fm = await readSkillFrontmatter(skillPath);
    skills.push({
      name,
      tier: 'tier1',
      triggers: [],
      path: skillPath,
      frontmatter: fm,
    });
  }

  // Tier 2
  for (const [name, cfg] of Object.entries(registry.tier2) as [string, any][]) {
    const skillPath = path.resolve(PROJECT_ROOT, cfg.path);
    const fm = await readSkillFrontmatter(skillPath);
    skills.push({
      name,
      tier: 'tier2',
      triggers: cfg.triggers ?? [],
      path: skillPath,
      frontmatter: fm,
    });
  }

  return skills;
}

export async function loadSkillBody(skill: SkillDef): Promise<string> {
  const content = await fs.readFile(skill.path, 'utf-8');
  const { body } = parseFrontmatter(content);
  return body;
}
