#!/usr/bin/env npx tsx

import { toolsList, toolsSearch } from '../src/commands/tools.js';
import { skillsList, skillsShow } from '../src/commands/skills.js';
import { serversList, serversHealth } from '../src/commands/servers.js';
import { bold, cyan, dim, heading } from '../src/ui/format.js';

const BANNER = `
  ${bold(cyan('ivy'))} ${dim('\u2014 Ivy introspection CLI')}
`;

const USAGE = `
${BANNER}
  ${bold('Usage:')}

    ivy tools                   List all tools grouped by server
    ivy tools --search <query>  Search tools by name/description
    ivy skills                  List all skills with triggers
    ivy skills <name>           Show full skill instructions
    ivy servers                 List all MCP servers
    ivy servers --health        Health check every server

  ${bold('Examples:')}

    ivy tools --search "skills"
    ivy skills routing
    ivy servers --health
`;

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      const key = rest[i].slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(rest[i]);
    }
  }

  return { command, flags, positional };
}

async function main() {
  const { command, flags, positional } = parseArgs(process.argv.slice(2));

  switch (command) {
    case 'tools':
      if (flags.search && typeof flags.search === 'string') {
        await toolsSearch(flags.search);
      } else {
        await toolsList();
      }
      break;

    case 'skills':
      if (positional[0]) {
        await skillsShow(positional[0]);
      } else {
        await skillsList();
      }
      break;

    case 'servers':
      if (flags.health) {
        await serversHealth();
      } else {
        await serversList();
      }
      break;

    case 'help':
    case '--help':
    case '-h':
    case undefined:
      console.log(USAGE);
      break;

    default:
      console.error(`  Unknown command: ${command}\n`);
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
