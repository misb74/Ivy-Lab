import { RateLimiter } from '@auxia/shared';

const BASE_URL = 'https://sdmx.ilo.org/rest';

// Key ILOSTAT dataflow indicator IDs
const KEY_DATAFLOWS: Record<string, string> = {
  UNE_DEAP_SEX_AGE_RT: 'Unemployment rate by sex and age',
  EMP_TEMP_SEX_AGE_NB: 'Employment by sex and age',
  EAP_TEAP_SEX_AGE_RT: 'Labour force participation rate',
  EAR_INEE_SEX_ECO_CUR_NB: 'Mean nominal monthly earnings',
  EMP_TEMP_SEX_ECO_NB: 'Employment by economic activity',
};

interface IlostatObservation {
  country: string;
  indicator: string;
  indicator_name: string;
  year: string;
  value: number | null;
  unit: string;
  frequency: string;
  classif1: string;
  classif2: string;
  data_source: 'ilostat';
}

interface IlostatDataflow {
  id: string;
  name: string;
  description: string;
  data_source: 'ilostat';
}

interface SdmxJsonResponse {
  dataSets?: Array<{
    series?: Record<string, { observations?: Record<string, [number | null, ...any[]]> }>;
  }>;
  structure?: {
    name?: string;
    dimensions?: {
      series?: Array<{
        id: string;
        name: string;
        values: Array<{ id: string; name: string }>;
      }>;
      observation?: Array<{
        id: string;
        name: string;
        values: Array<{ id: string; name: string }>;
      }>;
    };
  };
}

interface SdmxDataflowResponse {
  Dataflow?: Array<{
    id: string;
    name: string;
    names?: Record<string, string>;
    description?: string;
    descriptions?: Record<string, string>;
  }>;
}

