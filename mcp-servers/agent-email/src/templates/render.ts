import type { JobType, RenderedEmail, TemplateVars, TalentResearchVars, CompetitorIntelVars, SwpAnalysisVars, WeeklyDigestVars, InsightReportVars } from './types.js';
import { renderTalentResearch } from './talent-research.js';
import { renderCompetitorIntel } from './competitor-intel.js';
import { renderSwpAnalysis } from './swp-analysis.js';
import { renderWeeklyDigest } from './weekly-digest.js';
import { renderInsightReport } from './insight-report.js';

/**
 * Route a jobType to the correct renderer.
 * Throws if the jobType is unknown.
 */
export function renderEmail(jobType: JobType, variables: Record<string, any>): RenderedEmail {
  const vars = variables as TemplateVars;

  switch (jobType) {
    case 'talent-research':
      return renderTalentResearch(vars as TalentResearchVars);
    case 'competitor-intel':
      return renderCompetitorIntel(vars as CompetitorIntelVars);
    case 'swp-analysis':
      return renderSwpAnalysis(vars as SwpAnalysisVars);
    case 'weekly-digest':
      return renderWeeklyDigest(vars as WeeklyDigestVars);
    case 'insight-report':
      return renderInsightReport(vars as InsightReportVars);
    default:
      throw new Error(`Unknown email template: ${jobType}`);
  }
}
