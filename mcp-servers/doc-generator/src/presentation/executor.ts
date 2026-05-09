/**
 * Script Executor
 *
 * Sandboxed node subprocess execution for pptxgenjs scripts.
 * Ported from Auxia's _generate_pptx() method.
 */

import { execFile } from 'node:child_process';
import { writeFile, unlink, mkdir, stat } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ScriptExecutionInput, ScriptExecutionResult } from './types.js';

/** Max script size: 200KB */
const MAX_SCRIPT_SIZE = 200 * 1024;

/** Hard timeout: 60 seconds */
const EXECUTION_TIMEOUT_MS = 60_000;

/** Default workspace for temp scripts */
const WORKSPACE = join(process.env.HOME ?? '/tmp', '.ivy', 'workspace');
const TARGET_LAYOUT = 'LAYOUT_16x9';

interface LayoutNormalizationResult {
  normalizedScript: string;
  warnings: string[];
}

/**
 * Enforce 10x5.625 layout because template coordinates are authored in LAYOUT_16x9 units.
 * This prevents the common "everything is 75% size" issue when scripts use LAYOUT_WIDE.
 */
export function normalizePptxLayout(script: string): LayoutNormalizationResult {
  const warnings: string[] = [];
  let normalizedScript = script;

  // Normalize any explicit wide-layout assignments.
  const wideLayoutPattern = /(\b[A-Za-z_$][\w$]*\s*\.\s*layout\s*=\s*)['"]LAYOUT_WIDE['"]/g;
  if (wideLayoutPattern.test(normalizedScript)) {
    normalizedScript = normalizedScript.replace(wideLayoutPattern, `$1"${TARGET_LAYOUT}"`);
    warnings.push(`Normalized script layout from LAYOUT_WIDE to ${TARGET_LAYOUT}.`);
  }

  // If no layout is set, inject one after the first pptx instance construction.
  const constructorMatch = normalizedScript.match(
    /(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+[A-Za-z_$][\w$]*\s*\([^)]*\)\s*;?/
  );

  if (constructorMatch) {
    const instanceVar = constructorMatch[2];
    const hasLayoutAssignment = new RegExp(`\\b${instanceVar}\\s*\\.\\s*layout\\s*=`).test(normalizedScript);

    if (!hasLayoutAssignment) {
      const injectLine = `${instanceVar}.layout = "${TARGET_LAYOUT}";`;
      normalizedScript = normalizedScript.replace(constructorMatch[0], `${constructorMatch[0]}\n  ${injectLine}`);
      warnings.push(`Injected ${injectLine} to preserve template coordinate scaling.`);
    }
  }

  return { normalizedScript, warnings };
}

/**
 * Resolve the node_modules path. Looks for pptxgenjs in the project's
 * own node_modules first, falling back to the doc-generator's node_modules.
 */
function resolveNodeModulesPath(): string {
  // Walk up from this file to find the project root's node_modules
  // This file is at: .../doc-generator/src/presentation/executor.ts
  // Project node_modules: .../doc-generator/node_modules (or monorepo root)
  const docGeneratorRoot = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
  const monorepoRoot = resolve(docGeneratorRoot, '..', '..');

  // Prefer monorepo root (where pptxgenjs is likely installed)
  return join(monorepoRoot, 'node_modules');
}

/**
 * Execute a pptxgenjs script via a sandboxed node subprocess.
 */
export async function executeScript(input: ScriptExecutionInput): Promise<ScriptExecutionResult> {
  const { script, filename, outputDir } = input;
  const preflightWarnings: string[] = [];

  const { normalizedScript, warnings: normalizationWarnings } = normalizePptxLayout(script);
  preflightWarnings.push(...normalizationWarnings);

  // --- Validate script size ---
  if (Buffer.byteLength(normalizedScript, 'utf-8') > MAX_SCRIPT_SIZE) {
    return { success: false, error: `Script exceeds maximum size of ${MAX_SCRIPT_SIZE} bytes` };
  }

  // --- Build output path ---
  const outDir = outputDir ? resolve(outputDir) : resolve(process.cwd(), '.outputs');
  await mkdir(outDir, { recursive: true });

  const safeFilename = (filename ?? 'presentation')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/ /g, '_')
    .slice(0, 80) || 'presentation';
  const pptxPath = join(outDir, `${safeFilename}.pptx`);

  // --- Write temp script ---
  await mkdir(WORKSPACE, { recursive: true });
  const scriptPath = join(WORKSPACE, `${safeFilename}_${randomUUID().slice(0, 8)}.mjs`);
  await writeFile(scriptPath, normalizedScript, 'utf-8');

  const startTime = Date.now();

  try {
    const result = await new Promise<ScriptExecutionResult>((resolvePromise) => {
      const env = { ...process.env, NODE_PATH: resolveNodeModulesPath() };

      const child = execFile('node', [scriptPath, pptxPath], {
        env,
        timeout: EXECUTION_TIMEOUT_MS,
        maxBuffer: 5 * 1024 * 1024, // 5MB stdout/stderr buffer
      }, async (error, stdout, stderr) => {
        const executionTimeMs = Date.now() - startTime;
        const stdoutText = stdout?.trim() ?? '';
        const stderrText = stderr?.trim() ?? '';

        if (error) {
          const errorMsg = stderrText || stdoutText || error.message;
          resolvePromise({
            success: false,
            error: `Script execution failed: ${errorMsg}`,
            scriptPath,
            executionTimeMs,
            warnings: preflightWarnings.length > 0 ? preflightWarnings : undefined,
          });
          return;
        }

        // Check if the PPTX was actually created
        try {
          const stats = await stat(pptxPath);
          const warnings: string[] = [];

          // Check for DONE protocol
          if (stdoutText.includes('DONE:')) {
            // Success
          } else {
            warnings.push('Script did not print DONE:<path> protocol message');
          }

          // Check for stderr warnings (non-fatal)
          if (stderrText && !stderrText.includes('ERROR:')) {
            warnings.push(`stderr: ${stderrText.slice(0, 500)}`);
          }

          warnings.unshift(...preflightWarnings);

          resolvePromise({
            success: true,
            filepath: pptxPath,
            fileSize: stats.size,
            executionTimeMs,
            warnings: warnings.length > 0 ? warnings : undefined,
          });
        } catch {
          resolvePromise({
            success: false,
            error: 'PPTX file was not created',
            scriptPath,
            executionTimeMs,
            warnings: preflightWarnings.length > 0 ? preflightWarnings : undefined,
          });
        }
      });
    });

    // Clean up script on success, keep on failure for debugging
    if (result.success) {
      try { await unlink(scriptPath); } catch { /* ignore */ }
    }

    return result;
  } catch (err) {
    return {
      success: false,
      error: `Unexpected error: ${(err as Error).message}`,
      scriptPath,
      executionTimeMs: Date.now() - startTime,
    };
  }
}
