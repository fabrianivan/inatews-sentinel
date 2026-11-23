/**
 * Time helpers shared across the dashboard.
 *
 * Every wall-clock string is pinned to Asia/Jakarta and written the way BMKG
 * writes it ("13:21:30 WIB"), whatever zone or locale the browser runs in.
 * All functions are pure: callers pass `now`, so output is testable and
 * components decide how often to re-render.
 */

export type TimeInput = string | number | Date | null | undefined;

const WIB_ZONE = 'Asia/Jakarta';

const WIB_TIME_SECONDS = new Intl.DateTimeFormat('en-GB', {
  timeZone: WIB_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const WIB_TIME_MINUTES = new Intl.DateTimeFormat('en-GB', {
  timeZone: WIB_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const WIB_DATE_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: WIB_ZONE,
  day: '2-digit',
  month: 'numeric',
  year: 'numeric',
});

/** Fixed abbreviations: locale month names vary between server and browser ICU builds. */
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "2026-11-16 01:00:00" — a timestamp with no zone designator. */
const ZONELESS_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/;

const UTC_TIME_SECONDS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Parses anything timestamp-like; returns null instead of an Invalid Date.
 * A string with no zone designator is read as UTC — feeds such as IOC publish
 * UTC that way, and letting the runtime assume its own zone would shift it by
 * seven hours on a Jakarta machine and by nothing on a UTC server.
 */
export function toDate(input: TimeInput): Date | null {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'string') {
    const zoneless = ZONELESS_TIMESTAMP.exec(input.trim());
    if (zoneless) {
      const utc = new Date(`${zoneless[1]}T${zoneless[2]}Z`);
      return Number.isNaN(utc.getTime()) ? null : utc;
    }
  }
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Epoch milliseconds, or null when the input is not a usable timestamp. */
export function toMillis(input: TimeInput): number | null {
  return toDate(input)?.getTime() ?? null;
}

/** "13:21:30 WIB" (or "13:21 WIB" with `seconds: false`). */
export function formatWibTime(input: TimeInput, options: { seconds?: boolean } = {}): string {
  const withSeconds = options.seconds ?? true;
  const date = toDate(input);
  if (!date) return withSeconds ? '--:--:-- WIB' : '--:-- WIB';
  const formatter = withSeconds ? WIB_TIME_SECONDS : WIB_TIME_MINUTES;
  return `${formatter.format(date)} WIB`;
}

/** "13:21:30 UTC". */
export function formatUtcTime(input: TimeInput): string {
  const date = toDate(input);
  if (!date) return '--:--:-- UTC';
  return `${UTC_TIME_SECONDS.format(date)} UTC`;
}

function wibDateParts(date: Date): { day: string; month: number; year: string } {
  const parts = WIB_DATE_PARTS.formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { day: pick('day'), month: Number(pick('month')) || 1, year: pick('year') };
}

/** "16 Nov 2026" in WIB (or "16 Nov" with `year: false`). */
export function formatWibDate(input: TimeInput, options: { year?: boolean } = {}): string {
  const date = toDate(input);
  if (!date) return '—';
  const { day, month, year } = wibDateParts(date);
  const base = `${day} ${MONTHS_ID[month - 1]}`;
  return options.year === false ? base : `${base} ${year}`;
}

/** "16 Nov 2026, 13:21 WIB". */
export function formatWibDateTime(input: TimeInput): string {
  const date = toDate(input);
  if (!date) return '—';
  return `${formatWibDate(date)}, ${WIB_TIME_MINUTES.format(date)} WIB`;
}

/**
 * Compact stamp for list rows: "3 jam lalu · 14:05 WIB" within a day,
 * "4 Nov · 14:05 WIB" beyond it. Lists span weeks, so a bare time is not enough.
 */
export function formatRowStamp(input: TimeInput, now: TimeInput): string {
  const date = toDate(input);
  const current = toMillis(now);
  if (!date) return '—';
  const clock = `${WIB_TIME_MINUTES.format(date)} WIB`;
  if (current !== null && current - date.getTime() < DAY) {
    return `${formatAge(date, current)} · ${clock}`;
  }
  return `${formatWibDate(date, { year: false })} · ${clock}`;
}

/** Indonesian decimal comma for display values: 6.1 -> "6,1". */
export function formatDecimal(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(fractionDigits).replace('.', ',');
}

/**
 * Relative age in Indonesian: "baru saja", "40 dtk lalu", "12 mnt lalu",
 * "3 jam lalu", "5 hari lalu". Returns "—" when the timestamp is unusable and
 * "baru saja" for timestamps slightly in the future (clock skew).
 */
export function formatAge(input: TimeInput, now: TimeInput): string {
  const from = toMillis(input);
  const current = toMillis(now);
  if (from === null || current === null) return '—';
  const elapsed = current - from;
  if (elapsed < 10 * SECOND) return 'baru saja';
  if (elapsed < MINUTE) return `${Math.floor(elapsed / SECOND)} dtk lalu`;
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} mnt lalu`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} jam lalu`;
  return `${Math.floor(elapsed / DAY)} hari lalu`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** "00:12:34" for a duration; never negative. Hours grow past two digits if needed. */
export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor((Number.isFinite(durationMs) ? durationMs : 0) / SECOND));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

/**
 * Elapsed time since an event origin: "T+ 00:12:34" during the first day,
 * then "T+ 3 hari 4 jam" — a running seconds counter stops being useful once
 * the event is days old.
 */
export function formatTPlus(origin: TimeInput, now: TimeInput): string {
  const from = toMillis(origin);
  const current = toMillis(now);
  if (from === null || current === null) return 'T+ --:--:--';
  const elapsed = Math.max(0, current - from);
  if (elapsed < DAY) return `T+ ${formatDuration(elapsed)}`;
  const days = Math.floor(elapsed / DAY);
  const hours = Math.floor((elapsed % DAY) / HOUR);
  return hours > 0 ? `T+ ${days} hari ${hours} jam` : `T+ ${days} hari`;
}

/** Remaining time as "mm:ss" (or "h:mm:ss" from one hour up); "00:00" once passed. */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil((Number.isFinite(remainingMs) ? remainingMs : 0) / SECOND));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

/**
 * Signed scenario clock relative to the mainshock: "T−05:00", "T+00:00",
 * "T+08:12", "T+2:00:00". Input is seconds relative to T0.
 */
export function formatScenarioClock(secondsFromOrigin: number): string {
  const safe = Number.isFinite(secondsFromOrigin) ? secondsFromOrigin : 0;
  // Before T0 the clock counts down, so round up: 0.4 s before the mainshock still reads T−00:01.
  const whole = safe < 0 ? Math.ceil(Math.abs(safe)) : Math.floor(safe);
  const sign = safe < 0 && whole > 0 ? '−' : '+';
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  const body = hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${pad2(minutes)}:${pad2(seconds)}`;
  return `T${sign}${body}`;
}

/** Fractional hours between two instants (0 when either is unusable or `from` is after `to`). */
export function hoursBetween(from: TimeInput, to: TimeInput): number {
  const start = toMillis(from);
  const end = toMillis(to);
  if (start === null || end === null) return 0;
  return Math.max(0, (end - start) / HOUR);
}
