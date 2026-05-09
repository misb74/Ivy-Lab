import { RateLimiter } from '@auxia/shared';

const BASE_URL = 'https://api.stlouisfed.org/fred';

// Curated labor market series IDs
const LABOR_SERIES = {
  UNRATE: 'Unemployment Rate (%)',
  PAYEMS: 'Total Nonfarm Payrolls (thousands)',
  CIVPART: 'Labor Force Participation Rate (%)',
  JTSJOL: 'JOLTS Job Openings (thousands)',
  JTSQUR: 'JOLTS Quits Rate (%)',
  ICSA: 'Initial Jobless Claims',
} as const;

interface FredObservation {
  realtime_start: string;
  realtime_end: string;
  date: string;
  value: string;
}

interface FredObservationsResponse {
  realtime_start: string;
  realtime_end: string;
  observation_start: string;
  observation_end: string;
  units: string;
  output_type: number;
  file_type: string;
  order_by: string;
  sort_order: string;
  count: number;
  offset: number;
  limit: number;
  observations: FredObservation[];
}

interface FredSeriesInfo {
  id: string;
  realtime_start: string;
  realtime_end: string;
  title: string;
  observation_start: string;
  observation_end: string;
  frequency: string;
  frequency_short: string;
  units: string;
  units_short: string;
  seasonal_adjustment: string;
  seasonal_adjustment_short: string;
  last_updated: string;
  popularity: number;
  notes: string;
}

interface FredSeriesResponse {
  seriess: FredSeriesInfo[];
}

interface FredSearchResult {
  id: string;
  title: string;
  frequency: string;
  units: string;
  seasonal_adjustment: string;
  last_updated: string;
  popularity: number;
  observation_start: string;
  observation_end: string;
  notes: string;
}

interface FredSearchResponse {
  seriess: FredSearchResult[];
  count: number;
  offset: number;
  limit: number;
}

export class FredClient {
  private apiKey: string;
  private rateLimiter: RateLimiter;

  constructor() {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) {
      throw new Error('FRED_API_KEY must be set');
    }
    this.apiKey = apiKey;
    this.rateLimiter = new RateLimiter({ requestsPerMinute: 60, maxConcurrent: 3 });
  }

  private async request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    await this.rateLimiter.acquire();
    try {
      const searchParams = new URLSearchParams({
        ...params,
        api_key: this.apiKey,
        file_type: 'json',
      });

      const url = `${BASE_URL}${path}?${searchParams}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`FRED API error ${res.status}: ${errorText}`);
      }

      return (await res.json()) as T;
    } finally {
      this.rateLimiter.release();
    }
  }

  async getSeries(
    seriesId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    series_id: string;
    observations: { date: string; value: string }[];
    count: number;
    data_source: string;
  }> {
    const params: Record<string, string> = { series_id: seriesId };
    if (startDate) params.observation_start = startDate;
    if (endDate) params.observation_end = endDate;

    const data = await this.request<FredObservationsResponse>(
      '/series/observations',
      params
    );

    return {
      series_id: seriesId,
      observations: (data.observations || []).map((obs) => ({
        date: obs.date,
        value: obs.value,
      })),
      count: data.count || 0,
      data_source: 'fred',
    };
  }

  async searchSeries(
    query: string,
    limit?: number
  ): Promise<{
    query: string;
    results: {
      id: string;
      title: string;
      frequency: string;
      units: string;
      seasonal_adjustment: string;
      last_updated: string;
      popularity: number;
      observation_start: string;
      observation_end: string;
    }[];
    total_count: number;
    data_source: string;
  }> {
    const params: Record<string, string> = {
      search_text: query,
      limit: String(limit || 20),
    };

    const data = await this.request<FredSearchResponse>('/series/search', params);

    return {
      query,
      results: (data.seriess || []).map((s) => ({
        id: s.id,
        title: s.title,
        frequency: s.frequency,
        units: s.units,
        seasonal_adjustment: s.seasonal_adjustment,
        last_updated: s.last_updated,
        popularity: s.popularity,
        observation_start: s.observation_start,
        observation_end: s.observation_end,
      })),
      total_count: data.count || 0,
      data_source: 'fred',
    };
  }

  async getLaborDashboard(): Promise<{
    dashboard: Record<
      string,
      {
        label: string;
        latest_value: string | null;
        latest_date: string | null;
        previous_value: string | null;
        previous_date: string | null;
        change: string | null;
        recent_observations: { date: string; value: string }[];
      }
    >;
    retrieved_at: string;
    data_source: string;
  }> {
    // Fetch all labor series in parallel
    const seriesIds = Object.keys(LABOR_SERIES) as (keyof typeof LABOR_SERIES)[];

    // Get last 12 months of data for trend context
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startDate = oneYearAgo.toISOString().split('T')[0];

    const results = await Promise.all(
      seriesIds.map((id) =>
        this.getSeries(id, startDate).catch((err) => ({
          series_id: id,
          observations: [] as { date: string; value: string }[],
          count: 0,
          data_source: 'fred',
          error: (err as Error).message,
        }))
      )
    );

    const dashboard: Record<
      string,
      {
        label: string;
        latest_value: string | null;
        latest_date: string | null;
        previous_value: string | null;
        previous_date: string | null;
        change: string | null;
        recent_observations: { date: string; value: string }[];
      }
    > = {};

    for (let i = 0; i < seriesIds.length; i++) {
      const id = seriesIds[i];
      const result = results[i];
      const obs = result.observations.filter((o) => o.value !== '.');

      const latest = obs.length > 0 ? obs[obs.length - 1] : null;
      const previous = obs.length > 1 ? obs[obs.length - 2] : null;

      let change: string | null = null;
      if (latest && previous) {
        const latestNum = parseFloat(latest.value);
        const prevNum = parseFloat(previous.value);
        if (!isNaN(latestNum) && !isNaN(prevNum) && prevNum !== 0) {
          const delta = latestNum - prevNum;
          const pctChange = (delta / Math.abs(prevNum)) * 100;
          change = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%)`;
        }
      }

      dashboard[id] = {
        label: LABOR_SERIES[id],
        latest_value: latest?.value ?? null,
        latest_date: latest?.date ?? null,
        previous_value: previous?.value ?? null,
        previous_date: previous?.date ?? null,
        change,
        recent_observations: obs.slice(-6),
      };
    }

    return {
      dashboard,
      retrieved_at: new Date().toISOString(),
      data_source: 'fred',
    };
  }
}
