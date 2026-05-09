import crypto from 'crypto';
import type { AtsJob, AtsSystem } from './types.js';

const COMPANY_SUFFIXES = /\b(inc|inc\.|ltd|ltd\.|limited|plc|corp|corp\.|corporation|company|co|co\.|group|holdings)\b/gi;

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(COMPANY_SUFFIXES, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function slugCandidates(companyName: string, explicit?: string): string[] {
  const base = normalizeCompanyName(explicit || companyName);
  const collapsed = base.replace(/\s+/g, '');
  const dashed = base.replace(/\s+/g, '-');
  const underscored = base.replace(/\s+/g, '_');
  return Array.from(new Set([explicit, collapsed, dashed, underscored].filter(Boolean) as string[]));
}

export function inferSourceFromUrl(rawUrl?: string): { system?: AtsSystem; slug?: string; careers_url?: string } {
  if (!rawUrl) return {};
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);

    if (host.includes('greenhouse.io')) {
      const idx = parts.findIndex((p) => p === 'boards');
      return { system: 'greenhouse', slug: idx >= 0 ? parts[idx + 1] : parts[0], careers_url: rawUrl };
    }
    if (host.includes('lever.co')) return { system: 'lever', slug: parts[0], careers_url: rawUrl };
    if (host.includes('ashbyhq.com')) return { system: 'ashby', slug: parts[0], careers_url: rawUrl };
    if (host.includes('smartrecruiters.com')) return { system: 'smartrecruiters', slug: parts[0], careers_url: rawUrl };
    if (host.includes('workable.com')) return { system: 'workable', slug: parts[0], careers_url: rawUrl };
    if (host.includes('breezy.hr')) return { system: 'breezy', slug: host.split('.')[0], careers_url: rawUrl };
    if (host.includes('recruitee.com')) return { system: 'recruitee', slug: host.split('.')[0], careers_url: rawUrl };
  } catch {
    return {};
  }
  return {};
}

export function sha256(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

export function htmlToText(html?: string | null): string | null {
  if (!html) return null;
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function compactText(value?: string | null, max = 5000): string | null {
  if (!value) return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

export function jobKey(system: AtsSystem, sourceSlug: string, job: AtsJob): string {
  return sha256([
    system,
    sourceSlug,
    job.external_id || '',
    job.url || '',
    job.title || '',
    job.location || '',
  ].join('|'));
}

export function inferSeniority(title: string): string {
  const t = title.toLowerCase();
  if (/\b(intern|graduate|entry|junior|associate)\b/.test(t)) return 'early';
  if (/\b(senior|sr\.?|principal|staff|lead)\b/.test(t)) return 'senior';
  if (/\b(manager|head|director|vp|vice president|chief|cxo|executive)\b/.test(t)) return 'leadership';
  return 'mid';
}

export function matchesTerms(job: AtsJob | { title: string; description_text?: string | null; department?: string | null }, terms?: string[]): boolean {
  if (!terms || terms.length === 0) return true;
  const haystack = [
    job.title,
    job.department || '',
    'description_text' in job ? job.description_text || '' : '',
  ].join(' ').toLowerCase();
  return terms.some((term) => haystack.includes(term.toLowerCase()));
}

export function termsFromQuery(query?: string): string[] {
  if (!query) return [];
  const q = query.toLowerCase();
  const terms = new Set<string>();
  if (/\b(ai|artificial intelligence|machine learning|ml|genai|generative)\b/.test(q)) {
    [
      'ai',
      'artificial intelligence',
      'machine learning',
      'ml',
      'generative ai',
      'data science',
      'deep learning',
      'nlp',
      'computer vision',
      'llm',
      'language model',
    ].forEach((t) => terms.add(t));
  }
  for (const quoted of q.matchAll(/"([^"]+)"/g)) terms.add(quoted[1]);
  for (const token of q.split(/[^a-z0-9+#.]+/).filter((t) => t.length >= 4)) {
    if (!['what', 'show', 'company', 'companies', 'talent', 'building', 'hiring', 'strategy'].includes(token)) {
      terms.add(token);
    }
  }
  return Array.from(terms).slice(0, 20);
}
