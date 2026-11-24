import { timingSafeEqual } from 'node:crypto';
import { noStore } from '@/lib/server/pushRequest';
import { runPushCheck } from '@/lib/server/pushCheck';

export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * One check of the feeds for the push subscribers, for a host without a lasting server process
 * (a scheduler calls it with `Authorization: Bearer $CRON_SECRET`). Not available without the secret.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return noStore({ error: 'not-found' }, { status: 404 });
  const result = await runPushCheck();
  return noStore(result ?? { skipped: true });
}
