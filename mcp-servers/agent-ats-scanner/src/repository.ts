import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AtsContext,
  AtsJob,
  CompanyJobQuery,
  JobRecord,
  PersistedScanSummary,
  ProviderScanResult,
  ScanInput,
  ScanStatus,
} from './types.js';
import { getSupabase } from './supabase.js';
import { inferSeniority, jobKey, matchesTerms, normalizeCompanyName, sha256 } from './utils.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function tenantId(ctx?: AtsContext): string | null {
  return ctx?.tenant_id && UUID_RE.test(ctx.tenant_id) ? ctx.tenant_id : null;
}

function tenantFilter<T>(query: T, tenant: string | null): T {
  const q = query as any;
  return tenant ? q.eq('tenant_id', tenant) : q.is('tenant_id', null);
}

function asIso(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function upsertCompany(sb: SupabaseClient, name: string, ctx?: AtsContext): Promise<any> {
  const normalized = normalizeCompanyName(name);
  const tenant = tenantId(ctx);
  let query = sb.from('ats_companies').select('*').eq('normalized_name', normalized).limit(1);
  query = tenantFilter(query, tenant);
  const existing = await query.maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const inserted = await sb.from('ats_companies').insert({
    id: randomUUID(),
    tenant_id: tenant,
    name,
    normalized_name: normalized,
  }).select('*').single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function upsertSource(
  sb: SupabaseClient,
  company: any,
  scan: ProviderScanResult,
  input: ScanInput,
): Promise<any> {
  const tenant = tenantId(input._ctx);
  const sourceSlug = scan.source_slug || input.company_slug || normalizeCompanyName(input.company_name).replace(/\s+/g, '');
  const system = scan.system || input.ats_system || 'unknown';
  const existing = await sb
    .from('ats_sources')
    .select('*')
    .eq('company_id', company.id)
    .eq('system', system)
    .eq('source_slug', sourceSlug)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    const updated = await sb
      .from('ats_sources')
      .update({
        tenant_id: tenant,
        careers_url: scan.careers_url || input.careers_url || existing.data.careers_url,
        active: true,
        config: {
          ...(existing.data.config || {}),
          requested_company_slug: input.company_slug || null,
          requested_careers_url: input.careers_url || null,
        },
      })
      .eq('id', existing.data.id)
      .select('*')
      .single();
    if (updated.error) throw updated.error;
    return updated.data;
  }

  const inserted = await sb.from('ats_sources').insert({
    id: randomUUID(),
    company_id: company.id,
    tenant_id: tenant,
    system,
    source_slug: sourceSlug,
    careers_url: scan.careers_url || input.careers_url || null,
    config: {
      requested_company_slug: input.company_slug || null,
      requested_careers_url: input.careers_url || null,
    },
  }).select('*').single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function createScanRun(
  sb: SupabaseClient,
  company: any,
  source: any,
  scan: ProviderScanResult,
  input: ScanInput,
  startedAt: string,
): Promise<any> {
  const inserted = await sb.from('ats_scan_runs').insert({
    id: randomUUID(),
    company_id: company.id,
    source_id: source.id,
    tenant_id: tenantId(input._ctx),
    requested_by_user_id: input._ctx?.user_id || null,
    system: scan.system,
    source_slug: scan.source_slug,
    status: scan.status,
    started_at: startedAt,
    expected_count: scan.expected_count ?? null,
    jobs_found: scan.jobs.length,
    descriptions_found: scan.jobs.filter((j) => j.description_html || j.description_text).length,
    message: scan.partial_reason || null,
    metadata: {
      include_descriptions: Boolean(input.include_descriptions),
      search_terms: input.search_terms || [],
    },
  }).select('*').single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function insertDelta(
  sb: SupabaseClient,
  companyId: string,
  sourceId: string,
  scanRunId: string,
  jobId: string | null,
  changeType: 'new' | 'closed' | 'changed',
  previousHash: string | null,
  currentHash: string | null,
  ctx?: AtsContext,
): Promise<void> {
  const { error } = await sb.from('ats_job_deltas').insert({
    id: randomUUID(),
    company_id: companyId,
    source_id: sourceId,
    scan_run_id: scanRunId,
    job_id: jobId,
    tenant_id: tenantId(ctx),
    change_type: changeType,
    previous_hash: previousHash,
    current_hash: currentHash,
  });
  if (error) throw error;
}

export async function persistAdvert(params: {
  job_id: string;
  source_url?: string | null;
  description_text?: string | null;
  description_html?: string | null;
  raw_json?: Record<string, unknown>;
  ctx?: AtsContext;
}): Promise<any | null> {
  const text = params.description_text || null;
  const html = params.description_html || null;
  if (!text && !html) return null;

  const sb = getSupabase();
  const contentHash = sha256([text || '', html || ''].join('\n'));
  const existing = await sb
    .from('ats_job_adverts')
    .select('*')
    .eq('job_id', params.job_id)
    .eq('content_hash', contentHash)
    .maybeSingle();
  if (existing.error) throw existing.error;

  const advert = existing.data || (await sb.from('ats_job_adverts').insert({
    id: randomUUID(),
    job_id: params.job_id,
    tenant_id: tenantId(params.ctx),
    source_url: params.source_url || null,
    content_hash: contentHash,
    description_text: text,
    description_html: html,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    raw_json: params.raw_json || {},
  }).select('*').single()).data;

  if (!advert) return null;

  const { error } = await sb
    .from('ats_job_postings')
    .update({
      latest_advert_id: advert.id,
      description_text: text,
      description_html: html,
    })
    .eq('id', params.job_id);
  if (error) throw error;

  return advert;
}

export async function persistScan(
  input: ScanInput,
  scan: ProviderScanResult,
  startedAt = new Date().toISOString(),
): Promise<PersistedScanSummary> {
  const sb = getSupabase();
  const company = await upsertCompany(sb, input.company_name, input._ctx);
  const source = await upsertSource(sb, company, scan, input);
  const scanRun = await createScanRun(sb, company, source, scan, input, startedAt);

  const existingRes = await sb
    .from('ats_job_postings')
    .select('*')
    .eq('source_id', source.id);
  if (existingRes.error) throw existingRes.error;

  const existing = existingRes.data || [];
  const existingByKey = new Map(existing.map((row: any) => [row.job_key, row]));
  const activeKeys = new Set(existing.filter((row: any) => row.active).map((row: any) => row.job_key));
  const seenKeys = new Set<string>();

  let added = 0;
  let changed = 0;
  let persisted = 0;

  for (const job of scan.jobs) {
    const key = jobKey(scan.system, scan.source_slug, job);
    seenKeys.add(key);
    const rawHash = sha256(job.raw || job);
    const previous = existingByKey.get(key) as any | undefined;
    const seniority = job.seniority || inferSeniority(job.title);
    const payload = {
      company_id: company.id,
      source_id: source.id,
      tenant_id: tenantId(input._ctx),
      job_key: key,
      external_job_id: job.external_id || null,
      title: job.title,
      location: job.location || null,
      department: job.department || null,
      employment_type: job.employment_type || null,
      seniority,
      url: job.url || null,
      apply_url: job.apply_url || null,
      posted_at: asIso(job.posted_at),
      last_seen_at: startedAt,
      closed_at: null,
      active: true,
      description_text: job.description_text || null,
      description_html: job.description_html || null,
      raw_hash: rawHash,
      raw_json: job.raw || {},
      latest_scan_run_id: scanRun.id,
    };

    let jobId: string;
    if (previous) {
      const { error } = await sb.from('ats_job_postings').update(payload).eq('id', previous.id);
      if (error) throw error;
      jobId = previous.id;
      if (previous.raw_hash && previous.raw_hash !== rawHash) {
        changed++;
        await insertDelta(sb, company.id, source.id, scanRun.id, jobId, 'changed', previous.raw_hash, rawHash, input._ctx);
      }
    } else {
      const inserted = await sb.from('ats_job_postings').insert({
        id: randomUUID(),
        first_seen_at: startedAt,
        ...payload,
      }).select('id').single();
      if (inserted.error) throw inserted.error;
      jobId = inserted.data.id;
      added++;
      await insertDelta(sb, company.id, source.id, scanRun.id, jobId, 'new', null, rawHash, input._ctx);
    }

    if (input.include_descriptions && (job.description_text || job.description_html)) {
      await persistAdvert({
        job_id: jobId,
        source_url: job.url || job.apply_url || null,
        description_text: job.description_text || null,
        description_html: job.description_html || null,
        raw_json: job.raw,
        ctx: input._ctx,
      });
    }

    persisted++;
  }

  let removed = 0;
  for (const key of activeKeys) {
    if (seenKeys.has(key)) continue;
    const row = existingByKey.get(key) as any;
    const { error } = await sb
      .from('ats_job_postings')
      .update({ active: false, closed_at: startedAt, last_seen_at: startedAt, latest_scan_run_id: scanRun.id })
      .eq('id', row.id);
    if (error) throw error;
    removed++;
    await insertDelta(sb, company.id, source.id, scanRun.id, row.id, 'closed', row.raw_hash || null, null, input._ctx);
  }

  const finalStatus: ScanStatus =
    scan.status === 'success' && scan.expected_count != null && scan.jobs.length < scan.expected_count
      ? 'partial'
      : scan.status;

  const { error: scanUpdateError } = await sb
    .from('ats_scan_runs')
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      jobs_persisted: persisted,
      added_count: added,
      removed_count: removed,
      changed_count: changed,
      message: scan.partial_reason || null,
    })
    .eq('id', scanRun.id);
  if (scanUpdateError) throw scanUpdateError;

  const { error: sourceUpdateError } = await sb
    .from('ats_sources')
    .update({
      last_scan_run_id: scanRun.id,
      last_scanned_at: new Date().toISOString(),
      active: true,
    })
    .eq('id', source.id);
  if (sourceUpdateError) throw sourceUpdateError;

  return {
    company_id: company.id,
    source_id: source.id,
    scan_run_id: scanRun.id,
    status: finalStatus,
    jobs_found: scan.jobs.length,
    jobs_persisted: persisted,
    added,
    removed,
    changed,
  };
}

export async function getCompanyJobs(query: CompanyJobQuery): Promise<{ company: any | null; jobs: JobRecord[] }> {
  const sb = getSupabase();
  const normalized = normalizeCompanyName(query.company_name);
  const tenant = tenantId(query._ctx);
  let companyQuery = sb.from('ats_companies').select('*').eq('normalized_name', normalized).limit(1);
  companyQuery = tenantFilter(companyQuery, tenant);
  const companyRes = await companyQuery.maybeSingle();
  if (companyRes.error) throw companyRes.error;
  if (!companyRes.data) return { company: null, jobs: [] };

  let jobsQuery = sb
    .from('ats_job_postings')
    .select('*')
    .eq('company_id', companyRes.data.id)
    .order('last_seen_at', { ascending: false })
    .limit(query.limit || 100);
  if (query.active_only !== false) jobsQuery = jobsQuery.eq('active', true);

  const jobsRes = await jobsQuery;
  if (jobsRes.error) throw jobsRes.error;

  const jobs = ((jobsRes.data || []) as JobRecord[]).filter((job) => {
    if (!query.query) return true;
    return matchesTerms(job, query.query.split(/\s+/).filter(Boolean));
  });

  return { company: companyRes.data, jobs };
}

export async function getCompanyDeltas(params: {
  company_name: string;
  since?: string;
  limit?: number;
  _ctx?: AtsContext;
}): Promise<{ company: any | null; deltas: any[] }> {
  const sb = getSupabase();
  const { company } = await getCompanyJobs({ company_name: params.company_name, active_only: false, limit: 1, _ctx: params._ctx });
  if (!company) return { company: null, deltas: [] };

  let q = sb
    .from('ats_job_deltas')
    .select('*, ats_job_postings(title, location, department, url)')
    .eq('company_id', company.id)
    .order('detected_at', { ascending: false })
    .limit(params.limit || 100);
  if (params.since) q = q.gte('detected_at', params.since);

  const res = await q;
  if (res.error) throw res.error;
  return { company, deltas: res.data || [] };
}
