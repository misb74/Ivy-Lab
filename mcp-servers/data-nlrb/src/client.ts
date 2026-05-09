/**
 * NLRB + BLS Union Data Client
 *
 * Embedded reference data from:
 * - BLS Current Population Survey (union membership density, 2024/2025)
 * - NLRB election case data (aggregate trends 2018-2024)
 * - Notable recent representation elections
 *
 * The NLRB search interface is web-based and BLS union data is published
 * as HTML/PDF, so this follows the WORKBank local data pattern with
 * curated embedded datasets.
 */

interface UnionDensityRecord {
  industry: string;
  naics_code?: string;
  total_employed: number;       // thousands
  union_members: number;        // thousands
  union_density_pct: number;    // percentage
  year: number;
  sector: 'private' | 'public';
}

interface ElectionTrend {
  year: number;
  total_elections: number;
  union_wins: number;
  win_rate_pct: number;
  avg_unit_size: number;
  total_eligible_voters: number;
}

interface NotableElection {
  employer: string;
  union: string;
  location: string;
  year: number;
  unit_size: number;
  result: 'union_win' | 'union_loss' | 'withdrawn' | 'pending';
  industry: string;
}

// ---------------------------------------------------------------------------
// Embedded data — BLS Current Population Survey 2024/2025
// ---------------------------------------------------------------------------

const UNION_DENSITY_DATA: UnionDensityRecord[] = [
  // Overall economy
  { industry: 'All industries', total_employed: 144_100, union_members: 14_410, union_density_pct: 10.0, year: 2024, sector: 'private' },

  // Public sector
  { industry: 'Public sector — total', total_employed: 21_500, union_members: 6_988, union_density_pct: 32.5, year: 2024, sector: 'public' },
  { industry: 'Federal government', total_employed: 3_000, union_members: 798, union_density_pct: 26.6, year: 2024, sector: 'public' },
  { industry: 'State government', total_employed: 5_600, union_members: 1_680, union_density_pct: 30.0, year: 2024, sector: 'public' },
  { industry: 'Local government', total_employed: 12_900, union_members: 4_510, union_density_pct: 35.0, year: 2024, sector: 'public' },

  // Private sector — overall
  { industry: 'Private sector — total', total_employed: 122_600, union_members: 7_233, union_density_pct: 5.9, year: 2024, sector: 'private' },

  // Private sector — by industry
  { industry: 'Utilities', naics_code: '22', total_employed: 580, union_members: 112, union_density_pct: 19.4, year: 2024, sector: 'private' },
  { industry: 'Transportation and warehousing', naics_code: '48-49', total_employed: 6_800, union_members: 986, union_density_pct: 14.5, year: 2024, sector: 'private' },
  { industry: 'Telecommunications', naics_code: '517', total_employed: 650, union_members: 90, union_density_pct: 13.9, year: 2024, sector: 'private' },
  { industry: 'Construction', naics_code: '23', total_employed: 8_200, union_members: 976, union_density_pct: 11.9, year: 2024, sector: 'private' },
  { industry: 'Manufacturing', naics_code: '31-33', total_employed: 12_800, union_members: 1_011, union_density_pct: 7.9, year: 2024, sector: 'private' },
  { industry: 'Education and health services', naics_code: '61-62', total_employed: 24_500, union_members: 1_813, union_density_pct: 7.4, year: 2024, sector: 'private' },
  { industry: 'Information', naics_code: '51', total_employed: 3_000, union_members: 234, union_density_pct: 7.8, year: 2024, sector: 'private' },
  { industry: 'Mining', naics_code: '21', total_employed: 650, union_members: 32, union_density_pct: 4.9, year: 2024, sector: 'private' },
  { industry: 'Wholesale and retail trade', naics_code: '42-45', total_employed: 20_800, union_members: 853, union_density_pct: 4.1, year: 2024, sector: 'private' },
  { industry: 'Leisure and hospitality', naics_code: '71-72', total_employed: 16_500, union_members: 462, union_density_pct: 2.8, year: 2024, sector: 'private' },
  { industry: 'Professional and business services', naics_code: '54-56', total_employed: 22_700, union_members: 363, union_density_pct: 1.6, year: 2024, sector: 'private' },
  { industry: 'Financial activities', naics_code: '52-53', total_employed: 9_200, union_members: 138, union_density_pct: 1.5, year: 2024, sector: 'private' },
  { industry: 'Food services and accommodation', naics_code: '72', total_employed: 13_100, union_members: 157, union_density_pct: 1.2, year: 2024, sector: 'private' },
  { industry: 'Agriculture', naics_code: '11', total_employed: 2_200, union_members: 26, union_density_pct: 1.2, year: 2024, sector: 'private' },
];

