/**
 * Where the server keeps its push subscriptions: one JSON file on the server's disk
 * (`.data/push-subscriptions.json`, or `PUSH_STORE_PATH`). Writes go through one queue and
 * replace the file atomically, so a crash never leaves half a file.
 *
 * This suits a long-running server (`next start`, Docker with a volume on `.data`). A
 * serverless host has no lasting disk: there the browsers re-register on their next visit,
 * but nothing is pushed in between — such a deployment needs a database instead.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { EMPTY_LEDGER, parseLedger } from '@/lib/localAlerts';
import { parsePushSettings, parsePushSubscription, type PushRecord } from '@/lib/pushAlerts';

// Runtime data, not part of the build: the file calls below opt out of output tracing.
const STORE_PATH = process.env.PUSH_STORE_PATH || path.join(process.cwd(), '.data', 'push-subscriptions.json');

let queue: Promise<unknown> = Promise.resolve();

/** Runs `task` after every earlier one: reads and writes of the file never interleave. */
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

function parseRecord(value: unknown): PushRecord | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const subscription = parsePushSubscription(record.subscription);
  // Stored settings went through the same check when they were saved; a point is already rounded.
  const settings = parsePushSettings(record.settings);
  if (!subscription || !settings) return null;
  const number = (key: string) => (typeof record[key] === 'number' && Number.isFinite(record[key]) ? (record[key] as number) : 0);
  return {
    subscription,
    settings,
    ledger: record.ledger ? parseLedger(JSON.stringify(record.ledger)) : EMPTY_LEDGER,
    baseline: record.baseline === true,
    createdAt: number('createdAt'),
    updatedAt: number('updatedAt'),
  };
}

async function readAll(): Promise<PushRecord[]> {
  try {
    const value: unknown = JSON.parse(await readFile(/*turbopackIgnore: true*/ STORE_PATH, 'utf8'));
    return Array.isArray(value) ? value.map(parseRecord).filter((record): record is PushRecord => record !== null) : [];
  } catch {
    return [];
  }
}

async function writeAll(records: PushRecord[]): Promise<void> {
  await mkdir(/*turbopackIgnore: true*/ path.dirname(STORE_PATH), { recursive: true });
  const temporary = `${STORE_PATH}.${process.pid}.tmp`;
  await writeFile(/*turbopackIgnore: true*/ temporary, JSON.stringify(records), { encoding: 'utf8', mode: 0o600 });
  await rename(/*turbopackIgnore: true*/ temporary, /*turbopackIgnore: true*/ STORE_PATH);
}

export function listPushRecords(): Promise<PushRecord[]> {
  return serialized(readAll);
}

/**
 * Changes the stored records in one step: `change` gets the current list and returns the new
 * one (or the same list for no change), plus a result for the caller.
 */
export function updatePushRecords<T>(change: (records: PushRecord[]) => { records: PushRecord[]; result: T }): Promise<T> {
  return serialized(async () => {
    const current = await readAll();
    const { records, result } = change(current);
    if (records !== current) await writeAll(records);
    return result;
  });
}
