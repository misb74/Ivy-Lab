/**
 * Compliance checking, pay equity analysis, and regulatory frameworks.
 */

// ---------------------------------------------------------------------------
// Compliance frameworks and jurisdictional requirements
// ---------------------------------------------------------------------------

export interface ComplianceIssue {
  area: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  regulation: string;
  recommendation: string;
}

export interface ComplianceCheckResult {
  process_description: string;
  jurisdiction: string;
  issues: ComplianceIssue[];
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  applicable_regulations: string[];
  summary: string;
}

const COMPLIANCE_KEYWORDS: Record<string, Array<{ keyword: string; regulation: string; area: string; severity: ComplianceIssue['severity']; recommendation: string }>> = {
  hiring: [
    { keyword: 'background check', regulation: 'FCRA / Ban the Box laws', area: 'hiring', severity: 'high', recommendation: 'Ensure FCRA-compliant disclosure and authorization. Check state/local Ban the Box requirements.' },
    { keyword: 'credit check', regulation: 'FCRA / State laws', area: 'hiring', severity: 'high', recommendation: 'Credit checks for employment require written consent and are restricted in many jurisdictions.' },
    { keyword: 'drug test', regulation: 'ADA / State marijuana laws', area: 'hiring', severity: 'medium', recommendation: 'Review state-specific marijuana laws. Ensure testing is job-related and consistent.' },
    { keyword: 'social media', regulation: 'State social media privacy laws', area: 'hiring', severity: 'medium', recommendation: 'Many states prohibit requiring social media passwords. Review applicable state law.' },
    { keyword: 'salary history', regulation: 'State/local pay equity laws', area: 'hiring', severity: 'high', recommendation: 'Salary history bans exist in 20+ states/localities. Use market data for compensation.' },
    { keyword: 'non-compete', regulation: 'FTC / State laws', area: 'hiring', severity: 'high', recommendation: 'FTC has proposed banning non-competes. Many states already restrict them significantly.' },
    { keyword: 'at-will', regulation: 'State employment law', area: 'hiring', severity: 'low', recommendation: 'Ensure at-will language is consistent and does not conflict with implied contract.' },
    { keyword: 'reference check', regulation: 'Defamation / State laws', area: 'hiring', severity: 'low', recommendation: 'Limit reference checks to job-related information. Document all inquiries.' },
  ],
  termination: [
    { keyword: 'termination', regulation: 'WARN Act / State mini-WARN', area: 'termination', severity: 'high', recommendation: 'For mass layoffs, ensure WARN Act 60-day notice compliance. Check state mini-WARN laws.' },
    { keyword: 'layoff', regulation: 'WARN Act / ADEA / Title VII', area: 'termination', severity: 'critical', recommendation: 'Conduct adverse impact analysis before layoffs. Ensure selection criteria are non-discriminatory.' },
    { keyword: 'severance', regulation: 'OWBPA / ERISA', area: 'termination', severity: 'high', recommendation: 'For employees 40+, OWBPA requires specific release language and 21/45-day consideration periods.' },
    { keyword: 'performance improvement', regulation: 'ADA / FMLA', area: 'termination', severity: 'medium', recommendation: 'Ensure PIP is not retaliatory. Check if employee has pending ADA/FMLA requests.' },
    { keyword: 'reduction in force', regulation: 'WARN / OWBPA / Title VII', area: 'termination', severity: 'critical', recommendation: 'Conduct full adverse impact analysis. Provide OWBPA-compliant releases. Check WARN obligations.' },
  ],
  compensation: [
    { keyword: 'overtime', regulation: 'FLSA', area: 'compensation', severity: 'high', recommendation: 'Ensure proper exempt/non-exempt classification. Track all hours worked for non-exempt employees.' },
    { keyword: 'exempt', regulation: 'FLSA', area: 'compensation', severity: 'high', recommendation: 'Verify salary basis test and duties test for exemption. DOL salary threshold is $35,568/year.' },
    { keyword: 'minimum wage', regulation: 'FLSA / State/local laws', area: 'compensation', severity: 'critical', recommendation: 'Check federal, state, and local minimum wage rates. Apply the highest applicable rate.' },
    { keyword: 'pay equity', regulation: 'EPA / State pay equity laws', area: 'compensation', severity: 'high', recommendation: 'Conduct regular pay equity audits. Document legitimate factors for pay differences.' },
    { keyword: 'bonus', regulation: 'FLSA / Contract law', area: 'compensation', severity: 'medium', recommendation: 'Non-discretionary bonuses must be included in regular rate for overtime calculations.' },
    { keyword: 'commission', regulation: 'FLSA / State wage laws', area: 'compensation', severity: 'medium', recommendation: 'Ensure written commission agreement. Check state-specific commission payment requirements.' },
  ],
  leave: [
    { keyword: 'fmla', regulation: 'FMLA', area: 'leave', severity: 'high', recommendation: 'Ensure proper notice, certification, and reinstatement procedures. Track 12-month/1,250-hour eligibility.' },
    { keyword: 'medical leave', regulation: 'FMLA / ADA / State laws', area: 'leave', severity: 'high', recommendation: 'Coordinate FMLA, ADA, and state leave requirements. Do not retaliate for leave usage.' },
    { keyword: 'pregnancy', regulation: 'PDA / PWFA / State laws', area: 'leave', severity: 'critical', recommendation: 'Pregnant Workers Fairness Act requires reasonable accommodations. Review PDA and state requirements.' },
    { keyword: 'parental leave', regulation: 'FMLA / State paid leave laws', area: 'leave', severity: 'medium', recommendation: 'Check state paid family leave requirements. Ensure gender-neutral parental leave policies.' },
    { keyword: 'sick leave', regulation: 'State/local paid sick leave', area: 'leave', severity: 'medium', recommendation: 'Many jurisdictions require paid sick leave. Check applicable state/local requirements.' },
    { keyword: 'accommodation', regulation: 'ADA / PWFA', area: 'leave', severity: 'high', recommendation: 'Engage in interactive process. Document good-faith efforts to provide reasonable accommodation.' },
  ],
};

