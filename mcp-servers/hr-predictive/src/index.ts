import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initializeSchema } from './db/schema.js';
import { predictAttritionSchema, handlePredictAttrition } from './tools/predict-attrition.js';
import { predictSalaryTrendSchema, handlePredictSalaryTrend } from './tools/predict-salary-trend.js';
import { predictSkillsDemandSchema, handlePredictSkillsDemand } from './tools/predict-skills-demand.js';
import { predictHeadcountSchema, handlePredictHeadcount } from './tools/predict-headcount.js';
import { scenarioSimulateSchema, handleScenarioSimulate } from './tools/scenario-simulate.js';

// Initialize database schema
initializeSchema();

const server = new McpServer({
  name: 'hr-predictive',
  version: '2.0.0',
});

// Tool 1: Predict Attrition
server.tool(
  'predict_attrition',
  'Predict employee attrition risk using multi-factor analysis including tenure, compensation, engagement, market demand, and team size',
  predictAttritionSchema,
  async (params) => handlePredictAttrition(params)
);

// Tool 2: Predict Salary Trend
server.tool(
  'predict_salary_trend',
  'Project salary trends forward for a given role and location using historical salary data with trend extrapolation',
  predictSalaryTrendSchema,
  async (params) => handlePredictSalaryTrend(params)
);

// Tool 3: Predict Skills Demand
server.tool(
  'predict_skills_demand',
  'Project future skills demand based on historical trends, identifying emerging, stable, and declining skills',
  predictSkillsDemandSchema,
  async (params) => handlePredictSkillsDemand(params)
);

// Tool 4: Predict Headcount
server.tool(
  'predict_headcount',
  'Forecast headcount needs based on growth rates, attrition, and planned hiring with confidence intervals',
  predictHeadcountSchema,
  async (params) => handlePredictHeadcount(params)
);

// Tool 5: Scenario Simulate
server.tool(
  'scenario_simulate',
  'Run Monte Carlo simulation on workforce scenarios with configurable variables and distributions, with optional comparison to previous scenarios',
  scenarioSimulateSchema,
  async (params) => handleScenarioSimulate(params)
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('hr-predictive MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
