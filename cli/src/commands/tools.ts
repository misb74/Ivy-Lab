import { parseTools, searchTools } from '../parsers/tool-reference.js';
import { renderTable } from '../ui/table.js';
import { heading, serverName, dim, bold, green } from '../ui/format.js';

export async function toolsList() {
  const tools = await parseTools();

  // Group by server
  const grouped = new Map<string, typeof tools>();
  for (const t of tools) {
    const key = t.server || t.serverLabel;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  }

  for (const [server, serverTools] of grouped) {
    const label = serverTools[0].serverLabel;
    console.log(`\n  ${serverName(server)} ${dim(`\u2014 ${label} (${serverTools.length} tools)`)}`);
    const table = renderTable(
      ['Tool', 'Description', 'Parameters'],
      serverTools.map(t => [green(t.name), t.description, dim(t.params)]),
      { maxColWidth: 50 }
    );
    console.log(table);
  }

  const serverCount = grouped.size;
  console.log(`\n  ${bold(`${tools.length} tools`)} across ${bold(`${serverCount} servers`)}\n`);
}

export async function toolsSearch(query: string) {
  const tools = await parseTools();
  const matches = searchTools(tools, query);

  if (matches.length === 0) {
    console.log(`\n  No tools matching "${query}"\n`);
    return;
  }

  console.log(`\n  ${heading(`Search: "${query}"`)}\n`);
  const table = renderTable(
    ['Server', 'Tool', 'Description'],
    matches.map(t => [dim(t.server), green(t.name), t.description]),
    { maxColWidth: 50 }
  );
  console.log(table);
  console.log(`\n  ${bold(`${matches.length}`)} matches\n`);
}
