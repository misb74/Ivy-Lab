import { FileCache } from '@auxia/shared';
import { analyzeSupply } from './supply.js';
import { analyzeDemand } from './demand.js';

const cache = new FileCache('hr-workforce-gap', 3600 * 1000);

interface GapAnalysis {
  occupation: string;
  location: string;
  supply_summary: {
    employment_count: number | null;
    supply_rating: string;
    education_levels: Array<{ level: string; percentage: number }>;
  };
  demand_summary: {
    total_postings: number;
    unique_postings: number | undefined;
    demand_level: string;
    top_employers: string[];
  };
  gap_assessment: {
    gap_type: 'surplus' | 'balanced' | 'shortage' | 'critical_shortage';
    gap_description: string;
    supply_demand_ratio: number | null;
    hiring_difficulty: 'low' | 'moderate' | 'high' | 'very_high';
  };
  recommendations: string[];
  data_sources: string[];
}

function assessGap(
  supplyRating: string,
  demandLevel: string,
  employmentCount: number | null,
  totalPostings: number
): GapAnalysis['gap_assessment'] {
  const supplyScore = { abundant: 4, adequate: 3, tight: 2, critical: 1 }[supplyRating] ?? 2;
  const demandScore = { very_high: 4, high: 3, moderate: 2, low: 1 }[demandLevel] ?? 2;

  const ratio = employmentCount && totalPostings > 0 ? employmentCount / totalPostings : null;

  const diff = supplyScore - demandScore;

  if (diff >= 2) {
    return {
      gap_type: 'surplus',
      gap_description: 'Supply significantly exceeds demand. Employers have a large talent pool to draw from.',
      supply_demand_ratio: ratio,
      hiring_difficulty: 'low',
    };
  } else if (diff >= 0) {
    return {
      gap_type: 'balanced',
      gap_description: 'Supply and demand are roughly balanced. Standard recruitment should suffice.',
      supply_demand_ratio: ratio,
      hiring_difficulty: 'moderate',
    };
  } else if (diff >= -1) {
    return {
      gap_type: 'shortage',
      gap_description: 'Demand exceeds supply. Expect competition for talent and longer time-to-fill.',
      supply_demand_ratio: ratio,
      hiring_difficulty: 'high',
    };
  } else {
    return {
      gap_type: 'critical_shortage',
      gap_description: 'Severe talent shortage. Aggressive recruitment strategies and alternative talent pipelines recommended.',
      supply_demand_ratio: ratio,
      hiring_difficulty: 'very_high',
    };
  }
}

function generateRecommendations(gapType: string, demandLevel: string): string[] {
  const recs: string[] = [];

  switch (gapType) {
    case 'critical_shortage':
      recs.push('Consider remote/hybrid work to expand geographic talent pool.');
      recs.push('Invest in upskilling programs to develop internal talent.');
      recs.push('Partner with universities and bootcamps for pipeline development.');
      recs.push('Review compensation to ensure competitiveness.');
      recs.push('Explore adjacent skill profiles for career transition candidates.');
      break;
    case 'shortage':
      recs.push('Strengthen employer branding to attract passive candidates.');
      recs.push('Implement employee referral programs.');
      recs.push('Consider upskilling adjacent roles.');
      recs.push('Benchmark compensation against market rates.');
      break;
    case 'balanced':
      recs.push('Maintain competitive compensation and benefits.');
      recs.push('Focus on employer brand and culture to differentiate.');
      recs.push('Build a talent pipeline for future needs.');
      break;
    case 'surplus':
      recs.push('Focus on quality of hire over speed.');
      recs.push('Implement rigorous assessment processes.');
      recs.push('Consider building talent pools for future roles.');
      break;
  }

  return recs;
}

export async function analyzeGap(
  occupation: string,
  location: string = 'National'
): Promise<GapAnalysis> {
  const cacheKey = `gap:${occupation}:${location}`;
  const cached = await cache.get<GapAnalysis>(cacheKey);
  if (cached) return cached;

  const [supply, demand] = await Promise.all([
    analyzeSupply(occupation, location),
    analyzeDemand(occupation, location),
  ]);

  const gapAssessment = assessGap(
    supply.supply_rating,
    demand.demand_level,
    supply.employment_count,
    demand.posting_metrics.total_postings
  );

  const recommendations = generateRecommendations(gapAssessment.gap_type, demand.demand_level);

  const result: GapAnalysis = {
    occupation,
    location,
    supply_summary: {
      employment_count: supply.employment_count,
      supply_rating: supply.supply_rating,
      education_levels: supply.education_levels,
    },
    demand_summary: {
      total_postings: demand.posting_metrics.total_postings,
      unique_postings: demand.posting_metrics.unique_postings,
      demand_level: demand.demand_level,
      top_employers: demand.top_employers,
    },
    gap_assessment: gapAssessment,
    recommendations,
    data_sources: ['bls_oes', 'onet', 'lightcast_jpa'],
  };

  await cache.set(cacheKey, result);
  return result;
}

