import { noStore } from '@/lib/server/pushRequest';
import { vapidPublicKey } from '@/lib/server/pushSender';

export const dynamic = 'force-dynamic';

/** The public VAPID key browsers subscribe with; 503 when this server has no push set up. */
export async function GET() {
  const publicKey = vapidPublicKey();
  return publicKey ? noStore({ publicKey }) : noStore({ error: 'push-not-configured' }, { status: 503 });
}