/**
 * Check a process description for compliance issues.
 */
export function checkCompliance(processDescription: string, jurisdiction?: string): ComplianceCheckResult {
  const text = processDescription.toLowerCase();
  const issues: ComplianceIssue[] = [];
  const applicableRegulations = new Set<string>();

  for (const [_category, rules] of Object.entries(COMPLIANCE_KEYWORDS)) {
    for (const rule of rules) {
      if (text.includes(rule.keyword)) {
        issues.push({
          area: rule.area,
          severity: rule.severity,
          description: `Process mentions "${rule.keyword}" — review required for ${rule.regulation} compliance.`,
          regulation: rule.regulation,
          recommendation: rule.recommendation,
        });
        rule.regulation.split(' / ').forEach(r => applicableRegulations.add(r.trim()));
      }
    }
  }

  // Add jurisdiction-specific notes
  if (jurisdiction) {
    const jur = jurisdiction.toLowerCase();
    if (jur.includes('california') || jur === 'ca') {
      issues.push({
        area: 'jurisdiction',
        severity: 'info',
        description: 'California has among the strictest employment laws. Additional requirements may apply.',
        regulation: 'CA FEHA / CA Labor Code',
        recommendation: 'Review FEHA protections, CA-specific leave laws, pay transparency requirements, and CCPA employee data provisions.',
      });
      applicableRegulations.add('CA FEHA');
      applicableRegulations.add('CA Labor Code');
    }
    if (jur.includes('new york') || jur === 'ny') {
      issues.push({
        area: 'jurisdiction',
        severity: 'info',
        description: 'New York has expansive employment protections at state and city levels.',
        regulation: 'NY Human Rights Law / NYC Local Laws',
        recommendation: 'Review NYC pay transparency law, NY WARN Act, NYC automated employment decision tools law.',
      });
      applicableRegulations.add('NY Human Rights Law');
    }
    if (jur.includes('eu') || jur.includes('europe') || jur.includes('gdpr')) {
      issues.push({
        area: 'jurisdiction',
        severity: 'high',
        description: 'EU/EEA operations require GDPR compliance for all employee data processing.',
        regulation: 'GDPR / EU Employment Directive',
        recommendation: 'Ensure lawful basis for processing, data minimization, cross-border transfer safeguards, and DPIA for high-risk processing.',
      });
      applicableRegulations.add('GDPR');
    }
  }

  // Sort issues by severity
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Compute risk score
  const severityScores: Record<string, number> = { critical: 25, high: 15, medium: 8, low: 3, info: 0 };
  const rawScore = issues.reduce((sum, i) => sum + severityScores[i.severity], 0);
  const riskScore = Math.min(rawScore, 100);

  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (riskScore >= 70) riskLevel = 'critical';
  else if (riskScore >= 40) riskLevel = 'high';
  else if (riskScore >= 15) riskLevel = 'medium';
  else riskLevel = 'low';

  const summary = issues.length > 0
    ? `Found ${issues.length} compliance issue(s) across ${new Set(issues.map(i => i.area)).size} area(s). ` +
      `Risk level: ${riskLevel} (score: ${riskScore}/100). ` +
      `Critical/high issues: ${issues.filter(i => i.severity === 'critical' || i.severity === 'high').length}.`
    : 'No compliance issues detected in the process description. Consider a more detailed review for complete coverage.';

  return {
    process_description: processDescription,
    jurisdiction: jurisdiction || 'federal (US)',
    issues,
    risk_score: riskScore,
    risk_level: riskLevel,
    applicable_regulations: [...applicableRegulations],
    summary,
  };
}

