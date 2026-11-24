/**
 * Sends push messages with the dashboard's VAPID keys (`VAPID_PUBLIC_KEY`,
 * `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in the server's environment). Without the keys push is
 * simply not offered: the browser then notifies only while a dashboard tab is open.
 */

import webpush from 'web-push';
import type { PushSubscriptionData } from '@/lib/pushAlerts';

interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

let configured: VapidConfig | null | undefined;

function vapid(): VapidConfig | null {
  if (configured !== undefined) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@example.com';
  configured = null;
  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      configured = { publicKey, privateKey, subject };
    } catch {
      // malformed keys: push stays off rather than failing on every send
      configured = null;
    }
  }
  return configured;
}

/** The public key browsers subscribe with, or null when push is not set up on this server. */
export function vapidPublicKey(): string | null {
  return vapid()?.publicKey ?? null;
}

export type PushOutcome = 'sent' | 'gone' | 'failed';

/**
 * Sends one message. `gone` means the push service no longer knows the subscription (the
 * reader turned notifications off in the browser, or it expired): the caller removes it.
 */
export async function sendPush(
  subscription: PushSubscriptionData,
  message: string,
  options: { urgent: boolean; ttlSeconds: number }
): Promise<PushOutcome> {
  if (!vapid()) return 'failed';
  try {
    await webpush.sendNotification(subscription, message, {
      TTL: options.ttlSeconds,
      urgency: options.urgent ? 'high' : 'normal',
      timeout: 10_000,
    });
    return 'sent';
  } catch (error) {
    const { statusCode, body } = error as { statusCode?: number; body?: unknown };
    if (statusCode === 404 || statusCode === 410) return 'gone';
    // The push address is a secret of the reader's browser: only its host goes to the log.
    console.warn(
      `Web Push: kirim ke ${new URL(subscription.endpoint).host} gagal (${statusCode ?? 'tanpa status'}):`,
      typeof body === 'string' ? body.slice(0, 200) : error instanceof Error ? error.message : error
    );
    return 'failed';
  }
}
