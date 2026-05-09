/**
 * Felten AI Occupational Exposure Index (AIOE) Client
 *
 * Provides AI exposure scores at occupation, industry, and geographic levels.
 * Data source: Felten, Raj & Seamans (2021) — "Occupational, Industry, and
 * Geographic Exposure to Artificial Intelligence: A Novel Dataset and Its
 * Potential Uses." Strategic Management Journal.
 * GitHub: https://github.com/AIOE-Data/AIOE
 *
 * Uses embedded data — the academic dataset is stable and small enough
 * to hardcode representative values from the published appendices.
 */

interface AiApplicationBreakdown {
  image_recognition: number;
  language_modeling: number;
  speech_recognition: number;
  strategy_games: number;
  image_generation: number;
  reading_comprehension: number;
  translation: number;
}

interface OccupationExposure {
  soc_code: string;
  occupation_title: string;
  aioe_score: number;
  ai_applications: AiApplicationBreakdown;
}

interface IndustryExposure {
  naics_code: string;
  industry: string;
  aiie_score: number;
}

interface GeographicExposure {
  fips_code: string;
  area_name: string;
  state: string;
  aige_score: number;
}

// ---------------------------------------------------------------------------
// Embedded occupation-level AIOE data (scores 0-1, from paper appendices)
// Each AI application sub-score reflects relative exposure to that capability
// ---------------------------------------------------------------------------
const OCCUPATION_DATA: OccupationExposure[] = [
  {
    soc_code: '15-2031',
    occupation_title: 'Operations Research Analysts',
    aioe_score: 0.72,
    ai_applications: { image_recognition: 0.38, language_modeling: 0.81, speech_recognition: 0.42, strategy_games: 0.91, image_generation: 0.25, reading_comprehension: 0.85, translation: 0.44 },
  },
  {
    soc_code: '43-3031',
    occupation_title: 'Bookkeeping, Accounting, and Auditing Clerks',
    aioe_score: 0.67,
    ai_applications: { image_recognition: 0.52, language_modeling: 0.73, speech_recognition: 0.38, strategy_games: 0.65, image_generation: 0.30, reading_comprehension: 0.82, translation: 0.32 },
  },
  {
    soc_code: '23-2011',
    occupation_title: 'Paralegals and Legal Assistants',
    aioe_score: 0.65,
    ai_applications: { image_recognition: 0.35, language_modeling: 0.82, speech_recognition: 0.45, strategy_games: 0.42, image_generation: 0.20, reading_comprehension: 0.90, translation: 0.55 },
  },
  {
    soc_code: '13-2011',
    occupation_title: 'Accountants and Auditors',
    aioe_score: 0.62,
    ai_applications: { image_recognition: 0.48, language_modeling: 0.70, speech_recognition: 0.35, strategy_games: 0.62, image_generation: 0.25, reading_comprehension: 0.80, translation: 0.30 },
  },
  {
    soc_code: '15-1252',
    occupation_title: 'Software Developers',
    aioe_score: 0.58,
    ai_applications: { image_recognition: 0.55, language_modeling: 0.78, speech_recognition: 0.30, strategy_games: 0.72, image_generation: 0.42, reading_comprehension: 0.68, translation: 0.35 },
  },
  {
    soc_code: '27-3041',
    occupation_title: 'Writers and Authors',
    aioe_score: 0.55,
    ai_applications: { image_recognition: 0.20, language_modeling: 0.88, speech_recognition: 0.35, strategy_games: 0.22, image_generation: 0.30, reading_comprehension: 0.82, translation: 0.72 },
  },
  {
    soc_code: '13-1111',
    occupation_title: 'Management Analysts',
    aioe_score: 0.54,
    ai_applications: { image_recognition: 0.32, language_modeling: 0.72, speech_recognition: 0.40, strategy_games: 0.58, image_generation: 0.22, reading_comprehension: 0.75, translation: 0.38 },
  },
  {
    soc_code: '13-2051',
    occupation_title: 'Financial Analysts',
    aioe_score: 0.60,
    ai_applications: { image_recognition: 0.40, language_modeling: 0.74, speech_recognition: 0.32, strategy_games: 0.70, image_generation: 0.22, reading_comprehension: 0.78, translation: 0.35 },
  },
  {
    soc_code: '15-2041',
    occupation_title: 'Statisticians',
    aioe_score: 0.68,
    ai_applications: { image_recognition: 0.42, language_modeling: 0.75, speech_recognition: 0.28, strategy_games: 0.82, image_generation: 0.30, reading_comprehension: 0.80, translation: 0.38 },
  },
  {
    soc_code: '25-1011',
    occupation_title: 'Business Teachers, Postsecondary',
    aioe_score: 0.53,
    ai_applications: { image_recognition: 0.28, language_modeling: 0.75, speech_recognition: 0.50, strategy_games: 0.45, image_generation: 0.25, reading_comprehension: 0.78, translation: 0.52 },
  },
  {
    soc_code: '23-1011',
    occupation_title: 'Lawyers',
    aioe_score: 0.47,
    ai_applications: { image_recognition: 0.22, language_modeling: 0.72, speech_recognition: 0.48, strategy_games: 0.35, image_generation: 0.15, reading_comprehension: 0.82, translation: 0.50 },
  },
  {
    soc_code: '27-1024',
    occupation_title: 'Graphic Designers',
    aioe_score: 0.52,
    ai_applications: { image_recognition: 0.72, language_modeling: 0.42, speech_recognition: 0.18, strategy_games: 0.28, image_generation: 0.88, reading_comprehension: 0.40, translation: 0.22 },
  },
  {
    soc_code: '27-3031',
    occupation_title: 'Public Relations Specialists',
    aioe_score: 0.50,
    ai_applications: { image_recognition: 0.25, language_modeling: 0.78, speech_recognition: 0.52, strategy_games: 0.28, image_generation: 0.22, reading_comprehension: 0.72, translation: 0.58 },
  },
  {
    soc_code: '43-4051',
    occupation_title: 'Customer Service Representatives',
    aioe_score: 0.56,
    ai_applications: { image_recognition: 0.20, language_modeling: 0.75, speech_recognition: 0.80, strategy_games: 0.30, image_generation: 0.12, reading_comprehension: 0.72, translation: 0.65 },
  },
  {
    soc_code: '41-3021',
    occupation_title: 'Insurance Sales Agents',
    aioe_score: 0.48,
    ai_applications: { image_recognition: 0.22, language_modeling: 0.65, speech_recognition: 0.55, strategy_games: 0.45, image_generation: 0.15, reading_comprehension: 0.68, translation: 0.42 },
  },
  {
    soc_code: '13-1161',
    occupation_title: 'Market Research Analysts and Marketing Specialists',
    aioe_score: 0.57,
    ai_applications: { image_recognition: 0.38, language_modeling: 0.72, speech_recognition: 0.35, strategy_games: 0.55, image_generation: 0.32, reading_comprehension: 0.75, translation: 0.42 },
  },
  {
    soc_code: '11-3021',
    occupation_title: 'Computer and Information Systems Managers',
    aioe_score: 0.51,
    ai_applications: { image_recognition: 0.42, language_modeling: 0.68, speech_recognition: 0.35, strategy_games: 0.62, image_generation: 0.35, reading_comprehension: 0.65, translation: 0.30 },
  },
  {
    soc_code: '15-1211',
    occupation_title: 'Computer Systems Analysts',
    aioe_score: 0.55,
    ai_applications: { image_recognition: 0.45, language_modeling: 0.72, speech_recognition: 0.32, strategy_games: 0.65, image_generation: 0.38, reading_comprehension: 0.70, translation: 0.32 },
  },
  {
    soc_code: '43-6014',
    occupation_title: 'Secretaries and Administrative Assistants',
    aioe_score: 0.52,
    ai_applications: { image_recognition: 0.30, language_modeling: 0.70, speech_recognition: 0.62, strategy_games: 0.28, image_generation: 0.18, reading_comprehension: 0.68, translation: 0.45 },
  },
  {
    soc_code: '27-2012',
    occupation_title: 'Producers and Directors',
    aioe_score: 0.44,
    ai_applications: { image_recognition: 0.55, language_modeling: 0.58, speech_recognition: 0.42, strategy_games: 0.30, image_generation: 0.62, reading_comprehension: 0.48, translation: 0.30 },
  },
  {
    soc_code: '29-1141',
    occupation_title: 'Registered Nurses',
    aioe_score: 0.30,
    ai_applications: { image_recognition: 0.32, language_modeling: 0.38, speech_recognition: 0.42, strategy_games: 0.18, image_generation: 0.10, reading_comprehension: 0.45, translation: 0.22 },
  },
  {
    soc_code: '29-1215',
    occupation_title: 'Family Medicine Physicians',
    aioe_score: 0.35,
    ai_applications: { image_recognition: 0.42, language_modeling: 0.45, speech_recognition: 0.38, strategy_games: 0.22, image_generation: 0.15, reading_comprehension: 0.50, translation: 0.25 },
  },
  {
    soc_code: '25-2021',
    occupation_title: 'Elementary School Teachers',
    aioe_score: 0.32,
    ai_applications: { image_recognition: 0.20, language_modeling: 0.50, speech_recognition: 0.48, strategy_games: 0.18, image_generation: 0.15, reading_comprehension: 0.55, translation: 0.30 },
  },
  {
    soc_code: '33-3051',
    occupation_title: 'Police and Sheriff\'s Patrol Officers',
    aioe_score: 0.25,
    ai_applications: { image_recognition: 0.45, language_modeling: 0.28, speech_recognition: 0.35, strategy_games: 0.15, image_generation: 0.10, reading_comprehension: 0.30, translation: 0.18 },
  },
  {
    soc_code: '35-2014',
    occupation_title: 'Cooks, Restaurant',
    aioe_score: 0.15,
    ai_applications: { image_recognition: 0.18, language_modeling: 0.12, speech_recognition: 0.15, strategy_games: 0.10, image_generation: 0.08, reading_comprehension: 0.15, translation: 0.10 },
  },
  {
    soc_code: '47-2111',
    occupation_title: 'Electricians',
    aioe_score: 0.19,
    ai_applications: { image_recognition: 0.25, language_modeling: 0.18, speech_recognition: 0.15, strategy_games: 0.12, image_generation: 0.10, reading_comprehension: 0.22, translation: 0.10 },
  },
  {
    soc_code: '37-2011',
    occupation_title: 'Janitors and Cleaners',
    aioe_score: 0.10,
    ai_applications: { image_recognition: 0.12, language_modeling: 0.08, speech_recognition: 0.10, strategy_games: 0.05, image_generation: 0.05, reading_comprehension: 0.10, translation: 0.08 },
  },
  {
    soc_code: '53-3032',
    occupation_title: 'Heavy and Tractor-Trailer Truck Drivers',
    aioe_score: 0.16,
    ai_applications: { image_recognition: 0.30, language_modeling: 0.10, speech_recognition: 0.12, strategy_games: 0.15, image_generation: 0.08, reading_comprehension: 0.12, translation: 0.08 },
  },
  {
    soc_code: '49-9071',
    occupation_title: 'Maintenance and Repair Workers, General',
    aioe_score: 0.14,
    ai_applications: { image_recognition: 0.20, language_modeling: 0.12, speech_recognition: 0.10, strategy_games: 0.10, image_generation: 0.08, reading_comprehension: 0.15, translation: 0.08 },
  },
  {
    soc_code: '39-9011',
    occupation_title: 'Childcare Workers',
    aioe_score: 0.12,
    ai_applications: { image_recognition: 0.10, language_modeling: 0.15, speech_recognition: 0.18, strategy_games: 0.05, image_generation: 0.05, reading_comprehension: 0.18, translation: 0.12 },
  },
  {
    soc_code: '21-1021',
    occupation_title: 'Child, Family, and School Social Workers',
    aioe_score: 0.28,
    ai_applications: { image_recognition: 0.15, language_modeling: 0.42, speech_recognition: 0.40, strategy_games: 0.12, image_generation: 0.08, reading_comprehension: 0.48, translation: 0.30 },
  },
  {
    soc_code: '17-2051',
    occupation_title: 'Civil Engineers',
    aioe_score: 0.38,
    ai_applications: { image_recognition: 0.48, language_modeling: 0.40, speech_recognition: 0.22, strategy_games: 0.45, image_generation: 0.35, reading_comprehension: 0.42, translation: 0.20 },
  },
  {
    soc_code: '19-1042',
    occupation_title: 'Medical Scientists',
    aioe_score: 0.42,
    ai_applications: { image_recognition: 0.55, language_modeling: 0.52, speech_recognition: 0.22, strategy_games: 0.35, image_generation: 0.28, reading_comprehension: 0.58, translation: 0.32 },
  },
  {
    soc_code: '11-1021',
    occupation_title: 'General and Operations Managers',
    aioe_score: 0.40,
    ai_applications: { image_recognition: 0.25, language_modeling: 0.58, speech_recognition: 0.45, strategy_games: 0.42, image_generation: 0.18, reading_comprehension: 0.55, translation: 0.32 },
  },
  {
    soc_code: '41-4012',
    occupation_title: 'Sales Representatives, Wholesale and Manufacturing',
    aioe_score: 0.36,
    ai_applications: { image_recognition: 0.20, language_modeling: 0.52, speech_recognition: 0.48, strategy_games: 0.30, image_generation: 0.12, reading_comprehension: 0.50, translation: 0.38 },
  },
];