export class IlostatClient {
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter({ requestsPerMinute: 30, maxConcurrent: 2 });
  }

  private async request<T>(url: string): Promise<T> {
    await this.rateLimiter.acquire();
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`ILOSTAT API error ${res.status}: ${errorText}`);
      }

      return (await res.json()) as T;
    } finally {
      this.rateLimiter.release();
    }
  }

  /**
   * Parse the SDMX JSON data response into flat observation records.
   *
   * SDMX JSON uses positional indices for both series keys and observation keys.
   * A series key like "0:1:0:0" means dimension[0]=values[0], dimension[1]=values[1], etc.
   * Observation keys like "0", "1" map to the observation-level dimension (usually TIME_PERIOD).
   */
  private parseSdmxData(data: SdmxJsonResponse, indicator: string): IlostatObservation[] {
    const results: IlostatObservation[] = [];

    const dataSet = data.dataSets?.[0];
    const structure = data.structure;
    if (!dataSet?.series || !structure?.dimensions) return results;

    const seriesDims = structure.dimensions.series || [];
    const obsDims = structure.dimensions.observation || [];

    const indicatorName = structure.name || KEY_DATAFLOWS[indicator] || indicator;

    for (const [seriesKey, seriesObj] of Object.entries(dataSet.series)) {
      const indices = seriesKey.split(':').map(Number);

      // Map each series dimension index to its value
      const dimValues: Record<string, { id: string; name: string }> = {};
      for (let i = 0; i < seriesDims.length && i < indices.length; i++) {
        const dim = seriesDims[i];
        const valueIndex = indices[i];
        if (dim.values[valueIndex]) {
          dimValues[dim.id] = dim.values[valueIndex];
        }
      }

      const country = dimValues['REF_AREA']?.id || '';
      const frequency = dimValues['FREQ']?.id || '';
      const classif1 = dimValues['CLASSIF1']?.name || dimValues['CLASSIF1']?.id || '';
      const classif2 = dimValues['CLASSIF2']?.name || dimValues['CLASSIF2']?.id || '';
      const unit = dimValues['UNIT_MEASURE']?.name || dimValues['UNIT_MEASURE']?.id || '';

      if (!seriesObj.observations) continue;

      for (const [obsKey, obsValues] of Object.entries(seriesObj.observations)) {
        const obsIndex = Number(obsKey);
        const timeDim = obsDims[0]; // TIME_PERIOD is typically the first observation dimension
        const timePeriod = timeDim?.values[obsIndex]?.id || obsKey;
        const value = obsValues[0];

        results.push({
          country,
          indicator,
          indicator_name: indicatorName,
          year: timePeriod,
          value: value !== null && value !== undefined ? value : null,
          unit,
          frequency,
          classif1,
          classif2,
          data_source: 'ilostat',
        });
      }
    }

    // Sort by year ascending
    results.sort((a, b) => a.year.localeCompare(b.year));

    return results;
  }

  /**
   * Get a specific labor market indicator for a country.
   * Uses the SDMX data endpoint with wildcards for classification dimensions.
   */
  async getIndicator(
    indicator: string,
    country: string,
    startYear?: string,
    endYear?: string
  ): Promise<IlostatObservation[]> {
    // Build the SDMX key: {country}.{frequency}.{classif1}.{classif2}
    // Use wildcards for dimensions we don't want to filter on
    const key = `${country.toUpperCase()}...`;

    let url = `${BASE_URL}/data/ILO,DF_${indicator}/${key}?format=jsondata`;

    if (startYear) {
      url += `&startPeriod=${startYear}`;
    }
    if (endYear) {
      url += `&endPeriod=${endYear}`;
    }

    const data = await this.request<SdmxJsonResponse>(url);
    return this.parseSdmxData(data, indicator);
  }

  /**
   * Search available ILOSTAT dataflows/indicators by keyword.
   * Fetches the full dataflow list and filters by name.
   */
  async searchIndicators(query: string): Promise<IlostatDataflow[]> {
    const url = `${BASE_URL}/dataflow/ILO?format=jsondata`;

    const data = await this.request<SdmxDataflowResponse>(url);
    const dataflows = data.Dataflow || [];
    const queryLower = query.toLowerCase();

    const results: IlostatDataflow[] = [];

    for (const df of dataflows) {
      const name =
        (df.names && (df.names['en'] || Object.values(df.names)[0])) ||
        df.name ||
        df.id;
      const description =
        (df.descriptions && (df.descriptions['en'] || Object.values(df.descriptions)[0])) ||
        df.description ||
        '';

      const searchText = `${name} ${description} ${df.id}`.toLowerCase();
      if (searchText.includes(queryLower)) {
        results.push({
          id: df.id,
          name,
          description,
          data_source: 'ilostat',
        });
      }
    }

    return results;
  }

  /**
   * Compare an indicator across multiple countries for a given year (or latest available).
   * Fetches data for each country and returns a unified comparison.
   */
  async countryComparison(
    indicator: string,
    countries: string[],
    year?: string
  ): Promise<IlostatObservation[]> {
    const results: IlostatObservation[] = [];

    // Determine the period filter: if year provided use that, otherwise last 3 years
    const currentYear = new Date().getFullYear();
    const startYear = year || String(currentYear - 3);
    const endYear = year || String(currentYear);

    for (const country of countries) {
      try {
        const observations = await this.getIndicator(indicator, country, startYear, endYear);

        if (year) {
          // Return only observations for the exact year
          const matching = observations.filter((obs) => obs.year === year);
          results.push(...matching);
        } else {
          // Return the most recent observation per series
          const latestByKey = new Map<string, IlostatObservation>();
          for (const obs of observations) {
            const key = `${obs.country}:${obs.classif1}:${obs.classif2}`;
            const existing = latestByKey.get(key);
            if (!existing || obs.year > existing.year) {
              latestByKey.set(key, obs);
            }
          }
          results.push(...latestByKey.values());
        }
      } catch (error) {
        // Include an error entry so the caller knows this country failed
        results.push({
          country: country.toUpperCase(),
          indicator,
          indicator_name: KEY_DATAFLOWS[indicator] || indicator,
          year: year || 'N/A',
          value: null,
          unit: '',
          frequency: '',
          classif1: '',
          classif2: '',
          data_source: 'ilostat',
        });
      }
    }

    return results;
  }
}
