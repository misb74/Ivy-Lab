import type { AtsJob, ScanInput } from './types.js';
import { scanGroupA } from './providers/group-a.js';
import { getCompanyJobs, persistAdvert, persistScan } from './repository.js';
import { compactText, htmlToText, matchesTerms, termsFromQuery } from './utils.js';

const USER_AGENT = 'Ivy ATS Scanner/1.0 (+https://ivy.ai; public job intelligence)';

export async function scanCompanyJobs(input: ScanInput): Promise<Record<string, unknown>> {
  const startedAt = new Date().toISOString();
  const providerResult = await scanGroupA(input);
  const searchTerms = input.search_terms?.filter(Boolean) || [];
  const returnedJobs = searchTerms.length > 0
    ? providerResult.jobs.filter((job) => matchesTerms(job, searchTerms))
    : providerResult.jobs;

  const persisted = await persistScan(
    { ...input, include_descriptions: input.include_descriptions ?? false },
    providerResult,
    startedAt,
  );

  return {
    company_name: input.company_name,
    system: providerResult.system,
    source_slug: providerResult.source_slug,
    careers_url: providerResult.careers_url,
    status: persisted.status,
    expected_count: providerResult.expected_count ?? providerResult.jobs.length,
    jobs_found: providerResult.jobs.length,
    jobs_returned: returnedJobs.length,
    persistence: persisted,
    jobs: returnedJobs.slice(0, 100).map(publicJob),
    message: providerResult.partial_reason || null,
  };
}

export async function fetchJobAds(params: {
  company_name: string;
  query?: string;
  job_ids?: string[];
  limit?: number;
  force_refresh?: boolean;
  _ctx?: ScanInput['_ctx'];
}): Promise<Record<string, unknown>> {
  const { jobs } = await getCompanyJobs({
    company_name: params.company_name,
    active_only: true,
    limit: Math.max(params.limit || 25, params.job_ids?.length || 0, 1),
    _ctx: params._ctx,
  });
  const queryTerms = termsFromQuery(params.query);
  const selected = jobs
    .filter((job) => !params.job_ids || params.job_ids.includes(job.id))
    .filter((job) => matchesTerms(job, queryTerms))
    .slice(0, params.limit || 25);

  const fetched = [];
  for (const job of selected) {
    let descriptionText = job.description_text || null;
    let descriptionHtml = job.description_html || null;
    let source = 'persisted_listing';

    if ((!descriptionText && !descriptionHtml) || params.force_refresh) {
      const remote = await fetchAdvertFromUrl(job.url || job.apply_url);
      if (remote.description_text || remote.description_html) {
        descriptionText = remote.description_text;
        descriptionHtml = remote.description_html;
        source = 'job_url';
      }
    }

    const advert = await persistAdvert({
      job_id: job.id,
      source_url: job.url || job.apply_url,
      description_text: descriptionText,
      description_html: descriptionHtml,
      raw_json: { source },
      ctx: params._ctx,
    });

    fetched.push({
      job_id: job.id,
      title: job.title,
      url: job.url,
      source,
      advert_id: advert?.id || null,
      has_description: Boolean(descriptionText || descriptionHtml),
      description_preview: compactText(descriptionText || htmlToText(descriptionHtml), 700),
    });
  }

  return {
    company_name: params.company_name,
    requested: selected.length,
    fetched: fetched.length,
    with_descriptions: fetched.filter((j) => j.has_description).length,
    jobs: fetched,
  };
}

async function fetchAdvertFromUrl(url?: string | null): Promise<{ description_text: string | null; description_html: string | null }> {
  if (!url) return { description_text: null, description_html: null };
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,text/plain,*/*' },
      redirect: 'follow',
    });
    if (!response.ok) return { description_text: null, description_html: null };
    const html = await response.text();
    return { description_html: html, description_text: htmlToText(html) };
  } catch {
    return { description_text: null, description_html: null };
  }
}

function publicJob(job: AtsJob): Record<string, unknown> {
  return {
    external_id: job.external_id,
    title: job.title,
    location: job.location || null,
    department: job.department || null,
    employment_type: job.employment_type || null,
    url: job.url || null,
    posted_at: job.posted_at || null,
    has_description: Boolean(job.description_text || job.description_html),
  };
}
