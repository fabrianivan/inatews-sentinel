/**
 * The server's own look at the feeds, for the subscribers of Web Push: every minute it reads
 * BMKG and MAGMA (through the same cached readers as the dashboard's routes), decides per
 * subscriber with the open tab's rules, and sends what is new. Started once per server by
 * `src/instrumentation.ts`; a host without a lasting process can call `/api/push/check`
 * from a scheduler instead.
 */

import { alertsForSubscriber, pushMessage, type PushFeeds } from '@/lib/pushAlerts';
import { fetchRealtimeEarthquakesData, fetchRealtimeVolcanoesData } from '@/lib/telemetry';
import { updateTsunamiNotice, type TsunamiNotice } from '@/lib/tsunamiNotice';
import type { AlertLedger } from '@/lib/localAlerts';
import { listPushRecords, updatePushRecords } from './pushStore';
import { sendPush, vapidPublicKey } from './pushSender';

const CHECK_INTERVAL_MS = 60_000;
const FIRST_CHECK_DELAY_MS = 15_000;
/** Subscribers handled at once, so one slow push service does not hold up the rest. */
const CONCURRENCY = 8;

/** BMKG's statement, latched across checks exactly as the page latches it. */
let notice: TsunamiNotice | null = null;
let running = false;

export interface PushCheckResult {
  subscribers: number;
  sent: number;
  removed: number;
}

interface Outcome {
  updatedAt: number;
  ledger: AlertLedger;
  baseline: boolean;
  gone: boolean;
}

export async function runPushCheck(nowMs = Date.now()): Promise<PushCheckResult | null> {
  if (running || !vapidPublicKey()) return null;
  running = true;
  try {
    const records = await listPushRecords();
    if (records.length === 0) return { subscribers: 0, sent: 0, removed: 0 };

    const fetchedAtMs = Date.now();
    const [quakes, volcanoReports] = await Promise.all([fetchRealtimeEarthquakesData(), fetchRealtimeVolcanoesData()]);
    const recent = Array.isArray(quakes.recent_bmkg) ? quakes.recent_bmkg : [];
    notice = updateTsunamiNotice(notice, quakes.latest_bmkg, recent, nowMs, fetchedAtMs);
    const feeds: PushFeeds = { latest: quakes.latest_bmkg, recent, notice, volcanoReports };

    const outcomes = new Map<string, Outcome>();
    let sent = 0;
    for (let start = 0; start < records.length; start += CONCURRENCY) {
      await Promise.all(
        records.slice(start, start + CONCURRENCY).map(async (record) => {
          const { fresh, ledger, baseline } = alertsForSubscriber(record, feeds, nowMs);
          let gone = false;
          for (const alert of fresh) {
            const outcome = await sendPush(record.subscription, pushMessage(alert), {
              urgent: alert.kind === 'tsunami',
              ttlSeconds: alert.kind === 'tsunami' ? 6 * 60 * 60 : 60 * 60,
            });
            if (outcome === 'gone') {
              gone = true;
              break;
            }
            if (outcome === 'sent') {
              sent += 1;
              continue;
            }
            // Not delivered: left out of the record of what was sent, so the next check tries again.
            delete ledger.seen[alert.id];
            if (alert.throttleKey) {
              const before = record.ledger.lastByKey[alert.throttleKey];
              if (before === undefined) delete ledger.lastByKey[alert.throttleKey];
              else ledger.lastByKey[alert.throttleKey] = before;
            }
          }
          outcomes.set(record.subscription.endpoint, { updatedAt: record.updatedAt, ledger, baseline, gone });
        })
      );
    }

    let removed = 0;
    await updatePushRecords((current) => {
      const next = current.flatMap((record) => {
        const outcome = outcomes.get(record.subscription.endpoint);
        // Subscribed or changed while this check ran: its new settings stand as they are.
        if (!outcome || outcome.updatedAt !== record.updatedAt) return [record];
        if (outcome.gone) {
          removed += 1;
          return [];
        }
        return [{ ...record, ledger: outcome.ledger, baseline: outcome.baseline }];
      });
      return { records: next, result: undefined };
    });
    return { subscribers: records.length, sent, removed };
  } finally {
    running = false;
  }
}

const SCHEDULER_KEY = Symbol.for('inatews-sentinel.push-scheduler');

/** Starts the minute-by-minute check once per server process (development reloads included). */
export function startPushScheduler(): void {
  const registry = globalThis as unknown as Record<symbol, unknown>;
  if (registry[SCHEDULER_KEY] || !vapidPublicKey()) return;
  const tick = () => {
    runPushCheck().catch(() => {
      // a failed check is retried on the next tick; the feeds' own readers keep their last good copy
    });
  };
  const first = setTimeout(tick, FIRST_CHECK_DELAY_MS);
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  first.unref?.();
  timer.unref?.();
  registry[SCHEDULER_KEY] = timer;
}
