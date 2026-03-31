import { useState, useEffect, useCallback } from 'react';
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

export function useGoogleCalendar({ month, refetchInterval = 5 * 60 * 1000 }: UseGoogleCalendarOptions = {}) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setError(null);

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

      setEvents(result.events || []);
    } catch (err: any) {
      console.error('Failed to fetch calendar:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchEvents();

    const interval = setInterval(fetchEvents, refetchInterval);
    const onFocus = () => fetchEvents();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchEvents, refetchInterval]);

  return { events, loading, error, refetch: fetchEvents };
}
