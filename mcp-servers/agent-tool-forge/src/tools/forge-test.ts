import { getDb } from '../db/database.js';
import { runTestSuite, TestCase, TestSuiteResult } from '../sandbox/test-runner.js';
import { ForgedServerRow } from '../db/schema.js';

export async function forgeTest(params: {
  name: string;
  test_cases?: Array<{
    tool: string;
    input: Record<string, any>;
    expect_error?: boolean;
    description?: string;
  }>;
}): Promise<TestSuiteResult & { name: string; status: string }> {
  const db = getDb();
  const serverName = params.name.startsWith('forged-') ? params.name : `forged-${params.name}`;

  const row = db.prepare('SELECT * FROM forged_servers WHERE name = ?').get(serverName) as ForgedServerRow | undefined;
  if (!row) {
    throw new Error(`Server "${serverName}" not found`);
  }

  // Update status to testing
  db.prepare('UPDATE forged_servers SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run('testing', row.id);

  // Build test cases
  let testCases: TestCase[];

  if (params.test_cases && params.test_cases.length > 0) {
    testCases = params.test_cases.map(tc => ({
      tool: tc.tool,
      input: tc.input,
      expectError: tc.expect_error,
      description: tc.description,
    }));
  } else {
    // Auto-generate smoke tests: call each tool with empty/minimal input
    const tools: string[] = JSON.parse(row.tools_json);
    testCases = tools.map(toolName => ({
      tool: toolName,
      input: {},
      description: `Smoke test: ${toolName} with empty input`,
      expectError: false,
    }));
  }

  const projectDir = process.cwd();
  const result = await runTestSuite(row.server_path, testCases, projectDir);

  // Update database with results
  const newStatus = result.allPassed ? 'draft' : 'failed';
  db.prepare(`
    UPDATE forged_servers
    SET status = ?, test_results_json = ?, test_passed = ?, error = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    newStatus,
    JSON.stringify(result),
    result.allPassed ? 1 : 0,
    result.error || null,
    row.id,
  );

  return {
    ...result,
    name: serverName,
    status: newStatus,
  };
}
