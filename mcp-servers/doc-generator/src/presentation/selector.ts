/**
 * Template Selector
 *
 * Keyword-based template suggestion. No LLM call — Claude (the caller)
 * can use its own judgment after seeing the template list.
 */

import { listTemplates, getTemplate } from './registry.js';
import type { TemplateSummary } from './types.js';

// ---------------------------------------------------------------------------
// Backward-compatibility aliases (old name → new name)
// ---------------------------------------------------------------------------

const TEMPLATE_ALIASES: Record<string, string> = {
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

/**
 * Tag-to-keyword affinity map. When a topic matches a keyword,
 * we score templates that have the corresponding tag higher.
 */
const TAG_KEYWORDS: Record<string, string[]> = {
  // Unchanged (12)
  dark:          ['executive', 'night', 'dark', 'premium', 'luxury'],
  light:         ['consulting', 'corporate', 'professional', 'clean', 'bright'],
  luxury:        ['luxury', 'premium', 'gold', 'high-end', 'vip'],
  bold:          ['keynote', 'bold', 'impact', 'launch', 'announcement'],
  vibrant:       ['future', 'innovation', 'futuristic', 'startup', 'disrupt'],
  warm:          ['benchmark', 'maturity', 'industrial', 'manufacturing', 'operations'],
  minimal:       ['minimal', 'simple', 'clean', 'annual', 'swiss', 'typography'],
  organic:       ['employee', 'experience', 'wellbeing', 'culture', 'people', 'initiative'],
  editorial:     ['report', 'editorial', 'magazine', 'journal', 'publication'],
  magazine:      ['outlook', 'intelligence', 'briefing', 'digest'],
  pink:          ['diversity', 'inclusion', 'dei', 'equity', 'belonging'],
  blue:          ['board', 'governance', 'compliance', 'risk'],
  // Expanded (3)
  consulting:    ['consulting', 'strategy', 'framework', 'mckinsey', 'bcg', 'advisory', 'proposal', 'pitch', 'deliverable', 'client'],
  tech:          ['tech', 'software', 'engineering', 'dashboard', 'api', 'data', 'ai', 'ml', 'architecture', 'infrastructure', 'devops', 'cloud', 'saas'],
  framework:     ['swot', 'framework', 'process', 'rubric', 'scorecard', 'assessment', 'matrix', 'scorecard', 'heatmap', 'quadrant'],
  // New (7)
  retrospective: ['sprint', 'retro', 'retrospective', 'lessons-learned', 'postmortem', 'review', 'plus-delta'],
  people:        ['people', 'hr', 'talent', 'workforce', 'employee', 'headcount', 'attrition', 'engagement', 'hiring'],
  competitive:   ['competitive', 'competitor', 'battlecard', 'win-loss', 'market-share', 'positioning', 'benchmark'],
  risk:          ['risk', 'compliance', 'audit', 'control', 'incident', 'mitigation', 'kri', 'soc', 'gdpr', 'iso'],
  process:       ['operations', 'process', 'lean', 'six-sigma', 'value-stream', 'kaizen', 'waste', 'efficiency', 'pareto'],
  academic:      ['research', 'academic', 'thesis', 'paper', 'abstract', 'methodology', 'peer-review', 'citation'],
  financial:     ['financial', 'finance', 'p&l', 'revenue', 'budget', 'forecast', 'earnings', 'quarter', 'balance-sheet', 'cfo'],
};

/**
 * Suggest the best template(s) for a given topic string.
 * Returns summaries sorted by affinity score (descending).
 */
export function suggestTemplate(topic: string): TemplateSummary[] {
  const topicLower = topic.toLowerCase();
  const templates = listTemplates();

  // Score each template by keyword affinity
  const scored = templates.map(t => {
    let score = 0;
    for (const tag of t.tags) {
      const keywords = TAG_KEYWORDS[tag];
      if (!keywords) continue;
      for (const kw of keywords) {
        if (topicLower.includes(kw)) {
          score += 1;
        }
      }
    }
    return { template: t, score };
  });

  // Sort by score descending, keep all (caller decides)
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.template);
}

/**
 * Check if a topic string contains an explicit template name.
 * Supports both new names and legacy aliases.
 */
export function scanForTemplateName(text: string): string | null {
  const textLower = text.toLowerCase();
  const templates = listTemplates();

  // Check current template names first
  for (const t of templates) {
    const regex = new RegExp(`\\b${t.name.replace('-', '[-\\s]?')}\\b`);
    if (regex.test(textLower)) {
      return t.name;
    }
  }

  // Check legacy aliases as fallback
  for (const [alias, resolved] of Object.entries(TEMPLATE_ALIASES)) {
    const regex = new RegExp(`\\b${alias}\\b`);
    if (regex.test(textLower)) {
      return resolved;
    }
  }

  return null;
}
