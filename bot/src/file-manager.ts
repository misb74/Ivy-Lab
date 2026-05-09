import fs from 'fs';
import path from 'path';

const FILE_PATH_KEYS = [
  'filepath', 'filePath', 'file_path',
  'outputPath', 'output_path', 'path',
];

export class FileManager {
  private uploadDir: string;
  private projectDir: string;

  constructor(uploadDir: string, projectDir: string) {
    this.uploadDir = uploadDir;
    this.projectDir = path.resolve(projectDir);
  }

  saveUpload(chatId: string, filename: string, data: Buffer): string {
    const chatDir = path.join(this.uploadDir, chatId);
    if (!fs.existsSync(chatDir)) {
      fs.mkdirSync(chatDir, { recursive: true });
    }
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(chatDir, `${timestamp}_${safeName}`);
    fs.writeFileSync(filePath, data);
    return filePath;
  }

  extractFilePaths(resultStr: string): string[] {
    const paths: string[] = [];
    try {
      const parsed = JSON.parse(resultStr);
      for (const key of FILE_PATH_KEYS) {
        const val = parsed[key];
        if (typeof val === 'string' && val.length > 0) {
          const resolved = path.resolve(val);
          if (resolved.startsWith(this.projectDir) && fs.existsSync(resolved)) {
            paths.push(resolved);
          }
        }
      }
    } catch {
      // Not JSON
    }
    return paths;
  }

  cleanup(maxAgeMs: number): number {
    if (!fs.existsSync(this.uploadDir)) return 0;
    const now = Date.now();
    let deleted = 0;
    const chatDirs = fs.readdirSync(this.uploadDir);
    for (const chatDir of chatDirs) {
      const chatPath = path.join(this.uploadDir, chatDir);
      if (!fs.statSync(chatPath).isDirectory()) continue;
      const files = fs.readdirSync(chatPath);
      for (const file of files) {
        const filePath = path.join(chatPath, file);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      }
      if (fs.readdirSync(chatPath).length === 0) {
        fs.rmdirSync(chatPath);
      }
    }
    return deleted;
  }
}
