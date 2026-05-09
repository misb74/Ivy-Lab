import type { Compensation, WageData, LaborMarketTrend } from '@auxia/shared';

const BASE_URL = 'https://api.bls.gov/publicAPI/v2';

// BLS MSA area codes (7-digit, zero-padded CBSA codes)
// National uses a special prefix (OEUN) rather than an area code
const BLS_AREA_CODES: Record<string, string> = {
  national: '0000000',
  new_york: '0035620',
  los_angeles: '0031080',
  chicago: '0016980',
  dallas: '0019100',
  houston: '0026420',
  washington_dc: '0047900',
  philadelphia: '0037980',
  miami: '0033100',
  atlanta: '0012060',
  boston: '0014460',
  san_francisco: '0041860',
  phoenix: '0038060',
  riverside: '0040140',
  detroit: '0019820',
  seattle: '0042660',
  minneapolis: '0033460',
  san_diego: '0041740',
  tampa: '0045300',
  denver: '0019740',
  st_louis: '0041180',
  baltimore: '0012580',
  orlando: '0036740',
  charlotte: '0016740',
  san_antonio: '0041700',
  portland: '0038900',
  sacramento: '0040900',
  pittsburgh: '0038300',
  austin: '0012420',
  las_vegas: '0029820',
  cincinnati: '0017140',
  kansas_city: '0028140',
  columbus: '0018140',
  indianapolis: '0026900',
  cleveland: '0017460',
  nashville: '0034980',
  virginia_beach: '0047260',
  milwaukee: '0033340',
  jacksonville: '0027260',
  raleigh: '0039580',
  salt_lake_city: '0041620',
};

// State FIPS codes for LAUS unemployment series
const STATE_FIPS: Record<string, string> = {
  alabama: '01', alaska: '02', arizona: '04', arkansas: '05',
  california: '06', colorado: '08', connecticut: '09', delaware: '10',
  florida: '12', georgia: '13', hawaii: '15', idaho: '16',
  illinois: '17', indiana: '18', iowa: '19', kansas: '20',
  kentucky: '21', louisiana: '22', maine: '23', maryland: '24',
  massachusetts: '25', michigan: '26', minnesota: '27', mississippi: '28',
  missouri: '29', montana: '30', nebraska: '31', nevada: '32',
  new_hampshire: '33', new_jersey: '34', new_mexico: '35', new_york: '36',
  north_carolina: '37', north_dakota: '38', ohio: '39', oklahoma: '40',
  oregon: '41', pennsylvania: '42', rhode_island: '44', south_carolina: '45',
  south_dakota: '46', tennessee: '47', texas: '48', utah: '49',
  vermont: '50', virginia: '51', washington: '53', west_virginia: '54',
  wisconsin: '55', wyoming: '56', district_of_columbia: '11',
};

// CPS occupation group unemployment series (LNU04 prefix)
// Maps SOC major groups to BLS CPS series IDs
const CPS_OCCUPATION_UNEMPLOYMENT: Record<string, { seriesId: string; label: string }> = {
  '11': { seriesId: 'LNU04032183', label: 'Management occupations' },
  '13': { seriesId: 'LNU04034239', label: 'Business and financial operations' },
  '15': { seriesId: 'LNU04032215', label: 'Computer and mathematical occupations' },
  '17': { seriesId: 'LNU04032219', label: 'Architecture and engineering' },
  '19': { seriesId: 'LNU04032223', label: 'Life, physical, and social science' },
  '21': { seriesId: 'LNU04032227', label: 'Community and social service' },
  '23': { seriesId: 'LNU04032231', label: 'Legal occupations' },
  '25': { seriesId: 'LNU04032235', label: 'Educational instruction and library' },
  '27': { seriesId: 'LNU04034243', label: 'Arts, design, entertainment, sports, media' },
  '29': { seriesId: 'LNU04034247', label: 'Healthcare practitioners and technical' },
  '31': { seriesId: 'LNU04034251', label: 'Healthcare support' },
  '33': { seriesId: 'LNU04034255', label: 'Protective service' },
  '35': { seriesId: 'LNU04034259', label: 'Food preparation and serving' },
  '37': { seriesId: 'LNU04034263', label: 'Building and grounds cleaning and maintenance' },
  '39': { seriesId: 'LNU04034267', label: 'Personal care and service' },
  '41': { seriesId: 'LNU04034271', label: 'Sales and related' },
  '43': { seriesId: 'LNU04034275', label: 'Office and administrative support' },
  '45': { seriesId: 'LNU04034279', label: 'Farming, fishing, and forestry' },
  '47': { seriesId: 'LNU04034283', label: 'Construction and extraction' },
  '49': { seriesId: 'LNU04034287', label: 'Installation, maintenance, and repair' },
  '51': { seriesId: 'LNU04034291', label: 'Production' },
  '53': { seriesId: 'LNU04034295', label: 'Transportation and material moving' },
};

