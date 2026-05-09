import type { CompetitorIntelVars, RenderedEmail } from './types.js';
import { pickOpener } from './openers.js';
import {
  escapeHtml,
  htmlToPlainText,
  wrapHtml,
  sectionDivider,
  paragraph,
  statLine,
  signOff,
} from './html-wrapper.js';

export function renderCompetitorIntel(vars: CompetitorIntelVars): RenderedEmail {
  const opener = pickOpener(vars);

  let bodyRows = '';

  // Opener
  bodyRows += paragraph(escapeHtml(opener));

  // Executive Summary
  bodyRows += sectionDivider('Executive Summary');
  bodyRows += paragraph(
    `I monitored <strong>${escapeHtml(String(vars.competitorCount))}</strong> competitors over the past <strong>${escapeHtml(vars.period)}</strong>.`
  );
  bodyRows += statLine(vars.newPostings, 'new job postings');
  bodyRows += statLine(vars.removedPostings, 'roles taken down');
  bodyRows += statLine(
    `${vars.netChange >= 0 ? '+' : ''}${vars.netChange}`,
    `net change (${escapeHtml(vars.netDirection)} from last ${escapeHtml(vars.period)})`
  );

  // Flagging This
  if (vars.alertItems && vars.alertItems.length > 0) {
    bodyRows += sectionDivider('Flagging This');
    vars.alertItems.forEach((alert) => {
      bodyRows += paragraph(
        `<strong>${escapeHtml(alert.headline)}</strong><br>${escapeHtml(alert.detail)}`
      );
    });
  }

  // Hiring Trends
  bodyRows += sectionDivider('Hiring Trends');
  vars.competitors.forEach((comp) => {
    bodyRows += paragraph(
      `<strong>${escapeHtml(comp.name)}</strong>: ${escapeHtml(String(comp.netPostings))} net new roles<br>Hottest area: ${escapeHtml(comp.topFunction)}<br>Notable: ${escapeHtml(comp.insight)}`
    );
  });

  // What This Might Mean
  bodyRows += sectionDivider('What This Might Mean');
  bodyRows += paragraph(escapeHtml(vars.interpretation));

  // Sign-off
  bodyRows += signOff('Full report attached.');

  const html = wrapHtml(bodyRows);
  const text = htmlToPlainText(html);
  const subject = `Competitor hiring update: ${vars.period}`;

  return { subject, html, text };
}
