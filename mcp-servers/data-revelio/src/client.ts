import { RateLimiter } from '@auxia/shared';

const BASE_URL = 'https://www.reveliolabs.com';
const PUBLIC_STATS_URL = `${BASE_URL}/public-labor-statistics/`;

// Known Revelio Labs data API endpoint patterns (discovered from page network requests)
const DATA_API_PATTERNS = [
  `${BASE_URL}/api/public-labor-statistics`,
  `${BASE_URL}/api/v1/public/labor-statistics`,
  `${BASE_URL}/wp-json/revelio/v1/labor-statistics`,
];

interface RevelioLaborStats {
  employment_level: number | null;
  job_openings: number | null;
  new_hires: number | null;
  attrition: number | null;
  median_salary_new_openings: number | null;
  period: string | null;
  metrics: Record<string, any>;
  retrieved_at: string;
  data_source: 'revelio';
  source_url: string;
  methodology: string;
  note: string | null;
}

interface RevelioHiringTrends {
  trends: Array<{
    period: string;
    hiring_rate: number | null;
    attrition_rate: number | null;
    net_growth: number | null;
    job_openings: number | null;
  }>;
  summary: {
    avg_hiring_rate: number | null;
    avg_attrition_rate: number | null;
    avg_net_growth: number | null;
    trend_direction: string | null;
    months_covered: number;
  };
  retrieved_at: string;
  data_source: 'revelio';
  source_url: string;
  methodology: string;
  note: string | null;
}

export class RevelioClient {
  private rateLimiter: RateLimiter;

  constructor() {
    // No auth needed — public data. Be respectful with rate limiting since it's a website.
    this.rateLimiter = new RateLimiter({ requestsPerMinute: 10, maxConcurrent: 1 });
  }