// ---------------------------------------------------------------------------
// Compliance report generator
// ---------------------------------------------------------------------------

export interface ComplianceReportResult {
  area: string;
  period: string;
  framework: ComplianceFramework;
  key_requirements: ComplianceRequirement[];
  action_items: string[];
  generated_at: string;
}

export interface ComplianceFramework {
  name: string;
  description: string;
  primary_regulations: string[];
}

export interface ComplianceRequirement {
  requirement: string;
  regulation: string;
  frequency: string;
  responsible_party: string;
  status: 'review_needed';
}

const COMPLIANCE_AREAS: Record<string, ComplianceFramework> = {
  eeo: {
    name: 'Equal Employment Opportunity',
    description: 'Compliance with anti-discrimination laws in all employment practices.',
    primary_regulations: ['Title VII', 'ADA', 'ADEA', 'EPA', 'GINA', 'PDA'],
  },
  compensation: {
    name: 'Compensation Compliance',
    description: 'Wage and hour law compliance, pay equity, and benefits administration.',
    primary_regulations: ['FLSA', 'EPA', 'State pay equity laws', 'State minimum wage laws'],
  },
  benefits: {
    name: 'Benefits Compliance',
    description: 'Compliance with employee benefits laws and regulations.',
    primary_regulations: ['ERISA', 'ACA', 'COBRA', 'HIPAA', 'MHPAEA'],
  },
  safety: {
    name: 'Workplace Safety',
    description: 'Occupational safety and health compliance.',
    primary_regulations: ['OSHA', 'State OSHA plans', 'Workers compensation laws'],
  },
  data_privacy: {
    name: 'Employee Data Privacy',
    description: 'Compliance with data protection and privacy regulations for employee data.',
    primary_regulations: ['CCPA/CPRA', 'State biometric laws', 'GDPR (if applicable)', 'ECPA'],
  },
  immigration: {
    name: 'Immigration Compliance',
    description: 'Employment eligibility verification and immigration law compliance.',
    primary_regulations: ['IRCA', 'INA', 'H-1B regulations', 'E-Verify requirements'],
  },
  leave: {
    name: 'Leave Administration',
    description: 'Compliance with federal and state leave laws.',
    primary_regulations: ['FMLA', 'USERRA', 'PWFA', 'State paid leave laws', 'State sick leave laws'],
  },
};