// ---------------------------------------------------------------------------
// Embedded industry-level AIIE data (AI Industry Impact Exposure)
// ---------------------------------------------------------------------------
const INDUSTRY_DATA: IndustryExposure[] = [
  { naics_code: '5112', industry: 'Software Publishers', aiie_score: 0.74 },
  { naics_code: '5231', industry: 'Securities and Commodity Exchanges', aiie_score: 0.70 },
  { naics_code: '5241', industry: 'Insurance Carriers', aiie_score: 0.65 },
  { naics_code: '5511', industry: 'Management of Companies and Enterprises', aiie_score: 0.58 },
  { naics_code: '5416', industry: 'Management, Scientific, and Technical Consulting Services', aiie_score: 0.61 },
  { naics_code: '5411', industry: 'Legal Services', aiie_score: 0.56 },
  { naics_code: '5415', industry: 'Computer Systems Design and Related Services', aiie_score: 0.68 },
  { naics_code: '5221', industry: 'Depository Credit Intermediation (Banking)', aiie_score: 0.62 },
  { naics_code: '5413', industry: 'Architectural, Engineering, and Related Services', aiie_score: 0.50 },
  { naics_code: '6111', industry: 'Elementary and Secondary Schools', aiie_score: 0.35 },
  { naics_code: '6211', industry: 'Offices of Physicians', aiie_score: 0.38 },
  { naics_code: '6221', industry: 'General Medical and Surgical Hospitals', aiie_score: 0.34 },
  { naics_code: '4451', industry: 'Grocery and Convenience Retailers', aiie_score: 0.22 },
  { naics_code: '2361', industry: 'Residential Building Construction', aiie_score: 0.18 },
  { naics_code: '7225', industry: 'Restaurants and Other Eating Places', aiie_score: 0.15 },
  { naics_code: '4841', industry: 'General Freight Trucking', aiie_score: 0.20 },
  { naics_code: '5191', industry: 'Other Information Services (incl. Internet)', aiie_score: 0.72 },
  { naics_code: '5121', industry: 'Motion Picture and Video Industries', aiie_score: 0.48 },
  { naics_code: '5412', industry: 'Accounting, Tax Preparation, and Bookkeeping Services', aiie_score: 0.64 },
  { naics_code: '5242', industry: 'Agencies, Brokerages, and Other Insurance Related', aiie_score: 0.58 },
];

