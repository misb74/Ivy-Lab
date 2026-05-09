import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeScript, normalizePptxLayout } from '../executor.js';

describe('normalizePptxLayout()', () => {
  it('replaces LAYOUT_WIDE with LAYOUT_16x9', () => {
    const script = `
const pptxgen = require("pptxgenjs");
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
`;
    const result = normalizePptxLayout(script);
    expect(result.normalizedScript).toContain('pres.layout = "LAYOUT_16x9"');
    expect(result.normalizedScript).not.toContain('LAYOUT_WIDE');
    expect(result.warnings.some(w => w.includes('Normalized script layout'))).toBe(true);
  });

  it('injects layout when missing', () => {
    const script = `
import PptxGenJS from "pptxgenjs";
const pres = new PptxGenJS();
pres.author = "Ivy";
`;
    const result = normalizePptxLayout(script);
    expect(result.normalizedScript).toContain('pres.layout = "LAYOUT_16x9";');
    expect(result.warnings.some(w => w.includes('Injected pres.layout'))).toBe(true);
  });

  it('leaves scripts with explicit LAYOUT_16x9 unchanged', () => {
    const script = `
const pptxgen = require("pptxgenjs");
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
`;
    const result = normalizePptxLayout(script);
    expect(result.normalizedScript).toContain('pres.layout = "LAYOUT_16x9"');
    expect(result.warnings).toHaveLength(0);
  });

  it('applies layout normalization in real script execution', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'ivy-layout-norm-'));
    try {
      const script = `
import PptxGenJS from "pptxgenjs";
const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE";
const s = pres.addSlide();
s.addText("Layout normalization test", { x: 0.5, y: 0.5, w: 8, h: 0.8 });
const outPath = process.argv[2] || "presentation.pptx";
await pres.writeFile({ fileName: outPath });
console.log("DONE:" + outPath);
`;

      const result = await executeScript({
        script,
        filename: 'layout_normalization_integration',
        outputDir: outDir,
      });

      expect(result.success).toBe(true);
      expect(result.warnings?.some(w => w.includes('Normalized script layout'))).toBe(true);
      expect(result.filepath).toBeTruthy();
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
