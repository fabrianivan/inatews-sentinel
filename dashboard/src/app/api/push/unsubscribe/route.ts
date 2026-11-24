import { validPushEndpoint } from '@/lib/pushAlerts';
import { noStore, readJsonBody } from '@/lib/server/pushRequest';
import { updatePushRecords } from '@/lib/server/pushStore';

export const dynamic = 'force-dynamic';

/** Deletes a browser's subscription and everything kept with it. The push address itself is the key. */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if ('error' in body) return body.error;
  const endpoint = validPushEndpoint((body.value as { endpoint?: unknown } | null)?.endpoint);
  if (!endpoint) return noStore({ error: 'invalid-endpoint' }, { status: 400 });
  await updatePushRecords((records) => {
    const next = records.filter((record) => record.subscription.endpoint !== endpoint);
    return { records: next.length === records.length ? records : next, result: undefined };
  });
  return noStore({ ok: true });
}
