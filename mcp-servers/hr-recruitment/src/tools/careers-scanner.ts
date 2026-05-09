/**
 * Careers visual scanner v2 — Intelligent query expansion + full pagination.
 *
 * Discovers a company's careers page, expands search intent into multiple
 * concrete terms via LLM, paginates fully through all result pages per term,
 * and uses Claude Haiku vision to extract job listings.
 */

import Anthropic from '@anthropic-ai/sdk';

// Try to import optional deps, gracefully degrade if not available
let playwright: any;
let sharp: any;

try {
  playwright = await import('playwright');
} catch {
  playwright = null;
}

try {
  const sharpModule = await import('sharp');
  sharp = sharpModule.default ?? sharpModule;
} catch {
  sharp = null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobListing {
  title: string;
  location: string;
  department?: string;
  url?: string;
  matched_term?: string;
}

interface ScanMetadata {
  ats_detected: string | null;
  terms_searched: string[];
  pages_per_term: Record<string, number>;
  total_screenshots: number;
  total_pages: number;
  duplicates_removed: number;
  duration_ms: number;
  haiku_calls: { text: number; vision: number };
}

export interface CareersVisualScanResult {
  company_name: string;
  search_filter: string | null;
  search_intent?: string;
  expanded_terms?: string[];
  status: 'success' | 'partial' | 'error' | 'unavailable';
  careers_url?: string;
  jobs_found: number;
  jobs: JobListing[];
  screenshots_taken: number;
  message: string;
  scan_metadata?: ScanMetadata;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PAGES_PER_TERM = 50;
const MAX_SCREENSHOTS_PER_PAGE = 3;
const MAX_TERMS = 15;
const MAX_TOTAL_SCREENSHOTS = 200;
const SCAN_TIMEOUT_MS = 600_000; // 10 minutes
const NAVIGATION_TIMEOUT_MS = 30_000;
const PAGINATION_WAIT_MS = 2000;
const SEARCH_INPUT_WAIT_MS = 2000;

const COMMON_CAREER_URLS = (company: string): string[] => {
  const slug = company.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [
    `https://${slug}.com/careers`,
    `https://${slug}.com/jobs`,
    `https://www.${slug}.com/careers`,
    `https://www.${slug}.com/jobs`,
    `https://careers.${slug}.com`,
    `https://jobs.${slug}.com`,
    `https://${slug}.com/en/careers`,
    `https://jobs.lever.co/${slug}`,
    `https://boards.greenhouse.io/${slug}`,
    `https://${slug}.jobs.personio.com`,
  ];
};

const COOKIE_SELECTORS = [
  'button[id*="accept"]', 'button[id*="cookie"]', 'button[class*="accept"]',
  'button[class*="cookie"]', 'a[id*="accept"]', '#onetrust-accept-btn-handler',
  '.cc-accept', '.cc-btn.cc-dismiss', '[data-testid="cookie-accept"]',
  'button:has-text("Accept")', 'button:has-text("Accept All")',
  'button:has-text("Accept Cookies")', 'button:has-text("I Agree")',
  'button:has-text("Got it")', 'button:has-text("OK")',
];

const ATS_WAIT_SELECTORS: Record<string, string> = {
  'eightfold': '[class*="position-card"]',
  'workday': '[data-automation-id="jobTitle"]',
  'icims': '.iCIMS_JobsTable',
  'lever': '.posting-title',
  'greenhouse': '.opening',
};

const SEARCH_INPUT_SELECTORS = [
  'input.search-keyword',                  // Eightfold ATS
  'input[type="search"]',
  'input[placeholder*="keyword" i]',       // Eightfold: "Enter keyword e.g job title"
  'input[placeholder*="search" i]',
  'input[placeholder*="job title" i]',
  'input[placeholder*="job" i]',
  'input[name*="search" i]',
  'input[name*="keyword" i]',
  'input[id*="search" i]',
  '#keywords', '.search-input', '[data-testid="search-input"]',
];

const EXTRACTION_PROMPT = `You are analyzing a screenshot of a company careers/jobs page. Extract ALL visible job listings.

For each job found, extract:
- title: The job title
- location: The location (city, state, country, or "Remote")
- department: The department/team if visible
- url: Any visible URL or link text for the job

Return a JSON array of objects. If no jobs are visible, return an empty array.
Only return valid JSON, no other text.`;

// ---------------------------------------------------------------------------
// Haiku Call Tracker
// ---------------------------------------------------------------------------

interface HaikuTracker {
  text: number;
  vision: number;
}

// ---------------------------------------------------------------------------
// URL Discovery
// ---------------------------------------------------------------------------

async function findCareersUrl(company: string): Promise<string | null> {
  const urls = COMMON_CAREER_URLS(company);
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);
      if (response.ok) return url;
    } catch {
      // Try next URL
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cookie Banner Dismissal
// ---------------------------------------------------------------------------

async function dismissCookieBanner(page: any): Promise<void> {
  for (const selector of COOKIE_SELECTORS) {
    try {
      const el = await page.$(selector);
      if (el) {
        await el.click();
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // Continue trying
    }
  }
}

// ---------------------------------------------------------------------------
// ATS Detection
// ---------------------------------------------------------------------------

async function detectATS(page: any): Promise<string | null> {
  const html = await page.content();
  const htmlLower = html.toLowerCase();
  const url = page.url().toLowerCase();

  // Check URL patterns first (more reliable than HTML content)
  if (url.includes('myworkdayjobs.com') || url.includes('workday.com')) return 'workday';
  if (url.includes('greenhouse.io')) return 'greenhouse';
  if (url.includes('lever.co')) return 'lever';
  if (url.includes('icims.com')) return 'icims';

  for (const [ats, selector] of Object.entries(ATS_WAIT_SELECTORS)) {
    if (htmlLower.includes(ats)) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
      } catch {
        // Selector not found within timeout — continue anyway
      }
      return ats;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Image Compression
// ---------------------------------------------------------------------------

async function compressScreenshot(pngBuffer: Buffer): Promise<Buffer> {
  if (!sharp) return pngBuffer;
  return sharp(pngBuffer)
    .resize(1024, null, { withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Query Expansion via Claude Haiku
// ---------------------------------------------------------------------------

const SENIORITY_PREFIXES = /^(senior|junior|staff|lead|principal|director|vp|head|chief|associate|intern)\b/i;

async function expandSearchIntent(
  intent: string,
  client: Anthropic,
): Promise<string[]> {
  // Heuristic: if it looks like an exact job title, skip expansion
  const words = intent.trim().split(/\s+/);
  if (words.length > 4 && SENIORITY_PREFIXES.test(intent)) {
    return [intent];
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `You are a job search query expansion engine. Given a user's search intent, return a JSON array of 5-10 concrete search keywords that would find relevant jobs on a company careers page. Include the original term and related synonyms, abbreviations, and broader/narrower terms.

Rules:
- Return ONLY a JSON array of strings, no other text
- Include the original term first
- Focus on terms likely to appear in job titles or descriptions
- Keep terms concise (1-3 words each)

User intent: "${intent}"`,
      }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const terms: string[] = JSON.parse(jsonMatch[0]);
      // Enforce max terms and ensure original intent is first
      const unique = [...new Set(terms.map(t => t.trim()).filter(Boolean))];
      return unique.slice(0, MAX_TERMS);
    }
  } catch (err) {
    console.error('Query expansion error, falling back to literal term:', err);
  }

  return [intent];
}

// ---------------------------------------------------------------------------
// Vision Extraction — Single Screenshot
// ---------------------------------------------------------------------------

async function extractJobsFromScreenshot(
  screenshot: Buffer,
  client: Anthropic,
): Promise<JobListing[]> {
  const compressed = await compressScreenshot(screenshot);
  const base64 = compressed.toString('base64');
  const mediaType = sharp ? 'image/jpeg' as const : 'image/png' as const;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error('Vision extraction error:', err);
  }

  return [];
}

// ---------------------------------------------------------------------------
// Per-Page Screenshot Capture (scrolls within a single page)
// ---------------------------------------------------------------------------

async function captureCurrentPage(page: any): Promise<Buffer[]> {
  const screenshots: Buffer[] = [];

  // Scroll to top first
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // Capture initial viewport
  screenshots.push(await page.screenshot({ type: 'png', fullPage: false }));

  // Scroll and capture more viewports within this page
  const scrollHeight: number = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = 800;
  let scrolled = viewportHeight;

  while (scrolled < scrollHeight && screenshots.length < MAX_SCREENSHOTS_PER_PAGE) {
    await page.evaluate((y: number) => window.scrollTo(0, y), scrolled);
    await page.waitForTimeout(1000);
    screenshots.push(await page.screenshot({ type: 'png', fullPage: false }));
    scrolled += viewportHeight;
  }

  return screenshots;
}

// ---------------------------------------------------------------------------
// Pagination Strategies
// ---------------------------------------------------------------------------

interface PaginationStrategy {
  name: string;
  advance(page: any): Promise<boolean>;
}

function workdayPagination(): PaginationStrategy {
  return {
    name: 'workday',
    async advance(page: any): Promise<boolean> {
      const nextSelectors = [
        '[data-automation-id="nextPage"]',
        'button[aria-label="next"]',
        'button[aria-label="Next"]',
        'a[aria-label="next"]',
        'a[aria-label="Next"]',
      ];
      for (const sel of nextSelectors) {
        try {
          const btn = await page.$(sel);
          if (btn) {
            const disabled = await btn.getAttribute('disabled');
            const ariaDisabled = await btn.getAttribute('aria-disabled');
            if (disabled !== null || ariaDisabled === 'true') return false;
            await btn.click();
            await page.waitForTimeout(PAGINATION_WAIT_MS);
            try {
              await page.waitForSelector('[data-automation-id="jobTitle"]', { timeout: 10000 });
            } catch { /* content may already be loaded */ }
            return true;
          }
        } catch { /* try next selector */ }
      }
      return false;
    },
  };
}

function greenhousePagination(): PaginationStrategy {
  return {
    name: 'greenhouse',
    async advance(page: any): Promise<boolean> {
      // Try pagination links first
      const paginationSelectors = [
        'a.next_page', 'a:has-text("Next")', '.pagination a.next',
        'li.next a', 'a[rel="next"]',
      ];
      for (const sel of paginationSelectors) {
        try {
          const link = await page.$(sel);
          if (link) {
            await link.click();
            await page.waitForTimeout(PAGINATION_WAIT_MS);
            try {
              await page.waitForSelector('.opening', { timeout: 10000 });
            } catch { /* content may load differently */ }
            return true;
          }
        } catch { /* try next */ }
      }

      // Try "Load More" / "Show More" button
      const loadMoreSelectors = [
        'button:has-text("Load More")', 'button:has-text("Show More")',
        'button:has-text("Load more")', 'button:has-text("Show more")',
        'a:has-text("Load More")', 'a:has-text("Show More")',
      ];
      const beforeCount: number = await page.$$eval('.opening', (els: any[]) => els.length).catch(() => 0);
      for (const sel of loadMoreSelectors) {
        try {
          const btn = await page.$(sel);
          if (btn) {
            await btn.click();
            await page.waitForTimeout(PAGINATION_WAIT_MS);
            const afterCount: number = await page.$$eval('.opening', (els: any[]) => els.length).catch(() => 0);
            return afterCount > beforeCount;
          }
        } catch { /* try next */ }
      }

      return false;
    },
  };
}

function leverPagination(): PaginationStrategy {
  return {
    name: 'lever',
    async advance(page: any): Promise<boolean> {
      // Lever boards are typically single-page; check for "Show more"
      const loadMoreSelectors = [
        'button:has-text("Show More")', 'button:has-text("Show more")',
        'button:has-text("Load More")', 'button:has-text("Load more")',
        'a.show-more',
      ];
      const beforeCount: number = await page.$$eval('.posting-title', (els: any[]) => els.length).catch(() => 0);
      for (const sel of loadMoreSelectors) {
        try {
          const btn = await page.$(sel);
          if (btn) {
            await btn.click();
            await page.waitForTimeout(PAGINATION_WAIT_MS);
            const afterCount: number = await page.$$eval('.posting-title', (els: any[]) => els.length).catch(() => 0);
            return afterCount > beforeCount;
          }
        } catch { /* try next */ }
      }
      return false;
    },
  };
}

function icimsPagination(): PaginationStrategy {
  return {
    name: 'icims',
    async advance(page: any): Promise<boolean> {
      const nextSelectors = [
        '.iCIMS_Paging a:has-text("Next")', '.iCIMS_Paging a:has-text("next")',
        '.iCIMS_Paging a:has-text(">")', 'a[title="Next Page"]',
        'a.iCIMS_PagingNext',
      ];
      for (const sel of nextSelectors) {
        try {
          const link = await page.$(sel);
          if (link) {
            await link.click();
            await page.waitForTimeout(PAGINATION_WAIT_MS);
            try {
              await page.waitForSelector('.iCIMS_JobsTable', { timeout: 10000 });
            } catch { /* table may already be loaded */ }
            return true;
          }
        } catch { /* try next */ }
      }
      return false;
    },
  };
}

function eightfoldPagination(): PaginationStrategy {
  return {
    name: 'eightfold',
    async advance(page: any): Promise<boolean> {
      // Try "Load More" button first
      const loadMoreSelectors = [
        'button:has-text("Load More")', 'button:has-text("Show More")',
        'button:has-text("Load more")', 'button:has-text("Show more")',
        'button:has-text("View More")', 'button:has-text("View more")',
      ];
      const beforeCount: number = await page.$$eval('[class*="position-card"]', (els: any[]) => els.length).catch(() => 0);
      for (const sel of loadMoreSelectors) {
        try {
          const btn = await page.$(sel);
          if (btn) {
            await btn.click();
            await page.waitForTimeout(PAGINATION_WAIT_MS);
            const afterCount: number = await page.$$eval('[class*="position-card"]', (els: any[]) => els.length).catch(() => 0);
            return afterCount > beforeCount;
          }
        } catch { /* try next */ }
      }

      // Try infinite scroll: scroll to bottom, check if new cards appeared
      const scrollHeightBefore: number = await page.evaluate(() => document.body.scrollHeight);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(PAGINATION_WAIT_MS);
      const scrollHeightAfter: number = await page.evaluate(() => document.body.scrollHeight);
      const afterCount: number = await page.$$eval('[class*="position-card"]', (els: any[]) => els.length).catch(() => 0);

      return scrollHeightAfter > scrollHeightBefore && afterCount > beforeCount;
    },
  };
}

function genericPagination(): PaginationStrategy {
  let scrollAttempts = 0;

  return {
    name: 'generic',
    async advance(page: any): Promise<boolean> {
      // Strategy 1: Look for "Next" button/link
      const nextSelectors = [
        'a:has-text("Next")', 'button:has-text("Next")',
        '[aria-label="Next page"]', '[aria-label="next page"]',
        'a.next', '.pagination .next', 'li.next a',
        'a[rel="next"]', 'button[aria-label="Next"]',
        '.pager__next a', '.paginator__next',
      ];
      for (const sel of nextSelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            const disabled = await el.getAttribute('disabled');
            const ariaDisabled = await el.getAttribute('aria-disabled');
            const cls = (await el.getAttribute('class')) || '';
            if (disabled !== null || ariaDisabled === 'true' || cls.includes('disabled')) return false;
            await el.click();
            await page.waitForTimeout(PAGINATION_WAIT_MS);
            return true;
          }
        } catch { /* try next */ }
      }

      // Strategy 2: Look for numbered pagination — find current page, click next number
      try {
        const paginationContainers = [
          '.pagination', 'nav[aria-label*="pagination" i]', '[role="navigation"]',
          '.pager', '.paginator',
        ];
        for (const container of paginationContainers) {
          const current = await page.$(`${container} .active, ${container} [aria-current="page"]`);
          if (current) {
            const currentText = await current.textContent();
            const currentNum = parseInt(currentText?.trim() || '', 10);
            if (!isNaN(currentNum)) {
              const nextLink = await page.$(`${container} a:has-text("${currentNum + 1}")`);
              if (nextLink) {
                await nextLink.click();
                await page.waitForTimeout(PAGINATION_WAIT_MS);
                return true;
              }
            }
          }
        }
      } catch { /* fall through */ }

      // Strategy 3: "Load More" / "Show More" buttons
      const loadMoreSelectors = [
        'button:has-text("Load More")', 'button:has-text("Show More")',
        'button:has-text("Load more")', 'button:has-text("Show more")',
        'button:has-text("View More")', 'button:has-text("View more")',
        'a:has-text("Load More")', 'a:has-text("Show More")',
      ];
      for (const sel of loadMoreSelectors) {
        try {
          const btn = await page.$(sel);
          if (btn) {
            const beforeHeight: number = await page.evaluate(() => document.body.scrollHeight);
            await btn.click();
            await page.waitForTimeout(PAGINATION_WAIT_MS);
            const afterHeight: number = await page.evaluate(() => document.body.scrollHeight);
            return afterHeight > beforeHeight;
          }
        } catch { /* try next */ }
      }

      // Strategy 4: Infinite scroll detection (max 2 attempts)
      if (scrollAttempts < 2) {
        const beforeHeight: number = await page.evaluate(() => document.body.scrollHeight);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(PAGINATION_WAIT_MS);
        const afterHeight: number = await page.evaluate(() => document.body.scrollHeight);
        scrollAttempts++;
        if (afterHeight > beforeHeight) return true;
      }

      return false;
    },
  };
}

function getPaginationStrategy(ats: string | null): PaginationStrategy {
  switch (ats) {
    case 'workday': return workdayPagination();
    case 'greenhouse': return greenhousePagination();
    case 'lever': return leverPagination();
    case 'icims': return icimsPagination();
    case 'eightfold': return eightfoldPagination();
    default: return genericPagination();
  }
}

// ---------------------------------------------------------------------------
// Search Input Helper
// ---------------------------------------------------------------------------

async function typeSearchTerm(page: any, term: string): Promise<boolean> {
  for (const selector of SEARCH_INPUT_SELECTORS) {
    try {
      const input = await page.$(selector);
      if (input) {
        // Use force:true to bypass any overlay (cookie banners, etc.)
        await input.click({ clickCount: 3, force: true }); // select all existing text
        await page.waitForTimeout(200);
        for (const char of term) {
          await input.type(char, { delay: 30 });
        }
        // Try clicking a search/submit button first (Eightfold uses a button, not Enter)
        const searchBtnSelectors = [
          'button.search-submit', 'button[type="submit"]',
          'button:has-text("Search")', 'button:has-text("SEARCH")',
          'input[type="submit"]', 'a.search-submit',
        ];
        let clicked = false;
        for (const btnSel of searchBtnSelectors) {
          try {
            const btn = await page.$(btnSel);
            if (btn) {
              await btn.click();
              clicked = true;
              break;
            }
          } catch { /* try next */ }
        }
        // Fall back to Enter key
        if (!clicked) {
          await page.keyboard.press('Enter');
        }
        await page.waitForTimeout(SEARCH_INPUT_WAIT_MS);
        // Wait extra for Eightfold SPA navigation
        await page.waitForTimeout(2000);
        return true;
      }
    } catch {
      // Try next selector
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Per-Term Scan: Paginate + Extract
// ---------------------------------------------------------------------------

async function scanTerm(
  page: any,
  term: string,
  ats: string | null,
  careersUrl: string,
  client: Anthropic,
  tracker: HaikuTracker,
  globalScreenshotCount: { count: number },
): Promise<{ jobs: JobListing[]; pages: number; screenshots: number }> {
  const termJobs: JobListing[] = [];
  let termPages = 0;
  let termScreenshots = 0;

  try {
    // Navigate back to careers page for each term
    await page.goto(careersUrl, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
    await page.waitForTimeout(3000);

    // Dismiss cookie banner (may reappear on each navigation)
    await dismissCookieBanner(page);
    await page.waitForTimeout(500);

    // Type the search term
    const searched = await typeSearchTerm(page, term);
    if (!searched) {
      console.error(`Could not find search input for term: ${term}`);
      // Still try to capture whatever is on the page
    }

    // Wait for ATS content to load
    if (ats && ATS_WAIT_SELECTORS[ats]) {
      try {
        await page.waitForSelector(ATS_WAIT_SELECTORS[ats], { timeout: 10000 });
      } catch { /* content may already be loaded or not present */ }
    }
    await page.waitForTimeout(1000);

    // Create pagination strategy
    const strategy = getPaginationStrategy(ats);

    // Paginate and extract
    let hasMore = true;
    while (hasMore && termPages < MAX_PAGES_PER_TERM && globalScreenshotCount.count < MAX_TOTAL_SCREENSHOTS) {
      termPages++;

      // Capture screenshots for this page
      const screenshots = await captureCurrentPage(page);
      termScreenshots += screenshots.length;
      globalScreenshotCount.count += screenshots.length;

      // Extract jobs from each screenshot, then discard buffers
      for (const shot of screenshots) {
        const jobs = await extractJobsFromScreenshot(shot, client);
        tracker.vision++;
        termJobs.push(...jobs.map(j => ({ ...j, matched_term: term })));
      }

      // Check global screenshot cap
      if (globalScreenshotCount.count >= MAX_TOTAL_SCREENSHOTS) break;

      // Try to advance to next page
      hasMore = await strategy.advance(page);
    }
  } catch (err) {
    console.error(`Error scanning term "${term}":`, err);
  }

  return { jobs: termJobs, pages: termPages, screenshots: termScreenshots };
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

export async function careersVisualScan(
  companyName: string,
  searchFilter?: string,
  searchIntent?: string,
  exactTerms?: string[],
): Promise<CareersVisualScanResult> {
  const startTime = Date.now();

  // Check if playwright is available
  if (!playwright) {
    return {
      company_name: companyName,
      search_filter: searchFilter || null,
      status: 'unavailable',
      jobs_found: 0,
      jobs: [],
      screenshots_taken: 0,
      message: 'Playwright is not installed. Install with: npm install playwright && npx playwright install chromium',
    };
  }

  // Initialize Anthropic client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      company_name: companyName,
      search_filter: searchFilter || null,
      status: 'error',
      jobs_found: 0,
      jobs: [],
      screenshots_taken: 0,
      message: 'ANTHROPIC_API_KEY not set. Required for query expansion and job extraction.',
    };
  }
  const client = new Anthropic({ apiKey });
  const tracker: HaikuTracker = { text: 0, vision: 0 };

  // Determine search terms
  let terms: string[] = [];
  let resolvedIntent: string | undefined;

  if (exactTerms && exactTerms.length > 0) {
    terms = exactTerms.slice(0, MAX_TERMS);
  } else if (searchIntent) {
    resolvedIntent = searchIntent;
    terms = await expandSearchIntent(searchIntent, client);
    tracker.text++;
  } else if (searchFilter) {
    terms = [searchFilter]; // backward compat: literal term, no expansion
  }
  // else: no terms — scan full page without filtering

  // Find careers URL
  const careersUrl = await findCareersUrl(companyName);
  if (!careersUrl) {
    return {
      company_name: companyName,
      search_filter: searchFilter || null,
      search_intent: resolvedIntent,
      expanded_terms: terms.length > 0 ? terms : undefined,
      status: 'error',
      jobs_found: 0,
      jobs: [],
      screenshots_taken: 0,
      message: `Could not find careers page for ${companyName}. Try providing a direct URL.`,
    };
  }

  let browser: any;
  let scanTimedOut = false;

  // Set up global timeout
  const timeoutPromise = new Promise<'timeout'>((resolve) => {
    setTimeout(() => resolve('timeout'), SCAN_TIMEOUT_MS);
  });

  try {
    // Launch browser
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    // Initial navigation — use domcontentloaded (more resilient than networkidle for SPAs)
    await page.goto(careersUrl, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
    await page.waitForTimeout(3000); // Allow JS to render content
    await dismissCookieBanner(page);
    const ats = await detectATS(page);

    // Accumulate results
    const allJobs: JobListing[] = [];
    const pagesPerTerm: Record<string, number> = {};
    const globalScreenshotCount = { count: 0 };
    let totalPages = 0;

    if (terms.length === 0) {
      // No search terms: scan whatever is on the page with full pagination
      const strategy = getPaginationStrategy(ats);
      let hasMore = true;
      let pageNum = 0;

      while (hasMore && pageNum < MAX_PAGES_PER_TERM && globalScreenshotCount.count < MAX_TOTAL_SCREENSHOTS) {
        pageNum++;
        const screenshots = await captureCurrentPage(page);
        globalScreenshotCount.count += screenshots.length;

        for (const shot of screenshots) {
          const jobs = await extractJobsFromScreenshot(shot, client);
          tracker.vision++;
          allJobs.push(...jobs);
        }

        if (globalScreenshotCount.count >= MAX_TOTAL_SCREENSHOTS) break;
        hasMore = await strategy.advance(page);
      }
      totalPages = pageNum;
      pagesPerTerm['(unfiltered)'] = pageNum;
    } else {
      // Multi-term scan
      let consecutiveEmpty = 0;

      for (const term of terms) {
        // Check global timeout
        const elapsed = Date.now() - startTime;
        if (elapsed > SCAN_TIMEOUT_MS * 0.9) {
          scanTimedOut = true;
          break;
        }

        // Check screenshot cap
        if (globalScreenshotCount.count >= MAX_TOTAL_SCREENSHOTS) break;

        const result = await Promise.race([
          scanTerm(page, term, ats, careersUrl, client, tracker, globalScreenshotCount),
          timeoutPromise,
        ]);

        if (result === 'timeout') {
          scanTimedOut = true;
          break;
        }

        allJobs.push(...result.jobs);
        pagesPerTerm[term] = result.pages;
        totalPages += result.pages;

        if (result.jobs.length === 0) {
          consecutiveEmpty++;
        } else {
          consecutiveEmpty = 0;
        }

        // If 3+ consecutive terms return nothing, the search may not work
        if (consecutiveEmpty >= 3 && terms.indexOf(term) >= 3) {
          console.error(`3 consecutive empty terms after "${term}" — careers page may not support keyword search`);
          break;
        }
      }
    }

    await browser.close();
    browser = null;

    // Deduplicate by (title, location)
    const seen = new Set<string>();
    const deduped: JobListing[] = [];
    for (const job of allJobs) {
      const key = `${job.title}|${job.location}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(job);
      }
    }
    const duplicatesRemoved = allJobs.length - deduped.length;

    const durationMs = Date.now() - startTime;
    const status = deduped.length > 0 ? 'success' : 'partial';
    let message = deduped.length > 0
      ? `Found ${deduped.length} unique job listings`
      : `Scanned ${companyName}'s careers page but could not extract job listings.`;

    if (terms.length > 0) {
      message += ` across ${terms.length} search term${terms.length > 1 ? 's' : ''}`;
    }
    message += ` on ${companyName}'s careers page.`;
    if (scanTimedOut) message += ' (scan timed out — results may be incomplete)';
    if (duplicatesRemoved > 0) message += ` ${duplicatesRemoved} duplicates removed.`;

    return {
      company_name: companyName,
      search_filter: searchFilter || null,
      search_intent: resolvedIntent,
      expanded_terms: terms.length > 0 ? terms : undefined,
      status,
      careers_url: careersUrl,
      jobs_found: deduped.length,
      jobs: deduped,
      screenshots_taken: globalScreenshotCount.count,
      message,
      scan_metadata: {
        ats_detected: ats,
        terms_searched: terms.length > 0 ? terms : ['(unfiltered)'],
        pages_per_term: pagesPerTerm,
        total_screenshots: globalScreenshotCount.count,
        total_pages: totalPages,
        duplicates_removed: duplicatesRemoved,
        duration_ms: durationMs,
        haiku_calls: tracker,
      },
    };
  } catch (err: any) {
    if (browser) await browser.close().catch(() => {});
    return {
      company_name: companyName,
      search_filter: searchFilter || null,
      search_intent: resolvedIntent,
      expanded_terms: terms.length > 0 ? terms : undefined,
      status: 'error',
      careers_url: careersUrl,
      jobs_found: 0,
      jobs: [],
      screenshots_taken: 0,
      message: `Error scanning careers page: ${err.message}`,
    };
  }
}
