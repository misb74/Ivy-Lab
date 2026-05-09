import type { TimeBucket, BaseTemplateVars } from './types.js';

// UK bank holidays + US federal holidays for 2026 (ISO date strings)
const HOLIDAYS_2026 = new Set([
  // UK
  '2026-01-01', // New Year's Day
  '2026-04-03', // Good Friday
  '2026-04-06', // Easter Monday
  '2026-05-04', // Early May bank holiday
  '2026-05-25', // Spring bank holiday
  '2026-08-31', // Summer bank holiday
  '2026-12-25', // Christmas Day
  '2026-12-28', // Boxing Day (substitute)
  // US
  '2026-01-19', // MLK Day
  '2026-02-16', // Presidents' Day
  '2026-05-25', // Memorial Day (same as Spring bank holiday)
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-10-12', // Columbus Day
  '2026-11-11', // Veterans Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas Day
]);

const OPENER_BANKS: Record<TimeBucket, string[]> = {
  holiday: [
    'No rest for Ivy. Here\'s what I pulled together over the break.',
  ],
  weekend: [
    'Hope your weekend\'s going well. I stayed on it — here\'s your report.',
    'Weekend update for you, {name}. The highlights are worth a look.',
  ],
  overnight: [
    'Good morning, {name}. I ran this while you were sleeping — here\'s what came back.',
    'Early bird report. I wrapped this up at {completedTime} so it\'d be ready when you are.',
    'This one ran overnight. Grabbed a few interesting findings for you.',
  ],
  'deep-work': [
    'This one took some digging, but I got there. Worth the wait.',
    'Thorough scan complete. I cast a wide net on this one — here\'s the full picture.',
  ],
  quick: [
    'That was fast. Here\'s what I found.',
    'Quick one — results are in already.',
  ],
  standard: [
    'Your results are ready, {name}. Here\'s the summary.',
    'All done. Here\'s what I found.',
  ],
};

/**
 * Determine the time bucket for an email opener.
 * Priority: holiday > weekend > overnight > deep-work > quick > standard
 */
export function getTimeBucket(completedAt: Date, durationMinutes: number): TimeBucket {
  const dateStr = completedAt.toISOString().slice(0, 10);

  if (HOLIDAYS_2026.has(dateStr)) return 'holiday';

  const day = completedAt.getDay();
  if (day === 0 || day === 6) return 'weekend';

  const hour = completedAt.getHours();
  if (hour >= 0 && hour < 6) return 'overnight';

  if (durationMinutes > 240) return 'deep-work';
  if (durationMinutes < 30) return 'quick';

  return 'standard';
}

/**
 * Pick a random opener from the matching bucket, with variable substitution.
 */
export function pickOpener(vars: BaseTemplateVars): string {
  const completedAt = new Date(vars.completedAt);
  const bucket = getTimeBucket(completedAt, vars.durationMinutes);
  const lines = OPENER_BANKS[bucket];
  const line = lines[Math.floor(Math.random() * lines.length)];

  const timeStr = completedAt.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return line
    .replace(/\{name\}/g, vars.recipientName)
    .replace(/\{completedTime\}/g, timeStr);
}
