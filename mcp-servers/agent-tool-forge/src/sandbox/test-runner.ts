/**
 * Sandbox test runner for forged MCP servers.
 * Spawns the server as a child process, connects via MCP SDK,
 * discovers tools, and runs test cases.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface TestCase {
  tool: string;
  input: Record<string, any>;
  expectError?: boolean;
  description?: string;
}

export interface TestResult {
  tool: string;
  description: string;
  passed: boolean;
  output?: string;
  error?: string;
  duration_ms: number;
}

export interface TestSuiteResult {
  discoveredTools: string[];
  testResults: TestResult[];
  allPassed: boolean;
  totalDuration_ms: number;
  error?: string;
}

const STARTUP_TIMEOUT = 15_000;
const TEST_TIMEOUT = 30_000;
const SUITE_TIMEOUT = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export async function runTestSuite(
  serverPath: string,
  testCases: TestCase[],
  projectDir: string,
): Promise<TestSuiteResult> {
  const suiteStart = Date.now();
  let client: Client | null = null;
  let transport: StdioClientTransport | null = null;

  try {
    // Spawn the forged server
    transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', `${serverPath}/src/index.ts`],
      env: { ...process.env } as Record<string, string>,
      cwd: projectDir,
    });

    client = new Client({ name: 'forge-test-runner', version: '1.0.0' });

    // Connect with startup timeout
    await withTimeout(
      client.connect(transport),
      STARTUP_TIMEOUT,
      'Server startup'
    );

    // Discover tools
    const { tools } = await withTimeout(
      client.listTools(),
      5_000,
      'Tool discovery'
    );
    const discoveredTools = tools.map(t => t.name);

    // Run test cases
    const testResults: TestResult[] = [];

    for (const tc of testCases) {
      // Check suite timeout
      if (Date.now() - suiteStart > SUITE_TIMEOUT) {
        testResults.push({
          tool: tc.tool,
          description: tc.description || `Test ${tc.tool}`,
          passed: false,
          error: 'Suite timeout exceeded',
          duration_ms: 0,
        });
        continue;
      }

      const testStart = Date.now();
      try {
        const result = await withTimeout(
          client.callTool({ name: tc.tool, arguments: tc.input }),
          TEST_TIMEOUT,
          `Test: ${tc.tool}`
        );

        const resultText = Array.isArray(result.content)
          ? result.content.map((b: any) => b.text || JSON.stringify(b)).join('\n')
          : String(result.content);

        const isError = result.isError === true;

        if (tc.expectError) {
          testResults.push({
            tool: tc.tool,
            description: tc.description || `Test ${tc.tool} (expect error)`,
            passed: isError,
            output: resultText.slice(0, 500),
            error: isError ? undefined : 'Expected error but got success',
            duration_ms: Date.now() - testStart,
          });
        } else {
          testResults.push({
            tool: tc.tool,
            description: tc.description || `Test ${tc.tool}`,
            passed: !isError,
            output: resultText.slice(0, 500),
            error: isError ? resultText.slice(0, 200) : undefined,
            duration_ms: Date.now() - testStart,
          });
        }
      } catch (err: any) {
        testResults.push({
          tool: tc.tool,
          description: tc.description || `Test ${tc.tool}`,
          passed: tc.expectError === true,
          error: err.message,
          duration_ms: Date.now() - testStart,
        });
      }
    }

    const allPassed = testResults.length > 0 && testResults.every(r => r.passed);

    return {
      discoveredTools,
      testResults,
      allPassed,
      totalDuration_ms: Date.now() - suiteStart,
    };
  } catch (err: any) {
    return {
      discoveredTools: [],
      testResults: [],
      allPassed: false,
      totalDuration_ms: Date.now() - suiteStart,
      error: err.message,
    };
  } finally {
    try {
      await client?.close();
    } catch {
      // Ignore cleanup errors
    }
  }
}
