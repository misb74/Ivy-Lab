import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initializeSchema } from './db/schema.js';
import { connectorRegister } from './tools/connector-register.js';
import { connectorList } from './tools/connector-list.js';
import { connectorTest } from './tools/connector-test.js';
import { connectorSync } from './tools/connector-sync.js';
import { connectorQuery } from './tools/connector-query.js';
import { connectorListProfiles } from './tools/connector-list-profiles.js';
import { connectorCreateFromProfile } from './tools/connector-create-from-profile.js';

const server = new McpServer({
  name: 'agent-connector',
  version: '2.0.0',
});

// Initialize database schema
initializeSchema();

// Tool: connector_register
server.tool(
  'connector_register',
  'Register a new external connector with name, type, base URL, authentication config, and field mapping',
  {
    name: z.string().describe('Display name for the connector'),
    type: z.enum(['hris', 'ats', 'lms', 'erp', 'custom']).describe('Type of external system'),
    base_url: z.string().url().describe('Base URL of the external system API'),
    auth_type: z.enum(['none', 'api_key', 'oauth2_bearer', 'basic']).optional().describe('Authentication type'),
    auth_config: z.record(z.unknown()).optional().describe('Authentication configuration (keys, tokens, credentials)'),
    field_mapping: z.record(z.string()).optional().describe('Field mapping from external to internal schema { external_field: internal_field }'),
  },
  async (params) => {
    try {
      const result = connectorRegister({
        name: params.name,
        type: params.type,
        base_url: params.base_url,
        auth_type: params.auth_type,
        auth_config: params.auth_config,
        field_mapping: params.field_mapping,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// Tool: connector_list
server.tool(
  'connector_list',
  'List all registered connectors with status and last sync info',
  {
    type: z.string().optional().describe('Filter by connector type (hris, ats, lms, erp, custom)'),
    status: z.string().optional().describe('Filter by status (active, inactive)'),
  },
  async (params) => {
    try {
      const result = connectorList({
        type: params.type,
        status: params.status,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// Tool: connector_test
server.tool(
  'connector_test',
  'Test connection to an external system by making a health check request',
  {
    connector_id: z.string().describe('ID of the connector to test'),
    health_endpoint: z.string().optional().describe('Custom health check endpoint (defaults to /)'),
  },
  async (params) => {
    try {
      const result = await connectorTest({
        connector_id: params.connector_id,
        health_endpoint: params.health_endpoint,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// Tool: connector_sync
server.tool(
  'connector_sync',
  'Trigger a data sync for a specific connector, pulling data from the external system',
  {
    connector_id: z.string().describe('ID of the connector to sync'),
    entity_type: z.string().describe('Type of entity to sync (e.g., employees, candidates, courses)'),
    endpoint: z.string().describe('API endpoint to pull data from'),
    data_path: z.string().optional().describe('Dot-notation path to the data array in the response (e.g., data.results)'),
  },
  async (params) => {
    try {
      const result = await connectorSync({
        connector_id: params.connector_id,
        entity_type: params.entity_type,
        endpoint: params.endpoint,
        data_path: params.data_path,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// Tool: connector_query
server.tool(
  'connector_query',
  'Query synced data from a specific connector with optional filters',
  {
    connector_id: z.string().describe('ID of the connector to query'),
    entity_type: z.string().optional().describe('Filter by entity type'),
    filters: z.record(z.unknown()).optional().describe('Key-value filters to apply on synced data'),
    limit: z.number().optional().describe('Maximum number of records to return (default 100)'),
    offset: z.number().optional().describe('Number of records to skip for pagination (default 0)'),
  },
  async (params) => {
    try {
      const result = connectorQuery({
        connector_id: params.connector_id,
        entity_type: params.entity_type,
        filters: params.filters as Record<string, unknown> | undefined,
        limit: params.limit,
        offset: params.offset,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// Tool: connector_list_profiles
server.tool(
  'connector_list_profiles',
  'List available pre-built connector profiles for ATS, HRIS, and CRM platforms (Greenhouse, Lever, BambooHR, Salesforce, HubSpot, etc.)',
  {
    category: z.enum(['ats', 'hris', 'crm']).optional().describe('Filter by platform category'),
  },
  async (params) => {
    try {
      const result = connectorListProfiles({ category: params.category });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// Tool: connector_create_from_profile
server.tool(
  'connector_create_from_profile',
  'Create a connector from a pre-built profile by providing platform credentials. Use connector_list_profiles first to see available profiles and required credential fields.',
  {
    profile_id: z.string().describe('Profile ID (e.g., greenhouse, bamboohr, salesforce)'),
    credentials: z.record(z.string()).describe('Platform credentials as key-value pairs (see auth_config_fields from connector_list_profiles)'),
    base_url: z.string().optional().describe('Override the default base URL (for on-premise or custom domains)'),
  },
  async (params) => {
    try {
      const result = connectorCreateFromProfile({
        profile_id: params.profile_id,
        credentials: params.credentials,
        base_url: params.base_url,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error starting agent-connector server:', error);
  process.exit(1);
});