const AREA_REQUIREMENTS: Record<string, ComplianceRequirement[]> = {
  eeo: [
    { requirement: 'File EEO-1 Component 1 report', regulation: 'Title VII / EO 11246', frequency: 'Annual', responsible_party: 'HR/Legal', status: 'review_needed' },
    { requirement: 'Post "EEO is the Law" notice', regulation: 'Title VII', frequency: 'Continuous', responsible_party: 'HR', status: 'review_needed' },
    { requirement: 'Conduct adverse impact analysis for selection procedures', regulation: 'UGESP', frequency: 'Per selection cycle', responsible_party: 'HR Analytics', status: 'review_needed' },
    { requirement: 'Maintain applicant flow data by race/gender', regulation: 'OFCCP / Title VII', frequency: 'Continuous', responsible_party: 'Recruiting', status: 'review_needed' },
    { requirement: 'Develop Affirmative Action Plan (federal contractors)', regulation: 'EO 11246', frequency: 'Annual', responsible_party: 'HR/Legal', status: 'review_needed' },
    { requirement: 'Anti-harassment training', regulation: 'Title VII / State laws', frequency: 'Annual or biennial', responsible_party: 'L&D', status: 'review_needed' },
  ],
  compensation: [
    { requirement: 'Audit exempt/non-exempt classifications', regulation: 'FLSA', frequency: 'Annual', responsible_party: 'HR/Compensation', status: 'review_needed' },
    { requirement: 'Pay equity analysis', regulation: 'EPA / State laws', frequency: 'Annual', responsible_party: 'Compensation', status: 'review_needed' },
    { requirement: 'Minimum wage compliance review', regulation: 'FLSA / State laws', frequency: 'When rates change', responsible_party: 'Payroll', status: 'review_needed' },
    { requirement: 'Overtime calculation audit', regulation: 'FLSA', frequency: 'Quarterly', responsible_party: 'Payroll', status: 'review_needed' },
    { requirement: 'Pay transparency disclosures', regulation: 'State laws (CO, CA, NY, WA)', frequency: 'Per job posting', responsible_party: 'Recruiting', status: 'review_needed' },
  ],
  benefits: [
    { requirement: 'ACA reporting (Forms 1094-C/1095-C)', regulation: 'ACA', frequency: 'Annual', responsible_party: 'Benefits', status: 'review_needed' },
    { requirement: '5500 filing', regulation: 'ERISA', frequency: 'Annual', responsible_party: 'Benefits', status: 'review_needed' },
    { requirement: 'COBRA administration review', regulation: 'COBRA', frequency: 'Quarterly', responsible_party: 'Benefits', status: 'review_needed' },
    { requirement: 'Mental health parity compliance', regulation: 'MHPAEA', frequency: 'Annual', responsible_party: 'Benefits', status: 'review_needed' },
    { requirement: 'SPD distribution and updates', regulation: 'ERISA', frequency: 'Per plan change', responsible_party: 'Benefits', status: 'review_needed' },
  ],
  safety: [
    { requirement: 'OSHA 300 log maintenance', regulation: 'OSHA', frequency: 'Continuous', responsible_party: 'Safety', status: 'review_needed' },
    { requirement: 'OSHA 300A posting', regulation: 'OSHA', frequency: 'Feb 1 - Apr 30 annually', responsible_party: 'Safety', status: 'review_needed' },
    { requirement: 'Workplace hazard assessment', regulation: 'OSHA', frequency: 'Annual', responsible_party: 'Safety', status: 'review_needed' },
    { requirement: 'Safety training records', regulation: 'OSHA', frequency: 'Continuous', responsible_party: 'Safety/L&D', status: 'review_needed' },
  ],
  data_privacy: [
    { requirement: 'Employee data inventory', regulation: 'CCPA/CPRA / GDPR', frequency: 'Annual', responsible_party: 'IT/Legal', status: 'review_needed' },
    { requirement: 'Privacy notice to employees', regulation: 'CCPA/CPRA', frequency: 'At hire + annual', responsible_party: 'HR/Legal', status: 'review_needed' },
    { requirement: 'Data processing impact assessment', regulation: 'GDPR', frequency: 'Per new system', responsible_party: 'IT/Legal', status: 'review_needed' },
    { requirement: 'Biometric data consent', regulation: 'State biometric laws (IL BIPA)', frequency: 'Before collection', responsible_party: 'HR/Legal', status: 'review_needed' },
  ],
  immigration: [
    { requirement: 'I-9 completion within 3 days of hire', regulation: 'IRCA', frequency: 'Per hire', responsible_party: 'HR', status: 'review_needed' },
    { requirement: 'I-9 audit', regulation: 'IRCA', frequency: 'Annual', responsible_party: 'HR/Legal', status: 'review_needed' },
    { requirement: 'E-Verify submission', regulation: 'State E-Verify mandates', frequency: 'Per hire', responsible_party: 'HR', status: 'review_needed' },
    { requirement: 'LCA posting for H-1B', regulation: 'INA', frequency: 'Per petition', responsible_party: 'Legal', status: 'review_needed' },
  ],
  leave: [
    { requirement: 'FMLA eligibility tracking', regulation: 'FMLA', frequency: 'Continuous', responsible_party: 'HR', status: 'review_needed' },
    { requirement: 'FMLA notice posting', regulation: 'FMLA', frequency: 'Continuous', responsible_party: 'HR', status: 'review_needed' },
    { requirement: 'State paid leave compliance review', regulation: 'State laws', frequency: 'Quarterly', responsible_party: 'HR/Payroll', status: 'review_needed' },
    { requirement: 'USERRA reinstatement procedures', regulation: 'USERRA', frequency: 'Per occurrence', responsible_party: 'HR', status: 'review_needed' },
    { requirement: 'Reasonable accommodation log', regulation: 'ADA / PWFA', frequency: 'Continuous', responsible_party: 'HR', status: 'review_needed' },
  ],
};