  /**
   * Attempt to fetch data from potential API endpoints, then fall back to HTML scraping.
   */
  private async fetchWithFallback(url: string): Promise<{ html: string; status: number }> {
    await this.rateLimiter.acquire();
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Ivy-WorkVine/2.0 (workforce-intelligence; respectful-scraping)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const html = await res.text();
      return { html, status: res.status };
    } finally {
      this.rateLimiter.release();
    }
  }

  /**
   * Attempt to find a JSON API endpoint the page uses for data.
   */
  private async tryApiEndpoints(): Promise<Record<string, any> | null> {
    for (const apiUrl of DATA_API_PATTERNS) {
      try {
        await this.rateLimiter.acquire();
        try {
          const res = await fetch(apiUrl, {
            headers: {
              'User-Agent': 'Ivy-WorkVine/2.0 (workforce-intelligence; respectful-scraping)',
              Accept: 'application/json',
            },
          });

          if (res.ok) {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              return (await res.json()) as Record<string, any>;
            }
          }
        } finally {
          this.rateLimiter.release();
        }
      } catch {
        // Endpoint doesn't exist or returned error — try next
        continue;
      }
    }
    return null;
  }

  /**
   * Extract structured data from Revelio's public labor statistics page HTML.
   * The page likely embeds data via:
   *   1. JSON-LD or __NEXT_DATA__ / __NUXT__ script tags
   *   2. Inline JavaScript objects with chart data
   *   3. Visible text in metric cards/tables
   */
  private extractDataFromHtml(html: string): Record<string, any> {
    const extracted: Record<string, any> = {};

    // Strategy 1: Look for __NEXT_DATA__ (Next.js pages embed props here)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        extracted.__next_data = nextData?.props?.pageProps || nextData;
      } catch {
        // Malformed JSON — continue
      }
    }

    // Strategy 2: Look for embedded JSON blobs in script tags (common patterns)
    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of scriptMatches) {
      const content = match[1];

      // Look for chart data objects
      const jsonPatterns = [
        /window\.__DATA__\s*=\s*({[\s\S]*?});/,
        /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/,
        /var\s+chartData\s*=\s*({[\s\S]*?});/,
        /const\s+data\s*=\s*({[\s\S]*?});/,
        /"employment[_\s]?level"\s*:\s*([\d,.]+)/i,
        /"job[_\s]?openings"\s*:\s*([\d,.]+)/i,
        /"new[_\s]?hires"\s*:\s*([\d,.]+)/i,
        /"attrition"\s*:\s*([\d,.]+)/i,
        /"median[_\s]?salary"\s*:\s*([\d,.]+)/i,
      ];

      for (const pattern of jsonPatterns) {
        const jsonMatch = content.match(pattern);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            Object.assign(extracted, parsed);
          } catch {
            // If it's a numeric capture, store as metric
            if (jsonMatch[1] && /^[\d,.]+$/.test(jsonMatch[1].trim())) {
              const key = pattern.source.match(/"([^"]+)"/)?.[1] || 'unknown_metric';
              extracted[key] = parseFloat(jsonMatch[1].replace(/,/g, ''));
            }
          }
        }
      }
    }

    // Strategy 3: Extract visible metric values from common HTML patterns
    // Look for numbers near labor-related keywords
    const metricPatterns = [
      { key: 'employment_level', pattern: /employment\s*(?:level)?[:\s]*(?:<[^>]+>)*\s*([\d,.]+\s*[MmKk]?)/i },
      { key: 'job_openings', pattern: /job\s*openings?[:\s]*(?:<[^>]+>)*\s*([\d,.]+\s*[MmKk]?)/i },
      { key: 'new_hires', pattern: /new\s*hires?[:\s]*(?:<[^>]+>)*\s*([\d,.]+\s*[MmKk]?)/i },
      { key: 'attrition', pattern: /attrition[:\s]*(?:<[^>]+>)*\s*([\d,.]+\s*[MmKk%]?)/i },
      { key: 'median_salary', pattern: /median\s*salary[:\s]*(?:<[^>]+>)*\s*\$?([\d,.]+\s*[MmKk]?)/i },
      { key: 'hiring_rate', pattern: /hiring\s*rate[:\s]*(?:<[^>]+>)*\s*([\d,.]+\s*%?)/i },
      { key: 'attrition_rate', pattern: /attrition\s*rate[:\s]*(?:<[^>]+>)*\s*([\d,.]+\s*%?)/i },
    ];

    for (const { key, pattern } of metricPatterns) {
      const match = html.match(pattern);
      if (match) {
        extracted[key] = match[1].trim();
      }
    }

    return extracted;
  }

  /**
   * Parse a number string with potential suffixes (K, M) into a numeric value.
   */
  private parseMetricValue(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;

    const cleaned = value.replace(/[$,%]/g, '').trim();
    const suffixMatch = cleaned.match(/^([\d,.]+)\s*([MmKk]?)$/);
    if (!suffixMatch) return null;

    let num = parseFloat(suffixMatch[1].replace(/,/g, ''));
    if (isNaN(num)) return null;

    const suffix = suffixMatch[2].toUpperCase();
    if (suffix === 'M') num *= 1_000_000;
    if (suffix === 'K') num *= 1_000;

    return num;
  }

  /**
   * Get current US labor market statistics from Revelio Labs' public page.
   * Data is built from 100M+ US profiles — profile-based, not posting-based.
   */
  async getLaborStats(period?: string): Promise<RevelioLaborStats> {
    // First, try known API endpoints
    const apiData = await this.tryApiEndpoints();

    if (apiData && Object.keys(apiData).length > 0) {
      return {
        employment_level: this.parseMetricValue(apiData.employment_level ?? apiData.employment ?? null),
        job_openings: this.parseMetricValue(apiData.job_openings ?? apiData.openings ?? null),
        new_hires: this.parseMetricValue(apiData.new_hires ?? apiData.hires ?? null),
        attrition: this.parseMetricValue(apiData.attrition ?? apiData.separations ?? null),
        median_salary_new_openings: this.parseMetricValue(apiData.median_salary ?? apiData.salary ?? null),
        period: apiData.period ?? apiData.date ?? period ?? null,
        metrics: apiData,
        retrieved_at: new Date().toISOString(),
        data_source: 'revelio',
        source_url: PUBLIC_STATS_URL,
        methodology: 'Profile-based labor statistics derived from 100M+ US professional profiles. Not posting-based.',
        note: null,
      };
    }

    // Fallback: fetch and parse the HTML page
    let html: string;
    try {
      const result = await this.fetchWithFallback(PUBLIC_STATS_URL);
      html = result.html;
    } catch (error) {
      return {
        employment_level: null,
        job_openings: null,
        new_hires: null,
        attrition: null,
        median_salary_new_openings: null,
        period: period ?? null,
        metrics: {},
        retrieved_at: new Date().toISOString(),
        data_source: 'revelio',
        source_url: PUBLIC_STATS_URL,
        methodology: 'Profile-based labor statistics derived from 100M+ US professional profiles.',
        note: `Failed to fetch Revelio Labs page: ${(error as Error).message}. The data is available at ${PUBLIC_STATS_URL} — you can access it manually or use the browser agent tool (browse_and_extract) for live scraping.`,
      };
    }

    // Check if the page is JavaScript-rendered (minimal HTML body with JS bundles)
    const bodyContent = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
    const hasMinimalBody = bodyContent.replace(/<script[\s\S]*?<\/script>/gi, '').trim().length < 500;
    const hasJsBundles = /<script[^>]+src="[^"]*(?:bundle|chunk|app|main)\.[^"]*\.js"/i.test(html);

    const extracted = this.extractDataFromHtml(html);
    const hasExtractedData = Object.keys(extracted).length > 0;

    if (!hasExtractedData && hasMinimalBody && hasJsBundles) {
      // Page is client-side rendered — data can't be scraped with simple fetch
      return {
        employment_level: null,
        job_openings: null,
        new_hires: null,
        attrition: null,
        median_salary_new_openings: null,
        period: period ?? null,
        metrics: {},
        retrieved_at: new Date().toISOString(),
        data_source: 'revelio',
        source_url: PUBLIC_STATS_URL,
        methodology: 'Profile-based labor statistics derived from 100M+ US professional profiles.',
        note: `The Revelio Labs public statistics page (${PUBLIC_STATS_URL}) renders data client-side via JavaScript. A simple HTTP fetch cannot extract the data. Use the browser agent tool (browse_and_extract or screenshot_and_analyze) to load the page in a real browser and extract the rendered data. Alternatively, visit the URL directly for the latest statistics.`,
      };
    }

    return {
      employment_level: this.parseMetricValue(extracted.employment_level ?? null),
      job_openings: this.parseMetricValue(extracted.job_openings ?? extracted.job_openings ?? null),
      new_hires: this.parseMetricValue(extracted.new_hires ?? null),
      attrition: this.parseMetricValue(extracted.attrition ?? null),
      median_salary_new_openings: this.parseMetricValue(extracted.median_salary ?? null),
      period: extracted.period ?? period ?? null,
      metrics: extracted,
      retrieved_at: new Date().toISOString(),
      data_source: 'revelio',
      source_url: PUBLIC_STATS_URL,
      methodology: 'Profile-based labor statistics derived from 100M+ US professional profiles. Not posting-based.',
      note: hasExtractedData
        ? null
        : `Limited data extracted from the page. For richer data, use the browser agent tool (browse_and_extract) to render the full page, or visit ${PUBLIC_STATS_URL} directly.`,
    };
  }

  /**
   * Get hiring and attrition trend data from Revelio Labs.
   */
  async getHiringTrends(months: number = 12): Promise<RevelioHiringTrends> {
    // Try API endpoints first
    const apiData = await this.tryApiEndpoints();

    if (apiData && (apiData.trends || apiData.hiring_trends || apiData.monthly_data)) {
      const rawTrends: any[] = apiData.trends || apiData.hiring_trends || apiData.monthly_data || [];
      const limitedTrends = rawTrends.slice(-months);

      const trends = limitedTrends.map((t: any) => ({
        period: t.period ?? t.date ?? t.month ?? 'unknown',
        hiring_rate: this.parseMetricValue(t.hiring_rate ?? t.hires_rate ?? null),
        attrition_rate: this.parseMetricValue(t.attrition_rate ?? t.separations_rate ?? null),
        net_growth: this.parseMetricValue(t.net_growth ?? t.net_change ?? null),
        job_openings: this.parseMetricValue(t.job_openings ?? t.openings ?? null),
      }));

      const hiringRates = trends.map((t) => t.hiring_rate).filter((v): v is number => v !== null);
      const attritionRates = trends.map((t) => t.attrition_rate).filter((v): v is number => v !== null);
      const netGrowths = trends.map((t) => t.net_growth).filter((v): v is number => v !== null);

      const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

      let trendDirection: string | null = null;
      if (netGrowths.length >= 3) {
        const recentAvg = avg(netGrowths.slice(-3))!;
        const earlyAvg = avg(netGrowths.slice(0, 3))!;
        if (recentAvg > earlyAvg * 1.05) trendDirection = 'improving';
        else if (recentAvg < earlyAvg * 0.95) trendDirection = 'declining';
        else trendDirection = 'stable';
      }

      return {
        trends,
        summary: {
          avg_hiring_rate: avg(hiringRates),
          avg_attrition_rate: avg(attritionRates),
          avg_net_growth: avg(netGrowths),
          trend_direction: trendDirection,
          months_covered: trends.length,
        },
        retrieved_at: new Date().toISOString(),
        data_source: 'revelio',
        source_url: PUBLIC_STATS_URL,
        methodology: 'Monthly hiring and attrition rates derived from 100M+ US professional profiles. Profile-based, not posting-based.',
        note: null,
      };
    }

    // Fallback: try to extract trend data from the HTML page
    let html: string;
    try {
      const result = await this.fetchWithFallback(PUBLIC_STATS_URL);
      html = result.html;
    } catch (error) {
      return {
        trends: [],
        summary: {
          avg_hiring_rate: null,
          avg_attrition_rate: null,
          avg_net_growth: null,
          trend_direction: null,
          months_covered: 0,
        },
        retrieved_at: new Date().toISOString(),
        data_source: 'revelio',
        source_url: PUBLIC_STATS_URL,
        methodology: 'Monthly hiring and attrition rates derived from 100M+ US professional profiles.',
        note: `Failed to fetch Revelio Labs page: ${(error as Error).message}. The data is available at ${PUBLIC_STATS_URL} — you can access it manually or use the browser agent tool (browse_and_extract) for live scraping.`,
      };
    }

    const extracted = this.extractDataFromHtml(html);

    // Check for trend data in extracted content
    const trendArrays = extracted.__next_data?.trends ||
      extracted.__next_data?.hiringTrends ||
      extracted.trends ||
      extracted.monthly_data;

    if (Array.isArray(trendArrays) && trendArrays.length > 0) {
      const limitedTrends = trendArrays.slice(-months);

      const trends = limitedTrends.map((t: any) => ({
        period: t.period ?? t.date ?? t.month ?? 'unknown',
        hiring_rate: this.parseMetricValue(t.hiring_rate ?? t.hires_rate ?? null),
        attrition_rate: this.parseMetricValue(t.attrition_rate ?? t.separations_rate ?? null),
        net_growth: this.parseMetricValue(t.net_growth ?? t.net_change ?? null),
        job_openings: this.parseMetricValue(t.job_openings ?? t.openings ?? null),
      }));

      const hiringRates = trends.map((t) => t.hiring_rate).filter((v): v is number => v !== null);
      const attritionRates = trends.map((t) => t.attrition_rate).filter((v): v is number => v !== null);
      const netGrowths = trends.map((t) => t.net_growth).filter((v): v is number => v !== null);

      const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

      return {
        trends,
        summary: {
          avg_hiring_rate: avg(hiringRates),
          avg_attrition_rate: avg(attritionRates),
          avg_net_growth: avg(netGrowths),
          trend_direction: null,
          months_covered: trends.length,
        },
        retrieved_at: new Date().toISOString(),
        data_source: 'revelio',
        source_url: PUBLIC_STATS_URL,
        methodology: 'Monthly hiring and attrition rates derived from 100M+ US professional profiles.',
        note: null,
      };
    }

    // Check if page is JS-rendered
    const bodyContent = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
    const hasMinimalBody = bodyContent.replace(/<script[\s\S]*?<\/script>/gi, '').trim().length < 500;
    const hasJsBundles = /<script[^>]+src="[^"]*(?:bundle|chunk|app|main)\.[^"]*\.js"/i.test(html);

    return {
      trends: [],
      summary: {
        avg_hiring_rate: null,
        avg_attrition_rate: null,
        avg_net_growth: null,
        trend_direction: null,
        months_covered: 0,
      },
      retrieved_at: new Date().toISOString(),
      data_source: 'revelio',
      source_url: PUBLIC_STATS_URL,
      methodology: 'Monthly hiring and attrition rates derived from 100M+ US professional profiles.',
      note: hasMinimalBody && hasJsBundles
        ? `The Revelio Labs public statistics page (${PUBLIC_STATS_URL}) renders data client-side via JavaScript. A simple HTTP fetch cannot extract trend data. Use the browser agent tool (browse_and_extract or screenshot_and_analyze) to load the page in a real browser and extract the rendered charts and data. Alternatively, visit the URL directly.`
        : `Could not extract hiring trend data from the Revelio Labs page. The page structure may have changed. Use the browser agent tool (browse_and_extract) for live data extraction, or visit ${PUBLIC_STATS_URL} directly.`,
    };
  }
}
