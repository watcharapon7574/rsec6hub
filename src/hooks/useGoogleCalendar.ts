import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  colorId?: string;
  color?: string;       // hex bg color from Google Calendar
  calendarName?: string; // which calendar this event belongs to
}

interface UseGoogleCalendarOptions {
  month?: string; // YYYY-MM format
  refetchInterval?: number; // ms, default 5 minutes
}

const FUNCTION_URL = 'https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/google-calendar';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MzQ3MTcsImV4cCI6MjA2NjQxMDcxN30.m0RHqLl6RmM5rTN-TU3YrcvHNpSB9FnH_XN_Y3uhhRc';

const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry {
  events: CalendarEvent[];
  fetchedAt: number;
}

// Module-level cache shared across hook instances and remounts
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CalendarEvent[]>>();

async function fetchFromNetwork(month: string | undefined): Promise<CalendarEvent[]> {
  const url = new URL(FUNCTION_URL);
  if (month) url.searchParams.set('month', month);

  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${session?.access_token || ANON_KEY}`,
      'apikey': ANON_KEY,
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result.events || [];
}

function getOrFetch(cacheKey: string, month: string | undefined, force: boolean): Promise<CalendarEvent[]> {
  const cached = cache.get(cacheKey);
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return Promise.resolve(cached.events);
  }
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const p = fetchFromNetwork(month)
    .then((evts) => {
      cache.set(cacheKey, { events: evts, fetchedAt: Date.now() });
      return evts;
    })
    .finally(() => {
      inFlight.delete(cacheKey);
    });
  inFlight.set(cacheKey, p);
  return p;
}

export function useGoogleCalendar({ month, refetchInterval = 5 * 60 * 1000 }: UseGoogleCalendarOptions = {}) {
  const cacheKey = month || '_default';
  const initial = cache.get(cacheKey);

  const [events, setEvents] = useState<CalendarEvent[]>(initial?.events ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  // Track the latest key to discard stale responses after the user navigates
  const currentKeyRef = useRef(cacheKey);
  currentKeyRef.current = cacheKey;

  const refetch = useCallback(() => {
    void runFetch(cacheKey, month, true, currentKeyRef, setEvents, setLoading, setError);
  }, [cacheKey, month]);

  useEffect(() => {
    // Hydrate immediately from cache when the key changes
    const cached = cache.get(cacheKey);
    if (cached) {
      setEvents(cached.events);
      setLoading(false);
    } else {
      setEvents([]);
      setLoading(true);
    }

    void runFetch(cacheKey, month, false, currentKeyRef, setEvents, setLoading, setError);

    const interval = setInterval(() => {
      void runFetch(cacheKey, month, true, currentKeyRef, setEvents, setLoading, setError);
    }, refetchInterval);

    const onFocus = () => {
      void runFetch(cacheKey, month, false, currentKeyRef, setEvents, setLoading, setError);
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [cacheKey, month, refetchInterval]);

  return { events, loading, error, refetch };
}

async function runFetch(
  cacheKey: string,
  month: string | undefined,
  force: boolean,
  currentKeyRef: React.MutableRefObject<string>,
  setEvents: (e: CalendarEvent[]) => void,
  setLoading: (b: boolean) => void,
  setError: (e: string | null) => void,
): Promise<void> {
  try {
    setError(null);
    const evts = await getOrFetch(cacheKey, month, force);
    // Drop stale response if the user navigated to a different month
    if (currentKeyRef.current !== cacheKey) return;
    setEvents(evts);
  } catch (err: any) {
    if (currentKeyRef.current !== cacheKey) return;
    console.error('Failed to fetch calendar:', err);
    setError(err.message);
  } finally {
    if (currentKeyRef.current === cacheKey) setLoading(false);
  }
}