export async function benchmarkWorkforce(
  occupation: string,
  locations: string[] = ['National']
): Promise<{
  occupation: string;
  benchmarks: Array<{
    location: string;
    supply_rating: string;
    demand_level: string;
    gap_type: string;
    hiring_difficulty: string;
  }>;
}> {
  const benchmarks = await Promise.all(
    locations.map(async (loc) => {
      try {
        const gap = await analyzeGap(occupation, loc);
        return {
          location: loc,
          supply_rating: gap.supply_summary.supply_rating,
          demand_level: gap.demand_summary.demand_level,
          gap_type: gap.gap_assessment.gap_type,
          hiring_difficulty: gap.gap_assessment.hiring_difficulty,
        };
      } catch (error) {
        return {
          location: loc,
          supply_rating: 'unknown',
          demand_level: 'unknown',
          gap_type: 'unknown',
          hiring_difficulty: 'unknown',
        };
      }
    })
  );

  return { occupation, benchmarks };
}

export async function compareOccupations(
  occupation1: string,
  occupation2: string
): Promise<{
  occupation1: { name: string; supply_rating: string; demand_level: string; gap_type: string };
  occupation2: { name: string; supply_rating: string; demand_level: string; gap_type: string };
  comparison: string;
}> {
  const [gap1, gap2] = await Promise.all([
    analyzeGap(occupation1),
    analyzeGap(occupation2),
  ]);

  const summary1 = {
    name: occupation1,
    supply_rating: gap1.supply_summary.supply_rating,
    demand_level: gap1.demand_summary.demand_level,
    gap_type: gap1.gap_assessment.gap_type,
  };

  const summary2 = {
    name: occupation2,
    supply_rating: gap2.supply_summary.supply_rating,
    demand_level: gap2.demand_summary.demand_level,
    gap_type: gap2.gap_assessment.gap_type,
  };

  const demandRanks: Record<string, number> = { very_high: 4, high: 3, moderate: 2, low: 1 };
  const d1 = demandRanks[summary1.demand_level] ?? 2;
  const d2 = demandRanks[summary2.demand_level] ?? 2;

  let comparison: string;
  if (d1 > d2) {
    comparison = `${occupation1} has higher demand than ${occupation2}.`;
  } else if (d2 > d1) {
    comparison = `${occupation2} has higher demand than ${occupation1}.`;
  } else {
    comparison = `Both occupations show similar demand levels.`;
  }

  return { occupation1: summary1, occupation2: summary2, comparison };
}

export function forecastHeadcount(
  occupation: string,
  currentHeadcount: number = 100,
  growthRate: number = 0.05,
  years: number = 5
): {
  occupation: string;
  current_headcount: number;
  growth_rate: number;
  forecast_years: number;
  projections: Array<{ year: number; projected_headcount: number; new_hires_needed: number }>;
  total_new_hires: number;
  methodology: string;
} {
  const projections: Array<{ year: number; projected_headcount: number; new_hires_needed: number }> = [];
  let cumHeadcount = currentHeadcount;
  let totalNewHires = 0;

  const currentYear = new Date().getFullYear();

  for (let i = 1; i <= years; i++) {
    const newHeadcount = Math.ceil(cumHeadcount * (1 + growthRate));
    const newHires = newHeadcount - cumHeadcount;
    totalNewHires += newHires;
    projections.push({
      year: currentYear + i,
      projected_headcount: newHeadcount,
      new_hires_needed: newHires,
    });
    cumHeadcount = newHeadcount;
  }

  return {
    occupation,
    current_headcount: currentHeadcount,
    growth_rate: growthRate,
    forecast_years: years,
    projections,
    total_new_hires: totalNewHires,
    methodology: 'Compound annual growth rate projection. Does not account for attrition, which should be modeled separately.',
  };
}