/**
 * Generate a compliance report for a specific area.
 */
export function generateComplianceReport(area: string, period?: string): ComplianceReportResult {
  const normalizedArea = area.toLowerCase().replace(/[\s\-]+/g, '_');
  const framework = COMPLIANCE_AREAS[normalizedArea] || {
    name: area,
    description: `Compliance framework for ${area}.`,
    primary_regulations: ['Consult legal counsel for applicable regulations'],
  };

  const requirements = AREA_REQUIREMENTS[normalizedArea] || [
    {
      requirement: `Conduct comprehensive ${area} compliance review`,
      regulation: 'Multiple',
      frequency: 'Annual',
      responsible_party: 'HR/Legal',
      status: 'review_needed' as const,
    },
  ];

  const actionItems = [
    `Review all ${framework.name} obligations for the ${period || 'current'} period.`,
    `Audit documentation for ${requirements.length} compliance requirements.`,
    `Verify training records are up to date for ${framework.name} programs.`,
    `Confirm all regulatory postings and notices are current.`,
    `Schedule legal review of any policy changes since last audit.`,
  ];

  return {
    area: framework.name,
    period: period || 'current',
    framework,
    key_requirements: requirements,
    action_items: actionItems,
    generated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Pay equity audit
// ---------------------------------------------------------------------------

export interface RolePayData {
  title: string;
  salary: number;
  demographics?: Record<string, string>;
}

export interface PayEquityResult {
  roles_analyzed: number;
  pay_gaps: PayGap[];
  overall_equity_score: number;
  risk_level: 'low' | 'medium' | 'high';
  methodology: string;
  recommendations: string[];
}

export interface PayGap {
  role: string;
  demographic_factor: string;
  group_a: { label: string; avg_salary: number; count: number };
  group_b: { label: string; avg_salary: number; count: number };
  gap_percentage: number;
  gap_absolute: number;
  significant: boolean;
}

/**
 * Audit pay equity across roles and demographics.
 */
export function auditPayEquity(roles: RolePayData[]): PayEquityResult {
  const payGaps: PayGap[] = [];

  // Group by role title
  const roleGroups: Record<string, RolePayData[]> = {};
  for (const role of roles) {
    const key = role.title.toLowerCase();
    if (!roleGroups[key]) roleGroups[key] = [];
    roleGroups[key].push(role);
  }

  for (const [roleTitle, roleData] of Object.entries(roleGroups)) {
    // For each demographic factor, compute pay gaps
    const demographicKeys = new Set<string>();
    for (const r of roleData) {
      if (r.demographics) {
        Object.keys(r.demographics).forEach(k => demographicKeys.add(k));
      }
    }

    for (const factor of demographicKeys) {
      // Group by demographic value
      const groupedByValue: Record<string, number[]> = {};
      for (const r of roleData) {
        const val = r.demographics?.[factor];
        if (val) {
          if (!groupedByValue[val]) groupedByValue[val] = [];
          groupedByValue[val].push(r.salary);
        }
      }

      const values = Object.keys(groupedByValue);
      for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
          const salariesA = groupedByValue[values[i]];
          const salariesB = groupedByValue[values[j]];
          const avgA = salariesA.reduce((s, v) => s + v, 0) / salariesA.length;
          const avgB = salariesB.reduce((s, v) => s + v, 0) / salariesB.length;
          const higher = Math.max(avgA, avgB);
          const gapAbs = Math.abs(avgA - avgB);
          const gapPct = higher > 0 ? (gapAbs / higher) * 100 : 0;

          payGaps.push({
            role: roleTitle,
            demographic_factor: factor,
            group_a: { label: values[i], avg_salary: Math.round(avgA), count: salariesA.length },
            group_b: { label: values[j], avg_salary: Math.round(avgB), count: salariesB.length },
            gap_percentage: Math.round(gapPct * 100) / 100,
            gap_absolute: Math.round(gapAbs),
            significant: gapPct >= 5,
          });
        }
      }
    }
  }

  const significantGaps = payGaps.filter(g => g.significant);
  const equityScore = payGaps.length > 0
    ? Math.max(0, 100 - (significantGaps.length / payGaps.length) * 100)
    : 100;

  let riskLevel: 'low' | 'medium' | 'high';
  if (equityScore >= 80) riskLevel = 'low';
  else if (equityScore >= 50) riskLevel = 'medium';
  else riskLevel = 'high';

  const recommendations: string[] = [];
  if (significantGaps.length > 0) {
    recommendations.push(`${significantGaps.length} significant pay gap(s) detected (>5% difference). Investigate root causes.`);
    recommendations.push('Conduct regression analysis controlling for legitimate factors (experience, education, performance).');
    recommendations.push('Develop remediation plan with timeline and budget for pay adjustments.');
  }
  recommendations.push('Document all legitimate factors contributing to pay differences.');
  recommendations.push('Establish ongoing pay equity monitoring cadence (quarterly or semi-annually).');

  return {
    roles_analyzed: roles.length,
    pay_gaps: payGaps,
    overall_equity_score: Math.round(equityScore),
    risk_level: riskLevel,
    methodology: 'Unadjusted pay gap analysis comparing average compensation across demographic groups within same role. ' +
      'Gaps >= 5% are flagged as significant. A full audit should include regression analysis controlling for ' +
      'legitimate factors such as experience, education, performance, and location.',
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Pay equity methodology explainer
// ---------------------------------------------------------------------------

export interface PayEquityMethodology {
  method: string;
  description: string;
  steps: string[];
  pros: string[];
  cons: string[];
  when_to_use: string;
  regulatory_context: string;
}

const METHODOLOGIES: Record<string, PayEquityMethodology> = {
  regression: {
    method: 'Multiple Regression Analysis',
    description: 'Statistical method that models compensation as a function of legitimate factors (experience, education, performance, location) and tests whether protected characteristics explain residual pay differences.',
    steps: [
      '1. Identify legitimate pay factors (experience, education, performance, job level, location).',
      '2. Collect compensation and demographic data.',
      '3. Build regression model: Compensation = f(legitimate factors) + demographic variables.',
      '4. Test statistical significance of demographic coefficients.',
      '5. Calculate adjusted pay gaps after controlling for legitimate factors.',
      '6. Identify outliers and investigate case-by-case.',
      '7. Develop remediation plan for statistically significant gaps.',
    ],
    pros: [
      'Gold standard for legal defensibility.',
      'Controls for legitimate pay factors.',
      'Quantifies unexplained pay gaps precisely.',
      'Accepted by OFCCP and courts.',
    ],
    cons: [
      'Requires sufficient sample sizes per group.',
      'Sensitive to model specification (omitted variable bias).',
      'Requires statistical expertise.',
      'Can be expensive to implement properly.',
    ],
    when_to_use: 'Use for formal pay equity audits, OFCCP compliance, litigation defense, and when sample sizes permit meaningful analysis.',
    regulatory_context: 'OFCCP requires regression analysis for federal contractors. Courts have accepted regression as evidence in EPA and Title VII cases.',
  },
  cohort: {
    method: 'Cohort Analysis',
    description: 'Compares compensation within defined peer groups (cohorts) of employees with similar job function, level, and location.',
    steps: [
      '1. Define cohorts based on job family, level, and location.',
      '2. Calculate summary statistics (mean, median, range) per cohort.',
      '3. Compare pay by demographic group within each cohort.',
      '4. Flag gaps exceeding threshold (typically 5%).',
      '5. Investigate flagged gaps for legitimate explanations.',
      '6. Remediate unexplained gaps.',
    ],
    pros: [
      'Intuitive and easy to explain.',
      'Works with smaller sample sizes.',
      'Faster to implement than regression.',
      'Good for targeted analysis.',
    ],
    cons: [
      'Does not control for within-cohort differences.',
      'Cohort definition can influence results.',
      'Less statistically rigorous.',
      'May miss subtle patterns.',
    ],
    when_to_use: 'Use for initial screening, smaller organizations, or supplementing regression analysis.',
    regulatory_context: 'Acceptable as preliminary analysis but may not satisfy OFCCP requirements alone.',
  },
  compa_ratio: {
    method: 'Compa-Ratio Analysis',
    description: 'Compares each employee\'s pay to the midpoint of their pay range (compa-ratio = actual pay / range midpoint), then analyzes compa-ratio differences by demographic group.',
    steps: [
      '1. Establish pay ranges for all positions.',
      '2. Calculate compa-ratio for each employee.',
      '3. Group employees by job family, level, and demographics.',
      '4. Compare average compa-ratios across demographic groups.',
      '5. Flag groups with compa-ratio differences > 3-5%.',
      '6. Investigate and remediate.',
    ],
    pros: [
      'Normalizes for pay range differences across jobs.',
      'Easy to integrate with existing comp structures.',
      'Useful for ongoing monitoring.',
    ],
    cons: [
      'Depends on well-calibrated pay ranges.',
      'Does not explain why gaps exist.',
      'Pay range issues can mask or create false signals.',
    ],
    when_to_use: 'Use when pay ranges are well-established and you want ongoing monitoring capability.',
    regulatory_context: 'Can supplement formal analysis. OFCCP may request compa-ratio data during audits.',
  },
};

/**
 * Explain a pay equity methodology.
 */
export function explainPayEquityMethodology(method?: string): PayEquityMethodology | { available_methods: PayEquityMethodology[] } {
  if (method) {
    const normalized = method.toLowerCase().replace(/[\s\-]+/g, '_');
    const found = METHODOLOGIES[normalized];
    if (found) return found;
    // Try partial match
    for (const [key, val] of Object.entries(METHODOLOGIES)) {
      if (key.includes(normalized) || val.method.toLowerCase().includes(method.toLowerCase())) {
        return val;
      }
    }
  }
  return { available_methods: Object.values(METHODOLOGIES) };
}
