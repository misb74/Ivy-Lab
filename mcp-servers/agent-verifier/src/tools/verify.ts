/**
 * Verification engine — adversarial cross-checking of Ivy tool outputs.
 *
 * Inspired by Claude Code's dedicated verification agent that tests claims
 * rather than trusting them. Uses multi-source triangulation and URL
 * validation to catch fabricated or stale data.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VerificationRequest {
  type: 'research_findings' | 'automation_assessment' | 'candidate_profile' | 'compliance_check' | 'general';
  claims: VerificationClaim[];
  context?: string;
}

export interface VerificationClaim {
  claim: string;
  source?: string;
  source_tool?: string;
  confidence?: number;
  data_points?: Record<string, any>;
}

export interface VerificationResult {
  overall_confidence: number;
  verified_count: number;
  unverified_count: number;
  flagged_count: number;
  results: ClaimVerification[];
  recommendations: string[];
}

export interface ClaimVerification {
  claim: string;
  status: 'verified' | 'unverified' | 'flagged' | 'contradicted';
  confidence: number;
  issues: string[];
  cross_references: string[];
}

// ─── Verification logic ─────────────────────────────────────────────────────

/**
 * Verify a set of claims by cross-checking data consistency,
 * source validity, and internal coherence.
 */
export function verifyClaims(request: VerificationRequest): VerificationResult {
  const results: ClaimVerification[] = request.claims.map(claim => {
    const issues: string[] = [];
    const crossRefs: string[] = [];
    let status: ClaimVerification['status'] = 'verified';
    let confidence = claim.confidence ?? 0.7;

    // Check 1: Source attribution
    if (!claim.source && !claim.source_tool) {
      issues.push('No source attribution — claim cannot be traced to a data provider');
      confidence *= 0.5;
      status = 'flagged';
    }

    // Check 2: Stale data detection
    if (claim.data_points) {
      const dateFields = Object.entries(claim.data_points)
        .filter(([k]) => k.includes('date') || k.includes('period') || k.includes('year'));
      for (const [key, value] of dateFields) {
        if (typeof value === 'string' || typeof value === 'number') {
          const year = typeof value === 'number' ? value : parseInt(value);
          if (!isNaN(year) && year < new Date().getFullYear() - 2) {
            issues.push(`Data may be stale: ${key} = ${value} (>2 years old)`);
            confidence *= 0.7;
            if (status === 'verified') status = 'flagged';
          }
        }
      }
    }

    // Check 3: Numeric range validation
    if (claim.data_points) {
      for (const [key, value] of Object.entries(claim.data_points)) {
        if (typeof value !== 'number') continue;

        // Salary sanity checks
        if (key.includes('salary') || key.includes('wage') || key.includes('compensation')) {
          if (value < 15000 || value > 1000000) {
            issues.push(`Suspicious ${key}: $${value.toLocaleString()} — outside typical range`);
            confidence *= 0.6;
            status = 'flagged';
          }
        }
        // Percentage sanity checks
        if (key.includes('percent') || key.includes('rate') || key.includes('score')) {
          if (value < 0 || value > 100) {
            issues.push(`Invalid ${key}: ${value} — outside 0-100 range`);
            confidence *= 0.3;
            status = 'contradicted';
          }
        }
        // Automation scores (0-1)
        if (key.includes('automation') || key.includes('ai_capability')) {
          if (value < 0 || value > 1) {
            issues.push(`Invalid ${key}: ${value} — automation scores must be 0-1`);
            confidence *= 0.3;
            status = 'contradicted';
          }
        }
      }
    }

    // Check 4: Cross-reference source tools
    if (claim.source_tool) {
      crossRefs.push(`Source: ${claim.source_tool}`);
      // Flag if single-source claim on important topics
      if (request.type === 'automation_assessment' && !claim.source_tool.includes('workbank')) {
        issues.push('Automation assessment not cross-referenced with WORKBank data');
        if (status === 'verified') status = 'unverified';
      }
      if (request.type === 'research_findings' && claim.confidence && claim.confidence < 0.5) {
        issues.push(`Low confidence finding (${(claim.confidence * 100).toFixed(0)}%) — needs corroboration`);
        if (status === 'verified') status = 'flagged';
      }
    }

    // Check 5: Claim text analysis
    const claimLower = claim.claim.toLowerCase();
    // Flag absolutes — real data rarely uses "always", "never", "all"
    if (/\b(always|never|all|every|none|impossible|guaranteed)\b/.test(claimLower)) {
      issues.push('Claim uses absolute language — rarely supported by empirical data');
      confidence *= 0.8;
      if (status === 'verified') status = 'flagged';
    }
    // Flag missing specificity
    if (/\b(many|some|several|various|significant|substantial)\b/.test(claimLower) &&
        !claim.data_points) {
      issues.push('Vague quantifier without supporting data points');
      confidence *= 0.7;
      if (status === 'verified') status = 'unverified';
    }

    return {
      claim: claim.claim,
      status,
      confidence: Math.round(confidence * 100) / 100,
      issues,
      cross_references: crossRefs,
    };
  });

  const verified = results.filter(r => r.status === 'verified').length;
  const unverified = results.filter(r => r.status === 'unverified').length;
  const flagged = results.filter(r => r.status === 'flagged' || r.status === 'contradicted').length;

  const overallConfidence = results.length > 0
    ? Math.round((results.reduce((sum, r) => sum + r.confidence, 0) / results.length) * 100) / 100
    : 0;

  const recommendations: string[] = [];
  if (flagged > 0) {
    recommendations.push(`${flagged} claim(s) flagged — review before presenting to stakeholders`);
  }
  if (unverified > 0) {
    recommendations.push(`${unverified} claim(s) lack source attribution — cross-reference with additional data sources`);
  }
  if (overallConfidence < 0.6) {
    recommendations.push('Overall confidence is low — consider running deep research to strengthen evidence base');
  }
  const contradicted = results.filter(r => r.status === 'contradicted');
  if (contradicted.length > 0) {
    recommendations.push(`${contradicted.length} claim(s) contradicted by data validation — these should be removed or corrected`);
  }

  return {
    overall_confidence: overallConfidence,
    verified_count: verified,
    unverified_count: unverified,
    flagged_count: flagged,
    results,
    recommendations,
  };
}

