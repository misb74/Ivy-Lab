import path from 'path';

const PROJECTS_DIR = path.resolve(process.cwd(), 'data', 'projects');

const ALLOWED_COMMANDS = new Set([
  'npm', 'npx', 'node', 'python3', 'pip3',
  'git', 'ls', 'mkdir', 'cp', 'mv', 'cat', 'echo',
  'which', 'pwd', 'env',
]);

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//,
  /sudo/,
  /chmod\s+777/,
  /curl\s.*\|\s*sh/,
  /wget\s.*\|\s*sh/,
  /\beval\b/,
  /\bexec\b/,
  />\s*\/etc\//,
  />\s*\/usr\//,
  />\s*\/bin\//,
  /;\s*rm\s/,
  /&&\s*rm\s/,
];

export function validateCommand(command: string): { valid: boolean; reason?: string } {
  // Check blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return { valid: false, reason: `Command matches blocked pattern: ${pattern.source}` };
    }
  }

  // Extract base command
  const baseCommand = command.trim().split(/\s+/)[0];
  const commandName = path.basename(baseCommand);

  if (!ALLOWED_COMMANDS.has(commandName)) {
    return { valid: false, reason: `Command "${commandName}" is not in the allowlist. Allowed: ${[...ALLOWED_COMMANDS].join(', ')}` };
  }

  return { valid: true };
}

export function getProjectDir(projectName: string): string {
  // Sanitize project name
  const sanitized = projectName.replace(/[^a-zA-Z0-9_-]/g, '-');
  return path.join(PROJECTS_DIR, sanitized);
}

export function isInsideProjectsDir(dirPath: string): boolean {
  const resolved = path.resolve(dirPath);
  return resolved.startsWith(PROJECTS_DIR);
}

export { PROJECTS_DIR };