// ---------------------------------------------------------------------------
// Embedded data — NLRB election trends 2018-2024
// ---------------------------------------------------------------------------

const ELECTION_TRENDS: ElectionTrend[] = [
  { year: 2018, total_elections: 1_225, union_wins: 848, win_rate_pct: 69.2, avg_unit_size: 26, total_eligible_voters: 72_400 },
  { year: 2019, total_elections: 1_191, union_wins: 823, win_rate_pct: 69.1, avg_unit_size: 27, total_eligible_voters: 70_500 },
  { year: 2020, total_elections: 1_034, union_wins: 710, win_rate_pct: 68.7, avg_unit_size: 25, total_eligible_voters: 58_900 },
  { year: 2021, total_elections: 1_173, union_wins: 826, win_rate_pct: 70.4, avg_unit_size: 28, total_eligible_voters: 68_700 },
  { year: 2022, total_elections: 1_563, union_wins: 1_096, win_rate_pct: 70.1, avg_unit_size: 30, total_eligible_voters: 96_500 },
  { year: 2023, total_elections: 1_695, union_wins: 1_187, win_rate_pct: 70.0, avg_unit_size: 32, total_eligible_voters: 107_800 },
  { year: 2024, total_elections: 1_750, union_wins: 1_243, win_rate_pct: 71.0, avg_unit_size: 33, total_eligible_voters: 113_200 },
];

// ---------------------------------------------------------------------------
// Embedded data — Notable recent elections
// ---------------------------------------------------------------------------

