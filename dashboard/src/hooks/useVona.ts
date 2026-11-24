'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { findVolcanoLocation } from '@/lib/volcanoData';
import type { VonaResponse } from '@/lib/vona';

/** How often an open panel or map asks again; the route re-reads MAGMA's page every two minutes. */
const POLL_MS = 3 * 60 * 1000;
/** After a failed request to the dashboard's own route. */
const RETRY_MS = 30 * 1000;

export interface VonaFeed {
  /** The route's latest answer, or null before the first one arrived. */
  data: VonaResponse | null;
  /** The last request to the dashboard's route failed; `data`, if any, is from an earlier request. */
  failed: boolean;
}

/** One poll per volcano, shared by every component on the page that asks for it. */
interface Channel {
  url: string;
  snapshot: VonaFeed;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  /** When the last request settled (epoch ms); 0 before the first. */
  settledAt: number;
}

const IDLE: VonaFeed = { data: null, failed: false };
const channels = new Map<string, Channel>();

function channelFor(volcano: string): Channel {
  let channel = channels.get(volcano);
  if (!channel) {
    channel = {
      url: `/api/realtime/vona?volcano=${encodeURIComponent(volcano)}`,
      snapshot: IDLE,
      listeners: new Set(),
      timer: null,
      inFlight: false,
      settledAt: 0,
    };
    channels.set(volcano, channel);
  }
  return channel;
}

function schedule(channel: Channel, delayMs: number) {
  if (channel.timer) clearTimeout(channel.timer);
  channel.timer = null;
  // Nobody is looking: polling stops, and resumes on schedule when someone subscribes again.
  if (channel.listeners.size === 0) return;
  channel.timer = setTimeout(() => {
    channel.timer = null;
    void poll(channel);
  }, Math.max(0, delayMs));
}

async function poll(channel: Channel) {
  if (channel.inFlight) return;
  channel.inFlight = true;
  let next = POLL_MS;
  try {
    const response = await fetch(channel.url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`vona -> ${response.status}`);
    const data = (await response.json()) as VonaResponse;
    channel.snapshot = { data, failed: false };
  } catch {
    channel.snapshot = { data: channel.snapshot.data, failed: true };
    next = RETRY_MS;
  }
  channel.inFlight = false;
  channel.settledAt = Date.now();
  channel.listeners.forEach((listener) => listener());
  schedule(channel, next);
}

function subscribeChannel(channel: Channel, listener: () => void): () => void {
  channel.listeners.add(listener);
  if (channel.listeners.size === 1 && !channel.inFlight && !channel.timer) {
    const interval = channel.snapshot.failed ? RETRY_MS : POLL_MS;
    const dueInMs = channel.settledAt === 0 ? 0 : channel.settledAt + interval - Date.now();
    if (dueInMs <= 0) void poll(channel);
    else schedule(channel, dueInMs);
  }
  return () => {
    channel.listeners.delete(listener);
    if (channel.listeners.size === 0 && channel.timer) {
      clearTimeout(channel.timer);
      channel.timer = null;
    }
  };
}

const noop = () => {};

/**
 * PVMBG's VONAs from MAGMA Indonesia, with the newest one for a catalogue volcano, from the
 * dashboard's own route. Every component asking for the same volcano shares one request and
 * one poll, so the volcano panel and the map never ask twice. Pass null to ask for nothing.
 */
export function useVona(volcanoName: string | null | undefined): VonaFeed {
  const volcano = volcanoName ? (findVolcanoLocation(volcanoName)?.name ?? null) : null;
  const subscribe = useCallback(
    (listener: () => void) => (volcano ? subscribeChannel(channelFor(volcano), listener) : noop),
    [volcano]
  );
  const getSnapshot = useCallback(() => (volcano ? channelFor(volcano).snapshot : IDLE), [volcano]);
  return useSyncExternalStore(subscribe, getSnapshot, () => IDLE);
}
