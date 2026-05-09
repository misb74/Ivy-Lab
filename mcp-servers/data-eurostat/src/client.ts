import { RateLimiter } from '@auxia/shared';

const BASE_URL = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';

const EU27_COUNTRIES: Record<string, string> = {
  AT: 'Austria',
  BE: 'Belgium',
  BG: 'Bulgaria',
  HR: 'Croatia',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DK: 'Denmark',
  EE: 'Estonia',
  FI: 'Finland',
  FR: 'France',
  DE: 'Germany',
  EL: 'Greece',
  HU: 'Hungary',
  IE: 'Ireland',
  IT: 'Italy',
  LV: 'Latvia',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  MT: 'Malta',
  NL: 'Netherlands',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  SK: 'Slovakia',
  SI: 'Slovenia',
  ES: 'Spain',
  SE: 'Sweden',
};

const DATASET_CODES = {
  employment: 'lfsa_ergaed',
  unemployment_monthly: 'une_rt_m',
  unemployment_annual: 'une_rt_a',
  earnings: 'earn_ses_annual',
  labour_cost: 'lc_lci_r2_a',
  job_vacancies: 'jvs_q_nace2',
};

interface EurostatDimension {
  category: {
    index: Record<string, number>;
    label: Record<string, string>;
  };
}

interface EurostatResponse {
  id: string[];
  size: number[];
  dimension: Record<string, EurostatDimension>;
  value: Record<string, number>;
  label?: string;
  status?: Record<string, string>;
}

interface EurostatRecord {
  country: string;
  country_name: string;
  indicator: string;
  value: number;
  year: string;
  unit: string;
  data_source: 'eurostat';
  dimensions?: Record<string, string>;
}

