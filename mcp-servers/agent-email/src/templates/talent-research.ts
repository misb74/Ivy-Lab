import type { TalentResearchVars, RenderedEmail } from './types.js';
import { pickOpener } from './openers.js';
import {
  escapeHtml,
  htmlToPlainText,
  wrapHtml,
  sectionDivider,
  paragraph,
  statLine,
  bulletPoint,
  signOff,
} from './html-wrapper.js';

export function renderTalentResearch(vars: TalentResearchVars): RenderedEmail {
  const opener = pickOpener(vars);

  let bodyRows = '';

  // Opener
  bodyRows += paragraph(escapeHtml(opener));

  // Executive Summary
  bodyRows += sectionDivider('Executive Summary');
  bodyRows += paragraph(
    `I scanned <strong>${escapeHtml(String(vars.candidateCount))}</strong> profiles across <strong>${escapeHtml(String(vars.sourceCount))}</strong> sources for your <strong>${escapeHtml(vars.roleName)}</strong> search.`
  );
  bodyRows += statLine(vars.qualifiedCount, 'strong matches');
  bodyRows += statLine(vars.maybeCount, 'worth a second look');
  bodyRows += statLine(vars.passCount, 'didn\u2019t meet the bar');

  if (vars.notableFinding) {
    bodyRows += paragraph(
      `One thing that stood out: ${escapeHtml(vars.notableFinding)}`
    );
  }

  // Top 3 at a Glance
  if (vars.topCandidates && vars.topCandidates.length > 0) {
    bodyRows += sectionDivider('Top 3 at a Glance');
    vars.topCandidates.slice(0, 3).forEach((c, i) => {
      bodyRows += paragraph(
        `<strong>${i + 1}. ${escapeHtml(c.name)}</strong> &mdash; ${escapeHtml(c.headline)}<br>${escapeHtml(c.whyTheyFit)}`
      );
    });
  }

  // What's Attached
  if (vars.attachments && vars.attachments.length > 0) {
    bodyRows += sectionDivider('What\u2019s Attached');
    vars.attachments.forEach((a) => {
      bodyRows += bulletPoint(escapeHtml(a));
    });
  }

  // Ivy's Take
  if (vars.ivysTake) {
    bodyRows += sectionDivider('Ivy\u2019s Take');
    bodyRows += paragraph(escapeHtml(vars.ivysTake));
  }

  // Sign-off
  bodyRows += signOff('Let me know if you want me to dig deeper on any of these.');

  const html = wrapHtml(bodyRows);
  const text = htmlToPlainText(html);
  const subject = `Talent scan complete: ${vars.batchName}`;

  return { subject, html, text };
}