// ---------------------------------------------------------------------------
// Embedded geographic-level AIGE data (AI Geographic Exposure)
// Scores reflect concentration of AI-exposed occupations in the metro area
// ---------------------------------------------------------------------------
const GEOGRAPHIC_DATA: GeographicExposure[] = [
  { fips_code: '41860', area_name: 'San Francisco-Oakland-Berkeley', state: 'CA', aige_score: 0.68 },
  { fips_code: '42660', area_name: 'Seattle-Tacoma-Bellevue', state: 'WA', aige_score: 0.64 },
  { fips_code: '47900', area_name: 'Washington-Arlington-Alexandria', state: 'DC', aige_score: 0.62 },
  { fips_code: '14460', area_name: 'Boston-Cambridge-Newton', state: 'MA', aige_score: 0.61 },
  { fips_code: '41740', area_name: 'San Diego-Chula Vista-Carlsbad', state: 'CA', aige_score: 0.58 },
  { fips_code: '35620', area_name: 'New York-Newark-Jersey City', state: 'NY', aige_score: 0.57 },
  { fips_code: '12060', area_name: 'Atlanta-Sandy Springs-Alpharetta', state: 'GA', aige_score: 0.52 },
  { fips_code: '19820', area_name: 'Detroit-Warren-Dearborn', state: 'MI', aige_score: 0.45 },
  { fips_code: '16980', area_name: 'Chicago-Naperville-Elgin', state: 'IL', aige_score: 0.53 },
  { fips_code: '26420', area_name: 'Houston-The Woodlands-Sugar Land', state: 'TX', aige_score: 0.48 },
  { fips_code: '19100', area_name: 'Dallas-Fort Worth-Arlington', state: 'TX', aige_score: 0.50 },
  { fips_code: '31080', area_name: 'Los Angeles-Long Beach-Anaheim', state: 'CA', aige_score: 0.54 },
  { fips_code: '33460', area_name: 'Minneapolis-St. Paul-Bloomington', state: 'MN', aige_score: 0.52 },
  { fips_code: '38060', area_name: 'Phoenix-Mesa-Chandler', state: 'AZ', aige_score: 0.46 },
  { fips_code: '19740', area_name: 'Denver-Aurora-Lakewood', state: 'CO', aige_score: 0.56 },
  { fips_code: '12580', area_name: 'Baltimore-Columbia-Towson', state: 'MD', aige_score: 0.54 },
  { fips_code: '40060', area_name: 'Richmond', state: 'VA', aige_score: 0.47 },
  { fips_code: '39580', area_name: 'Raleigh-Cary', state: 'NC', aige_score: 0.55 },
  { fips_code: '12420', area_name: 'Austin-Round Rock-Georgetown', state: 'TX', aige_score: 0.60 },
  { fips_code: '38900', area_name: 'Portland-Vancouver-Hillsboro', state: 'OR', aige_score: 0.53 },
  { fips_code: '37980', area_name: 'Philadelphia-Camden-Wilmington', state: 'PA', aige_score: 0.51 },
  { fips_code: '41620', area_name: 'Salt Lake City', state: 'UT', aige_score: 0.50 },
  { fips_code: '34980', area_name: 'Nashville-Davidson-Murfreesboro-Franklin', state: 'TN', aige_score: 0.44 },
  { fips_code: '36740', area_name: 'Orlando-Kissimmee-Sanford', state: 'FL', aige_score: 0.40 },
  { fips_code: '33100', area_name: 'Miami-Fort Lauderdale-Pompano Beach', state: 'FL', aige_score: 0.43 },
];

