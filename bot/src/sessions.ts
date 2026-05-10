import fs from 'node:fs';
import path from 'node:path';

export class SessionStore {
  private filePath: string;
  private map: Record<string, string>;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.map = this.load();
  }

  private load(): Record<string, string> {
    try {
      if (!fs.existsSync(this.filePath)) return {};
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.map, null, 2));
  }

  get(chatId: number): string | undefined {
    return this.map[String(chatId)];
  }

  set(chatId: number, sessionId: string): void {
    this.map[String(chatId)] = sessionId;
    this.save();
  }

  clear(chatId: number): void {
    delete this.map[String(chatId)];
    this.save();
  }
}
