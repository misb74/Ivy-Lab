import { randomUUID } from 'crypto';
import { getDatabase } from '../db/database.js';

export interface ConnectorRegisterInput {
  name: string;
  type: 'hris' | 'ats' | 'lms' | 'erp' | 'custom';
  base_url: string;
  auth_type?: 'none' | 'api_key' | 'oauth2_bearer' | 'basic';
  auth_config?: Record<string, unknown>;
  field_mapping?: Record<string, string>;
}

export function connectorRegister(input: ConnectorRegisterInput): {
  id: string;
  name: string;
  type: string;
  base_url: string;
  status: string;
  created_at: string;
} {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO connectors (id, name, type, base_url, auth_type, auth_config, field_mapping, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  ).run(
    id,
    input.name,
    input.type,
    input.base_url,
    input.auth_type ?? 'none',
    JSON.stringify(input.auth_config ?? {}),
    JSON.stringify(input.field_mapping ?? {}),
    now,
    now
  );

  return {
    id,
    name: input.name,
    type: input.type,
    base_url: input.base_url,
    status: 'active',
    created_at: now,
  };
}
