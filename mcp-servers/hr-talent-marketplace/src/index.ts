import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { initializeSchema } from "./db/schema.js";
import { closeDatabase } from "./db/database.js";
import { talentMatchInternal } from "./tools/talent-match-internal.js";
import { talentMobilityScore } from "./tools/talent-mobility-score.js";
import { talentDevelopmentPlan } from "./tools/talent-development-plan.js";
import { talentBenchStrength } from "./tools/talent-bench-strength.js";

// Initialize database schema
initializeSchema();

// Create MCP server
const server = new McpServer({
  name: "hr-talent-marketplace",
  version: "2.0.0",
});

// --- Tool 1: talent_match_internal ---
server.tool(
  "talent_match_internal",
  "Match internal candidates to an open role, ranked by composite fit score. Evaluates all talent profiles against the role requirements using skill matching and mobility scoring.",
  {
    roleId: z.string().describe("The ID of the open role to match candidates against"),
    limit: z.number().optional().describe("Maximum number of candidates to return (default: 10)"),
    minScore: z.number().optional().describe("Minimum fit score threshold 0-100 (default: 0)"),
    departmentFilter: z.string().optional().describe("Filter candidates to a specific department"),
  },
  async (params) => {
    try {
      const result = talentMatchInternal({
        roleId: params.roleId,
        limit: params.limit,
        minScore: params.minScore,
        departmentFilter: params.departmentFilter,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

// --- Tool 2: talent_mobility_score ---
server.tool(
  "talent_mobility_score",
  "Calculate a composite mobility score for a specific talent profile toward a target role. Factors: skill overlap (40%), growth trajectory (20%), performance (20%), aspiration alignment (20%).",
  {
    profileId: z.string().describe("The ID of the talent profile to evaluate"),
    targetRoleId: z.string().describe("The ID of the target role"),
  },
  async (params) => {
    try {
      const result = talentMobilityScore({
        profileId: params.profileId,
        targetRoleId: params.targetRoleId,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

// --- Tool 3: talent_development_plan ---
server.tool(
  "talent_development_plan",
  "Generate a personalized multi-phase development plan for a talent profile transitioning to a target role. Identifies skill gaps and produces foundation, growth, and mastery phases with learning resources and milestones.",
  {
    profileId: z.string().describe("The ID of the talent profile"),
    targetRoleId: z.string().describe("The ID of the target role to develop toward"),
    savePlan: z.boolean().optional().describe("Whether to persist the plan to the database (default: false)"),
  },
  async (params) => {
    try {
      const result = talentDevelopmentPlan({
        profileId: params.profileId,
        targetRoleId: params.targetRoleId,
        savePlan: params.savePlan,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

// --- Tool 4: talent_bench_strength ---
server.tool(
  "talent_bench_strength",
  "Analyze succession pipeline depth (bench strength) for a specific role. Categorizes internal candidates into readiness buckets: ready_now, ready_6mo, ready_12mo, develop.",
  {
    roleId: z.string().describe("The ID of the role to analyze bench strength for"),
    includeDepartments: z.array(z.string()).optional().describe("Limit analysis to candidates from specific departments"),
    excludeCurrentHolder: z.boolean().optional().describe("Exclude the current role holder from analysis (default: false)"),
  },
  async (params) => {
    try {
      const result = talentBenchStrength({
        roleId: params.roleId,
        includeDepartments: params.includeDepartments,
        excludeCurrentHolder: params.excludeCurrentHolder,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

// --- Start the server ---
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", () => {
    closeDatabase();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    closeDatabase();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error starting hr-talent-marketplace server:", error);
  closeDatabase();
  process.exit(1);
});
