import type { SwpAnalysisVars, RenderedEmail } from './types.js';
import { pickOpener } from './openers.js';
import {
  escapeHtml,
  htmlToPlainText,
  wrapHtml,
  sectionDivider,
  paragraph,
  bulletPoint,
  signOff,
} from './html-wrapper.js';

export function renderSwpAnalysis(vars: SwpAnalysisVars): RenderedEmail {
  const opener = pickOpener(vars);

  let bodyRows = '';

  // Opener
  bodyRows += paragraph(escapeHtml(opener));

  // Executive Summary
  bodyRows += sectionDivider('Executive Summary');
  bodyRows += paragraph(escapeHtml(vars.summaryNarrative));

  // Key Numbers
  bodyRows += sectionDivider('Key Numbers');
  vars.keyMetrics.forEach((m) => {
    const direction = m.direction ? ` ${escapeHtml(m.direction)}` : '';
    bodyRows += bulletPoint(
      `<strong>${escapeHtml(m.label)}</strong>: ${escapeHtml(m.value)}${direction}`
    );
  });

  // Risks I'd Flag
  if (vars.risks && vars.risks.length > 0) {
    bodyRows += sectionDivider('Risks I\u2019d Flag');
    vars.risks.forEach((r) => {
      bodyRows += bulletPoint(
        `${escapeHtml(r.description)} &mdash; <strong>${escapeHtml(r.severity)}</strong>`
      );
    });
  }

  // Opportunities
  if (vars.opportunities && vars.opportunities.length > 0) {
    bodyRows += sectionDivider('Opportunities');
    vars.opportunities.forEach((o) => {
      bodyRows += bulletPoint(escapeHtml(o.description));
    });
  }

  // Ivy's Take
  bodyRows += sectionDivider('Ivy\u2019s Take');
  bodyRows += paragraph(escapeHtml(vars.recommendation));

  // Sign-off
  const closingLine = vars.suggestedPage
    ? `Full analysis attached. You\u2019ll probably want to start on page ${vars.suggestedPage}.`
    : 'Full analysis attached.';
  bodyRows += signOff(closingLine);

  const html = wrapHtml(bodyRows);
  const text = htmlToPlainText(html);
  const subject = `Workforce analysis ready: ${vars.analysisName}`;

  return { subject, html, text };
}