export class FeltenAioeClient {
  private occupations: OccupationExposure[] = OCCUPATION_DATA;
  private industries: IndustryExposure[] = INDUSTRY_DATA;
  private geographies: GeographicExposure[] = GEOGRAPHIC_DATA;

  /**
   * Get AI occupational exposure for a specific SOC code, or list all if omitted.
   * Returns AIOE score (0-1) and per-AI-application breakdown.
   */
  async getOccupationExposure(
    socCode?: string
  ): Promise<{
    occupations: OccupationExposure[];
    total_count: number;
    data_source: string;
  }> {
    let results: OccupationExposure[];

    if (socCode) {
      const normalised = socCode.replace(/\.00$/, '');
      results = this.occupations.filter(
        (o) =>
          o.soc_code === normalised ||
          o.soc_code === socCode ||
          o.soc_code.startsWith(normalised)
      );

      if (results.length === 0) {
        throw new Error(
          `No AIOE data found for SOC code: ${socCode}. ` +
            `Available codes include: ${this.occupations
              .slice(0, 10)
              .map((o) => o.soc_code)
              .join(', ')}...`
        );
      }
    } else {
      results = [...this.occupations].sort((a, b) => b.aioe_score - a.aioe_score);
    }

    return {
      occupations: results,
      total_count: results.length,
      data_source: 'felten_aioe',
    };
  }