// Data type suffixes for OES series IDs
const DATA_TYPES: Record<string, string> = {
  employment: '01',
  hourly_mean: '03',
  annual_mean: '04',
  hourly_p10: '07',
  hourly_p25: '08',
  hourly_median: '09',
  hourly_p75: '10',
  hourly_p90: '11',
  annual_p10: '12',
  annual_p25: '13',
  annual_median: '14',
  annual_p75: '15',
  annual_p90: '16',
};

export class BLSClient {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.BLS_API_KEY;
  }

  private buildSeriesId(areaCode: string, occupationCode: string, dataType: string): string {
    // OES series ID format:
    //   National: OEUN{area_code}000000{occ_code}{data_type}
    //   Metro:    OEUM{area_code}000000{occ_code}{data_type}
    const cleanOcc = occupationCode.replace('-', '');
    const prefix = areaCode === '0000000' ? 'OEUN' : 'OEUM';
    return `${prefix}${areaCode}000000${cleanOcc}${dataType}`;
  }

  private resolveAreaCode(location?: string): string {
    if (!location) return BLS_AREA_CODES.national;
    const key = location.toLowerCase().replace(/[\s-]+/g, '_');
    return BLS_AREA_CODES[key] || BLS_AREA_CODES.national;
  }

  private async request<T>(body: Record<string, any>): Promise<T> {
    const res = await fetch(`${BASE_URL}/timeseries/data/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        ...(this.apiKey ? { registrationkey: this.apiKey } : {}),
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`BLS API error ${res.status}: ${errorText}`);
    }

    const data = (await res.json()) as any;

    if (data.status !== 'REQUEST_SUCCEEDED') {
      throw new Error(`BLS API error: ${data.message?.join(', ') || 'Unknown error'}`);
    }

    return data as T;
  }

  private getLatestValue(seriesData: any[]): number | undefined {
    if (!seriesData || seriesData.length === 0) return undefined;

    // Sort by year descending, get most recent
    const sorted = [...seriesData].sort((a, b) => {
      const yearDiff = parseInt(b.year) - parseInt(a.year);
      if (yearDiff !== 0) return yearDiff;
      return (b.period || '').localeCompare(a.period || '');
    });

    const value = parseFloat(sorted[0].value);
    return isNaN(value) ? undefined : value;
  }

  async getOccupationWages(occupationCode: string, location?: string): Promise<Compensation> {
    const areaCode = this.resolveAreaCode(location);

    const seriesIds = [
      this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.annual_mean),
      this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.annual_median),
      this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.annual_p10),
      this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.annual_p25),
      this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.annual_p75),
      this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.annual_p90),
      this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.hourly_mean),
      this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.employment),
    ];

    const currentYear = new Date().getFullYear();
    const data = await this.request<{ Results: { series: any[] } }>({
      seriesid: seriesIds,
      startyear: String(currentYear - 2),
      endyear: String(currentYear),
    });

    const seriesMap = new Map<string, any[]>();
    for (const series of data.Results?.series || []) {
      seriesMap.set(series.seriesID, series.data || []);
    }

    const wages: WageData = {
      annual_mean: this.getLatestValue(
        seriesMap.get(this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.annual_mean)) || []
      ),
      median: this.getLatestValue(
        seriesMap.get(this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.annual_median)) || []
      ),
      p10: this.getLatestValue(
        seriesMap.get(this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.annual_p10)) || []
      ),
      p25: this.getLatestValue(
        seriesMap.get(this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.annual_p25)) || []
      ),
      p75: this.getLatestValue(
        seriesMap.get(this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.annual_p75)) || []
      ),
      p90: this.getLatestValue(
        seriesMap.get(this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.annual_p90)) || []
      ),
      hourly_mean: this.getLatestValue(
        seriesMap.get(this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.hourly_mean)) || []
      ),
    };

    const employmentCount = this.getLatestValue(
      seriesMap.get(this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.employment)) || []
    );

    return {
      role: occupationCode,
      location: location || 'national',
      wages,
      currency: 'USD',
      wage_type: 'annual',
      occupation_code: occupationCode,
      employment_count: employmentCount,
      data_source: 'bls',
      reference_period: `${currentYear - 2}-${currentYear}`,
    };
  }

  async getWageComparison(
    occupationCode: string,
    locations: string[]
  ): Promise<Compensation[]> {
    const results: Compensation[] = [];

    for (const location of locations) {
      try {
        const compensation = await this.getOccupationWages(occupationCode, location);
        results.push(compensation);
      } catch (error) {
        // Include error entry for locations that fail
        results.push({
          role: occupationCode,
          location,
          wages: {},
          currency: 'USD',
          data_source: 'bls',
          metadata: { error: (error as Error).message },
        });
      }
    }

    return results;
  }

  async getEmploymentTrend(
    occupationCode: string,
    location?: string,
    years: number = 5
  ): Promise<LaborMarketTrend[]> {
    const areaCode = this.resolveAreaCode(location);
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - years;

    const seriesIds = [
      this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.employment),
      this.buildSeriesId(areaCode, occupationCode, DATA_TYPES.annual_mean),
    ];

    const data = await this.request<{ Results: { series: any[] } }>({
      seriesid: seriesIds,
      startyear: String(startYear),
      endyear: String(currentYear),
    });

    const trends: LaborMarketTrend[] = [];

    for (const series of data.Results?.series || []) {
      const isEmployment = series.seriesID.endsWith(DATA_TYPES.employment);
      const metric = isEmployment ? 'employment' : 'annual_mean_wage';

      // Sort data by year
      const sortedData = [...(series.data || [])].sort(
        (a: any, b: any) => parseInt(a.year) - parseInt(b.year)
      );

      for (let i = 0; i < sortedData.length; i++) {
        const current = parseFloat(sortedData[i].value);
        const previous = i > 0 ? parseFloat(sortedData[i - 1].value) : undefined;

        if (isNaN(current)) continue;

        let changePercent: number | undefined;
        let trendDirection = 'stable';

        if (previous !== undefined && !isNaN(previous) && previous > 0) {
          changePercent = ((current - previous) / previous) * 100;
          if (changePercent > 1) trendDirection = 'increasing';
          else if (changePercent < -1) trendDirection = 'decreasing';
        }

        trends.push({
          metric,
          value: current,
          previous_value: previous,
          change_percent: changePercent,
          trend_direction: trendDirection,
          period: `${sortedData[i].year}-${sortedData[i].period || 'A01'}`,
          location: location || 'national',
          occupation: occupationCode,
          data_source: 'bls',
        });
      }
    }

    return trends;
  }

  // ── Unemployment Methods ─────────────────────────────────────────────────

  /**
   * Get unemployment rate for an occupation group via CPS data.
   * BLS CPS reports unemployment at the SOC major group level (2-digit),
   * so we map any SOC code to its major group.
   */
  async getOccupationUnemployment(
    occupationCodes: string[],
    years: number = 3
  ): Promise<{
    national_rate: number | undefined;
    occupations: Array<{
      occupation_code: string;
      major_group: string;
      label: string;
      unemployment_rate: number | undefined;
      previous_rate: number | undefined;
      change_points: number | undefined;
      trend: string;
      series: Array<{ period: string; value: number }>;
    }>;
    reference_period: string;
    data_source: string;
  }> {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - years;

    // Deduplicate major groups from the input codes
    const majorGroups = new Map<string, string[]>();
    for (const code of occupationCodes) {
      const major = code.split('-')[0];
      if (!majorGroups.has(major)) majorGroups.set(major, []);
      majorGroups.get(major)!.push(code);
    }

    // Build series list: national rate + each occupation group
    const seriesIds: string[] = ['LNS14000000']; // national unemployment rate
    const groupOrder: string[] = [];

    for (const major of majorGroups.keys()) {
      const entry = CPS_OCCUPATION_UNEMPLOYMENT[major];
      if (entry) {
        seriesIds.push(entry.seriesId);
        groupOrder.push(major);
      }
    }

    const data = await this.request<{ Results: { series: any[] } }>({
      seriesid: seriesIds,
      startyear: String(startYear),
      endyear: String(currentYear),
    });

    const seriesMap = new Map<string, any[]>();
    for (const series of data.Results?.series || []) {
      seriesMap.set(series.seriesID, series.data || []);
    }

    // Helper: extract valid data points sorted chronologically
    const extractSeries = (rawData: any[]) => {
      return [...rawData]
        .filter(d => d.value && d.value !== '-')
        .sort((a, b) => {
          const yearDiff = parseInt(a.year) - parseInt(b.year);
          if (yearDiff !== 0) return yearDiff;
          return (a.period || '').localeCompare(b.period || '');
        })
        .map(d => ({
          period: `${d.year}-${d.period}`,
          value: parseFloat(d.value),
        }));
    };

    // National rate
    const nationalSeries = extractSeries(seriesMap.get('LNS14000000') || []);
    const nationalRate = nationalSeries.length > 0
      ? nationalSeries[nationalSeries.length - 1].value
      : undefined;

    // Per-occupation group
    const occupations = [];
    for (const major of groupOrder) {
      const entry = CPS_OCCUPATION_UNEMPLOYMENT[major]!;
      const series = extractSeries(seriesMap.get(entry.seriesId) || []);
      const latest = series.length > 0 ? series[series.length - 1].value : undefined;

      // Find same-month previous year for YoY comparison
      let previousRate: number | undefined;
      if (series.length >= 13) {
        const latestPeriod = series[series.length - 1]?.period;
        const latestMonth = latestPeriod?.split('-')[1];
        const prevYear = series.find(
          s => s.period.endsWith(latestMonth!) &&
            s.period !== latestPeriod
        );
        // Take the most recent previous-year match
        const prevYearMatches = series.filter(
          s => s.period.endsWith(latestMonth!) && s.period !== latestPeriod
        );
        previousRate = prevYearMatches.length > 0
          ? prevYearMatches[prevYearMatches.length - 1].value
          : undefined;
      }

      const changePoints = (latest !== undefined && previousRate !== undefined)
        ? Math.round((latest - previousRate) * 10) / 10
        : undefined;

      let trend = 'stable';
      if (changePoints !== undefined) {
        if (changePoints > 0.3) trend = 'increasing';
        else if (changePoints < -0.3) trend = 'decreasing';
      }

      // Map back to all input codes that share this major group
      for (const code of majorGroups.get(major) || []) {
        occupations.push({
          occupation_code: code,
          major_group: major,
          label: entry.label,
          unemployment_rate: latest,
          previous_rate: previousRate,
          change_points: changePoints,
          trend,
          series: series.slice(-12), // last 12 months
        });
      }
    }

    return {
      national_rate: nationalRate,
      occupations,
      reference_period: `${startYear}-${currentYear}`,
      data_source: 'bls_cps',
    };
  }

  /**
   * Get state-level unemployment rate from LAUS.
   * Series format: LAUST{fips2}0000000000003
   */
  async getStateUnemployment(
    states: string[],
    years: number = 3
  ): Promise<{
    national_rate: number | undefined;
    states: Array<{
      state: string;
      fips: string;
      unemployment_rate: number | undefined;
      previous_rate: number | undefined;
      change_points: number | undefined;
      trend: string;
      series: Array<{ period: string; value: number }>;
    }>;
    reference_period: string;
    data_source: string;
  }> {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - years;

    const seriesIds: string[] = ['LNS14000000']; // national baseline
    const stateOrder: Array<{ state: string; fips: string }> = [];

    for (const state of states) {
      const key = state.toLowerCase().replace(/[\s-]+/g, '_');
      const fips = STATE_FIPS[key];
      if (fips) {
        seriesIds.push(`LAUST${fips}0000000000003`);
        stateOrder.push({ state: key, fips });
      }
    }

    const data = await this.request<{ Results: { series: any[] } }>({
      seriesid: seriesIds,
      startyear: String(startYear),
      endyear: String(currentYear),
    });

    const seriesMap = new Map<string, any[]>();
    for (const series of data.Results?.series || []) {
      seriesMap.set(series.seriesID, series.data || []);
    }

    const extractSeries = (rawData: any[]) => {
      return [...rawData]
        .filter(d => d.value && d.value !== '-')
        .sort((a, b) => {
          const yearDiff = parseInt(a.year) - parseInt(b.year);
          if (yearDiff !== 0) return yearDiff;
          return (a.period || '').localeCompare(b.period || '');
        })
        .map(d => ({
          period: `${d.year}-${d.period}`,
          value: parseFloat(d.value),
        }));
    };

    const nationalSeries = extractSeries(seriesMap.get('LNS14000000') || []);
    const nationalRate = nationalSeries.length > 0
      ? nationalSeries[nationalSeries.length - 1].value
      : undefined;

    const stateResults = [];
    for (const { state, fips } of stateOrder) {
      const seriesId = `LAUST${fips}0000000000003`;
      const series = extractSeries(seriesMap.get(seriesId) || []);
      const latest = series.length > 0 ? series[series.length - 1].value : undefined;

      let previousRate: number | undefined;
      if (series.length >= 13) {
        const latestPeriod = series[series.length - 1]?.period;
        const latestMonth = latestPeriod?.split('-')[1];
        const prevYearMatches = series.filter(
          s => s.period.endsWith(latestMonth!) && s.period !== latestPeriod
        );
        previousRate = prevYearMatches.length > 0
          ? prevYearMatches[prevYearMatches.length - 1].value
          : undefined;
      }

      const changePoints = (latest !== undefined && previousRate !== undefined)
        ? Math.round((latest - previousRate) * 10) / 10
        : undefined;

      let trend = 'stable';
      if (changePoints !== undefined) {
        if (changePoints > 0.3) trend = 'increasing';
        else if (changePoints < -0.3) trend = 'decreasing';
      }

      stateResults.push({
        state,
        fips,
        unemployment_rate: latest,
        previous_rate: previousRate,
        change_points: changePoints,
        trend,
        series: series.slice(-12),
      });
    }

    return {
      national_rate: nationalRate,
      states: stateResults,
      reference_period: `${startYear}-${currentYear}`,
      data_source: 'bls_laus',
    };
  }
}
