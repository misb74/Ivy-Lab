import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { connectorRegister } from './connector-register.js';
import type { ConnectorProfile } from '../types/profile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = resolve(__dirname, '../../profiles');

export interface CreateFromProfileInput {
  profile_id: string;
  credentials: Record<string, string>;
  base_url?: string;
}

export function connectorCreateFromProfile(input: CreateFromProfileInput): {
  id: string;
  name: string;
  type: string;
  base_url: string;
  status: string;
  created_at: string;
  profile_id: string;
  default_endpoints: Array<{ entity_type: string; path: string; data_path?: string }>;
} {
  // Load profile
  const profilePath = resolve(PROFILES_DIR, `${input.profile_id}.json`);
  let raw: string;
  try {
    raw = readFileSync(profilePath, 'utf-8');
  } catch {
    throw new Error(`Profile '${input.profile_id}' not found. Use connector_list_profiles to see available profiles.`);
  }

  const profile: ConnectorProfile = JSON.parse(raw);

  // Validate required credential fields
  const missing = profile.auth_config_fields.filter(f => !input.credentials[f]);
  if (missing.length > 0) {
    throw new Error(`Missing required credentials: ${missing.join(', ')}. Required fields for ${profile.name}: ${profile.auth_config_fields.join(', ')}`);
  }

  // Substitute credentials into auth_config_template
  const authConfig: Record<string, unknown> = { type: profile.auth_type };
  for (const [key, template] of Object.entries(profile.auth_config_template)) {
    let value: string = template;
    for (const [credKey, credValue] of Object.entries(input.credentials)) {
      value = value.replace(`{{${credKey}}}`, credValue);
    }
    authConfig[key] = value;
  }

  // Determine base URL
  let baseUrl = input.base_url || profile.base_url_template;
  for (const [credKey, credValue] of Object.entries(input.credentials)) {
    baseUrl = baseUrl.replace(`{{${credKey}}}`, credValue);
  }

  // Map category to connector type
  const typeMap: Record<string, 'hris' | 'ats' | 'lms' | 'erp' | 'custom'> = {
    ats: 'ats',
    hris: 'hris',
    crm: 'custom',
  };

  const result = connectorRegister({
    name: profile.name,
    type: typeMap[profile.category] || 'custom',
    base_url: baseUrl,
    auth_type: profile.auth_type,
    auth_config: authConfig,
    field_mapping: profile.field_mapping,
  });

  return {
    ...result,
    profile_id: profile.id,
    default_endpoints: profile.default_endpoints,
  };
}
