import type { RestClient } from './rest-client.js';
import type { PaginationConfig } from '../types/profile.js';

export async function paginateAll(
  client: RestClient,
  endpoint: string,
  dataPath: string | undefined,
  pagination: PaginationConfig,
  maxPages: number = 50
): Promise<Record<string, unknown>[]> {
  const allRecords: Record<string, unknown>[] = [];
  let currentEndpoint = endpoint;
  let page = 0;

  for (let i = 0; i < maxPages; i++) {
    const response = await client.get(currentEndpoint);

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
    }

    const records = extractData(response.data, dataPath);
    allRecords.push(...records);

    if (records.length === 0) break;

    // Determine next page based on pagination type
    const nextUrl = getNextPage(pagination, response, currentEndpoint, page);
    if (!nextUrl) break;

    currentEndpoint = nextUrl;
    page++;
  }

  return allRecords;
}

function getNextPage(
  pagination: PaginationConfig,
  response: { data: unknown; headers: Record<string, string> },
  currentEndpoint: string,
  page: number
): string | null {
  switch (pagination.type) {
    case 'link_header': {
      const linkHeader = response.headers['link'];
      if (!linkHeader) return null;
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (!nextMatch) return null;
      const nextUrl = nextMatch[1];
      // Return path portion only if it's a full URL
      try {
        const url = new URL(nextUrl);
        return url.pathname + url.search;
      } catch {
        return nextUrl;
      }
    }

    case 'cursor': {
      const cursorField = pagination.cursor_field || 'next_cursor';
      const cursorParam = pagination.cursor_param || 'cursor';
      const cursor = getNestedValue(response.data, cursorField);
      if (!cursor) return null;

      const url = new URL(currentEndpoint, 'http://placeholder');
      url.searchParams.set(cursorParam, String(cursor));
      return url.pathname + url.search;
    }

    case 'offset': {
      const pageParam = pagination.page_param || 'page';
      const perPage = pagination.per_page_default || 100;
      const data = response.data as Record<string, unknown>;

      // Check if there are more records
      const records = extractData(data, undefined);
      if (records.length < perPage) return null;

      const nextPage = page + 2; // 1-indexed
      const url = new URL(currentEndpoint.split('?')[0], 'http://placeholder');
      // Preserve existing query params
      const existing = new URL(currentEndpoint, 'http://placeholder');
      existing.searchParams.forEach((v, k) => {
        if (k !== pageParam) url.searchParams.set(k, v);
      });
      url.searchParams.set(pageParam, String(nextPage));
      if (pagination.per_page_param) {
        url.searchParams.set(pagination.per_page_param, String(perPage));
      }
      return url.pathname + url.search;
    }

    default:
      return null;
  }
}

function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function extractData(response: unknown, dataPath?: string): Record<string, unknown>[] {
  let data = response;

  if (dataPath) {
    const keys = dataPath.split('.');
    for (const key of keys) {
      if (data && typeof data === 'object' && key in (data as Record<string, unknown>)) {
        data = (data as Record<string, unknown>)[key];
      } else {
        return [];
      }
    }
  }

  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object') return [data as Record<string, unknown>];
  return [];
}
