export interface PaginationConfig {
  type: 'link_header' | 'cursor' | 'offset';
  cursor_field?: string;
  cursor_param?: string;
  page_param?: string;
  per_page_param?: string;
  per_page_default?: number;
}

export interface ConnectorProfile {
  id: string;
  name: string;
  category: 'ats' | 'hris' | 'crm';
  version: string;
  base_url_template: string;
  auth_type: 'api_key' | 'oauth2_bearer' | 'basic';
  auth_config_template: Record<string, string>;
  auth_config_fields: string[];
  health_endpoint: string;
  default_endpoints: Array<{
    entity_type: string;
    path: string;
    data_path?: string;
  }>;
  pagination: PaginationConfig;
  field_mapping: Record<string, string>;
  notes?: string;
}
