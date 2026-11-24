import { EMPTY_LEDGER } from '@/lib/localAlerts';
import { MAX_PUSH_SUBSCRIPTIONS, parseSubscribeRequest, type PushRecord } from '@/lib/pushAlerts';
import { noStore, readJsonBody } from '@/lib/server/pushRequest';
import { vapidPublicKey } from '@/lib/server/pushSender';
import { updatePushRecords } from '@/lib/server/pushStore';

export const dynamic = 'force-dynamic';

/**
 * Saves a browser's push subscription with its notification settings (or moves a renewed
 * subscription onto the record of the one it replaces). Sending the same settings again changes
 * nothing; new settings start from the feed as it is now, so events already on it are not sent.
 */
export async function POST(request: Request) {
  if (!vapidPublicKey()) return noStore({ error: 'push-not-configured' }, { status: 503 });
  const body = await readJsonBody(request);
  if ('error' in body) return body.error;
  const parsed = parseSubscribeRequest(body.value);
  if (!parsed) return noStore({ error: 'invalid-subscription' }, { status: 400 });

  const now = Date.now();
  const endpoint = parsed.subscription.endpoint;
  const result = await updatePushRecords((records) => {
    if (parsed.replaces !== undefined) {
      const previous = records.find((record) => record.subscription.endpoint === parsed.replaces);
      if (!previous) return { records, result: 'unknown' as const };
      const others = records.filter(
        (record) => record.subscription.endpoint !== parsed.replaces && record.subscription.endpoint !== endpoint
      );
      return { records: [...others, { ...previous, subscription: parsed.subscription, updatedAt: now }], result: 'ok' as const };
    }

    const index = records.findIndex((record) => record.subscription.endpoint === endpoint);
    const existing = index >= 0 ? records[index] : null;
    if (!existing && records.length >= MAX_PUSH_SUBSCRIPTIONS) return { records, result: 'full' as const };
    if (
      existing &&
      JSON.stringify(existing.settings) === JSON.stringify(parsed.settings) &&
      existing.subscription.keys.p256dh === parsed.subscription.keys.p256dh &&
      existing.subscription.keys.auth === parsed.subscription.keys.auth
    ) {
      return { records, result: 'ok' as const };
    }
    const record: PushRecord = {
      subscription: parsed.subscription,
      settings: parsed.settings,
      ledger: existing?.ledger ?? EMPTY_LEDGER,
      baseline: true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const next = [...records];
    if (existing) next[index] = record;
    else next.push(record);
    return { records: next, result: 'ok' as const };
  });

  if (result === 'full') return noStore({ error: 'too-many-subscriptions' }, { status: 503 });
  if (result === 'unknown') return noStore({ error: 'unknown-subscription' }, { status: 404 });
  return noStore({ ok: true });
}
