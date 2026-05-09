export type JobType = 'talent-research' | 'competitor-intel' | 'swp-analysis' | 'weekly-digest' | 'insight-report';

export type TimeBucket = 'holiday' | 'weekend' | 'overnight' | 'deep-work' | 'quick' | 'standard';

export interface BaseTemplateVars {
  recipientName: string;
  jobType: JobType;
  submittedAt: string;   // ISO 8601
  completedAt: string;   // ISO 8601
  durationMinutes: number;
  ivysTake?: string;
}

// --- Talent Research ---

export interface TalentCandidate {
  name: string;
  headline: string;
  whyTheyFit: string;
}

export interface TalentResearchVars extends BaseTemplateVars {
  jobType: 'talent-research';
  batchName: string;
  roleName: string;
  candidateCount: number;
  sourceCount: number;
  qualifiedCount: number;
  maybeCount: number;
  passCount: number;
  topCandidates: TalentCandidate[];  // up to 3
  notableFinding?: string;
  attachments?: string[];
}

// --- Competitor Intelligence ---

export interface CompetitorAlert {
  headline: string;
  detail: string;
}

export interface CompetitorEntry {
  name: string;
  netPostings: number;
  topFunction: string;
  insight: string;
}

export interface CompetitorIntelVars extends BaseTemplateVars {
  jobType: 'competitor-intel';
  period: string;
  competitorCount: number;
  newPostings: number;
  removedPostings: number;
  netChange: number;
  netDirection: string;
  alertItems?: CompetitorAlert[];
  competitors: CompetitorEntry[];
  interpretation: string;
}

// --- SWP / Workforce Analysis ---

export interface KeyMetric {
  label: string;
  value: string;
  direction?: string;  // e.g. "up 3%", "down 12"
}

export interface RiskItem {
  description: string;
  severity: string;
}

export interface OpportunityItem {
  description: string;
}

export interface SwpAnalysisVars extends BaseTemplateVars {
  jobType: 'swp-analysis';
  analysisName: string;
  summaryNarrative: string;
  keyMetrics: KeyMetric[];
  risks?: RiskItem[];
  opportunities?: OpportunityItem[];
  recommendation: string;
  suggestedPage?: number;
}

// --- Weekly Digest ---

export interface WeeklyDigestVars extends BaseTemplateVars {
  jobType: 'weekly-digest';
  weekOf: string;
  weekSummary: string;
  headcount: string;
  headcountDelta: string;
  openRoles: string;
  openRolesDelta: string;
  avgTTF: string;
  ttfDelta: string;
  attritionRate: string;
  attritionDelta: string;
  actionItems?: string[];
  quietWeek?: boolean;
}

// --- Insight Report ---

export interface MetricsDelta {
  value: string;
  direction: 'up' | 'down';
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface MetricItem {
  label: string;
  value: string | number;
  color?: string;
  delta?: MetricsDelta;
  variant?: string;
}

export interface InsightMetricsSection {
  kind: 'metrics';
  items: MetricItem[];
}

export interface InsightCalloutSection {
  kind: 'callout';
  title: string;
  description: string;
  variant?: string;
  icon?: string;
}

export interface InsightTableSection {
  kind: 'table';
  title?: string;
  headers: string[];
  rows: string[][];
  highlightColumn?: number;
  explainer?: Record<string, string>;
}

export interface InsightChartSection {
  kind: 'chart';
  chartType: string;
  title?: string;
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: string[];
}

export interface InsightListItem {
  text: string;
  priority?: string;
  checked?: boolean;
}

export interface InsightListSection {
  kind: 'list';
  style?: string;
  items: InsightListItem[];
}

export interface InsightRecommendation {
  title: string;
  description: string;
  priority: string;
}

export interface InsightRecommendationsSection {
  kind: 'recommendations';
  title?: string;
  items: InsightRecommendation[];
}

export interface InsightProseSection {
  kind: 'prose';
  heading?: string;
  body: string;
}

export interface InsightTimelineNode {
  label: string;
  status: string;
}

export interface InsightTimelineSection {
  kind: 'timeline';
  nodes: InsightTimelineNode[];
}

export interface InsightComparisonColumn {
  heading: string;
  items: string[];
  recommended?: boolean;
}

export interface InsightComparisonSection {
  kind: 'comparison';
  columns: InsightComparisonColumn[];
}

export interface InsightSimulationSection {
  kind: 'simulation';
  title?: string;
  subtitle?: string;
}

export type InsightSection =
  | InsightMetricsSection
  | InsightCalloutSection
  | InsightTableSection
  | InsightChartSection
  | InsightListSection
  | InsightRecommendationsSection
  | InsightProseSection
  | InsightTimelineSection
  | InsightComparisonSection
  | InsightSimulationSection;

export interface InsightArtifact {
  type: 'insight';
  title: string;
  pillLabel: string;
  subtitle: string;
  dataSources: string;
  sections: InsightSection[];
}

export interface InsightReportVars extends BaseTemplateVars {
  jobType: 'insight-report';
  artifact: InsightArtifact;
}

// --- Union type for all template vars ---

export type TemplateVars =
  | TalentResearchVars
  | CompetitorIntelVars
  | SwpAnalysisVars
  | WeeklyDigestVars
  | InsightReportVars;

// --- Rendered output ---

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
