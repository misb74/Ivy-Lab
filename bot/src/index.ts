import path from 'path';
import { fileURLToPath } from 'url';
import { MCPManager } from './mcp-manager.js';
import { ConversationStore } from './conversation-store.js';
import { AuditLogger } from './audit.js';
import { FileManager } from './file-manager.js';
import { createBot } from './telegram.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is required');
  process.exit(1);
}

if (!process.env.ALLOWED_TELEGRAM_IDS) {
  console.warn('[bot] ALLOWED_TELEGRAM_IDS not set — bot will reject ALL users until you add your Telegram user ID. Message the bot once to log your ID, then set ALLOWED_TELEGRAM_IDS in .env and restart.');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = process.env.IVY_PROJECT_DIR || path.resolve(__dirname, '../..');
const dataDir = path.join(projectDir, 'data', 'telegram-bot');

async function main(): Promise<void> {
  console.log('[bot] Starting Ivy Telegram Bot...');
  console.log(`[bot] Project dir: ${projectDir}`);

  const mcpManager = new MCPManager();
  await mcpManager.initialize(path.join(projectDir, '.mcp.json'));

  const conversationStore = new ConversationStore(
    path.join(dataDir, 'conversations.db'),
  );

  const audit = new AuditLogger(
    path.join(dataDir, 'audit.db'),
  );

  const fileManager = new FileManager(
    path.join(dataDir, 'uploads'),
    projectDir,
  );

  const cleaned = fileManager.cleanup(24 * 60 * 60 * 1000);
  if (cleaned > 0) console.log(`[bot] Cleaned ${cleaned} old uploads`);

  setInterval(() => {
    const n = fileManager.cleanup(24 * 60 * 60 * 1000);
    if (n > 0) console.log(`[bot] Cleaned ${n} old uploads`);
  }, 6 * 60 * 60 * 1000);

  const bot = createBot(TELEGRAM_BOT_TOKEN as string, mcpManager, conversationStore, audit, fileManager);

  const shutdown = async (signal: string) => {
    console.log(`\n[bot] ${signal} received, shutting down...`);
    await bot.stop();
    await mcpManager.shutdown();
    conversationStore.close();
    audit.close();
    console.log('[bot] Goodbye.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log('[bot] Bot is running. Press Ctrl+C to stop.');
  await bot.start();
}

main().catch((err) => {
  console.error('[bot] Fatal error:', err);
  process.exit(1);
});
