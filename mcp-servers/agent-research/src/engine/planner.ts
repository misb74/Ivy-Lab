export function generateSubQuestions(
  query: string,
  depth: 'quick' | 'standard' | 'deep'
): string[] {
  const baseQuestions = [query];

  if (depth === 'quick') {
    return baseQuestions;
  }

  // Template-based question decomposition
  const patterns: Array<{ match: RegExp; questions: (q: string) => string[] }> = [
    {
      match: /^(what|who|which)\s+(is|are)\s+(.+)/i,
      questions: (q) => [
        q,
        `history of ${q.replace(/^(what|who|which)\s+(is|are)\s+/i, '')}`,
        `examples of ${q.replace(/^(what|who|which)\s+(is|are)\s+/i, '')}`,
      ],
    },
    {
      match: /compare|vs|versus|difference/i,
      questions: (q) => [
        q,
        `${q} advantages`,
        `${q} disadvantages`,
        `${q} use cases`,
      ],
    },
    {
      match: /how\s+to|guide|tutorial/i,
      questions: (q) => [
        q,
        `${q} best practices`,
        `${q} common mistakes`,
        `${q} tools and resources`,
      ],
    },
    {
      match: /best|top|leading|popular/i,
      questions: (q) => [
        q,
        `${q} comparison`,
        `${q} reviews`,
        `${q} alternatives`,
      ],
    },
    {
      match: /trend|future|prediction|forecast/i,
      questions: (q) => [
        q,
        `${q} current state`,
        `${q} expert opinions`,
        `${q} data and statistics`,
      ],
    },
  ];

  for (const pattern of patterns) {
    if (pattern.match.test(query)) {
      const questions = pattern.questions(query);
      return depth === 'deep' ? questions : questions.slice(0, 3);
    }
  }

  // Default decomposition
  const defaultQuestions = [
    query,
    `${query} overview`,
    `${query} latest developments`,
  ];

  if (depth === 'deep') {
    defaultQuestions.push(
      `${query} expert analysis`,
      `${query} statistics and data`,
    );
  }

  return defaultQuestions;
}
