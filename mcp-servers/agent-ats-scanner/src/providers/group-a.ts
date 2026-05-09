import type { AtsJob, AtsSystem, ProviderScanResult, ScanInput } from '../types.js';
import { htmlToText, inferSourceFromUrl, slugCandidates } from '../utils.js';

const USER_AGENT = 'Ivy ATS Scanner/1.0 (+https://ivy.ai; public job intelligence)';
const FETCH_TIMEOUT_MS = 12000;

type JsonValue = Record<string, any> | any[];

async function fetchJson<T extends JsonValue>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json,text/plain,*/*',
        'user-agent': USER_AGENT,
      },
      redirect: 'follow',
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function absoluteUrl(base: string, maybeUrl?: string | null): string | null {
  if (!maybeUrl) return null;
  try {
    return new URL(maybeUrl, base).toString();
  } catch {
    return maybeUrl;
  }
}

function normalizeJob(job: AtsJob): AtsJob {
  return {
    ...job,
    external_id: String(job.external_id || job.url || job.title),
    title: String(job.title || 'Untitled role').trim(),
    description_text: job.description_text || htmlToText(job.description_html),
  };
}

async function scanGreenhouse(slug: string): Promise<ProviderScanResult | null> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  const data = await fetchJson<Record<string, any>>(url);
  const rows = Array.isArray(data?.jobs) ? data.jobs : null;
  if (!rows) return null;
  return {
    system: 'greenhouse',
    source_slug: slug,
    careers_url: `https://boards.greenhouse.io/${slug}`,
    status: 'success',
    expected_count: rows.length,
    jobs: rows.map((j: any) => normalizeJob({
      external_id: String(j.id),
      title: j.title,
      location: j.location?.name ?? null,
      department: Array.isArray(j.departments) ? j.departments.map((d: any) => d.name).filter(Boolean).join(', ') || null : null,
      url: j.absolute_url ?? null,
      apply_url: j.absolute_url ?? null,
      posted_at: j.updated_at ?? null,
      description_html: j.content ?? null,
      raw: j,
    })),
  };
}

async function scanLever(slug: string): Promise<ProviderScanResult | null> {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  const rows = await fetchJson<any[]>(url);
  if (!Array.isArray(rows)) return null;
  return {
    system: 'lever',
    source_slug: slug,
    careers_url: `https://jobs.lever.co/${slug}`,
    status: 'success',
    expected_count: rows.length,
    jobs: rows.map((j: any) => normalizeJob({
      external_id: String(j.id || j.hostedUrl || j.text),
      title: j.text,
      location: j.categories?.location ?? null,
      department: j.categories?.team ?? null,
      employment_type: j.categories?.commitment ?? null,
      url: j.hostedUrl ?? null,
      apply_url: j.applyUrl ?? j.hostedUrl ?? null,
      posted_at: typeof j.createdAt === 'number' ? new Date(j.createdAt).toISOString() : null,
      description_html: j.description ?? null,
      description_text: j.descriptionPlain ?? null,
      raw: j,
    })),
  };
}

async function scanAshby(slug: string): Promise<ProviderScanResult | null> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`;
  const data = await fetchJson<Record<string, any>>(url);
  const rows = Array.isArray(data?.jobs) ? data.jobs : null;
  if (!rows) return null;
  return {
    system: 'ashby',
    source_slug: slug,
    careers_url: `https://jobs.ashbyhq.com/${slug}`,
    status: 'success',
    expected_count: rows.length,
    jobs: rows.map((j: any) => normalizeJob({
      external_id: String(j.id || j.jobId || j.jobUrl || j.title),
      title: j.title,
      location: j.locationName ?? j.location ?? null,
      department: j.departmentName ?? j.department ?? null,
      employment_type: j.employmentType ?? null,
      url: j.jobUrl ?? `https://jobs.ashbyhq.com/${slug}/${j.id}`,
      apply_url: j.applyUrl ?? j.jobUrl ?? null,
      posted_at: j.publishedAt ?? j.updatedAt ?? null,
      description_html: j.descriptionHtml ?? j.description ?? null,
      raw: j,
    })),
  };
}

async function scanSmartRecruiters(slug: string): Promise<ProviderScanResult | null> {
  const jobs: AtsJob[] = [];
  let expected: number | null = null;
  let offset = 0;
  const limit = 100;

  while (offset < 1000) {
    const url = `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=${limit}&offset=${offset}`;
    const data = await fetchJson<Record<string, any>>(url);
    const rows = Array.isArray(data?.content) ? data.content : null;
    if (!rows) return offset === 0 ? null : {
      system: 'smartrecruiters',
      source_slug: slug,
      careers_url: `https://jobs.smartrecruiters.com/${slug}`,
      status: 'partial',
      expected_count: expected,
      partial_reason: 'Pagination stopped after an unreadable page.',
      jobs,
    };

    const page = data as Record<string, any>;
    expected = typeof page.totalFound === 'number' ? page.totalFound : expected;
    for (const j of rows) {
      jobs.push(normalizeJob({
        external_id: String(j.id || j.uuid || j.ref || j.name),
        title: j.name || j.title,
        location: j.location?.city || j.location?.fullLocation || j.location?.region || null,
        department: j.department?.label || j.department || null,
        employment_type: j.typeOfEmployment?.label || null,
        url: j.ref || absoluteUrl(`https://jobs.smartrecruiters.com/${slug}/`, j.url),
        apply_url: j.ref || null,
        posted_at: j.releasedDate || j.createdOn || null,
        raw: j,
      }));
    }

    if (rows.length < limit || (expected != null && jobs.length >= expected)) break;
    offset += limit;
  }

  return {
    system: 'smartrecruiters',
    source_slug: slug,
    careers_url: `https://jobs.smartrecruiters.com/${slug}`,
    status: expected != null && jobs.length < expected ? 'partial' : 'success',
    expected_count: expected ?? jobs.length,
    partial_reason: expected != null && jobs.length < expected ? `Expected ${expected}, received ${jobs.length}.` : null,
    jobs,
  };
}

async function scanWorkable(slug: string): Promise<ProviderScanResult | null> {
  const candidates = [
    `https://apply.workable.com/api/v3/accounts/${slug}/jobs`,
    `https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`,
  ];

  for (const url of candidates) {
    const data = await fetchJson<Record<string, any>>(url);
    const rows =
      (Array.isArray(data?.results) && data.results) ||
      (Array.isArray(data?.jobs) && data.jobs) ||
      (Array.isArray(data?.positions) && data.positions) ||
      null;
    if (!rows) continue;

    return {
      system: 'workable',
      source_slug: slug,
      careers_url: `https://apply.workable.com/${slug}/`,
      status: 'success',
      expected_count: rows.length,
      jobs: rows.map((j: any) => normalizeJob({
        external_id: String(j.shortcode || j.id || j.url || j.title),
        title: j.title || j.full_title,
        location: j.location?.location_str || j.location?.city || j.city || j.location || null,
        department: j.department || j.department_name || null,
        employment_type: j.type || j.employment_type || null,
        url: j.url || j.shortlink || `https://apply.workable.com/${slug}/j/${j.shortcode}/`,
        apply_url: j.application_url || j.url || null,
        posted_at: j.published_on || j.created_at || null,
        description_html: j.description || j.full_description || null,
        raw: j,
      })),
    };
  }

  return null;
}

async function scanBreezy(slug: string): Promise<ProviderScanResult | null> {
  const url = `https://api.breezy.hr/v3/company/${slug}/positions`;
  const data = await fetchJson<any[] | Record<string, any>>(url);
  const rows = Array.isArray(data) ? data : Array.isArray(data?.positions) ? data.positions : null;
  if (!rows) return null;
  return {
    system: 'breezy',
    source_slug: slug,
    careers_url: `https://${slug}.breezy.hr/`,
    status: 'success',
    expected_count: rows.length,
    jobs: rows.map((j: any) => normalizeJob({
      external_id: String(j._id || j.id || j.friendly_id || j.name),
      title: j.name || j.title,
      location: j.location?.name || j.location || null,
      department: j.department || j.category?.name || null,
      employment_type: j.type || j.employment_type || null,
      url: j.url || `https://${slug}.breezy.hr/p/${j.friendly_id || j._id}`,
      apply_url: j.url || null,
      posted_at: j.creation_date || j.created_at || null,
      description_html: j.description || null,
      raw: j,
    })),
  };
}

async function scanRecruitee(slug: string): Promise<ProviderScanResult | null> {
  const candidates = [
    `https://${slug}.recruitee.com/api/offers/`,
    `https://${slug}.recruitee.com/api/offers`,
    `https://api.recruitee.com/c/${slug}/offers`,
  ];

  for (const url of candidates) {
    const data = await fetchJson<Record<string, any> | any[]>(url);
    const rows =
      (Array.isArray(data) && data) ||
      (Array.isArray((data as any)?.offers) && (data as any).offers) ||
      (Array.isArray((data as any)?.jobs) && (data as any).jobs) ||
      null;
    if (!rows) continue;

    return {
      system: 'recruitee',
      source_slug: slug,
      careers_url: `https://${slug}.recruitee.com/`,
      status: 'success',
      expected_count: rows.length,
      jobs: rows.map((j: any) => normalizeJob({
        external_id: String(j.id || j.slug || j.careers_url || j.title),
        title: j.title,
        location: j.location || j.city || null,
        department: j.department || null,
        employment_type: j.employment_type || j.kind || null,
        url: j.careers_url || j.url || `https://${slug}.recruitee.com/o/${j.slug || j.id}`,
        apply_url: j.careers_url || j.url || null,
        posted_at: j.published_at || j.created_at || null,
        description_html: j.description || j.requirements || null,
        raw: j,
      })),
    };
  }

  return null;
}

const SCANNERS: Record<Exclude<AtsSystem, 'unknown'>, (slug: string) => Promise<ProviderScanResult | null>> = {
  greenhouse: scanGreenhouse,
  lever: scanLever,
  ashby: scanAshby,
  smartrecruiters: scanSmartRecruiters,
  workable: scanWorkable,
  breezy: scanBreezy,
  recruitee: scanRecruitee,
};

export async function scanGroupA(input: ScanInput): Promise<ProviderScanResult> {
  const urlHint = inferSourceFromUrl(input.careers_url);
  const requestedSystem = input.ats_system || urlHint.system;
  const requestedSlug = input.company_slug || urlHint.slug;
  const slugs = slugCandidates(input.company_name, requestedSlug);

  const systems = requestedSystem && requestedSystem !== 'unknown'
    ? [requestedSystem]
    : Object.keys(SCANNERS) as Array<Exclude<AtsSystem, 'unknown'>>;

  for (const system of systems) {
    const scanner = SCANNERS[system as Exclude<AtsSystem, 'unknown'>];
    if (!scanner) continue;

    for (const slug of slugs) {
      const result = await scanner(slug);
      if (result && result.jobs.length > 0) return result;
    }
  }

  return {
    system: requestedSystem || 'unknown',
    source_slug: requestedSlug || slugs[0] || input.company_name,
    careers_url: input.careers_url || null,
    status: 'unsupported',
    jobs: [],
    expected_count: 0,
    partial_reason: requestedSystem
      ? `No readable ${requestedSystem} public feed found for ${input.company_name}.`
      : `No Group A public feed found for ${input.company_name}.`,
  };
}
