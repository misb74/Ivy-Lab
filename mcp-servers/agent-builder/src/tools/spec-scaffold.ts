import { getDb } from '../db/database.js';
import { generateSystemPrompt } from '../engine/prompt-generator.js';
import { generateScaffold } from '../engine/scaffold-generator.js';
import fs from 'fs';
import path from 'path';

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function specScaffold(params: {
  spec_id: string;
  output_dir?: string;
}) {
  const db = getDb();

  const spec = db.prepare('SELECT * FROM agent_specs WHERE id = ?').get(params.spec_id) as any;
  if (!spec) throw new Error(`Spec "${params.spec_id}" not found`);
  if (!['validated', 'composed'].includes(spec.status)) {
    throw new Error(`Spec status is "${spec.status}" — must be "validated" or "composed" before scaffolding.`);
  }

  const tools = db.prepare('SELECT * FROM spec_tools WHERE spec_id = ? ORDER BY tool_name').all(params.spec_id) as any[];
  const guardrails = db.prepare('SELECT * FROM spec_guardrails WHERE spec_id = ? ORDER BY priority DESC').all(params.spec_id) as any[];
  const tasks = db.prepare('SELECT * FROM spec_tasks WHERE spec_id = ? ORDER BY sequence_order').all(params.spec_id) as any[];
  const criteria = db.prepare('SELECT * FROM spec_success_criteria WHERE spec_id = ?').all(params.spec_id) as any[];

  // Generate system prompt
  const systemPrompt = generateSystemPrompt(spec, tasks, tools, guardrails, criteria);

  // Generate scaffold files
  const files = generateScaffold(spec, tasks, tools, guardrails, criteria, systemPrompt);

  // Determine output directory
  const slug = spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const outputDir = params.output_dir || path.resolve(process.cwd(), '.outputs', 'agents', slug);

  // Write files
  const writtenFiles: string[] = [];
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(outputDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    writtenFiles.push(relPath);
  }

  // Store output manifest
  const now = new Date().toISOString();
  const outputId = genId('output');
  const manifest = {
    output_dir: outputDir,
    files: writtenFiles,
    scaffold_type: 'claude-agent-sdk',
    generated_at: now,
  };

  db.prepare(`
    INSERT INTO spec_outputs (id, spec_id, output_type, content_json, generated_at)
    VALUES (?, ?, 'scaffold', ?, ?)
  `).run(outputId, params.spec_id, JSON.stringify(manifest), now);

  db.prepare("UPDATE agent_specs SET status = 'scaffolded', updated_at = ? WHERE id = ?").run(now, params.spec_id);

  return {
    spec_id: params.spec_id,
    output_id: outputId,
    status: 'scaffolded',
    output_dir: outputDir,
    files: writtenFiles,
    next_steps: [
      `cd ${outputDir}`,
      'pip install -e .',
      'python -m src.agent "Your task here"',
      'Customize src/guardrails.py with your business logic',
      'Add custom tools in src/tools.py',
      'Run tests: pytest tests/',
    ],
  };
}
