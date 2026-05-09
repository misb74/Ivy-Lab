import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { biasScore, fourFifthsRule, scanJdForBias, detectProxyVariables } from './tools/bias.js';
import {
  checkCompliance,
  generateComplianceReport,
  auditPayEquity,
  explainPayEquityMethodology,
} from './tools/compliance.js';
import { queryAuditTrail } from './tools/audit.js';

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'hr-compliance',
  version: '2.0.0',
});

// ---------------------------------------------------------------------------
// Tool 1: compliance_check
// ---------------------------------------------------------------------------

server.tool(
  'compliance_check',
  'Check a process description for HR compliance issues across hiring, termination, compensation, leave, and data privacy regulations.',
  {
    process_description: z.string().describe('Description of the HR process to check for compliance issues'),
    jurisdiction: z.string().optional().describe('Jurisdiction (e.g., "California", "NY", "EU") for location-specific requirements'),
  },
  async ({ process_description, jurisdiction }) => {
    const result = checkCompliance(process_description, jurisdiction);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 2: compliance_report
// ---------------------------------------------------------------------------

server.tool(
  'compliance_report',
  'Generate a structured compliance report for a specific HR compliance area, including applicable regulations, requirements, and action items.',
  {
    area: z.string().describe('Compliance area (e.g., "eeo", "compensation", "benefits", "safety", "data_privacy", "immigration", "leave")'),
    period: z.string().optional().describe('Reporting period (e.g., "Q1 2025", "2024 Annual")'),
  },
  async ({ area, period }) => {
    const result = generateComplianceReport(area, period);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 3: adverse_impact_monitor
// ---------------------------------------------------------------------------

server.tool(
  'adverse_impact_monitor',
  'Monitor for adverse impact using the EEOC 4/5ths (80%) rule. Compares selection rates across demographic groups to detect potential discrimination.',
  {
    groups: z.record(
      z.string(),
      z.object({
        selected: z.number().describe('Number of candidates selected from this group'),
        total: z.number().describe('Total number of candidates in this group'),
      })
    ).describe('Demographic groups with selection data (e.g., {"male": {"selected": 40, "total": 50}, "female": {"selected": 20, "total": 50}})'),
  },
  async ({ groups }) => {
    const result = fourFifthsRule(groups);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 4: pay_equity_audit
// ---------------------------------------------------------------------------

server.tool(
  'pay_equity_audit',
  'Audit pay equity across roles and demographics. Identifies significant pay gaps and provides remediation recommendations.',
  {
    roles: z.array(
      z.object({
        title: z.string().describe('Job title'),
        salary: z.number().describe('Annual salary'),
        demographics: z.record(z.string(), z.string()).optional().describe('Demographic attributes (e.g., {"gender": "female", "ethnicity": "hispanic"})'),
      })
    ).describe('Array of role/salary/demographic data to analyze'),
  },
  async ({ roles }) => {
    const result = auditPayEquity(roles);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 5: pay_equity_methodology
// ---------------------------------------------------------------------------

server.tool(
  'pay_equity_methodology',
  'Explain pay equity analysis methodologies including regression analysis, cohort analysis, and compa-ratio analysis.',
  {
    method: z.string().optional().describe('Specific methodology to explain (e.g., "regression", "cohort", "compa_ratio"). Omit to see all methods.'),
  },
  async ({ method }) => {
    const result = explainPayEquityMethodology(method);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 6: jd_bias_scan
// ---------------------------------------------------------------------------

server.tool(
  'jd_bias_scan',
  'Scan a job description for biased language including gendered terms, age-biased language, exclusionary terms, and proxy variables.',
  {
    jd_text: z.string().describe('Full text of the job description to scan'),
  },
  async ({ jd_text }) => {
    const result = scanJdForBias(jd_text);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 7: audit_trail_query
// ---------------------------------------------------------------------------

server.tool(
  'audit_trail_query',
  'Query the HR audit trail for specific actions and time periods. Returns audit entries with risk classifications and recommendations.',
  {
    action: z.string().optional().describe('Action type to filter by (e.g., "employee", "compensation", "access", "termination")'),
    date_range: z.object({
      start: z.string().describe('Start date (ISO 8601)'),
      end: z.string().describe('End date (ISO 8601)'),
    }).optional().describe('Date range to filter audit entries'),
  },
  async ({ action, date_range }) => {
    const result = queryAuditTrail(action, date_range);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 8: bias_detector
// ---------------------------------------------------------------------------

server.tool(
  'bias_detector',
  'Detect bias in selection criteria. Scans for proxy variables, subjective criteria, and discriminatory patterns. Optionally runs 4/5ths rule on selection data.',
  {
    criteria: z.array(z.string()).describe('Selection criteria to analyze for bias (e.g., ["zip_code", "GPA", "culture_fit", "years_of_experience"])'),
    selection_data: z.record(
      z.string(),
      z.object({
        selected: z.number().describe('Number selected'),
        total: z.number().describe('Total candidates'),
      })
    ).optional().describe('Optional demographic selection data for 4/5ths rule analysis'),
  },
  async ({ criteria, selection_data }) => {
    // Run bias scoring on criteria
    const biasResult = biasScore(criteria);

    // Run proxy variable detection
    const proxyDetections = detectProxyVariables(criteria);

    // Optionally run adverse impact analysis
    let adverseImpact = null;
    if (selection_data) {
      adverseImpact = fourFifthsRule(selection_data);
    }

    const result = {
      bias_analysis: biasResult,
      proxy_variables_detected: proxyDetections,
      adverse_impact_analysis: adverseImpact,
      combined_risk_level: adverseImpact?.has_adverse_impact
        ? 'critical'
        : biasResult.risk_level,
      summary: [
        `Bias score: ${biasResult.overall_score}/100 (${biasResult.risk_level} risk).`,
        `Proxy variables found: ${proxyDetections.length}.`,
        adverseImpact
          ? `Adverse impact: ${adverseImpact.has_adverse_impact ? 'DETECTED' : 'not detected'}.`
          : 'No selection data provided for adverse impact analysis.',
      ].join(' '),
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('hr-compliance MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
