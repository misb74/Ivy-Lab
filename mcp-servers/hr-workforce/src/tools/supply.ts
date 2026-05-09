import { FileCache } from '@auxia/shared';

const BLS_BASE_URL = 'https://api.bls.gov/publicAPI/v2';
const cache = new FileCache('hr-workforce-supply', 3600 * 1000);

interface SupplyAnalysis {
  occupation: string;
  location: string;
  employment_count: number | null;
  employment_per_1000: number | null;
  labor_force_participation: number | null;
  education_levels: Array<{ level: string; percentage: number }>;
  talent_pool_assessment: string;
  supply_rating: 'abundant' | 'adequate' | 'tight' | 'critical';
  data_source: string;
  notes: string[];
}

async function getONetHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env.ONET_API_KEY;
  if (!apiKey) throw new Error('ONET_API_KEY must be set');
  return {
    'X-API-Key': apiKey,
    Accept: 'application/json',
  };
}

async function searchOccupationCode(keyword: string): Promise<{ code: string; title: string } | null> {
  const headers = await getONetHeaders();
  const url = `https://api-v2.onetcenter.org/online/search?keyword=${encodeURIComponent(keyword)}&end=1`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.occupation || [];
  return results.length > 0 ? { code: results[0].code, title: results[0].title } : null;
}

function socFromOnet(onetCode: string): string {
  // O*NET codes are like 15-1252.00, BLS SOC is 15-1252
  return onetCode.replace(/\.\d+$/, '');
}

async function getBLSEmployment(socCode: string): Promise<{ employment: number | null; per1000: number | null }> {
  // BLS OES series: OEUM + area + occupation code
  // National data: area = 0000000
  const seriesId = `OEUM00000000000000${socCode.replace('-', '')}00000004`;
  try {
    const res = await fetch(`${BLS_BASE_URL}/timeseries/data/${seriesId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: [seriesId],
        startyear: String(new Date().getFullYear() - 1),
        endyear: String(new Date().getFullYear()),
      }),
    });
    if (!res.ok) return { employment: null, per1000: null };
    const data = await res.json();
    const series = data.Results?.series?.[0];
    const latestData = series?.data?.[0];
    return {
      employment: latestData ? parseInt(latestData.value, 10) * 1000 : null,
      per1000: null,
    };
  } catch {
    return { employment: null, per1000: null };
  }
}

async function getEducationDistribution(onetCode: string): Promise<Array<{ level: string; percentage: number }>> {
  const headers = await getONetHeaders();
  const url = `https://api-v2.onetcenter.org/online/occupations/${onetCode}/summary/education`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.education || data.element || []).map((e: any) => ({
      level: e.name || e.category || 'Unknown',
      percentage: e.percentage || e.score?.value || 0,
    }));
  } catch {
    return [];
  }
}

function assessSupply(employment: number | null): {
  rating: 'abundant' | 'adequate' | 'tight' | 'critical';
  assessment: string;
} {
  if (employment === null) {
    return { rating: 'adequate', assessment: 'Unable to determine talent pool size from available data.' };
  }
  if (employment > 500000) return { rating: 'abundant', assessment: 'Large talent pool with significant available workforce.' };
  if (employment > 100000) return { rating: 'adequate', assessment: 'Moderate talent pool that should meet typical hiring needs.' };
  if (employment > 25000) return { rating: 'tight', assessment: 'Smaller talent pool; may face competition for candidates.' };
  return { rating: 'critical', assessment: 'Very limited talent pool; expect significant hiring challenges.' };
}

export async function analyzeSupply(
  occupation: string,
  location: string = 'National'
): Promise<SupplyAnalysis> {
  const cacheKey = `supply:${occupation}:${location}`;
  const cached = await cache.get<SupplyAnalysis>(cacheKey);
  if (cached) return cached;

  const onetResult = await searchOccupationCode(occupation);
  if (!onetResult) {
    throw new Error(`Could not find O*NET occupation for: ${occupation}`);
  }

  const socCode = socFromOnet(onetResult.code);

  const [blsData, education] = await Promise.all([
    getBLSEmployment(socCode),
    getEducationDistribution(onetResult.code),
  ]);

  const supplyAssessment = assessSupply(blsData.employment);

  const result: SupplyAnalysis = {
    occupation: onetResult.title,
    location,
    employment_count: blsData.employment,
    employment_per_1000: blsData.per1000,
    labor_force_participation: null,
    education_levels: education,
    talent_pool_assessment: supplyAssessment.assessment,
    supply_rating: supplyAssessment.rating,
    data_source: 'bls_oes,onet',
    notes: [
      `O*NET code: ${onetResult.code}`,
      `SOC code: ${socCode}`,
      location !== 'National' ? 'Note: Location-specific data may not be available from BLS. National figures shown.' : '',
    ].filter(Boolean),
  };

  await cache.set(cacheKey, result);
  return result;
}
