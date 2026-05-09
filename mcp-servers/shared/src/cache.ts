import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const CACHE_DIR = process.env.CACHE_DIR || join(process.cwd(), 'data', 'cache');
const DEFAULT_TTL = parseInt(process.env.CACHE_TTL || '3600', 10) * 1000;

interface CacheEntry<T> {
  data: T;
  expires: number;
}

export class FileCache {
  private dir: string;
  private ttl: number;

  constructor(namespace: string, ttlMs?: number) {
    this.dir = join(CACHE_DIR, namespace);
    this.ttl = ttlMs ?? DEFAULT_TTL;
  }

  private key(input: string): string {
    return createHash('sha256').update(input).digest('hex').slice(0, 16);
  }

  async get<T>(input: string): Promise<T | null> {
    const file = join(this.dir, `${this.key(input)}.json`);
    try {
      const raw = await readFile(file, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() < entry.expires) {
        return entry.data;
      }
    } catch {
      // miss
    }
    return null;
  }

  async set<T>(input: string, data: T): Promise<void> {
    if (!existsSync(this.dir)) {
      await mkdir(this.dir, { recursive: true });
    }
    const entry: CacheEntry<T> = { data, expires: Date.now() + this.ttl };
    await writeFile(join(this.dir, `${this.key(input)}.json`), JSON.stringify(entry));
  }
}
