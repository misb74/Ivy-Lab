export interface AttritionFactors {
  tenure: number;            // years at company
  compensationRatio: number; // current salary / market median (e.g. 0.9 = below market)
  engagementScore: number;   // 0-100 scale
  marketDemand: number;      // 0-100, how hot is this role in the market
  teamSize: number;          // size of immediate team
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AttritionResult {
  riskScore: number;     // 0-100
  riskLevel: RiskLevel;
  factors: {
    name: string;
    weight: number;
    rawValue: number;
    normalizedScore: number;
    contribution: number;
  }[];
  recommendations: string[];
}

const WEIGHTS = {
  tenure: 0.20,
  compensationRatio: 0.25,
  engagementScore: 0.25,
  marketDemand: 0.15,
  teamSize: 0.15,
};

/**
 * Normalize tenure to a risk score (0-100).
 * Very short (<1yr) and very long (>10yr) tenures are lower risk;
 * 1-3 years is the highest attrition risk zone.
 */
function normalizeTenure(tenure: number): number {
  if (tenure < 0.5) return 40;
  if (tenure < 1) return 65;
  if (tenure < 2) return 80;
  if (tenure < 3) return 70;
  if (tenure < 5) return 50;
  if (tenure < 8) return 30;
  return 20;
}

/**
 * Normalize compensation ratio to risk score.
 * Below-market pay increases attrition risk.
 */
function normalizeCompensation(ratio: number): number {
  if (ratio >= 1.2) return 10;
  if (ratio >= 1.1) return 20;
  if (ratio >= 1.0) return 35;
  if (ratio >= 0.95) return 50;
  if (ratio >= 0.9) return 65;
  if (ratio >= 0.85) return 80;
  return 95;
}

/**
 * Normalize engagement score to risk (inverted: low engagement = high risk).
 */
function normalizeEngagement(score: number): number {
  return Math.max(0, Math.min(100, 100 - score));
}

/**
 * Normalize market demand to risk score.
 * High demand = more opportunities = higher risk.
 */
function normalizeMarketDemand(demand: number): number {
  return Math.max(0, Math.min(100, demand));
}

/**
 * Normalize team size to risk score.
 * Very small teams (<3) or very large teams (>20) have higher risk.
 */
function normalizeTeamSize(size: number): number {
  if (size < 2) return 70;
  if (size < 4) return 50;
  if (size <= 8) return 20;
  if (size <= 15) return 35;
  if (size <= 20) return 50;
  return 65;
}

function classifyRisk(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function generateRecommendations(factors: AttritionResult['factors']): string[] {
  const recommendations: string[] = [];
  const sorted = [...factors].sort((a, b) => b.contribution - a.contribution);

  for (const factor of sorted.slice(0, 3)) {
    switch (factor.name) {
      case 'tenure':
        if (factor.normalizedScore > 60) {
          recommendations.push('Consider career development discussion - employee is in a high-risk tenure window.');
        }
        break;
      case 'compensationRatio':
        if (factor.normalizedScore > 50) {
          recommendations.push('Review compensation against market rates - below-market pay detected.');
        }
        break;
      case 'engagementScore':
        if (factor.normalizedScore > 50) {
          recommendations.push('Engagement score is low - schedule 1:1 check-in and explore growth opportunities.');
        }
        break;
      case 'marketDemand':
        if (factor.normalizedScore > 60) {
          recommendations.push('Role is in high market demand - consider retention incentives or counter-offer strategy.');
        }
        break;
      case 'teamSize':
        if (factor.normalizedScore > 50) {
          recommendations.push('Team structure may be contributing to risk - evaluate team dynamics and workload.');
        }
        break;
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Overall risk is manageable. Continue regular check-ins and engagement monitoring.');
  }

  return recommendations;
}

/**
 * Multi-factor attrition risk scoring.
 */
export function calculateAttritionRisk(input: AttritionFactors): AttritionResult {
  const normalizers: Record<string, (v: number) => number> = {
    tenure: normalizeTenure,
    compensationRatio: normalizeCompensation,
    engagementScore: normalizeEngagement,
    marketDemand: normalizeMarketDemand,
    teamSize: normalizeTeamSize,
  };

  const factors: AttritionResult['factors'] = [];
  let totalScore = 0;

  for (const [name, weight] of Object.entries(WEIGHTS)) {
    const rawValue = input[name as keyof AttritionFactors];
    const normalizedScore = normalizers[name](rawValue);
    const contribution = weight * normalizedScore;
    totalScore += contribution;

    factors.push({
      name,
      weight,
      rawValue,
      normalizedScore: Math.round(normalizedScore * 100) / 100,
      contribution: Math.round(contribution * 100) / 100,
    });
  }

  const riskScore = Math.round(totalScore * 100) / 100;
  const riskLevel = classifyRisk(riskScore);
  const recommendations = generateRecommendations(factors);

  return { riskScore, riskLevel, factors, recommendations };
}
