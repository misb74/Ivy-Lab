import type { WeeklyDigestVars, RenderedEmail } from './types.js';
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

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const TEXT_COLOR = '#1a1a1a';
const MUTED_COLOR = '#6b7280';

function metricsTable(vars: WeeklyDigestVars): string {
  const rows = [
    ['Headcount', vars.headcount, vars.headcountDelta],
    ['Open roles', vars.openRoles, vars.openRolesDelta],
    ['Time-to-fill', `${vars.avgTTF} days`, vars.ttfDelta],
    ['Attrition', vars.attritionRate, vars.attritionDelta],
  ];

  const tableRows = rows
    .map(
      ([label, value, delta]) => `
        <tr>
          <td style="font-family: ${FONT_STACK}; font-size: 15px; color: ${MUTED_COLOR}; padding: 4px 16px 4px 16px; white-space: nowrap;">${escapeHtml(label)}</td>
          <td style="font-family: ${FONT_STACK}; font-size: 15px; color: ${TEXT_COLOR}; padding: 4px 12px; font-weight: 600;">${escapeHtml(value)}</td>
          <td style="font-family: ${FONT_STACK}; font-size: 14px; color: ${MUTED_COLOR}; padding: 4px 0;">(${escapeHtml(delta)})</td>
        </tr>`
    )
    .join('');

  return `
    <tr>
      <td style="padding: 8px 0;">
        <table cellpadding="0" cellspacing="0" border="0">
          ${tableRows}
        </table>
      </td>
    </tr>`;
}

export function renderWeeklyDigest(vars: WeeklyDigestVars): RenderedEmail {
  const opener = pickOpener(vars);

  let bodyRows = '';

  // Opener
  bodyRows += paragraph(escapeHtml(opener));

  // This Week in 30 Seconds
  bodyRows += sectionDivider('This Week in 30 Seconds');
  bodyRows += paragraph(escapeHtml(vars.weekSummary));

  // By the Numbers
  bodyRows += sectionDivider('By the Numbers');
  bodyRows += metricsTable(vars);

  // Might Need Your Attention
  if (vars.actionItems && vars.actionItems.length > 0) {
    bodyRows += sectionDivider('Might Need Your Attention');
    vars.actionItems.forEach((item) => {
      bodyRows += bulletPoint(escapeHtml(item));
    });
  }

  // Quiet week
  if (vars.quietWeek) {
    bodyRows += paragraph('Quiet week overall. Nothing that needs your attention right now.');
  }

  // Sign-off
  bodyRows += signOff();

  const html = wrapHtml(bodyRows);
  const text = htmlToPlainText(html);
  const subject = `Your weekly workforce briefing \u2014 ${vars.weekOf}`;

  return { subject, html, text };
}
