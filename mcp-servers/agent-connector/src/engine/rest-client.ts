export interface AuthConfig {
  type: 'none' | 'api_key' | 'oauth2_bearer' | 'basic';
  api_key?: string;
  api_key_header?: string;
  api_key_query_param?: string;
  token?: string;
  username?: string;
  password?: string;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  queryParams?: Record<string, string>;
}

export class RestClient {
  private baseUrl: string;
  private authConfig: AuthConfig;
  private defaultHeaders: Record<string, string>;
  private defaultTimeout: number;

  constructor(
    baseUrl: string,
    authConfig: AuthConfig = { type: 'none' },
    options: { headers?: Record<string, string>; timeout?: number } = {}
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.authConfig = authConfig;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };
    this.defaultTimeout = options.timeout ?? 30000;
  }

  private buildUrl(path: string, queryParams?: Record<string, string>): string {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, this.baseUrl);

    if (this.authConfig.type === 'api_key' && this.authConfig.api_key_query_param && this.authConfig.api_key) {
      url.searchParams.set(this.authConfig.api_key_query_param, this.authConfig.api_key);
    }

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }

  private buildHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...this.defaultHeaders, ...extraHeaders };

    switch (this.authConfig.type) {
      case 'api_key':
        if (this.authConfig.api_key && this.authConfig.api_key_header) {
          headers[this.authConfig.api_key_header] = this.authConfig.api_key;
        }
        break;
      case 'oauth2_bearer':
        if (this.authConfig.token) {
          headers['Authorization'] = `Bearer ${this.authConfig.token}`;
        }
        break;
      case 'basic':
        if (this.authConfig.username && this.authConfig.password) {
          const encoded = Buffer.from(`${this.authConfig.username}:${this.authConfig.password}`).toString('base64');
          headers['Authorization'] = `Basic ${encoded}`;
        }
        break;
    }

    return headers;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<{ status: number; data: unknown; headers: Record<string, string> }> {
    const url = this.buildUrl(path, options.queryParams);
    const headers = this.buildHeaders(options.headers);
    const timeout = options.timeout ?? this.defaultTimeout;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let data: unknown;
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return { status: response.status, data, headers: responseHeaders };
    } finally {
      clearTimeout(timer);
    }
  }

  async get(path: string, options?: RequestOptions) {
    return this.request('GET', path, undefined, options);
  }

  async post(path: string, body?: unknown, options?: RequestOptions) {
    return this.request('POST', path, body, options);
  }

  async put(path: string, body?: unknown, options?: RequestOptions) {
    return this.request('PUT', path, body, options);
  }

  async delete(path: string, options?: RequestOptions) {
    return this.request('DELETE', path, undefined, options);
  }
}