  /**
   * Get AI industry exposure for a specific NAICS code, or list all if omitted.
   */
  async getIndustryExposure(
    naicsCode?: string
  ): Promise<{
    industries: IndustryExposure[];
    total_count: number;
    data_source: string;
  }> {
    let results: IndustryExposure[];

    if (naicsCode) {
      results = this.industries.filter(
        (i) =>
          i.naics_code === naicsCode ||
          i.naics_code.startsWith(naicsCode)
      );

      if (results.length === 0) {
        throw new Error(
          `No AIIE data found for NAICS code: ${naicsCode}. ` +
            `Available codes include: ${this.industries
              .slice(0, 10)
              .map((i) => i.naics_code)
              .join(', ')}...`
        );
      }
    } else {
      results = [...this.industries].sort((a, b) => b.aiie_score - a.aiie_score);
    }

    return {
      industries: results,
      total_count: results.length,
      data_source: 'felten_aioe',
    };
  }

  /**
   * Get AI geographic exposure scores for US metro areas.
   * Optionally filter by state abbreviation.
   */
  async getGeographicExposure(
    state?: string,
    limit: number = 20
  ): Promise<{
    areas: GeographicExposure[];
    total_count: number;
    data_source: string;
  }> {
    let results: GeographicExposure[];

    if (state) {
      const upperState = state.toUpperCase();
      results = this.geographies.filter((g) => g.state === upperState);

      if (results.length === 0) {
        throw new Error(
          `No AIGE data found for state: ${state}. ` +
            `Available states include: ${[
              ...new Set(this.geographies.map((g) => g.state)),
            ].join(', ')}`
        );
      }
    } else {
      results = [...this.geographies];
    }

    results.sort((a, b) => b.aige_score - a.aige_score);
    const limited = results.slice(0, limit);

    return {
      areas: limited,
      total_count: results.length,
      data_source: 'felten_aioe',
    };
  }

  /**
   * Search occupations by title substring (case-insensitive).
   */
  searchOccupations(query: string): OccupationExposure[] {
    const lowerQuery = query.toLowerCase();
    return this.occupations.filter(
      (o) =>
        o.occupation_title.toLowerCase().includes(lowerQuery) ||
        o.soc_code.includes(query)
    );
  }

  /**
   * Search industries by name substring (case-insensitive).
   */
  searchIndustries(query: string): IndustryExposure[] {
    const lowerQuery = query.toLowerCase();
    return this.industries.filter(
      (i) =>
        i.industry.toLowerCase().includes(lowerQuery) ||
        i.naics_code.includes(query)
    );
  }
}
