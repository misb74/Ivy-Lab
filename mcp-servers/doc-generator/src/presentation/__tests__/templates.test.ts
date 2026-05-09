import { describe, it, expect } from 'vitest';
import { listTemplates, getTemplate, getTemplateNames, buildSynthesisPrompt } from '../registry.js';
import { suggestTemplate, scanForTemplateName } from '../selector.js';

// ---------------------------------------------------------------------------
// 1. Template registry counts
// ---------------------------------------------------------------------------

describe('Template registry', () => {
  it('listTemplates() returns exactly 20 templates', () => {
    const templates = listTemplates();
    expect(templates).toHaveLength(20);
  });

  it('getTemplateNames() returns 30 entries (20 real + 10 aliases)', () => {
    const names = getTemplateNames();
    expect(names).toHaveLength(30);
  });

  it('all 20 template names are present', () => {
    const names = getTemplateNames();
    const expected = [
      'apex', 'prism', 'folio', 'volt', 'nexus',
      'atlas', 'forge', 'terrain', 'helix', 'cedar',
      'nimbus', 'solstice', 'graphite', 'aurora-borealis', 'sandstone',
      'cobalt', 'mosaic', 'circuit', 'dusk', 'silk',
    ];
    for (const name of expected) {
      expect(names).toContain(name);
    }
  });

  it('all 10 legacy aliases are present in getTemplateNames()', () => {
    const names = getTemplateNames();
    const aliases = [
      'obsidian', 'ivory', 'slate', 'ember', 'aurora',
      'copper', 'onyx', 'meridian', 'rosewood', 'carbon',
    ];
    for (const alias of aliases) {
      expect(names).toContain(alias);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. getTemplate() returns non-null with valid synthesisPrompt for all 20
// ---------------------------------------------------------------------------

describe('getTemplate()', () => {
  const templateNames = [
    'apex', 'prism', 'folio', 'volt', 'nexus',
    'atlas', 'forge', 'terrain', 'helix', 'cedar',
    'nimbus', 'solstice', 'graphite', 'aurora-borealis', 'sandstone',
    'cobalt', 'mosaic', 'circuit', 'dusk', 'silk',
  ];

  it.each(templateNames)('getTemplate("%s") returns non-null with synthesisPrompt', (name) => {
    const details = getTemplate(name);
    expect(details).not.toBeNull();
    expect(details!.synthesisPrompt).toBeTruthy();
    expect(details!.synthesisPrompt.length).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// 3. All 10 aliases resolve correctly
// ---------------------------------------------------------------------------

describe('Template aliases', () => {
  const aliasMap: Record<string, string> = {
    obsidian: 'apex',
    ivory: 'silk',
    slate: 'helix',
    ember: 'volt',
    aurora: 'aurora-borealis',
    copper: 'sandstone',
    onyx: 'graphite',
    meridian: 'nimbus',
    rosewood: 'solstice',
    carbon: 'folio',
  };

  it.each(Object.entries(aliasMap))('alias "%s" resolves to "%s"', (alias, expected) => {
    const details = getTemplate(alias);
    expect(details).not.toBeNull();
    expect(details!.name).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 4. Every template has valid structure
// ---------------------------------------------------------------------------

describe('Template structure validation', () => {
  const templates = listTemplates();

  it.each(templates.map(t => t.name))('template "%s" has valid structure', (name) => {
    const details = getTemplate(name);
    expect(details).not.toBeNull();

    // designTokens contains "const D"
    expect(details!.designTokens).toContain('const D');

    // At least 3 tags
    expect(details!.tags.length).toBeGreaterThanOrEqual(3);

    // Non-empty fields
    expect(details!.layoutDna.length).toBeGreaterThan(20);
    expect(details!.codePatterns.length).toBeGreaterThan(50);
    expect(details!.footerPattern.length).toBeGreaterThan(0);
    expect(details!.qualityChecklist.length).toBeGreaterThan(20);

    // displayName is non-empty
    expect(details!.displayName.length).toBeGreaterThan(0);

    // description is roughly 10-30 words
    const wordCount = details!.description.split(/\s+/).length;
    expect(wordCount).toBeGreaterThanOrEqual(5);
    expect(wordCount).toBeLessThanOrEqual(40);
  });
});

// ---------------------------------------------------------------------------
// 5. suggestTemplate() returns correct first-match for use-case queries
// ---------------------------------------------------------------------------

describe('suggestTemplate()', () => {
  const testCases: [string, string[]][] = [
    ['executive dark luxury keynote', ['apex']],
    ['tech dashboard software engineering', ['helix', 'circuit', 'prism']],
    ['consulting strategy framework', ['nexus', 'silk', 'atlas']],
    ['employee experience people culture', ['cedar', 'solstice', 'terrain', 'mosaic']],
    ['risk compliance audit', ['dusk']],
    ['financial p&l revenue quarterly', ['cobalt', 'nimbus', 'atlas']],
    ['operations process lean six-sigma', ['sandstone', 'forge']],
    ['sprint retrospective review', ['circuit']],
    ['diversity inclusion dei equity', ['solstice', 'mosaic']],
    ['annual report minimal typography', ['folio']],
  ];

  it.each(testCases)('topic "%s" suggests one of %s as top result', (topic, expectedNames) => {
    const results = suggestTemplate(topic);
    expect(results.length).toBeGreaterThan(0);
    // The top result should be one of the expected templates
    expect(expectedNames).toContain(results[0].name);
  });
});

// ---------------------------------------------------------------------------
// 6. scanForTemplateName() finds new names and resolves old names
// ---------------------------------------------------------------------------

describe('scanForTemplateName()', () => {
  it('finds new template names in text', () => {
    expect(scanForTemplateName('Please use the apex template')).toBe('apex');
    expect(scanForTemplateName('Generate with helix design')).toBe('helix');
    expect(scanForTemplateName('I want aurora-borealis style')).toBe('aurora-borealis');
    expect(scanForTemplateName('Use circuit for this')).toBe('circuit');
  });

  it('resolves old template names via aliases', () => {
    expect(scanForTemplateName('Use the obsidian template')).toBe('apex');
    expect(scanForTemplateName('I want ivory style')).toBe('silk');
    expect(scanForTemplateName('Generate with slate')).toBe('helix');
    expect(scanForTemplateName('Use ember for keynote')).toBe('volt');
    expect(scanForTemplateName('Apply carbon design')).toBe('folio');
  });

  it('returns null for no match', () => {
    expect(scanForTemplateName('Make a presentation about cats')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. buildSynthesisPrompt() conditional sections
// ---------------------------------------------------------------------------

describe('buildSynthesisPrompt() conditionals', () => {
  it('includes shadow factory for templates with shadow in codePatterns', () => {
    const apex = getTemplate('apex');
    if (apex && /shadow/i.test(apex.codePatterns)) {
      expect(apex.synthesisPrompt).toContain('makeShadow');
    }
  });

  it('skips shadow factory for flat-design templates like volt', () => {
    const volt = getTemplate('volt');
    expect(volt).not.toBeNull();
    // Volt is flat design — if codePatterns has no shadow, synthesis prompt should skip it
    if (volt && !/shadow/i.test(volt.codePatterns)) {
      expect(volt.synthesisPrompt).not.toContain('const makeShadow');
    }
  });

  it('includes combo chart guidance for templates that need it', () => {
    const sandstone = getTemplate('sandstone');
    expect(sandstone).not.toBeNull();
    // Sandstone has Pareto chart (BAR+LINE combo)
    if (sandstone && /pareto|BAR.*LINE|combo/i.test(sandstone.codePatterns + ' ' + sandstone.layoutDna)) {
      expect(sandstone.synthesisPrompt).toContain('Combo Chart');
    }
  });

  it('includes chart styling guidance for templates that use charts', () => {
    const apex = getTemplate('apex');
    expect(apex).not.toBeNull();
    if (apex && /addChart|pres\.charts/i.test(apex.codePatterns + ' ' + apex.layoutDna)) {
      expect(apex.synthesisPrompt).toContain('Chart Styling Defaults');
    }
  });

  it('skips chart styling guidance for templates without charts', () => {
    const terrain = getTemplate('terrain');
    expect(terrain).not.toBeNull();
    if (terrain && !/addChart|pres\.charts/i.test(terrain.codePatterns + ' ' + terrain.layoutDna)) {
      expect(terrain.synthesisPrompt).not.toContain('Chart Styling Defaults');
    }
  });

  it('includes image sizing guidance for templates using icons', () => {
    const circuit = getTemplate('circuit');
    expect(circuit).not.toBeNull();
    if (circuit && /renderIcon|icon/i.test(circuit.codePatterns)) {
      expect(circuit.synthesisPrompt).toContain('Image Sizing Modes');
    }
  });

  it('skips image sizing guidance for templates without icons', () => {
    const apex = getTemplate('apex');
    expect(apex).not.toBeNull();
    if (apex && !/renderIcon|icon/i.test(apex.codePatterns)) {
      expect(apex.synthesisPrompt).not.toContain('Image Sizing Modes');
    }
  });

  it('all synthesis prompts contain critical pptxgenjs rules', () => {
    const names = [
      'apex', 'prism', 'folio', 'volt', 'nexus',
      'atlas', 'forge', 'terrain', 'helix', 'cedar',
      'nimbus', 'solstice', 'graphite', 'aurora-borealis', 'sandstone',
      'cobalt', 'mosaic', 'circuit', 'dusk', 'silk',
    ];
    for (const name of names) {
      const details = getTemplate(name);
      expect(details).not.toBeNull();
      expect(details!.synthesisPrompt).toContain('Critical pptxgenjs Rules');
      expect(details!.synthesisPrompt).toContain('Colors WITHOUT # prefix');
      expect(details!.synthesisPrompt).toContain('Use charSpacing not letterSpacing');
      expect(details!.synthesisPrompt).toContain('Use pres.layout = "LAYOUT_16x9"');
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Template code pattern safety guards
// ---------------------------------------------------------------------------

describe('Template code pattern safety guards', () => {
  const names = [
    'apex', 'prism', 'folio', 'volt', 'nexus',
    'atlas', 'forge', 'terrain', 'helix', 'cedar',
    'nimbus', 'solstice', 'graphite', 'aurora-borealis', 'sandstone',
    'cobalt', 'mosaic', 'circuit', 'dusk', 'silk',
  ];

  it('contains no deprecated letterSpacing usage', () => {
    for (const name of names) {
      const details = getTemplate(name);
      expect(details).not.toBeNull();
      expect(details!.codePatterns).not.toContain('letterSpacing');
    }
  });

  it('contains no unicode bullet prefix "• "', () => {
    for (const name of names) {
      const details = getTemplate(name);
      expect(details).not.toBeNull();
      expect(details!.codePatterns).not.toContain('"• "');
    }
  });

  it('contains no quoted 8-char hex colors', () => {
    const eightHex = /["'][0-9A-Fa-f]{8}["']/;
    for (const name of names) {
      const details = getTemplate(name);
      expect(details).not.toBeNull();
      expect(eightHex.test(details!.codePatterns)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. No duplicate template names
// ---------------------------------------------------------------------------

describe('Template uniqueness', () => {
  it('all template names are unique', () => {
    const templates = listTemplates();
    const names = templates.map(t => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('all template displayNames are unique', () => {
    const templates = listTemplates();
    const names = templates.map(t => t.displayName);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