const NOTABLE_ELECTIONS: NotableElection[] = [
  {
    employer: 'Amazon (JFK8 warehouse)',
    union: 'Amazon Labor Union (ALU)',
    location: 'Staten Island, NY',
    year: 2022,
    unit_size: 8_325,
    result: 'union_win',
    industry: 'Transportation and warehousing',
  },
  {
    employer: 'Amazon (LDJ5 warehouse)',
    union: 'Amazon Labor Union (ALU)',
    location: 'Staten Island, NY',
    year: 2022,
    unit_size: 1_633,
    result: 'union_loss',
    industry: 'Transportation and warehousing',
  },
  {
    employer: 'Starbucks (Elmwood Ave)',
    union: 'Starbucks Workers United / SEIU',
    location: 'Buffalo, NY',
    year: 2021,
    unit_size: 27,
    result: 'union_win',
    industry: 'Food services and accommodation',
  },
  {
    employer: 'Starbucks (various — 400+ stores)',
    union: 'Starbucks Workers United / SEIU',
    location: 'Nationwide',
    year: 2023,
    unit_size: 9_000,
    result: 'union_win',
    industry: 'Food services and accommodation',
  },
  {
    employer: 'Apple (Towson Town Center)',
    union: 'International Association of Machinists (IAM)',
    location: 'Towson, MD',
    year: 2022,
    unit_size: 110,
    result: 'union_win',
    industry: 'Wholesale and retail trade',
  },
  {
    employer: 'Apple (Penn Square Mall)',
    union: 'Communications Workers of America (CWA)',
    location: 'Oklahoma City, OK',
    year: 2022,
    unit_size: 95,
    result: 'union_win',
    industry: 'Wholesale and retail trade',
  },
  {
    employer: 'REI (SoHo)',
    union: 'Retail, Wholesale and Department Store Union (RWDSU)',
    location: 'New York, NY',
    year: 2022,
    unit_size: 88,
    result: 'union_win',
    industry: 'Wholesale and retail trade',
  },
  {
    employer: 'Trader Joe\'s (Hadley)',
    union: 'Trader Joe\'s United',
    location: 'Hadley, MA',
    year: 2022,
    unit_size: 81,
    result: 'union_win',
    industry: 'Wholesale and retail trade',
  },
  {
    employer: 'Microsoft / Activision Blizzard (Raven Software QA)',
    union: 'Communications Workers of America (CWA)',
    location: 'Madison, WI',
    year: 2022,
    unit_size: 34,
    result: 'union_win',
    industry: 'Information',
  },
  {
    employer: 'Volkswagen (Chattanooga Assembly)',
    union: 'United Auto Workers (UAW)',
    location: 'Chattanooga, TN',
    year: 2024,
    unit_size: 4_326,
    result: 'union_win',
    industry: 'Manufacturing',
  },
  {
    employer: 'Mercedes-Benz (Vance Plant)',
    union: 'United Auto Workers (UAW)',
    location: 'Vance, AL',
    year: 2024,
    unit_size: 5_200,
    result: 'union_loss',
    industry: 'Manufacturing',
  },
  {
    employer: 'Blue Origin (Cape Canaveral)',
    union: 'International Association of Machinists (IAM)',
    location: 'Cape Canaveral, FL',
    year: 2024,
    unit_size: 250,
    result: 'union_win',
    industry: 'Manufacturing',
  },
  {
    employer: 'The New York Times (Tech Guild)',
    union: 'NewsGuild-CWA',
    location: 'New York, NY',
    year: 2022,
    unit_size: 650,
    result: 'union_win',
    industry: 'Information',
  },
  {
    employer: 'Google Fiber (Kansas City)',
    union: 'Alphabet Workers Union / CWA',
    location: 'Kansas City, MO',
    year: 2023,
    unit_size: 60,
    result: 'union_win',
    industry: 'Telecommunications',
  },
  {
    employer: 'Costco (Norfolk)',
    union: 'Teamsters Local 822',
    location: 'Norfolk, VA',
    year: 2025,
    unit_size: 238,
    result: 'union_win',
    industry: 'Wholesale and retail trade',
  },
];

// ---------------------------------------------------------------------------
// Client class
// ---------------------------------------------------------------------------

export class NlrbClient {
  /**
   * Search union representation election data.
   * Filters notable elections by employer name, industry, and/or year.
   */
  searchElections(
    query?: string,
    industry?: string,
    year?: number,
  ): {
    elections: NotableElection[];
    total_results: number;
    data_source: string;
  } {
    let results = [...NOTABLE_ELECTIONS];

    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(
        (e) =>
          e.employer.toLowerCase().includes(lowerQuery) ||
          e.union.toLowerCase().includes(lowerQuery) ||
          e.location.toLowerCase().includes(lowerQuery),
      );
    }

    if (industry) {
      const lowerIndustry = industry.toLowerCase();
      results = results.filter((e) =>
        e.industry.toLowerCase().includes(lowerIndustry),
      );
    }

    if (year) {
      results = results.filter((e) => e.year === year);
    }

