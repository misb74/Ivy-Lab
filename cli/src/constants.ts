import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '../..');
export const MCP_CONFIG = path.join(PROJECT_ROOT, '.mcp.json');
export const TOOL_REFERENCE = path.join(PROJECT_ROOT, 'docs/tool-reference.md');
export const SKILL_REGISTRY = path.join(PROJECT_ROOT, 'gateway/skill-registry.json');
export const SKILLS_DIR = path.join(PROJECT_ROOT, '.claude/skills');
