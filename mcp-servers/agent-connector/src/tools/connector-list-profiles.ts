import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ConnectorProfile } from '../types/profile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = resolve(__dirname, '../../profiles');

export interface ListProfilesInput {
  category?: string;
}

export function connectorListProfiles(input: ListProfilesInput): {
  profiles: Array<{
    id: string;
    name: string;
    category: string;
    auth_type: string;
    auth_config_fields: string[];
  }>;
  total: number;
} {
  const files = readdirSync(PROFILES_DIR).filter(f => f.endsWith('.json'));
  const profiles: Array<{
    id: string;
    name: string;
    category: string;
    auth_type: string;
    auth_config_fields: string[];
  }> = [];

  for (const file of files) {
    const raw = readFileSync(resolve(PROFILES_DIR, file), 'utf-8');
    const profile: ConnectorProfile = JSON.parse(raw);

    if (input.category && profile.category !== input.category) continue;

    profiles.push({
      id: profile.id,
      name: profile.name,
      category: profile.category,
      auth_type: profile.auth_type,
      auth_config_fields: profile.auth_config_fields,
    });
  }

  return { profiles, total: profiles.length };
}
