/**
 * Presentation template types — ported from Auxia's PresentationTemplate dataclass.
 */

export interface PresentationTemplate {
  name: string;           // slug, e.g. "obsidian"
  displayName: string;    // human-readable, e.g. "Obsidian"
  description: string;    // ~20-word mood/personality sentence
  tags: string[];

  /** Verbatim JS `const D = {...}` block */
  designTokens: string;

  /** Prose description of visual personality (3-5 sentences) */
  layoutDna: string;

  /** 3-4 representative JS code snippets showing layout patterns */
  codePatterns: string;

  /** The addFooter() function (verbatim JS) */
  footerPattern: string;

  /** Template-specific quality rules (5-7 bullets) */
  qualityChecklist: string;
}

export interface TemplateSummary {
  name: string;
  displayName: string;
  description: string;
  tags: string[];
}

export interface TemplateDetails {
  name: string;
  displayName: string;
  description: string;
  tags: string[];
  designTokens: string;
  layoutDna: string;
  codePatterns: string;
  footerPattern: string;
  qualityChecklist: string;
  synthesisPrompt: string;
}

export interface ScriptExecutionInput {
  script: string;
  filename?: string;
  outputDir?: string;
}

export interface ScriptExecutionResult {
  success: boolean;
  filepath?: string;
  fileSize?: number;
  executionTimeMs?: number;
  warnings?: string[];
  error?: string;
  scriptPath?: string;
}