/**
 * Validate a URL by checking its format and domain.
 * Does NOT make HTTP requests — that's done via the browser tool.
 */
export function validateUrl(url: string): {
  valid: boolean;
  issues: string[];
  domain: string | null;
  is_linkedin: boolean;
} {
  const issues: string[] = [];
  let domain: string | null = null;
  let isLinkedin = false;

  try {
    const parsed = new URL(url);
    domain = parsed.hostname;
    isLinkedin = parsed.hostname.includes('linkedin.com');

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      issues.push(`Non-HTTP protocol: ${parsed.protocol}`);
    }
    if (parsed.hostname.length < 4) {
      issues.push('Suspiciously short hostname');
    }
    // LinkedIn-specific validation
    if (isLinkedin) {
      if (!parsed.pathname.startsWith('/in/') && !parsed.pathname.startsWith('/pub/')) {
        issues.push('LinkedIn URL does not match expected profile path format (/in/ or /pub/)');
      }
    }
  } catch {
    issues.push('Malformed URL');
    return { valid: false, issues, domain: null, is_linkedin: false };
  }

  return {
    valid: issues.length === 0,
    issues,
    domain,
    is_linkedin: isLinkedin,
  };
}

/**
 * Validate a batch of candidate profiles for data integrity.
 */
export function validateCandidateProfiles(
  candidates: Array<{
    name: string;
    source_url?: string;
    title?: string;
    company?: string;
    [key: string]: any;
  }>,
): {
  valid_count: number;
  invalid_count: number;
  issues: Array<{ candidate: string; problems: string[] }>;
} {
  const issues: Array<{ candidate: string; problems: string[] }> = [];
  let valid = 0;
  let invalid = 0;

  for (const candidate of candidates) {
    const problems: string[] = [];

    if (!candidate.name || candidate.name.trim().length < 2) {
      problems.push('Missing or invalid name');
    }
    if (!candidate.source_url) {
      problems.push('Missing source_url — candidate cannot be verified');
    } else {
      const urlCheck = validateUrl(candidate.source_url);
      if (!urlCheck.valid) {
        problems.push(...urlCheck.issues.map(i => `URL issue: ${i}`));
      }
    }
    if (!candidate.title) {
      problems.push('Missing job title');
    }
    // Check for duplicate indicators
    if (candidate.name && /^(John|Jane|Test|Sample|Example)\s+(Doe|Smith|User|Person)/i.test(candidate.name)) {
      problems.push('Name matches common placeholder pattern — likely fabricated');
    }

    if (problems.length > 0) {
      issues.push({ candidate: candidate.name || 'unknown', problems });
      invalid++;
    } else {
      valid++;
    }
  }

  return { valid_count: valid, invalid_count: invalid, issues };
}
