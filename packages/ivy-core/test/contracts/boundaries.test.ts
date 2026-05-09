import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = new URL("../..", import.meta.url).pathname;
const sourceRoots = ["src", "test"];
const forbiddenWorkspaceImports = /\b(?:from\s+|import\s*\()\s*["'][^"']*(?:gateway|frontend|bot|mcp-servers)\b/;
const sectionBContractNames = [
  "Session",
  "Message",
  "Claim",
  "Handoff",
  "Mutation",
  "UserPreferences",
  "ArtifactCell",
];

function filesUnder(root: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...filesUnder(path));
    } else if (path.endsWith(".ts")) {
      files.push(path);
    }
  }

  return files;
}

describe("ivy-core package boundaries", () => {
  it("does not import from gateway, frontend, bot, or mcp-servers", () => {
    const offenders = sourceRoots.flatMap((root) =>
      filesUnder(join(packageRoot, root)).filter((file) =>
        forbiddenWorkspaceImports.test(readFileSync(file, "utf8")),
      ),
    );

    expect(offenders.map((file) => relative(packageRoot, file))).toEqual([]);
  });

  it("does not export Section B contract names from the contracts barrel", () => {
    const barrel = readFileSync(join(packageRoot, "src/contracts/index.ts"), "utf8");
    const exportedNames = sectionBContractNames.filter((name) =>
      new RegExp(`\\b${name}\\b`).test(barrel),
    );

    expect(exportedNames).toEqual([]);
  });

  it("does not carry the Section B ArtifactCell schema in Section A schemas", () => {
    const schemas = readFileSync(join(packageRoot, "src/contracts/schemas.ts"), "utf8");

    expect(schemas).not.toMatch(/\bArtifactCell\b/);
  });
});
