export interface PersonProfile {
  name: string;
  first_name: string;
  last_name: string;
  current_title: string;
  current_company: string;
  linkedin_url: string | null;
  source_url: string;
  source: 'apollo' | 'pdl';
  location: string;
  seniority: string;
  industry: string;
  headline: string;
  employment_history: {
    title: string;
    company: string;
    start_date: string | null;
    end_date: string | null;
    is_current: boolean;
  }[];
  education: {
    school: string;
    degree: string | null;
    field: string | null;
  }[];
  skills: string[];
}

export interface SearchParams {
  job_titles: string[];
  locations?: string[];
  seniority_levels?: ('c_suite' | 'vp' | 'director' | 'manager' | 'senior')[];
  industries?: string[];
  company_sizes?: string[];
  current_companies?: string[];
  keywords?: string[];
  max_results?: number;
}
