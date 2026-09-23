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
    const eventTypes = ['metrics', 'activity_index', 'event', 'tsunami', 'correlated_alert', 'incident_update', 'incident_timeline', 'incident_response', 'connector_alert', 'all'];
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

    const eventTypes = ['metrics', 'activity_index', 'event', 'tsunami', 'correlated_alert', 'incident_update', 'incident_timeline', 'incident_response', 'connector_alert', 'all'];
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

export async function triggerSimulation(typeOrPath: string) {
  const path = typeOrPath.startsWith('/')
    ? typeOrPath
    : `/api/simulate/${typeOrPath}`;
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST' });
  return res.json();
}

export async function fetchStatus(): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/status`);
  return res.json();
}

export async function fetchGovernance(): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/governance`);
  return res.json();
}
