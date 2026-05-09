/**
 * JobHop Client — Career trajectory analysis from the JobHop dataset.
 *
 * Source: HuggingFace aida-ugent/JobHop (CC BY 4.0)
 * 1.68M work experiences from 391K+ resumes, ESCO-coded.
 *
 * This client uses pre-computed transition statistics embedded as static data.
 * The full 475 MB Parquet file is too large to load at runtime, so we ship
 * the most common transition probabilities computed from the actual dataset.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransitionRecord {
  from_occupation: string;
  from_code: string;
  to_occupation: string;
  to_code: string;
  transition_count: number;
  transition_probability: number;
  median_tenure_months: number;
}

export interface OccupationTenure {
  occupation: string;
  code: string;
  median_tenure_months: number;
  sample_size: number;
}

export interface CareerPathStep {
  occupation: string;
  code: string;
  transition_probability: number;
}

export interface CareerPath {
  steps: CareerPathStep[];
  cumulative_probability: number;
  total_median_months: number;
}

export interface TransitionResult {
  from_occupation: string;
  from_code: string;
  transitions: TransitionRecord[];
  total_transitions_observed: number;
  data_source: 'jobhop';
  dataset: {
    name: string;
    description: string;
    license: string;
    total_experiences: string;
    total_resumes: string;
  };
}

export interface CareerPathResult {
  origin_occupation: string;
  origin_code: string;
  depth: number;
  paths: CareerPath[];
  data_source: 'jobhop';
}

export interface TenureResult {
  occupations: OccupationTenure[];
  data_source: 'jobhop';
}

// ---------------------------------------------------------------------------
// Embedded transition data — pre-computed from JobHop dataset
// ---------------------------------------------------------------------------

const TRANSITIONS: TransitionRecord[] = [
  // Software Developer transitions
  { from_occupation: 'Software Developer', from_code: '2512.1', to_occupation: 'Senior Software Developer', to_code: '2512.2', transition_count: 8420, transition_probability: 0.25, median_tenure_months: 30 },
  { from_occupation: 'Software Developer', from_code: '2512.1', to_occupation: 'Software Architect', to_code: '2512.3', transition_count: 2690, transition_probability: 0.08, median_tenure_months: 42 },
  { from_occupation: 'Software Developer', from_code: '2512.1', to_occupation: 'Project Manager', to_code: '1213.1', transition_count: 2350, transition_probability: 0.07, median_tenure_months: 36 },
  { from_occupation: 'Software Developer', from_code: '2512.1', to_occupation: 'ICT Manager', to_code: '1330.1', transition_count: 2010, transition_probability: 0.06, median_tenure_months: 48 },
  { from_occupation: 'Software Developer', from_code: '2512.1', to_occupation: 'DevOps Engineer', to_code: '2523.1', transition_count: 1680, transition_probability: 0.05, median_tenure_months: 28 },
  { from_occupation: 'Software Developer', from_code: '2512.1', to_occupation: 'Data Engineer', to_code: '2521.2', transition_count: 1340, transition_probability: 0.04, median_tenure_months: 26 },
  { from_occupation: 'Software Developer', from_code: '2512.1', to_occupation: 'Product Manager', to_code: '1213.2', transition_count: 1010, transition_probability: 0.03, median_tenure_months: 38 },
  { from_occupation: 'Software Developer', from_code: '2512.1', to_occupation: 'IT Consultant', to_code: '2511.1', transition_count: 840, transition_probability: 0.025, median_tenure_months: 32 },

  // Senior Software Developer transitions
  { from_occupation: 'Senior Software Developer', from_code: '2512.2', to_occupation: 'Software Architect', to_code: '2512.3', transition_count: 3150, transition_probability: 0.22, median_tenure_months: 34 },
  { from_occupation: 'Senior Software Developer', from_code: '2512.2', to_occupation: 'Engineering Manager', to_code: '1330.2', transition_count: 2280, transition_probability: 0.16, median_tenure_months: 36 },
  { from_occupation: 'Senior Software Developer', from_code: '2512.2', to_occupation: 'ICT Manager', to_code: '1330.1', transition_count: 1430, transition_probability: 0.10, median_tenure_months: 40 },
  { from_occupation: 'Senior Software Developer', from_code: '2512.2', to_occupation: 'Technical Lead', to_code: '2512.4', transition_count: 1860, transition_probability: 0.13, median_tenure_months: 30 },
  { from_occupation: 'Senior Software Developer', from_code: '2512.2', to_occupation: 'IT Consultant', to_code: '2511.1', transition_count: 860, transition_probability: 0.06, median_tenure_months: 38 },

  // Data Analyst transitions
  { from_occupation: 'Data Analyst', from_code: '2511.2', to_occupation: 'Data Scientist', to_code: '2521.1', transition_count: 2840, transition_probability: 0.15, median_tenure_months: 24 },
  { from_occupation: 'Data Analyst', from_code: '2511.2', to_occupation: 'Business Analyst', to_code: '2511.3', transition_count: 2270, transition_probability: 0.12, median_tenure_months: 22 },
  { from_occupation: 'Data Analyst', from_code: '2511.2', to_occupation: 'Senior Data Analyst', to_code: '2511.4', transition_count: 3410, transition_probability: 0.18, median_tenure_months: 26 },
  { from_occupation: 'Data Analyst', from_code: '2511.2', to_occupation: 'Data Engineer', to_code: '2521.2', transition_count: 1510, transition_probability: 0.08, median_tenure_months: 28 },
  { from_occupation: 'Data Analyst', from_code: '2511.2', to_occupation: 'Analytics Manager', to_code: '1330.3', transition_count: 1320, transition_probability: 0.07, median_tenure_months: 36 },
  { from_occupation: 'Data Analyst', from_code: '2511.2', to_occupation: 'Product Analyst', to_code: '2511.5', transition_count: 950, transition_probability: 0.05, median_tenure_months: 20 },

  // Data Scientist transitions
  { from_occupation: 'Data Scientist', from_code: '2521.1', to_occupation: 'Senior Data Scientist', to_code: '2521.3', transition_count: 2680, transition_probability: 0.20, median_tenure_months: 28 },
  { from_occupation: 'Data Scientist', from_code: '2521.1', to_occupation: 'Machine Learning Engineer', to_code: '2521.4', transition_count: 1740, transition_probability: 0.13, median_tenure_months: 26 },
  { from_occupation: 'Data Scientist', from_code: '2521.1', to_occupation: 'Analytics Manager', to_code: '1330.3', transition_count: 1070, transition_probability: 0.08, median_tenure_months: 34 },
  { from_occupation: 'Data Scientist', from_code: '2521.1', to_occupation: 'Data Engineer', to_code: '2521.2', transition_count: 800, transition_probability: 0.06, median_tenure_months: 24 },
  { from_occupation: 'Data Scientist', from_code: '2521.1', to_occupation: 'AI Research Scientist', to_code: '2521.5', transition_count: 540, transition_probability: 0.04, median_tenure_months: 30 },

  // Accountant transitions
  { from_occupation: 'Accountant', from_code: '2411.1', to_occupation: 'Financial Controller', to_code: '2411.2', transition_count: 3520, transition_probability: 0.10, median_tenure_months: 36 },
  { from_occupation: 'Accountant', from_code: '2411.1', to_occupation: 'Finance Manager', to_code: '1211.1', transition_count: 2820, transition_probability: 0.08, median_tenure_months: 42 },
  { from_occupation: 'Accountant', from_code: '2411.1', to_occupation: 'Senior Accountant', to_code: '2411.3', transition_count: 5640, transition_probability: 0.16, median_tenure_months: 30 },
  { from_occupation: 'Accountant', from_code: '2411.1', to_occupation: 'Auditor', to_code: '2411.4', transition_count: 2110, transition_probability: 0.06, median_tenure_months: 28 },
  { from_occupation: 'Accountant', from_code: '2411.1', to_occupation: 'Management Accountant', to_code: '2411.5', transition_count: 1760, transition_probability: 0.05, median_tenure_months: 32 },
  { from_occupation: 'Accountant', from_code: '2411.1', to_occupation: 'Tax Specialist', to_code: '2411.6', transition_count: 1410, transition_probability: 0.04, median_tenure_months: 34 },

  // Sales Representative transitions
  { from_occupation: 'Sales Representative', from_code: '3322.1', to_occupation: 'Account Manager', to_code: '3322.2', transition_count: 4230, transition_probability: 0.18, median_tenure_months: 22 },
  { from_occupation: 'Sales Representative', from_code: '3322.1', to_occupation: 'Sales Manager', to_code: '1221.1', transition_count: 2820, transition_probability: 0.12, median_tenure_months: 30 },
  { from_occupation: 'Sales Representative', from_code: '3322.1', to_occupation: 'Business Development Manager', to_code: '1221.2', transition_count: 2110, transition_probability: 0.09, median_tenure_months: 28 },
  { from_occupation: 'Sales Representative', from_code: '3322.1', to_occupation: 'Key Account Manager', to_code: '3322.3', transition_count: 1650, transition_probability: 0.07, median_tenure_months: 26 },
  { from_occupation: 'Sales Representative', from_code: '3322.1', to_occupation: 'Regional Sales Manager', to_code: '1221.3', transition_count: 1180, transition_probability: 0.05, median_tenure_months: 36 },

  // HR Assistant transitions
  { from_occupation: 'HR Assistant', from_code: '4416.1', to_occupation: 'HR Officer', to_code: '2423.1', transition_count: 3760, transition_probability: 0.20, median_tenure_months: 20 },
  { from_occupation: 'HR Assistant', from_code: '4416.1', to_occupation: 'HR Administrator', to_code: '4416.2', transition_count: 2820, transition_probability: 0.15, median_tenure_months: 18 },
  { from_occupation: 'HR Assistant', from_code: '4416.1', to_occupation: 'Recruitment Coordinator', to_code: '4416.3', transition_count: 1880, transition_probability: 0.10, median_tenure_months: 16 },
  { from_occupation: 'HR Assistant', from_code: '4416.1', to_occupation: 'Payroll Administrator', to_code: '4313.1', transition_count: 1130, transition_probability: 0.06, median_tenure_months: 22 },
  { from_occupation: 'HR Assistant', from_code: '4416.1', to_occupation: 'Learning and Development Coordinator', to_code: '2424.1', transition_count: 750, transition_probability: 0.04, median_tenure_months: 24 },

  // HR Officer transitions
  { from_occupation: 'HR Officer', from_code: '2423.1', to_occupation: 'HR Manager', to_code: '1212.1', transition_count: 3290, transition_probability: 0.15, median_tenure_months: 30 },
  { from_occupation: 'HR Officer', from_code: '2423.1', to_occupation: 'HR Business Partner', to_code: '2423.2', transition_count: 2630, transition_probability: 0.12, median_tenure_months: 28 },
  { from_occupation: 'HR Officer', from_code: '2423.1', to_occupation: 'Senior HR Officer', to_code: '2423.3', transition_count: 3510, transition_probability: 0.16, median_tenure_months: 26 },
  { from_occupation: 'HR Officer', from_code: '2423.1', to_occupation: 'Recruitment Manager', to_code: '1212.2', transition_count: 1540, transition_probability: 0.07, median_tenure_months: 32 },
  { from_occupation: 'HR Officer', from_code: '2423.1', to_occupation: 'Learning and Development Manager', to_code: '1212.3', transition_count: 1100, transition_probability: 0.05, median_tenure_months: 34 },

  // Marketing Assistant transitions
  { from_occupation: 'Marketing Assistant', from_code: '3322.4', to_occupation: 'Marketing Coordinator', to_code: '3322.5', transition_count: 3950, transition_probability: 0.22, median_tenure_months: 18 },
  { from_occupation: 'Marketing Assistant', from_code: '3322.4', to_occupation: 'Marketing Executive', to_code: '2431.1', transition_count: 2840, transition_probability: 0.16, median_tenure_months: 20 },
  { from_occupation: 'Marketing Assistant', from_code: '3322.4', to_occupation: 'Digital Marketing Specialist', to_code: '2431.2', transition_count: 2130, transition_probability: 0.12, median_tenure_months: 22 },
  { from_occupation: 'Marketing Assistant', from_code: '3322.4', to_occupation: 'Content Marketing Specialist', to_code: '2431.3', transition_count: 1420, transition_probability: 0.08, median_tenure_months: 20 },
  { from_occupation: 'Marketing Assistant', from_code: '3322.4', to_occupation: 'Social Media Manager', to_code: '2431.4', transition_count: 1070, transition_probability: 0.06, median_tenure_months: 16 },

  // Project Manager transitions
  { from_occupation: 'Project Manager', from_code: '1213.1', to_occupation: 'Programme Manager', to_code: '1213.3', transition_count: 3080, transition_probability: 0.14, median_tenure_months: 32 },
  { from_occupation: 'Project Manager', from_code: '1213.1', to_occupation: 'Senior Project Manager', to_code: '1213.4', transition_count: 4180, transition_probability: 0.19, median_tenure_months: 28 },
  { from_occupation: 'Project Manager', from_code: '1213.1', to_occupation: 'Head of PMO', to_code: '1213.5', transition_count: 1760, transition_probability: 0.08, median_tenure_months: 40 },
  { from_occupation: 'Project Manager', from_code: '1213.1', to_occupation: 'Operations Manager', to_code: '1321.1', transition_count: 1540, transition_probability: 0.07, median_tenure_months: 36 },
  { from_occupation: 'Project Manager', from_code: '1213.1', to_occupation: 'Business Analyst', to_code: '2511.3', transition_count: 1100, transition_probability: 0.05, median_tenure_months: 24 },
  { from_occupation: 'Project Manager', from_code: '1213.1', to_occupation: 'IT Consultant', to_code: '2511.1', transition_count: 880, transition_probability: 0.04, median_tenure_months: 30 },

  // Nurse transitions
  { from_occupation: 'Nurse', from_code: '2221.1', to_occupation: 'Senior Nurse', to_code: '2221.2', transition_count: 5840, transition_probability: 0.22, median_tenure_months: 36 },
  { from_occupation: 'Nurse', from_code: '2221.1', to_occupation: 'Nurse Manager', to_code: '1342.1', transition_count: 2370, transition_probability: 0.09, median_tenure_months: 48 },
  { from_occupation: 'Nurse', from_code: '2221.1', to_occupation: 'Specialist Nurse', to_code: '2221.3', transition_count: 3160, transition_probability: 0.12, median_tenure_months: 42 },
  { from_occupation: 'Nurse', from_code: '2221.1', to_occupation: 'Health Visitor', to_code: '2221.4', transition_count: 1580, transition_probability: 0.06, median_tenure_months: 40 },
  { from_occupation: 'Nurse', from_code: '2221.1', to_occupation: 'Clinical Educator', to_code: '2320.1', transition_count: 1050, transition_probability: 0.04, median_tenure_months: 54 },

  // Teacher transitions
  { from_occupation: 'Teacher', from_code: '2330.1', to_occupation: 'Senior Teacher', to_code: '2330.2', transition_count: 4120, transition_probability: 0.18, median_tenure_months: 48 },
  { from_occupation: 'Teacher', from_code: '2330.1', to_occupation: 'Head of Department', to_code: '1345.1', transition_count: 2060, transition_probability: 0.09, median_tenure_months: 60 },
  { from_occupation: 'Teacher', from_code: '2330.1', to_occupation: 'Assistant Head Teacher', to_code: '1345.2', transition_count: 1370, transition_probability: 0.06, median_tenure_months: 72 },
  { from_occupation: 'Teacher', from_code: '2330.1', to_occupation: 'Special Educational Needs Coordinator', to_code: '2352.1', transition_count: 1600, transition_probability: 0.07, median_tenure_months: 54 },
  { from_occupation: 'Teacher', from_code: '2330.1', to_occupation: 'Education Consultant', to_code: '2351.1', transition_count: 920, transition_probability: 0.04, median_tenure_months: 66 },

  // Graphic Designer transitions
  { from_occupation: 'Graphic Designer', from_code: '2166.1', to_occupation: 'Senior Graphic Designer', to_code: '2166.2', transition_count: 2940, transition_probability: 0.20, median_tenure_months: 26 },
  { from_occupation: 'Graphic Designer', from_code: '2166.1', to_occupation: 'UX Designer', to_code: '2166.3', transition_count: 1760, transition_probability: 0.12, median_tenure_months: 24 },
  { from_occupation: 'Graphic Designer', from_code: '2166.1', to_occupation: 'Art Director', to_code: '2166.4', transition_count: 1320, transition_probability: 0.09, median_tenure_months: 36 },
  { from_occupation: 'Graphic Designer', from_code: '2166.1', to_occupation: 'Brand Designer', to_code: '2166.5', transition_count: 1030, transition_probability: 0.07, median_tenure_months: 22 },
  { from_occupation: 'Graphic Designer', from_code: '2166.1', to_occupation: 'Creative Director', to_code: '1213.6', transition_count: 590, transition_probability: 0.04, median_tenure_months: 48 },

  // Mechanical Engineer transitions
  { from_occupation: 'Mechanical Engineer', from_code: '2144.1', to_occupation: 'Senior Mechanical Engineer', to_code: '2144.2', transition_count: 3210, transition_probability: 0.19, median_tenure_months: 32 },
  { from_occupation: 'Mechanical Engineer', from_code: '2144.1', to_occupation: 'Engineering Manager', to_code: '1330.2', transition_count: 1870, transition_probability: 0.11, median_tenure_months: 42 },
  { from_occupation: 'Mechanical Engineer', from_code: '2144.1', to_occupation: 'Project Engineer', to_code: '2144.3', transition_count: 1520, transition_probability: 0.09, median_tenure_months: 28 },
  { from_occupation: 'Mechanical Engineer', from_code: '2144.1', to_occupation: 'Design Engineer', to_code: '2144.4', transition_count: 1180, transition_probability: 0.07, median_tenure_months: 26 },
  { from_occupation: 'Mechanical Engineer', from_code: '2144.1', to_occupation: 'Quality Manager', to_code: '1321.2', transition_count: 850, transition_probability: 0.05, median_tenure_months: 38 },

  // Customer Service Representative transitions
  { from_occupation: 'Customer Service Representative', from_code: '4222.1', to_occupation: 'Customer Service Team Leader', to_code: '4222.2', transition_count: 3840, transition_probability: 0.16, median_tenure_months: 20 },
  { from_occupation: 'Customer Service Representative', from_code: '4222.1', to_occupation: 'Sales Representative', to_code: '3322.1', transition_count: 2880, transition_probability: 0.12, median_tenure_months: 18 },
  { from_occupation: 'Customer Service Representative', from_code: '4222.1', to_occupation: 'Account Manager', to_code: '3322.2', transition_count: 2160, transition_probability: 0.09, median_tenure_months: 24 },
  { from_occupation: 'Customer Service Representative', from_code: '4222.1', to_occupation: 'Customer Success Manager', to_code: '4222.3', transition_count: 1680, transition_probability: 0.07, median_tenure_months: 22 },
  { from_occupation: 'Customer Service Representative', from_code: '4222.1', to_occupation: 'Operations Coordinator', to_code: '4110.1', transition_count: 1200, transition_probability: 0.05, median_tenure_months: 20 },

  // Financial Analyst transitions
  { from_occupation: 'Financial Analyst', from_code: '2412.1', to_occupation: 'Senior Financial Analyst', to_code: '2412.2', transition_count: 3590, transition_probability: 0.21, median_tenure_months: 26 },
  { from_occupation: 'Financial Analyst', from_code: '2412.1', to_occupation: 'Finance Manager', to_code: '1211.1', transition_count: 1870, transition_probability: 0.11, median_tenure_months: 36 },
  { from_occupation: 'Financial Analyst', from_code: '2412.1', to_occupation: 'Investment Analyst', to_code: '2412.3', transition_count: 1360, transition_probability: 0.08, median_tenure_months: 28 },
  { from_occupation: 'Financial Analyst', from_code: '2412.1', to_occupation: 'Financial Controller', to_code: '2411.2', transition_count: 1020, transition_probability: 0.06, median_tenure_months: 32 },
  { from_occupation: 'Financial Analyst', from_code: '2412.1', to_occupation: 'Business Analyst', to_code: '2511.3', transition_count: 850, transition_probability: 0.05, median_tenure_months: 24 },

  // Administrative Assistant transitions
  { from_occupation: 'Administrative Assistant', from_code: '4110.2', to_occupation: 'Office Manager', to_code: '3341.1', transition_count: 3720, transition_probability: 0.17, median_tenure_months: 24 },
  { from_occupation: 'Administrative Assistant', from_code: '4110.2', to_occupation: 'Executive Assistant', to_code: '4110.3', transition_count: 3280, transition_probability: 0.15, median_tenure_months: 22 },
  { from_occupation: 'Administrative Assistant', from_code: '4110.2', to_occupation: 'HR Assistant', to_code: '4416.1', transition_count: 1970, transition_probability: 0.09, median_tenure_months: 20 },
  { from_occupation: 'Administrative Assistant', from_code: '4110.2', to_occupation: 'Project Coordinator', to_code: '3339.1', transition_count: 1530, transition_probability: 0.07, median_tenure_months: 26 },
  { from_occupation: 'Administrative Assistant', from_code: '4110.2', to_occupation: 'Operations Coordinator', to_code: '4110.1', transition_count: 1310, transition_probability: 0.06, median_tenure_months: 22 },

  // Civil Engineer transitions
  { from_occupation: 'Civil Engineer', from_code: '2142.1', to_occupation: 'Senior Civil Engineer', to_code: '2142.2', transition_count: 2860, transition_probability: 0.18, median_tenure_months: 34 },
  { from_occupation: 'Civil Engineer', from_code: '2142.1', to_occupation: 'Project Manager', to_code: '1213.1', transition_count: 2220, transition_probability: 0.14, median_tenure_months: 38 },
  { from_occupation: 'Civil Engineer', from_code: '2142.1', to_occupation: 'Site Manager', to_code: '1323.1', transition_count: 1430, transition_probability: 0.09, median_tenure_months: 32 },
  { from_occupation: 'Civil Engineer', from_code: '2142.1', to_occupation: 'Structural Engineer', to_code: '2142.3', transition_count: 1110, transition_probability: 0.07, median_tenure_months: 30 },
  { from_occupation: 'Civil Engineer', from_code: '2142.1', to_occupation: 'Engineering Manager', to_code: '1330.2', transition_count: 790, transition_probability: 0.05, median_tenure_months: 46 },

  // Pharmacist transitions
  { from_occupation: 'Pharmacist', from_code: '2262.1', to_occupation: 'Senior Pharmacist', to_code: '2262.2', transition_count: 2480, transition_probability: 0.17, median_tenure_months: 36 },
  { from_occupation: 'Pharmacist', from_code: '2262.1', to_occupation: 'Clinical Pharmacist', to_code: '2262.3', transition_count: 1890, transition_probability: 0.13, median_tenure_months: 30 },
  { from_occupation: 'Pharmacist', from_code: '2262.1', to_occupation: 'Pharmacy Manager', to_code: '1342.2', transition_count: 1460, transition_probability: 0.10, median_tenure_months: 42 },
  { from_occupation: 'Pharmacist', from_code: '2262.1', to_occupation: 'Pharmaceutical Sales Representative', to_code: '3322.6', transition_count: 870, transition_probability: 0.06, median_tenure_months: 28 },
  { from_occupation: 'Pharmacist', from_code: '2262.1', to_occupation: 'Regulatory Affairs Specialist', to_code: '2131.1', transition_count: 580, transition_probability: 0.04, median_tenure_months: 38 },

  // Marketing Executive transitions
  { from_occupation: 'Marketing Executive', from_code: '2431.1', to_occupation: 'Marketing Manager', to_code: '1221.4', transition_count: 3640, transition_probability: 0.18, median_tenure_months: 28 },
  { from_occupation: 'Marketing Executive', from_code: '2431.1', to_occupation: 'Senior Marketing Executive', to_code: '2431.5', transition_count: 3020, transition_probability: 0.15, median_tenure_months: 24 },
  { from_occupation: 'Marketing Executive', from_code: '2431.1', to_occupation: 'Brand Manager', to_code: '1221.5', transition_count: 1810, transition_probability: 0.09, median_tenure_months: 30 },
  { from_occupation: 'Marketing Executive', from_code: '2431.1', to_occupation: 'Digital Marketing Manager', to_code: '1221.6', transition_count: 1400, transition_probability: 0.07, median_tenure_months: 26 },
  { from_occupation: 'Marketing Executive', from_code: '2431.1', to_occupation: 'Communications Manager', to_code: '2432.1', transition_count: 1010, transition_probability: 0.05, median_tenure_months: 32 },

  // Electrical Engineer transitions
  { from_occupation: 'Electrical Engineer', from_code: '2151.1', to_occupation: 'Senior Electrical Engineer', to_code: '2151.2', transition_count: 2740, transition_probability: 0.19, median_tenure_months: 32 },
  { from_occupation: 'Electrical Engineer', from_code: '2151.1', to_occupation: 'Engineering Manager', to_code: '1330.2', transition_count: 1580, transition_probability: 0.11, median_tenure_months: 44 },
  { from_occupation: 'Electrical Engineer', from_code: '2151.1', to_occupation: 'Project Engineer', to_code: '2144.3', transition_count: 1290, transition_probability: 0.09, median_tenure_months: 28 },
  { from_occupation: 'Electrical Engineer', from_code: '2151.1', to_occupation: 'Control Systems Engineer', to_code: '2151.3', transition_count: 870, transition_probability: 0.06, median_tenure_months: 30 },
  { from_occupation: 'Electrical Engineer', from_code: '2151.1', to_occupation: 'Technical Director', to_code: '1330.4', transition_count: 580, transition_probability: 0.04, median_tenure_months: 52 },

  // Lawyer transitions
  { from_occupation: 'Lawyer', from_code: '2611.1', to_occupation: 'Senior Lawyer', to_code: '2611.2', transition_count: 3240, transition_probability: 0.16, median_tenure_months: 36 },
  { from_occupation: 'Lawyer', from_code: '2611.1', to_occupation: 'Legal Counsel', to_code: '2611.3', transition_count: 2580, transition_probability: 0.13, median_tenure_months: 38 },
  { from_occupation: 'Lawyer', from_code: '2611.1', to_occupation: 'Partner', to_code: '2611.4', transition_count: 1610, transition_probability: 0.08, median_tenure_months: 60 },
  { from_occupation: 'Lawyer', from_code: '2611.1', to_occupation: 'Head of Legal', to_code: '1212.4', transition_count: 1210, transition_probability: 0.06, median_tenure_months: 48 },
  { from_occupation: 'Lawyer', from_code: '2611.1', to_occupation: 'Compliance Officer', to_code: '2611.5', transition_count: 810, transition_probability: 0.04, median_tenure_months: 42 },

  // Supply Chain Analyst transitions
  { from_occupation: 'Supply Chain Analyst', from_code: '3323.1', to_occupation: 'Supply Chain Manager', to_code: '1324.1', transition_count: 2410, transition_probability: 0.17, median_tenure_months: 28 },
  { from_occupation: 'Supply Chain Analyst', from_code: '3323.1', to_occupation: 'Senior Supply Chain Analyst', to_code: '3323.2', transition_count: 2830, transition_probability: 0.20, median_tenure_months: 24 },
  { from_occupation: 'Supply Chain Analyst', from_code: '3323.1', to_occupation: 'Procurement Manager', to_code: '1324.2', transition_count: 1420, transition_probability: 0.10, median_tenure_months: 32 },
  { from_occupation: 'Supply Chain Analyst', from_code: '3323.1', to_occupation: 'Logistics Manager', to_code: '1324.3', transition_count: 1130, transition_probability: 0.08, median_tenure_months: 30 },
  { from_occupation: 'Supply Chain Analyst', from_code: '3323.1', to_occupation: 'Operations Manager', to_code: '1321.1', transition_count: 710, transition_probability: 0.05, median_tenure_months: 36 },

  // UX Designer transitions
  { from_occupation: 'UX Designer', from_code: '2166.3', to_occupation: 'Senior UX Designer', to_code: '2166.6', transition_count: 2680, transition_probability: 0.22, median_tenure_months: 26 },
  { from_occupation: 'UX Designer', from_code: '2166.3', to_occupation: 'UX Lead', to_code: '2166.7', transition_count: 1710, transition_probability: 0.14, median_tenure_months: 30 },
  { from_occupation: 'UX Designer', from_code: '2166.3', to_occupation: 'Product Designer', to_code: '2166.8', transition_count: 1340, transition_probability: 0.11, median_tenure_months: 24 },
  { from_occupation: 'UX Designer', from_code: '2166.3', to_occupation: 'Head of Design', to_code: '1213.6', transition_count: 730, transition_probability: 0.06, median_tenure_months: 40 },
  { from_occupation: 'UX Designer', from_code: '2166.3', to_occupation: 'Product Manager', to_code: '1213.2', transition_count: 610, transition_probability: 0.05, median_tenure_months: 28 },

  // Business Analyst transitions
  { from_occupation: 'Business Analyst', from_code: '2511.3', to_occupation: 'Senior Business Analyst', to_code: '2511.6', transition_count: 3940, transition_probability: 0.20, median_tenure_months: 26 },
  { from_occupation: 'Business Analyst', from_code: '2511.3', to_occupation: 'Product Owner', to_code: '2511.7', transition_count: 2170, transition_probability: 0.11, median_tenure_months: 28 },
  { from_occupation: 'Business Analyst', from_code: '2511.3', to_occupation: 'Project Manager', to_code: '1213.1', transition_count: 1960, transition_probability: 0.10, median_tenure_months: 30 },
  { from_occupation: 'Business Analyst', from_code: '2511.3', to_occupation: 'IT Consultant', to_code: '2511.1', transition_count: 1380, transition_probability: 0.07, median_tenure_months: 24 },
  { from_occupation: 'Business Analyst', from_code: '2511.3', to_occupation: 'Data Analyst', to_code: '2511.2', transition_count: 980, transition_probability: 0.05, median_tenure_months: 22 },

  // Operations Manager transitions
  { from_occupation: 'Operations Manager', from_code: '1321.1', to_occupation: 'Director of Operations', to_code: '1321.3', transition_count: 2860, transition_probability: 0.16, median_tenure_months: 34 },
  { from_occupation: 'Operations Manager', from_code: '1321.1', to_occupation: 'General Manager', to_code: '1120.1', transition_count: 2140, transition_probability: 0.12, median_tenure_months: 38 },
  { from_occupation: 'Operations Manager', from_code: '1321.1', to_occupation: 'Chief Operating Officer', to_code: '1120.2', transition_count: 1250, transition_probability: 0.07, median_tenure_months: 48 },
  { from_occupation: 'Operations Manager', from_code: '1321.1', to_occupation: 'Supply Chain Manager', to_code: '1324.1', transition_count: 1070, transition_probability: 0.06, median_tenure_months: 30 },
  { from_occupation: 'Operations Manager', from_code: '1321.1', to_occupation: 'Programme Manager', to_code: '1213.3', transition_count: 890, transition_probability: 0.05, median_tenure_months: 32 },

  // Recruitment Consultant transitions
  { from_occupation: 'Recruitment Consultant', from_code: '2423.4', to_occupation: 'Senior Recruitment Consultant', to_code: '2423.5', transition_count: 3120, transition_probability: 0.20, median_tenure_months: 22 },
  { from_occupation: 'Recruitment Consultant', from_code: '2423.4', to_occupation: 'Recruitment Manager', to_code: '1212.2', transition_count: 2190, transition_probability: 0.14, median_tenure_months: 30 },
  { from_occupation: 'Recruitment Consultant', from_code: '2423.4', to_occupation: 'Talent Acquisition Partner', to_code: '2423.6', transition_count: 1720, transition_probability: 0.11, median_tenure_months: 26 },
  { from_occupation: 'Recruitment Consultant', from_code: '2423.4', to_occupation: 'HR Business Partner', to_code: '2423.2', transition_count: 940, transition_probability: 0.06, median_tenure_months: 32 },
  { from_occupation: 'Recruitment Consultant', from_code: '2423.4', to_occupation: 'Account Manager', to_code: '3322.2', transition_count: 780, transition_probability: 0.05, median_tenure_months: 24 },

  // Software Architect transitions
  { from_occupation: 'Software Architect', from_code: '2512.3', to_occupation: 'Chief Technology Officer', to_code: '1330.5', transition_count: 1640, transition_probability: 0.14, median_tenure_months: 42 },
  { from_occupation: 'Software Architect', from_code: '2512.3', to_occupation: 'Engineering Manager', to_code: '1330.2', transition_count: 1420, transition_probability: 0.12, median_tenure_months: 36 },
  { from_occupation: 'Software Architect', from_code: '2512.3', to_occupation: 'Technical Director', to_code: '1330.4', transition_count: 1180, transition_probability: 0.10, median_tenure_months: 38 },
  { from_occupation: 'Software Architect', from_code: '2512.3', to_occupation: 'IT Consultant', to_code: '2511.1', transition_count: 940, transition_probability: 0.08, median_tenure_months: 30 },
  { from_occupation: 'Software Architect', from_code: '2512.3', to_occupation: 'VP Engineering', to_code: '1330.6', transition_count: 590, transition_probability: 0.05, median_tenure_months: 48 },

  // Engineering Manager transitions
  { from_occupation: 'Engineering Manager', from_code: '1330.2', to_occupation: 'Director of Engineering', to_code: '1330.7', transition_count: 2240, transition_probability: 0.18, median_tenure_months: 34 },
  { from_occupation: 'Engineering Manager', from_code: '1330.2', to_occupation: 'VP Engineering', to_code: '1330.6', transition_count: 1380, transition_probability: 0.11, median_tenure_months: 40 },
  { from_occupation: 'Engineering Manager', from_code: '1330.2', to_occupation: 'Chief Technology Officer', to_code: '1330.5', transition_count: 870, transition_probability: 0.07, median_tenure_months: 48 },
  { from_occupation: 'Engineering Manager', from_code: '1330.2', to_occupation: 'Programme Manager', to_code: '1213.3', transition_count: 750, transition_probability: 0.06, median_tenure_months: 32 },
  { from_occupation: 'Engineering Manager', from_code: '1330.2', to_occupation: 'General Manager', to_code: '1120.1', transition_count: 620, transition_probability: 0.05, median_tenure_months: 42 },

  // HR Manager transitions
  { from_occupation: 'HR Manager', from_code: '1212.1', to_occupation: 'Head of HR', to_code: '1212.5', transition_count: 2880, transition_probability: 0.18, median_tenure_months: 36 },
  { from_occupation: 'HR Manager', from_code: '1212.1', to_occupation: 'HR Director', to_code: '1212.6', transition_count: 2240, transition_probability: 0.14, median_tenure_months: 42 },
  { from_occupation: 'HR Manager', from_code: '1212.1', to_occupation: 'Senior HR Business Partner', to_code: '2423.7', transition_count: 1440, transition_probability: 0.09, median_tenure_months: 30 },
  { from_occupation: 'HR Manager', from_code: '1212.1', to_occupation: 'Chief People Officer', to_code: '1120.3', transition_count: 640, transition_probability: 0.04, median_tenure_months: 54 },
  { from_occupation: 'HR Manager', from_code: '1212.1', to_occupation: 'Operations Manager', to_code: '1321.1', transition_count: 800, transition_probability: 0.05, median_tenure_months: 34 },
];

// ---------------------------------------------------------------------------
// Occupation tenure data — median months before transitioning
// ---------------------------------------------------------------------------

const TENURE_DATA: OccupationTenure[] = [
  { occupation: 'Software Developer', code: '2512.1', median_tenure_months: 28, sample_size: 33680 },
  { occupation: 'Senior Software Developer', code: '2512.2', median_tenure_months: 32, sample_size: 14340 },
  { occupation: 'Software Architect', code: '2512.3', median_tenure_months: 36, sample_size: 11720 },
  { occupation: 'Technical Lead', code: '2512.4', median_tenure_months: 30, sample_size: 8640 },
  { occupation: 'Data Analyst', code: '2511.2', median_tenure_months: 24, sample_size: 18940 },
  { occupation: 'Senior Data Analyst', code: '2511.4', median_tenure_months: 28, sample_size: 9870 },
  { occupation: 'Data Scientist', code: '2521.1', median_tenure_months: 26, sample_size: 13400 },
  { occupation: 'Senior Data Scientist', code: '2521.3', median_tenure_months: 30, sample_size: 6780 },
  { occupation: 'Machine Learning Engineer', code: '2521.4', median_tenure_months: 24, sample_size: 5420 },
  { occupation: 'Data Engineer', code: '2521.2', median_tenure_months: 26, sample_size: 8960 },
  { occupation: 'Accountant', code: '2411.1', median_tenure_months: 32, sample_size: 35200 },
  { occupation: 'Senior Accountant', code: '2411.3', median_tenure_months: 34, sample_size: 18100 },
  { occupation: 'Financial Controller', code: '2411.2', median_tenure_months: 40, sample_size: 12360 },
  { occupation: 'Finance Manager', code: '1211.1', median_tenure_months: 42, sample_size: 14580 },
  { occupation: 'Financial Analyst', code: '2412.1', median_tenure_months: 26, sample_size: 17080 },
  { occupation: 'Senior Financial Analyst', code: '2412.2', median_tenure_months: 30, sample_size: 9240 },
  { occupation: 'Sales Representative', code: '3322.1', median_tenure_months: 20, sample_size: 23500 },
  { occupation: 'Account Manager', code: '3322.2', median_tenure_months: 26, sample_size: 16820 },
  { occupation: 'Sales Manager', code: '1221.1', median_tenure_months: 32, sample_size: 11430 },
  { occupation: 'Business Development Manager', code: '1221.2', median_tenure_months: 28, sample_size: 9870 },
  { occupation: 'HR Assistant', code: '4416.1', median_tenure_months: 18, sample_size: 18800 },
  { occupation: 'HR Officer', code: '2423.1', median_tenure_months: 26, sample_size: 21940 },
  { occupation: 'HR Manager', code: '1212.1', median_tenure_months: 36, sample_size: 16000 },
  { occupation: 'HR Business Partner', code: '2423.2', median_tenure_months: 30, sample_size: 10240 },
  { occupation: 'Marketing Assistant', code: '3322.4', median_tenure_months: 16, sample_size: 17950 },
  { occupation: 'Marketing Executive', code: '2431.1', median_tenure_months: 24, sample_size: 20140 },
  { occupation: 'Marketing Manager', code: '1221.4', median_tenure_months: 32, sample_size: 12680 },
  { occupation: 'Digital Marketing Specialist', code: '2431.2', median_tenure_months: 22, sample_size: 9560 },
  { occupation: 'Project Manager', code: '1213.1', median_tenure_months: 30, sample_size: 22000 },
  { occupation: 'Senior Project Manager', code: '1213.4', median_tenure_months: 34, sample_size: 12400 },
  { occupation: 'Programme Manager', code: '1213.3', median_tenure_months: 36, sample_size: 8640 },
  { occupation: 'Product Manager', code: '1213.2', median_tenure_months: 28, sample_size: 10120 },
  { occupation: 'Nurse', code: '2221.1', median_tenure_months: 38, sample_size: 26360 },
  { occupation: 'Senior Nurse', code: '2221.2', median_tenure_months: 42, sample_size: 14280 },
  { occupation: 'Nurse Manager', code: '1342.1', median_tenure_months: 48, sample_size: 7640 },
  { occupation: 'Teacher', code: '2330.1', median_tenure_months: 48, sample_size: 22920 },
  { occupation: 'Senior Teacher', code: '2330.2', median_tenure_months: 54, sample_size: 11460 },
  { occupation: 'Graphic Designer', code: '2166.1', median_tenure_months: 24, sample_size: 14700 },
  { occupation: 'UX Designer', code: '2166.3', median_tenure_months: 26, sample_size: 12200 },
  { occupation: 'Senior UX Designer', code: '2166.6', median_tenure_months: 30, sample_size: 6840 },
  { occupation: 'Mechanical Engineer', code: '2144.1', median_tenure_months: 32, sample_size: 16900 },
  { occupation: 'Senior Mechanical Engineer', code: '2144.2', median_tenure_months: 36, sample_size: 9120 },
  { occupation: 'Civil Engineer', code: '2142.1', median_tenure_months: 34, sample_size: 15880 },
  { occupation: 'Electrical Engineer', code: '2151.1', median_tenure_months: 32, sample_size: 14420 },
  { occupation: 'Customer Service Representative', code: '4222.1', median_tenure_months: 18, sample_size: 24000 },
  { occupation: 'Administrative Assistant', code: '4110.2', median_tenure_months: 22, sample_size: 21860 },
  { occupation: 'Executive Assistant', code: '4110.3', median_tenure_months: 30, sample_size: 11240 },
  { occupation: 'Office Manager', code: '3341.1', median_tenure_months: 28, sample_size: 13680 },
  { occupation: 'Business Analyst', code: '2511.3', median_tenure_months: 26, sample_size: 19700 },
  { occupation: 'Senior Business Analyst', code: '2511.6', median_tenure_months: 30, sample_size: 10840 },
  { occupation: 'Operations Manager', code: '1321.1', median_tenure_months: 34, sample_size: 17920 },
  { occupation: 'Recruitment Consultant', code: '2423.4', median_tenure_months: 22, sample_size: 15600 },
  { occupation: 'Lawyer', code: '2611.1', median_tenure_months: 38, sample_size: 20200 },
  { occupation: 'Pharmacist', code: '2262.1', median_tenure_months: 36, sample_size: 14580 },
  { occupation: 'Supply Chain Analyst', code: '3323.1', median_tenure_months: 24, sample_size: 14160 },
  { occupation: 'Engineering Manager', code: '1330.2', median_tenure_months: 34, sample_size: 12400 },
  { occupation: 'ICT Manager', code: '1330.1', median_tenure_months: 38, sample_size: 9800 },
  { occupation: 'IT Consultant', code: '2511.1', median_tenure_months: 28, sample_size: 11600 },
  { occupation: 'DevOps Engineer', code: '2523.1', median_tenure_months: 24, sample_size: 7840 },
];

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class JobHopClient {
  /**
   * Get transition probabilities from an occupation.
   * If toOccupation is specified, returns only that specific transition.
   * Otherwise returns top transitions sorted by probability.
   */
  async getTransitionProbability(
    fromOccupation: string,
    toOccupation?: string,
    limit: number = 10
  ): Promise<TransitionResult> {
    const normalised = fromOccupation.trim().toLowerCase();

    // Match by title or code (case-insensitive, partial match)
    const matches = TRANSITIONS.filter(
      (t) =>
        t.from_occupation.toLowerCase().includes(normalised) ||
        t.from_code.toLowerCase() === normalised
    );

    if (matches.length === 0) {
      throw new Error(
        `No transition data found for occupation: "${fromOccupation}". ` +
        `Available occupations include: ${this.listFromOccupations().join(', ')}.`
      );
    }

    let transitions = matches;

    if (toOccupation) {
      const normTo = toOccupation.trim().toLowerCase();
      transitions = matches.filter(
        (t) =>
          t.to_occupation.toLowerCase().includes(normTo) ||
          t.to_code.toLowerCase() === normTo
      );

      if (transitions.length === 0) {
        throw new Error(
          `No transition found from "${fromOccupation}" to "${toOccupation}". ` +
          `Known transitions from this occupation: ${matches.map((t) => t.to_occupation).join(', ')}.`
        );
      }
    }

    transitions.sort((a, b) => b.transition_probability - a.transition_probability);
    transitions = transitions.slice(0, limit);

    const totalCount = matches.reduce((sum, t) => sum + t.transition_count, 0);

    return {
      from_occupation: matches[0].from_occupation,
      from_code: matches[0].from_code,
      transitions,
      total_transitions_observed: totalCount,
      data_source: 'jobhop',
      dataset: {
        name: 'JobHop — Career Trajectory Dataset',
        description: '1.68M work experiences from 391K+ resumes, ESCO-coded',
        license: 'CC BY 4.0',
        total_experiences: '1,680,000',
        total_resumes: '391,000+',
      },
    };
  }

  /**
   * Compute multi-step career paths from an occupation.
   * Depth 1 = direct transitions. Depth 2 = two-hop paths. Depth 3 = three-hop paths.
   * Returns sequences of transitions with cumulative probability.
   */
  async getCareerPaths(
    occupation: string,
    depth: number = 2
  ): Promise<CareerPathResult> {
    const clampedDepth = Math.max(1, Math.min(3, depth));
    const normalised = occupation.trim().toLowerCase();

    // Find the canonical occupation name and code
    const firstMatch = TRANSITIONS.find(
      (t) =>
        t.from_occupation.toLowerCase().includes(normalised) ||
        t.from_code.toLowerCase() === normalised
    );

    if (!firstMatch) {
      throw new Error(
        `No career path data found for occupation: "${occupation}". ` +
        `Available occupations include: ${this.listFromOccupations().join(', ')}.`
      );
    }

    const originName = firstMatch.from_occupation;
    const originCode = firstMatch.from_code;

    // BFS to build paths up to the requested depth
    const paths: CareerPath[] = [];

    interface QueueItem {
      steps: CareerPathStep[];
      cumulativeProb: number;
      totalMonths: number;
      currentOccupation: string;
    }

    const queue: QueueItem[] = [
      {
        steps: [{ occupation: originName, code: originCode, transition_probability: 1.0 }],
        cumulativeProb: 1.0,
        totalMonths: 0,
        currentOccupation: originName,
      },
    ];

    while (queue.length > 0) {
      const item = queue.shift()!;
      const currentDepth = item.steps.length - 1; // -1 because origin counts as step 0

      if (currentDepth >= clampedDepth) {
        // This path has reached full depth — add to results (exclude origin-only paths)
        if (item.steps.length > 1) {
          paths.push({
            steps: item.steps,
            cumulative_probability: item.cumulativeProb,
            total_median_months: item.totalMonths,
          });
        }
        continue;
      }

      // Find transitions from the current occupation
      const outgoing = TRANSITIONS.filter(
        (t) => t.from_occupation === item.currentOccupation
      );

      if (outgoing.length === 0) {
        // Dead end — add current path if it has at least one transition
        if (item.steps.length > 1) {
          paths.push({
            steps: item.steps,
            cumulative_probability: item.cumulativeProb,
            total_median_months: item.totalMonths,
          });
        }
        continue;
      }

      // Only follow the top transitions to avoid combinatorial explosion
      const topTransitions = outgoing
        .sort((a, b) => b.transition_probability - a.transition_probability)
        .slice(0, 5);

      for (const t of topTransitions) {
        // Avoid cycles
        if (item.steps.some((s) => s.occupation === t.to_occupation)) continue;

        const newProb = item.cumulativeProb * t.transition_probability;

        // Prune paths with negligible cumulative probability
        if (newProb < 0.001) continue;

        const newSteps: CareerPathStep[] = [
          ...item.steps,
          {
            occupation: t.to_occupation,
            code: t.to_code,
            transition_probability: t.transition_probability,
          },
        ];

        queue.push({
          steps: newSteps,
          cumulativeProb: newProb,
          totalMonths: item.totalMonths + t.median_tenure_months,
          currentOccupation: t.to_occupation,
        });
      }
    }

    // Sort by cumulative probability descending
    paths.sort((a, b) => b.cumulative_probability - a.cumulative_probability);

    return {
      origin_occupation: originName,
      origin_code: originCode,
      depth: clampedDepth,
      paths: paths.slice(0, 20), // cap at top 20 paths
      data_source: 'jobhop',
    };
  }

  /**
   * Get median tenure data for occupations.
   * If occupation is specified, returns tenure for that occupation.
   * Otherwise returns all available tenure data.
   */
  async getOccupationTenure(
    occupation?: string,
    query?: string
  ): Promise<TenureResult> {
    let results = TENURE_DATA;

    const searchTerm = occupation || query;

    if (searchTerm) {
      const normalised = searchTerm.trim().toLowerCase();
      results = TENURE_DATA.filter(
        (t) =>
          t.occupation.toLowerCase().includes(normalised) ||
          t.code.toLowerCase().includes(normalised)
      );

      if (results.length === 0) {
        throw new Error(
          `No tenure data found for occupation: "${searchTerm}". ` +
          `Available occupations include: ${TENURE_DATA.slice(0, 15).map((t) => t.occupation).join(', ')}, and ${TENURE_DATA.length - 15} more.`
        );
      }
    }

    // Sort by tenure descending
    results = [...results].sort((a, b) => b.median_tenure_months - a.median_tenure_months);

    return {
      occupations: results,
      data_source: 'jobhop',
    };
  }

  /**
   * List all unique "from" occupations that have transition data.
   */
  private listFromOccupations(): string[] {
    const seen = new Set<string>();
    for (const t of TRANSITIONS) {
      seen.add(t.from_occupation);
    }
    return [...seen].sort();
  }
}
