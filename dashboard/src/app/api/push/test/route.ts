import { pushMessage, validPushEndpoint } from '@/lib/pushAlerts';
import { noStore, readJsonBody } from '@/lib/server/pushRequest';
import { sendPush, vapidPublicKey } from '@/lib/server/pushSender';
import { listPushRecords, updatePushRecords } from '@/lib/server/pushStore';

export const dynamic = 'force-dynamic';

/** One test message per subscription in this long, however often the button is pressed. */
const TEST_GAP_MS = 20_000;
const lastTest = new Map<string, number>();

/**
 * Sends a test message through the whole push path — this server, the browser's push service
 * and the service worker — to a subscription this server already holds.
 */
export async function POST(request: Request) {
  if (!vapidPublicKey()) return noStore({ error: 'push-not-configured' }, { status: 503 });
  const body = await readJsonBody(request);
  if ('error' in body) return body.error;
  const endpoint = validPushEndpoint((body.value as { endpoint?: unknown } | null)?.endpoint);
  if (!endpoint) return noStore({ error: 'invalid-endpoint' }, { status: 400 });

  const record = (await listPushRecords()).find((item) => item.subscription.endpoint === endpoint);
  if (!record) return noStore({ error: 'unknown-subscription' }, { status: 404 });
  const now = Date.now();
  if (now - (lastTest.get(endpoint) ?? 0) < TEST_GAP_MS) return noStore({ error: 'too-soon' }, { status: 429 });
  lastTest.set(endpoint, now);

  const outcome = await sendPush(
    record.subscription,
    pushMessage({
      id: `test:push:${now}`,
      kind: 'quake',
      title: 'Notifikasi uji (push) — INATEWS SENTINEL',
      body: 'Ini hanya uji coba, bukan kejadian. Notifikasi seperti ini dikirim server dasbor, juga saat tab ditutup.',
      sticky: false,
      atMs: now,
      distanceKm: null,
    }),
    { urgent: false, ttlSeconds: 300 }
  );
  if (outcome === 'gone') {
    await updatePushRecords((records) => ({
      records: records.filter((item) => item.subscription.endpoint !== endpoint),
      result: undefined,
    }));
    return noStore({ error: 'subscription-gone' }, { status: 410 });
  }
  return outcome === 'sent' ? noStore({ ok: true }) : noStore({ error: 'send-failed' }, { status: 502 });
}
