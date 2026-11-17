'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';

interface SSEState<T> {
  data: T | null;
  connected: boolean;
  error: string | null;
}

export function useSSE<T>(endpoint: string): SSEState<T> {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const eventSource = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    const url = `${API_BASE}${endpoint}`;
    const es = new EventSource(url);
    eventSource.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        setData(parsed);
      } catch {
        // ignore parse errors
      }
    };

    // Listen for specific event types
    const eventTypes = ['metrics', 'activity_index', 'event', 'ai_analysis', 'tsunami', 'correlated_alert', 'agent_thought', 'agent_action', 'all'];
    eventTypes.forEach(type => {
      es.addEventListener(type, (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data);
          setData(parsed as T);
        } catch {
          // ignore
        }
      });
    });

    es.onerror = () => {
      setConnected(false);
      setError('Connection lost — reconnecting...');
      es.close();
      
      // Exponential backoff reconnect
      reconnectTimeout.current = setTimeout(() => {
        connect();
      }, 2000);
    };
  }, [endpoint]);

  useEffect(() => {
    connect();

    return () => {
      eventSource.current?.close();
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [connect]);

  return { data, connected, error };
}

export function useMultiSSE(endpoint: string) {
  const [events, setEvents] = useState<Array<{ event: string; data: unknown }>>([]);
  const [connected, setConnected] = useState(false);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const eventSource = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    const url = `${API_BASE}${endpoint}`;
    const es = new EventSource(url);
    eventSource.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    const eventTypes = ['metrics', 'activity_index', 'event', 'ai_analysis', 'tsunami', 'correlated_alert', 'agent_thought', 'agent_action', 'all'];
    eventTypes.forEach(type => {
      es.addEventListener(type, (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data);
          setEvents(prev => {
            const newEvents = [{ event: type, data: parsed }, ...prev];
            return newEvents.slice(0, 100); // Keep last 100
          });
        } catch {
          // ignore
        }
      });
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      reconnectTimeout.current = setTimeout(connect, 2000);
    };
  }, [endpoint]);

  useEffect(() => {
    connect();
    return () => {
      eventSource.current?.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  return { events, connected };
}

async function fetchWithLocalFallback<T>(path: string, init?: RequestInit): Promise<T> {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}${path}`, init);
      if (res.ok) {
        return (await res.json()) as T;
      }
    } catch {
      // fall back to local Next.js API route handler
    }
  }

  const localRes = await fetch(path, init);
  if (!localRes.ok) {
    throw new Error(`Request failed: ${localRes.status}`);
  }
  return (await localRes.json()) as T;
}

export async function triggerSimulation(typeOrPath: string) {
  const path = typeOrPath.startsWith('/')
    ? typeOrPath
    : `/api/simulate/${typeOrPath}`;
  return fetchWithLocalFallback(path, { method: 'POST' });
}

export async function toggleBackendMode(mode: 'real' | 'drill') {
  return fetchWithLocalFallback<{ status: string; mode: string }>('/api/mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
}

export async function fetchStatus(): Promise<unknown> {
  return fetchWithLocalFallback('/api/status');
}

export async function fetchGovernance(): Promise<unknown> {
  return fetchWithLocalFallback('/api/governance');
}

export async function fetchAIProvider(): Promise<{ active: string; model: string; available: string[] }> {
  return fetchWithLocalFallback('/api/ai/provider');
}

export async function switchAIProvider(provider: string): Promise<{ status: string; active: string; model: string }> {
  return fetchWithLocalFallback('/api/ai/provider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
}

export async function fetchAgentState(): Promise<unknown> {
  return fetchWithLocalFallback('/api/agent/state');
}
