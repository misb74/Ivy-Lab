import { parseSkills, loadSkillBody } from '../parsers/skill-registry.js';
import { renderTable } from '../ui/table.js';
import { heading, dim, bold, green, yellow, cyan, gray, badge } from '../ui/format.js';

export async function skillsList() {
  const skills = await parseSkills();
  const tier1 = skills.filter(s => s.tier === 'tier1');
  const tier2 = skills.filter(s => s.tier === 'tier2');

  console.log(`\n  ${heading('Always Loaded (Tier 1)')}\n`);
  const t1Table = renderTable(
    ['Skill', 'Description'],
    tier1.map(s => [green(s.name), s.frontmatter.description || dim('(no description)')]),
    { maxColWidth: 70 }
  );
  console.log(t1Table);

  console.log(`\n  ${heading('Conditional (Tier 2)')}\n`);
  for (const s of tier2) {
    const triggerPreview = s.triggers.slice(0, 5).join(', ');
    const more = s.triggers.length > 5 ? ` +${s.triggers.length - 5} more` : '';
    console.log(`  ${green(s.name)}`);
    console.log(`    ${s.frontmatter.description || dim('(no description)')}`);
    console.log(`    ${dim(`Triggers: ${triggerPreview}${more}`)}`);
    console.log();
  }

  console.log(`  ${bold(`${skills.length} skills`)} (${tier1.length} always loaded, ${tier2.length} conditional)\n`);
}

export async function skillsShow(name: string) {
  const skills = await parseSkills();
  const skill = skills.find(s => s.name.toLowerCase() === name.toLowerCase());

  if (!skill) {
    console.log(`\n  Skill "${name}" not found. Available skills:\n`);
    for (const s of skills) {
      console.log(`    ${green(s.name)} ${dim(`(${s.tier})`)}`);
    }
    console.log();
    return;
  }

  const body = await loadSkillBody(skill);

  console.log(`\n  ${heading(skill.frontmatter.name || skill.name)}`);
  console.log(`  ${dim(skill.frontmatter.description)}`);
  console.log(`  ${dim(`Tier: ${skill.tier}`)}`);
  if (skill.triggers.length > 0) {
    console.log(`  ${dim('Triggers:')} ${skill.triggers.join(', ')}`);
  }
  console.log(`  ${dim('Path:')} ${skill.path}`);
  console.log(`\n${dim('\u2500'.repeat(72))}\n`);
  console.log(body);
}
