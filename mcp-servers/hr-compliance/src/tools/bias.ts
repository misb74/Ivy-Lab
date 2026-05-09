/**
 * Bias detection utilities for HR compliance.
 * Ported from v1 bias_detector.py — proxy variable detection,
 * four-fifths (4/5ths) adverse impact rule, and bias scoring.
 */

// ---------------------------------------------------------------------------
// Proxy variable map
// ---------------------------------------------------------------------------

export interface ProxyEntry {
  protected_attribute: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

export const PROXY_VARIABLE_MAP: Record<string, ProxyEntry> = {
  zip_code: {
    protected_attribute: 'race/ethnicity',
    severity: 'high',
    description: 'Zip codes are highly correlated with racial demographics due to historical housing segregation.',
  },
  postal_code: {
    protected_attribute: 'race/ethnicity',
    severity: 'high',
    description: 'Postal codes function identically to zip codes as racial proxies.',
  },
  neighborhood: {
    protected_attribute: 'race/ethnicity',
    severity: 'high',
    description: 'Neighborhood names are closely tied to racial and socioeconomic demographics.',
  },
  graduation_year: {
    protected_attribute: 'age',
    severity: 'high',
    description: 'Graduation year directly reveals approximate age.',
  },
  years_of_experience: {
    protected_attribute: 'age',
    severity: 'medium',
    description: 'Years of experience can serve as a proxy for age, especially at extremes.',
  },
  name: {
    protected_attribute: 'race/ethnicity/gender',
    severity: 'high',
    description: 'Names are strongly correlated with race, ethnicity, and gender.',
  },
  first_name: {
    protected_attribute: 'race/ethnicity/gender',
    severity: 'high',
    description: 'First names are strongly correlated with gender and ethnicity.',
  },
  last_name: {
    protected_attribute: 'race/ethnicity',
    severity: 'high',
    description: 'Last names (surnames) are strongly correlated with ethnicity.',
  },
  credit_score: {
    protected_attribute: 'race/socioeconomic status',
    severity: 'high',
    description: 'Credit scores disproportionately disadvantage minority and low-income groups.',
  },
  credit_history: {
    protected_attribute: 'race/socioeconomic status',
    severity: 'high',
    description: 'Credit history reflects systemic economic inequalities.',
  },
  arrest_record: {
    protected_attribute: 'race',
    severity: 'high',
    description: 'Arrest records disproportionately affect racial minorities due to policing disparities.',
  },
  criminal_record: {
    protected_attribute: 'race',
    severity: 'high',
    description: 'Criminal records disproportionately affect racial minorities.',
  },
  college_name: {
    protected_attribute: 'race/socioeconomic status',
    severity: 'medium',
    description: 'College/university prestige correlates with socioeconomic background and race.',
  },
  university: {
    protected_attribute: 'race/socioeconomic status',
    severity: 'medium',
    description: 'University name correlates with socioeconomic background.',
  },
  gpa: {
    protected_attribute: 'socioeconomic status',
    severity: 'medium',
    description: 'GPA can be influenced by access to educational resources.',
  },
  height: {
    protected_attribute: 'gender/ethnicity',
    severity: 'medium',
    description: 'Height requirements disproportionately exclude women and certain ethnic groups.',
  },
  weight: {
    protected_attribute: 'gender/disability',
    severity: 'medium',
    description: 'Weight requirements can disproportionately affect women and people with disabilities.',
  },
  photo: {
    protected_attribute: 'race/gender/age/disability',
    severity: 'high',
    description: 'Photos reveal multiple protected characteristics.',
  },
  headshot: {
    protected_attribute: 'race/gender/age/disability',
    severity: 'high',
    description: 'Headshots reveal multiple protected characteristics.',
  },
  marital_status: {
    protected_attribute: 'gender/family status',
    severity: 'high',
    description: 'Marital status disproportionately affects women in hiring decisions.',
  },
  number_of_children: {
    protected_attribute: 'gender/family status',
    severity: 'high',
    description: 'Parental status disproportionately penalizes women.',
  },
  language: {
    protected_attribute: 'national origin',
    severity: 'medium',
    description: 'Language requirements may proxy for national origin unless job-related.',
  },
  native_language: {
    protected_attribute: 'national origin',
    severity: 'high',
    description: 'Native language directly proxies national origin.',
  },
  accent: {
    protected_attribute: 'national origin',
    severity: 'high',
    description: 'Accent evaluation is closely tied to national origin.',
  },
  church: {
    protected_attribute: 'religion',
    severity: 'high',
    description: 'Church or place of worship reveals religious affiliation.',
  },
  religious_affiliation: {
    protected_attribute: 'religion',
    severity: 'high',
    description: 'Direct religious proxy.',
  },
  availability_weekends: {
    protected_attribute: 'religion',
    severity: 'medium',
    description: 'Weekend availability may conflict with Sabbath observance.',
  },
  military_status: {
    protected_attribute: 'veteran status',
    severity: 'medium',
    description: 'Military status is a protected characteristic under USERRA.',
  },
  disability_status: {
    protected_attribute: 'disability',
    severity: 'high',
    description: 'Direct disability proxy; protected under ADA.',
  },
  medications: {
    protected_attribute: 'disability',
    severity: 'high',
    description: 'Medication use can reveal disability status.',
  },
  commute_distance: {
    protected_attribute: 'race/socioeconomic status',
    severity: 'low',
    description: 'Commute distance can correlate with residential segregation patterns.',
  },
  social_media_profile: {
    protected_attribute: 'race/gender/age/religion',
    severity: 'medium',
    description: 'Social media profiles reveal multiple protected characteristics.',
  },
};

// ---------------------------------------------------------------------------
// Proxy variable detection
// ---------------------------------------------------------------------------

export interface ProxyDetection {
  field: string;
  matched_proxy: string;
  protected_attribute: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

/**
 * Scans a list of field names for potential proxy variables.
 * Uses normalized matching (lowercase, underscore-separated).
 */
export function detectProxyVariables(fields: string[]): ProxyDetection[] {
  const detections: ProxyDetection[] = [];

  for (const field of fields) {
    const normalized = field.toLowerCase().replace(/[\s\-]+/g, '_');

    // Direct match
    if (PROXY_VARIABLE_MAP[normalized]) {
      const entry = PROXY_VARIABLE_MAP[normalized];
      detections.push({
        field,
        matched_proxy: normalized,
        protected_attribute: entry.protected_attribute,
        severity: entry.severity,
        description: entry.description,
      });
      continue;
    }

    // Substring match — check if any proxy key is contained in the field name
    for (const [proxyKey, entry] of Object.entries(PROXY_VARIABLE_MAP)) {
      if (normalized.includes(proxyKey) || proxyKey.includes(normalized)) {
        detections.push({
          field,
          matched_proxy: proxyKey,
          protected_attribute: entry.protected_attribute,
          severity: entry.severity,
          description: entry.description,
        });
        break;
      }
    }
  }

  return detections;
}

// ---------------------------------------------------------------------------
// Four-fifths (4/5ths) adverse impact rule
// ---------------------------------------------------------------------------

export interface GroupStats {
  selected: number;
  total: number;
}

export interface AdverseImpactResult {
  has_adverse_impact: boolean;
  comparisons: AdverseImpactComparison[];
  highest_selection_rate_group: string;
  highest_selection_rate: number;
  summary: string;
}

export interface AdverseImpactComparison {
  group_a: string;
  group_b: string;
  rate_a: number;
  rate_b: number;
  impact_ratio: number;
  adverse_impact: boolean;
  disadvantaged_group: string | null;
}

/**
 * Implements the EEOC 4/5ths (80%) rule for adverse impact detection.
 *
 * For each pair of demographic groups, computes the selection rate ratio.
 * If the ratio of the lower rate to the higher rate is below 0.8,
 * adverse impact is indicated.
 */
export function fourFifthsRule(groups: Record<string, GroupStats>): AdverseImpactResult {
  const groupNames = Object.keys(groups);
  const comparisons: AdverseImpactComparison[] = [];
  let hasAdverseImpact = false;

  // Compute selection rates
  const rates: Record<string, number> = {};
  for (const [name, stats] of Object.entries(groups)) {
    rates[name] = stats.total > 0 ? stats.selected / stats.total : 0;
  }

  // Find highest selection rate
  let highestGroup = groupNames[0];
  let highestRate = rates[groupNames[0]] ?? 0;
  for (const name of groupNames) {
    if (rates[name] > highestRate) {
      highestRate = rates[name];
      highestGroup = name;
    }
  }

  // Pairwise comparisons
  for (let i = 0; i < groupNames.length; i++) {
    for (let j = i + 1; j < groupNames.length; j++) {
      const a = groupNames[i];
      const b = groupNames[j];
      const rateA = rates[a];
      const rateB = rates[b];

      const higherRate = Math.max(rateA, rateB);
      const lowerRate = Math.min(rateA, rateB);
      const impactRatio = higherRate > 0 ? lowerRate / higherRate : 0;
      const isAdverse = impactRatio < 0.8;

      if (isAdverse) hasAdverseImpact = true;

      const disadvantaged = isAdverse
        ? rateA < rateB ? a : b
        : null;

      comparisons.push({
        group_a: a,
        group_b: b,
        rate_a: Math.round(rateA * 10000) / 10000,
        rate_b: Math.round(rateB * 10000) / 10000,
        impact_ratio: Math.round(impactRatio * 10000) / 10000,
        adverse_impact: isAdverse,
        disadvantaged_group: disadvantaged,
      });
    }
  }

  const adverseComparisons = comparisons.filter(c => c.adverse_impact);
  const summary = hasAdverseImpact
    ? `Adverse impact detected in ${adverseComparisons.length} of ${comparisons.length} group comparisons. ` +
      `Disadvantaged groups: ${[...new Set(adverseComparisons.map(c => c.disadvantaged_group))].join(', ')}. ` +
      `Highest selection rate: ${highestGroup} (${(highestRate * 100).toFixed(1)}%).`
    : `No adverse impact detected across ${comparisons.length} group comparisons. ` +
      `All selection rate ratios meet the 4/5ths (80%) threshold.`;

  return {
    has_adverse_impact: hasAdverseImpact,
    comparisons,
    highest_selection_rate_group: highestGroup,
    highest_selection_rate: Math.round(highestRate * 10000) / 10000,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Bias score for selection criteria
// ---------------------------------------------------------------------------

export interface BiasScoreResult {
  overall_score: number;
  criteria_scores: CriteriaScore[];
  proxy_detections: ProxyDetection[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface CriteriaScore {
  criterion: string;
  score: number;
  flags: string[];
}

/**
 * Scores a set of selection criteria for potential bias.
 * Returns a 0-100 score where higher = more bias risk.
 */
export function biasScore(criteria: string[]): BiasScoreResult {
  const criteriaScores: CriteriaScore[] = [];
  const allFlags: string[] = [];

  // Check criteria against proxy variables
  const proxyDetections = detectProxyVariables(criteria);

  for (const criterion of criteria) {
    const normalized = criterion.toLowerCase().replace(/[\s\-]+/g, '_');
    let score = 0;
    const flags: string[] = [];

    // Check for proxy variable match
    const proxyMatch = proxyDetections.find(
      d => d.field === criterion
    );
    if (proxyMatch) {
      const severityScores = { high: 40, medium: 25, low: 10 };
      score += severityScores[proxyMatch.severity];
      flags.push(`Proxy for ${proxyMatch.protected_attribute} (${proxyMatch.severity} severity)`);
    }

    // Check for subjective/vague criteria
    const subjectiveTerms = [
      'culture_fit', 'cultural_fit', 'personality', 'likability',
      'gut_feeling', 'instinct', 'professionalism', 'polish',
      'appearance', 'grooming', 'demeanor', 'attitude',
      'communication_style', 'presence', 'charisma',
    ];
    for (const term of subjectiveTerms) {
      if (normalized.includes(term)) {
        score += 20;
        flags.push(`Subjective criterion "${term}" — may mask bias`);
      }
    }

    // Check for potentially discriminatory criteria
    const discriminatoryPatterns: Array<{ pattern: string; reason: string; points: number }> = [
      { pattern: 'age', reason: 'May discriminate based on age (ADEA)', points: 30 },
      { pattern: 'young', reason: 'Age-biased language favoring younger candidates', points: 25 },
      { pattern: 'energetic', reason: 'Often used as code for "young"', points: 15 },
      { pattern: 'digital_native', reason: 'Proxy for age discrimination', points: 25 },
      { pattern: 'overqualified', reason: 'Often used as proxy for age', points: 20 },
      { pattern: 'physical', reason: 'May exclude people with disabilities (ADA)', points: 20 },
      { pattern: 'native_speaker', reason: 'May discriminate based on national origin', points: 30 },
      { pattern: 'clean_shaven', reason: 'May conflict with religious practices', points: 25 },
    ];

    for (const { pattern, reason, points } of discriminatoryPatterns) {
      if (normalized.includes(pattern)) {
        score += points;
        flags.push(reason);
      }
    }

    // Cap individual score at 100
    score = Math.min(score, 100);

    criteriaScores.push({ criterion, score, flags });
    allFlags.push(...flags);
  }

  // Compute overall score — weighted average with boost for proxy detections
  const avgScore = criteriaScores.length > 0
    ? criteriaScores.reduce((sum, c) => sum + c.score, 0) / criteriaScores.length
    : 0;

  const proxyBoost = proxyDetections.length * 5;
  const overallScore = Math.min(Math.round(avgScore + proxyBoost), 100);

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (overallScore >= 70) riskLevel = 'critical';
  else if (overallScore >= 45) riskLevel = 'high';
  else if (overallScore >= 20) riskLevel = 'medium';
  else riskLevel = 'low';

  // Generate recommendations
  const recommendations: string[] = [];
  if (proxyDetections.length > 0) {
    recommendations.push(
      `Remove or replace ${proxyDetections.length} proxy variable(s): ${proxyDetections.map(d => d.field).join(', ')}.`
    );
  }
  const subjectiveCriteria = criteriaScores.filter(c =>
    c.flags.some(f => f.includes('Subjective'))
  );
  if (subjectiveCriteria.length > 0) {
    recommendations.push(
      `Replace subjective criteria with measurable, job-related requirements: ${subjectiveCriteria.map(c => c.criterion).join(', ')}.`
    );
  }
  if (overallScore > 30) {
    recommendations.push('Conduct a formal adverse impact analysis before using these criteria.');
    recommendations.push('Consult with legal counsel or an I/O psychologist to validate selection criteria.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Selection criteria appear low-risk. Continue to monitor outcomes for adverse impact.');
  }

  return {
    overall_score: overallScore,
    criteria_scores: criteriaScores,
    proxy_detections: proxyDetections,
    risk_level: riskLevel,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Job description bias scanner
// ---------------------------------------------------------------------------

export interface JdBiasScanResult {
  overall_risk: 'low' | 'medium' | 'high';
  gendered_terms: BiasTermMatch[];
  age_biased_terms: BiasTermMatch[];
  exclusionary_terms: BiasTermMatch[];
  proxy_variables: ProxyDetection[];
  score: number;
  suggestions: string[];
}

export interface BiasTermMatch {
  term: string;
  category: string;
  suggestion: string;
  context?: string;
}

const GENDERED_TERMS: Array<{ term: string; gender: string; suggestion: string }> = [
  { term: 'rockstar', gender: 'masculine', suggestion: 'high performer' },
  { term: 'ninja', gender: 'masculine', suggestion: 'expert' },
  { term: 'guru', gender: 'masculine', suggestion: 'specialist' },
  { term: 'hacker', gender: 'masculine', suggestion: 'developer' },
  { term: 'aggressive', gender: 'masculine', suggestion: 'ambitious' },
  { term: 'dominant', gender: 'masculine', suggestion: 'leading' },
  { term: 'competitive', gender: 'masculine', suggestion: 'motivated' },
  { term: 'fearless', gender: 'masculine', suggestion: 'confident' },
  { term: 'he ', gender: 'masculine', suggestion: 'they' },
  { term: 'him ', gender: 'masculine', suggestion: 'them' },
  { term: 'his ', gender: 'masculine', suggestion: 'their' },
  { term: 'chairman', gender: 'masculine', suggestion: 'chairperson' },
  { term: 'manpower', gender: 'masculine', suggestion: 'workforce' },
  { term: 'mankind', gender: 'masculine', suggestion: 'humanity' },
  { term: 'man-hours', gender: 'masculine', suggestion: 'person-hours' },
  { term: 'salesman', gender: 'masculine', suggestion: 'salesperson' },
  { term: 'nurturing', gender: 'feminine', suggestion: 'supportive' },
  { term: 'collaborative', gender: 'feminine', suggestion: 'team-oriented' },
  { term: 'empathetic', gender: 'feminine', suggestion: 'understanding' },
  { term: 'she ', gender: 'feminine', suggestion: 'they' },
  { term: 'her ', gender: 'feminine', suggestion: 'their' },
];

const AGE_BIASED_TERMS: Array<{ term: string; suggestion: string }> = [
  { term: 'digital native', suggestion: 'digitally proficient' },
  { term: 'young', suggestion: 'motivated' },
  { term: 'recent graduate', suggestion: 'entry-level' },
  { term: 'fresh out of college', suggestion: 'entry-level candidate' },
  { term: 'energetic', suggestion: 'enthusiastic' },
  { term: 'youthful', suggestion: 'dynamic' },
  { term: 'mature', suggestion: 'experienced' },
  { term: 'seasoned', suggestion: 'experienced' },
  { term: 'overqualified', suggestion: 'highly qualified' },
  { term: 'up-and-coming', suggestion: 'high-potential' },
  { term: 'junior', suggestion: 'early-career' },
  { term: 'senior', suggestion: 'experienced (if not a title)' },
  { term: 'old school', suggestion: 'traditional' },
  { term: 'new blood', suggestion: 'fresh perspectives' },
];

const EXCLUSIONARY_TERMS: Array<{ term: string; category: string; suggestion: string }> = [
  { term: 'native english', category: 'national origin', suggestion: 'fluent in English' },
  { term: 'clean-shaven', category: 'religion', suggestion: 'professional appearance' },
  { term: 'must be able to lift', category: 'disability', suggestion: 'physical requirements: (specify exact weight and frequency)' },
  { term: 'stand for long periods', category: 'disability', suggestion: 'specify actual standing requirements with reasonable accommodation note' },
  { term: 'no criminal record', category: 'race (disparate impact)', suggestion: 'background check may be required (follow Ban the Box guidelines)' },
  { term: 'cultural fit', category: 'multiple', suggestion: 'values alignment' },
  { term: 'work hard play hard', category: 'age/disability/family status', suggestion: 'describe actual work environment' },
  { term: 'fast-paced', category: 'disability/age', suggestion: 'dynamic environment' },
];

/**
 * Scans a job description for biased language, including gendered terms,
 * age-biased language, exclusionary terms, and proxy variables.
 */
export function scanJdForBias(jdText: string): JdBiasScanResult {
  const text = jdText.toLowerCase();
  const genderedMatches: BiasTermMatch[] = [];
  const ageMatches: BiasTermMatch[] = [];
  const exclusionaryMatches: BiasTermMatch[] = [];

  // Scan for gendered terms
  for (const { term, gender, suggestion } of GENDERED_TERMS) {
    if (text.includes(term)) {
      genderedMatches.push({
        term,
        category: `${gender}-coded language`,
        suggestion: `Replace "${term.trim()}" with "${suggestion}"`,
      });
    }
  }

  // Scan for age-biased terms
  for (const { term, suggestion } of AGE_BIASED_TERMS) {
    if (text.includes(term)) {
      ageMatches.push({
        term,
        category: 'age bias',
        suggestion: `Replace "${term}" with "${suggestion}"`,
      });
    }
  }

  // Scan for exclusionary terms
  for (const { term, category, suggestion } of EXCLUSIONARY_TERMS) {
    if (text.includes(term)) {
      exclusionaryMatches.push({
        term,
        category,
        suggestion: `Replace "${term}" with "${suggestion}"`,
      });
    }
  }

  // Extract potential field names for proxy detection
  const words = jdText.split(/[\s,;:()[\]{}]+/).filter(w => w.length > 2);
  const proxyDetections = detectProxyVariables(words);

  // Compute score
  const genderPenalty = genderedMatches.length * 8;
  const agePenalty = ageMatches.length * 10;
  const exclusionPenalty = exclusionaryMatches.length * 15;
  const proxyPenalty = proxyDetections.length * 12;
  const score = Math.min(genderPenalty + agePenalty + exclusionPenalty + proxyPenalty, 100);

  let overallRisk: 'low' | 'medium' | 'high';
  if (score >= 50) overallRisk = 'high';
  else if (score >= 20) overallRisk = 'medium';
  else overallRisk = 'low';

  // Generate suggestions
  const suggestions: string[] = [];
  if (genderedMatches.length > 0) {
    suggestions.push(`Found ${genderedMatches.length} gendered term(s). Use gender-neutral language to attract diverse candidates.`);
  }
  if (ageMatches.length > 0) {
    suggestions.push(`Found ${ageMatches.length} age-biased term(s). Remove age-related language to comply with ADEA.`);
  }
  if (exclusionaryMatches.length > 0) {
    suggestions.push(`Found ${exclusionaryMatches.length} potentially exclusionary term(s). Review for ADA/Title VII compliance.`);
  }
  if (proxyDetections.length > 0) {
    suggestions.push(`Found ${proxyDetections.length} proxy variable reference(s). Remove unless directly job-related.`);
  }
  if (suggestions.length === 0) {
    suggestions.push('No significant bias indicators detected. The job description appears inclusive.');
  }

  return {
    overall_risk: overallRisk,
    gendered_terms: genderedMatches,
    age_biased_terms: ageMatches,
    exclusionary_terms: exclusionaryMatches,
    proxy_variables: proxyDetections,
    score,
    suggestions,
  };
}