    return {
      elections: results,
      total_results: results.length,
      data_source: 'nlrb_bls',
    };
  }

  /**
   * Get union election and organizing trends by industry.
   * Returns aggregate NLRB election statistics and, if an industry is
   * specified, the corresponding union density data.
   */
  getIndustryTrends(
    industry?: string,
    years: number = 5,
  ): {
    election_trends: ElectionTrend[];
    density?: UnionDensityRecord[];
    notable_elections: NotableElection[];
    summary: {
      trend_direction: string;
      avg_win_rate_pct: number;
      total_elections_period: number;
      total_union_wins_period: number;
    };
    data_source: string;
  } {
    const currentYear = 2024;
    const startYear = currentYear - years + 1;

    const trends = ELECTION_TRENDS.filter(
      (t) => t.year >= startYear && t.year <= currentYear,
    );

    let density: UnionDensityRecord[] | undefined;
    let notableElections = [...NOTABLE_ELECTIONS];

    if (industry) {
      const lowerIndustry = industry.toLowerCase();
      density = UNION_DENSITY_DATA.filter((d) =>
        d.industry.toLowerCase().includes(lowerIndustry),
      );
      notableElections = notableElections.filter((e) =>
        e.industry.toLowerCase().includes(lowerIndustry),
      );
    } else {
      density = UNION_DENSITY_DATA;
    }

    const totalElections = trends.reduce((s, t) => s + t.total_elections, 0);
    const totalWins = trends.reduce((s, t) => s + t.union_wins, 0);
    const avgWinRate =
      trends.length > 0
        ? trends.reduce((s, t) => s + t.win_rate_pct, 0) / trends.length
        : 0;

    // Determine trend direction by comparing first half to second half
    const midpoint = Math.floor(trends.length / 2);
    const firstHalf = trends.slice(0, midpoint);
    const secondHalf = trends.slice(midpoint);
    const firstAvg =
      firstHalf.length > 0
        ? firstHalf.reduce((s, t) => s + t.total_elections, 0) / firstHalf.length
        : 0;
    const secondAvg =
      secondHalf.length > 0
        ? secondHalf.reduce((s, t) => s + t.total_elections, 0) / secondHalf.length
        : 0;
    const trendDirection =
      secondAvg > firstAvg * 1.05
        ? 'increasing'
        : secondAvg < firstAvg * 0.95
          ? 'decreasing'
          : 'stable';

    return {
      election_trends: trends,
      density,
      notable_elections: notableElections,
      summary: {
        trend_direction: trendDirection,
        avg_win_rate_pct: Math.round(avgWinRate * 10) / 10,
        total_elections_period: totalElections,
        total_union_wins_period: totalWins,
      },
      data_source: 'nlrb_bls',
    };
  }

  /**
   * Get union membership density rates.
   * Filter by sector ('private', 'public') or by a specific industry name.
   */
  getUnionDensity(
    sector?: string,
    year?: number,
  ): {
    records: UnionDensityRecord[];
    summary: {
      overall_density_pct: number;
      total_members_thousands: number;
      total_employed_thousands: number;
      sector_filter?: string;
    };
    data_source: string;
  } {
    let records = [...UNION_DENSITY_DATA];

    if (year) {
      records = records.filter((r) => r.year === year);
    }

    if (sector) {
      const lowerSector = sector.toLowerCase();
      if (lowerSector === 'private') {
        records = records.filter((r) => r.sector === 'private');
      } else if (lowerSector === 'public') {
        records = records.filter((r) => r.sector === 'public');
      } else {
        // Treat as industry name search
        records = records.filter((r) =>
          r.industry.toLowerCase().includes(lowerSector),
        );
      }
    }

    // Compute summary from the top-level records (avoid double-counting)
    const overallRecord = records.find(
      (r) =>
        r.industry === 'All industries' ||
        r.industry === 'Private sector — total' ||
        r.industry === 'Public sector — total',
    );

    const totalMembers = overallRecord
      ? overallRecord.union_members
      : records.reduce((s, r) => s + r.union_members, 0);
    const totalEmployed = overallRecord
      ? overallRecord.total_employed
      : records.reduce((s, r) => s + r.total_employed, 0);
    const overallDensity =
      totalEmployed > 0
        ? Math.round((totalMembers / totalEmployed) * 1000) / 10
        : 0;

    return {
      records,
      summary: {
        overall_density_pct: overallRecord
          ? overallRecord.union_density_pct
          : overallDensity,
        total_members_thousands: totalMembers,
        total_employed_thousands: totalEmployed,
        sector_filter: sector,
      },
      data_source: 'nlrb_bls',
    };
  }
}
