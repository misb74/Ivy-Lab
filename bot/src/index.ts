import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBot } from './telegram.js';
import { SessionStore } from './sessions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = process.env.IVY_PROJECT_DIR || path.resolve(__dirname, '../..');
const dataDir = path.join(projectDir, 'data', 'telegram-bot');
const responsesDir = path.join(dataDir, 'responses');
const sessionsPath = path.join(projectDir, 'bot', 'sessions.json');

async function main(): Promise<void> {
  console.log('[bot] Starting Ivy-Lab Telegram bot');
  console.log(`[bot] Project dir: ${projectDir}`);
  console.log(`[bot] Sessions file: ${sessionsPath}`);
  console.log(`[bot] Responses dir: ${responsesDir}`);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('[bot] TELEGRAM_BOT_TOKEN not set in env. Exiting.');
    process.exit(1);
  }

  if (!process.env.ALLOWED_TELEGRAM_IDS) {
    console.warn(
      '[bot] ALLOWED_TELEGRAM_IDS not set — bot will reject ALL users until you add ' +
      'your Telegram user ID. Message the bot once to log your ID, then set ' +
      'ALLOWED_TELEGRAM_IDS in .env and restart.',
    );
  }

  const sessions = new SessionStore(sessionsPath);
  const bot = buildBot({
    token,
    cwd: projectDir,
    responsesDir,
    sessions,
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`[bot] Received ${signal} — stopping`);
    void bot.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await bot.start({
    onStart: info => {
      console.log(`[bot] Connected as @${info.username} (id=${info.id}). Polling.`);
    },
  });
}

main().catch(err => {
  console.error('[bot] Fatal:', err);
  process.exit(1);
});
