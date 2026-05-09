const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
  'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
  'she', 'her', 'they', 'them', 'their', 'what', 'which', 'who',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because',
  'as', 'until', 'while', 'about', 'between', 'through', 'during',
  'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off',
  'over', 'under', 'again', 'further', 'then', 'once',
]);

export function porterStem(word: string): string {
  if (word.length < 3) return word;
  let stem = word;

  // Step 1a
  if (stem.endsWith('sses')) stem = stem.slice(0, -2);
  else if (stem.endsWith('ies')) stem = stem.slice(0, -2);
  else if (!stem.endsWith('ss') && stem.endsWith('s')) stem = stem.slice(0, -1);

  // Step 1b
  if (stem.endsWith('eed')) {
    if (stem.slice(0, -3).match(/[aeiouy]/)) stem = stem.slice(0, -1);
  } else if (stem.endsWith('ed') && stem.slice(0, -2).match(/[aeiouy]/)) {
    stem = stem.slice(0, -2);
    if (stem.endsWith('at') || stem.endsWith('bl') || stem.endsWith('iz')) stem += 'e';
  } else if (stem.endsWith('ing') && stem.slice(0, -3).match(/[aeiouy]/)) {
    stem = stem.slice(0, -3);
    if (stem.endsWith('at') || stem.endsWith('bl') || stem.endsWith('iz')) stem += 'e';
  }

  // Step 1c
  if (stem.endsWith('y') && stem.slice(0, -1).match(/[aeiouy]/)) {
    stem = stem.slice(0, -1) + 'i';
  }

  // Step 2 (simplified)
  const step2Map: Record<string, string> = {
    ational: 'ate', tional: 'tion', enci: 'ence', anci: 'ance',
    izer: 'ize', isation: 'ize', ization: 'ize', ation: 'ate',
    ator: 'ate', alism: 'al', iveness: 'ive', fulness: 'ful',
    ousness: 'ous', aliti: 'al', iviti: 'ive', biliti: 'ble',
  };
  for (const [suffix, replacement] of Object.entries(step2Map)) {
    if (stem.endsWith(suffix)) {
      stem = stem.slice(0, -suffix.length) + replacement;
      break;
    }
  }

  return stem;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
    .map(porterStem);
}
