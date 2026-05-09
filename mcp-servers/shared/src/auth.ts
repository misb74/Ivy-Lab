import { setTimeout } from 'timers/promises';

interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  created_at: number;
}

export class OAuthClient {
  private token: OAuthToken | null = null;
  private tokenUrl: string;
  private clientId: string;
  private clientSecret: string;
  private scopeCandidates: string[];

  constructor(opts: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scopeCandidates?: string[];
  }) {
    this.tokenUrl = opts.tokenUrl;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.scopeCandidates = opts.scopeCandidates || ['emsi_open'];
  }

  private isExpired(): boolean {
    if (!this.token) return true;
    return Date.now() / 1000 > this.token.created_at + this.token.expires_in - 300;
  }

  async getToken(): Promise<string> {
    if (!this.isExpired() && this.token) {
      return this.token.access_token;
    }
    await this.refresh();
    return this.token!.access_token;
  }

  private async refresh(): Promise<void> {
    let lastError: Error | null = null;

    for (const scope of this.scopeCandidates) {
      try {
        const body = new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope,
        });

        const res = await fetch(this.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });

        const data: any = await res.json();

        if (!res.ok || data.error) {
          lastError = new Error(`Scope '${scope}': ${data.error_description || data.error || res.statusText}`);
          continue;
        }

        this.token = {
          access_token: data.access_token,
          token_type: data.token_type || 'Bearer',
          expires_in: data.expires_in || 3600,
          scope: data.scope || scope,
          created_at: Date.now() / 1000,
        };
        return;
      } catch (err) {
        lastError = err as Error;
        continue;
      }
    }

    throw new Error(`OAuth failed with all scopes: ${lastError?.message}`);
  }
}

export class RateLimiter {
  private lastRequestTime = 0;
  private delayMs: number;
  private concurrency: number;
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(opts: { requestsPerMinute?: number; maxConcurrent?: number }) {
    this.delayMs = 60_000 / (opts.requestsPerMinute || 30);
    this.concurrency = opts.maxConcurrent || 3;
  }

  async acquire(): Promise<void> {
    // Wait for concurrency slot
    if (this.active >= this.concurrency) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.active++;

    // Enforce rate limiting
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.delayMs) {
      await setTimeout(this.delayMs - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}
