/**
 * Canonical HR concept aliases and normalization utilities.
 *
 * Each concept maps to common column header variations (all lowercase).
 * The schema-detector uses these to auto-map uploaded columns to Ivy concepts.
 */

export const CONCEPT_ALIASES: Record<string, string[]> = {
  EMPLOYEE_ID: [
    'employee_id', 'emp_id', 'worker_id', 'staff_id', 'personnel_id',
    'id', 'ee_id', 'employeeid', 'empid', 'badge_id',
  ],
  EMPLOYEE_NAME: [
    'employee_name', 'full_name', 'name', 'worker_name', 'staff_name',
    'emp_name', 'fullname', 'display_name', 'preferred_name',
  ],
  FIRST_NAME: [
    'first_name', 'firstname', 'fname', 'given_name', 'forename',
    'first', 'givenname',
  ],
  LAST_NAME: [
    'last_name', 'lastname', 'lname', 'surname', 'family_name',
    'last', 'familyname',
  ],
  EMAIL: [
    'email', 'email_address', 'work_email', 'corporate_email',
    'emailaddress', 'e_mail', 'mail',
  ],
  JOB_TITLE: [
    'job_title', 'title', 'position_title', 'role', 'role_name',
    'jobtitle', 'position', 'designation', 'occupation',
  ],
  JOB_FAMILY: [
    'job_family', 'jobfamily', 'job_group', 'function', 'job_function',
    'career_family', 'role_family', 'occupation_group',
  ],
  JOB_LEVEL: [
    'job_level', 'level', 'grade', 'band', 'career_level',
    'joblevel', 'pay_grade', 'classification', 'tier',
  ],
  DEPARTMENT: [
    'department', 'dept', 'division', 'business_unit', 'org_unit',
    'team', 'group', 'cost_center', 'department_name',
  ],
  LOCATION: [
    'location', 'office', 'city', 'work_location', 'site',
    'region', 'country', 'geography', 'office_location', 'market',
  ],
  MANAGER: [
    'manager', 'manager_name', 'supervisor', 'reports_to', 'manager_id',
    'direct_manager', 'line_manager', 'supervisor_name',
  ],
  HIRE_DATE: [
    'hire_date', 'hiredate', 'start_date', 'date_of_hire', 'join_date',
    'employment_start', 'onboard_date', 'commenced',
  ],
  TERM_DATE: [
    'term_date', 'termination_date', 'end_date', 'exit_date', 'leave_date',
    'separation_date', 'last_day', 'departure_date',
  ],
  SALARY: [
    'salary', 'base_salary', 'base_pay', 'annual_salary', 'pay',
    'compensation', 'base_comp', 'annual_pay', 'wage',
  ],
  TOTAL_COMP: [
    'total_comp', 'total_compensation', 'total_pay', 'loaded_cost',
    'fully_loaded', 'total_rewards', 'total_cash', 'ctc',
  ],
  CURRENCY: [
    'currency', 'currency_code', 'pay_currency', 'salary_currency',
    'ccy', 'curr',
  ],
  FTE: [
    'fte', 'full_time_equivalent', 'ftes', 'fte_count', 'fte_value',
    'headcount_fte',
  ],
  HEADCOUNT: [
    'headcount', 'hc', 'head_count', 'employee_count', 'hc_count',
    'employees', 'staff_count',
  ],
  SKILLS: [
    'skills', 'skill', 'competencies', 'capabilities', 'skill_list',
    'core_skills', 'technical_skills', 'key_skills',
  ],
  SOC_CODE: [
    'soc_code', 'soc', 'onet_code', 'occupation_code', 'standard_occupation',
    'bls_code', 'census_code',
  ],
};

/**
 * Maps Ivy concepts to denormalized column names in the records table.
 * Only concepts that have a corresponding _column in the schema are listed.
 */
export const DENORMALIZED_FIELDS: Record<string, string> = {
  JOB_TITLE: '_job_title',
  DEPARTMENT: '_department',
  LOCATION: '_location',
  JOB_LEVEL: '_job_level',
  JOB_FAMILY: '_job_family',
  SALARY: '_salary',
  FTE: '_fte',
  HIRE_DATE: '_hire_date',
  SOC_CODE: '_soc_code',
};

/**
 * Normalize a column header for matching:
 * - Lowercase
 * - Strip non-alphanumeric (except underscore)
 * - Collapse multiple underscores
 */
export function normalizeKey(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}
