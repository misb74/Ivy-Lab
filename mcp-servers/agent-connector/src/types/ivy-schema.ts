export interface IvyEntity {
  external_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  location?: {
    city?: string;
    country?: string;
  };
  employment?: {
    type?: string;
    status?: string;
    start_date?: string;
  };
  compensation?: {
    salary?: number;
    currency?: string;
  };
  manager?: {
    name?: string;
  };
  stage?: string;
  source?: string;
  created_at?: string;
  updated_at?: string;
}