export class EurostatClient {
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter({ requestsPerMinute: 60, maxConcurrent: 3 });
  }

  private async request<T>(datasetCode: string, params: Record<string, string>): Promise<T> {
    await this.rateLimiter.acquire();
    try {
      const queryParams = new URLSearchParams({
        ...params,
        format: 'JSON',
        lang: 'en',
      });

      const url = `${BASE_URL}/${datasetCode}?${queryParams}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Eurostat API error ${res.status}: ${errorText}`);
      }

      return (await res.json()) as T;
    } finally {
      this.rateLimiter.release();
    }
  }

  /**
   * Parse a Eurostat JSON-stat response into flat records.
   *
   * The response contains:
   * - `id`: ordered list of dimension names, e.g. ['geo', 'time', 'sex', ...]
   * - `size`: sizes of each dimension, e.g. [1, 5, 3, ...]
   * - `dimension`: metadata for each dimension with category indices and labels
   * - `value`: flattened values keyed by linear index, e.g. { "0": 72.5, "1": 73.1, ... }
   *
   * To map a flat index back to dimension coordinates:
   *   For dimensions [d0, d1, ..., dN] with sizes [s0, s1, ..., sN],
   *   index = i0 * (s1*s2*...*sN) + i1 * (s2*...*sN) + ... + iN
   */
  private parseResponse(data: EurostatResponse): EurostatRecord[] {
    const records: EurostatRecord[] = [];
    const { id: dimensionIds, size: dimensionSizes, dimension, value } = data;

    if (!dimensionIds || !dimensionSizes || !dimension || !value) {
      return records;
    }

    // Build ordered arrays of category keys for each dimension
    const dimensionKeys: string[][] = dimensionIds.map((dimId) => {
      const dim = dimension[dimId];
      if (!dim?.category?.index) return [];
      // Sort categories by their index value to get correct order
      return Object.entries(dim.category.index)
        .sort(([, a], [, b]) => a - b)
        .map(([key]) => key);
    });

    // Compute strides for index decomposition
    const strides: number[] = new Array(dimensionIds.length);
    strides[dimensionIds.length - 1] = 1;
    for (let i = dimensionIds.length - 2; i >= 0; i--) {
      strides[i] = strides[i + 1] * dimensionSizes[i + 1];
    }

    // Iterate over every value in the flat map
    for (const [flatIndexStr, val] of Object.entries(value)) {
      if (val === null || val === undefined) continue;

      let flatIndex = parseInt(flatIndexStr, 10);
      const coords: Record<string, string> = {};
      const labels: Record<string, string> = {};

      for (let d = 0; d < dimensionIds.length; d++) {
        const dimIndex = Math.floor(flatIndex / strides[d]);
        flatIndex = flatIndex % strides[d];

        const dimId = dimensionIds[d];
        const key = dimensionKeys[d][dimIndex] || String(dimIndex);
        coords[dimId] = key;

        const dimMeta = dimension[dimId];
        labels[dimId] = dimMeta?.category?.label?.[key] || key;
      }

      // Extract standard fields
      const country = coords['geo'] || '';
      const countryName = EU27_COUNTRIES[country] || labels['geo'] || country;
      const year = coords['time'] || coords['TIME_PERIOD'] || '';

      // Build unit from unit dimension if present, else from freq or indicator
      const unit = labels['unit'] || labels['indic_em'] || labels['indic'] || '';

      // Build indicator label from non-geo, non-time dimensions
      const indicatorParts: string[] = [];
      for (const dimId of dimensionIds) {
        if (['geo', 'time', 'TIME_PERIOD', 'freq'].includes(dimId)) continue;
        if (labels[dimId]) indicatorParts.push(labels[dimId]);
      }

      records.push({
        country,
        country_name: countryName,
        indicator: indicatorParts.join(' | ') || 'value',
        value: val,
        year,
        unit,
        data_source: 'eurostat',
        dimensions: coords,
      });
    }

    return records;
  }

  async getEmploymentData(
    country: string,
    ageGroup: string = 'Y20-64',
    sex: string = 'T',
    year?: string
  ): Promise<EurostatRecord[]> {
    const params: Record<string, string> = {
      geo: country.toUpperCase(),
      age: ageGroup,
      sex,
      unit: 'PC',
      isced11: 'TOTAL',
      citizen: 'TOTAL',
    };

    if (year) {
      params['time'] = year;
    } else {
      // Request the most recent 5 years
      const currentYear = new Date().getFullYear();
      const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
      params['time'] = years.join('&time=');
    }

    const data = await this.request<EurostatResponse>(DATASET_CODES.employment, params);
    const records = this.parseResponse(data);

    return records.map((r) => ({
      ...r,
      indicator: `Employment rate (${ageGroup}, ${sex === 'T' ? 'Total' : sex})`,
    }));
  }

  async getWages(
    country: string,
    year?: string
  ): Promise<EurostatRecord[]> {
    const allRecords: EurostatRecord[] = [];

    // Try labour cost index first (more widely available)
    try {
      const lciParams: Record<string, string> = {
        geo: country.toUpperCase(),
        unit: 'I20',
        nace_r2: 'B-S',
        lcstruct: 'D1_D4_MD5',
      };

      if (year) {
        lciParams['time'] = year;
      } else {
        const currentYear = new Date().getFullYear();
        const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
        lciParams['time'] = years.join('&time=');
      }

      const lciData = await this.request<EurostatResponse>(DATASET_CODES.labour_cost, lciParams);
      const lciRecords = this.parseResponse(lciData);
      allRecords.push(
        ...lciRecords.map((r) => ({
          ...r,
          indicator: 'Labour cost index (total economy)',
        }))
      );
    } catch {
      // Labour cost index not available for this country, continue
    }

    // Try annual earnings survey
    try {
      const earningsParams: Record<string, string> = {
        geo: country.toUpperCase(),
        nace_r2: 'B-S',
        isco08: 'TOTAL',
        worktime: 'TOTAL',
        age: 'TOTAL',
        sex: 'T',
      };

      if (year) {
        earningsParams['time'] = year;
      } else {
        const currentYear = new Date().getFullYear();
        const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
        earningsParams['time'] = years.join('&time=');
      }

      const earningsData = await this.request<EurostatResponse>(
        DATASET_CODES.earnings,
        earningsParams
      );
      const earningsRecords = this.parseResponse(earningsData);
      allRecords.push(
        ...earningsRecords.map((r) => ({
          ...r,
          indicator: 'Annual earnings (structure of earnings survey)',
        }))
      );
    } catch {
      // Annual earnings not available for this country, continue
    }

    if (allRecords.length === 0) {
      throw new Error(
        `No wage or labour cost data found for country: ${country}. ` +
          `This may be because Eurostat has not published data for this country yet.`
      );
    }

    return allRecords;
  }

  async compareCountries(
    countries: string[],
    indicator: string,
    year?: string
  ): Promise<EurostatRecord[]> {
    const allRecords: EurostatRecord[] = [];

    const geoParam = countries.map((c) => c.toUpperCase()).join('&geo=');

    if (indicator === 'unemployment_rate') {
      const params: Record<string, string> = {
        geo: geoParam,
        sex: 'T',
        age: 'Y15-74',
        unit: 'PC_ACT',
      };

      if (year) {
        params['time'] = year;
      } else {
        const currentYear = new Date().getFullYear();
        const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
        params['time'] = years.join('&time=');
      }

      const data = await this.request<EurostatResponse>(
        DATASET_CODES.unemployment_annual,
        params
      );
      const records = this.parseResponse(data);
      allRecords.push(
        ...records.map((r) => ({
          ...r,
          indicator: 'Unemployment rate (15-74, Total)',
        }))
      );
    } else if (indicator === 'employment_rate') {
      const params: Record<string, string> = {
        geo: geoParam,
        sex: 'T',
        age: 'Y20-64',
        unit: 'PC',
        isced11: 'TOTAL',
        citizen: 'TOTAL',
      };

      if (year) {
        params['time'] = year;
      } else {
        const currentYear = new Date().getFullYear();
        const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
        params['time'] = years.join('&time=');
      }

      const data = await this.request<EurostatResponse>(DATASET_CODES.employment, params);
      const records = this.parseResponse(data);
      allRecords.push(
        ...records.map((r) => ({
          ...r,
          indicator: 'Employment rate (20-64, Total)',
        }))
      );
    } else {
      throw new Error(
        `Unsupported indicator: ${indicator}. Use 'employment_rate' or 'unemployment_rate'.`
      );
    }

    if (allRecords.length === 0) {
      throw new Error(
        `No data found for countries: ${countries.join(', ')} with indicator: ${indicator}`
      );
    }

    return allRecords;
  }
}
