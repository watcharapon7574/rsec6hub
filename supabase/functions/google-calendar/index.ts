// @ts-nocheck
// This file runs in Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_CALENDAR_API_KEY') || 'AIzaSyACXC0P_lc2SCv29IntKtG_GjddGpG1yNI'

// Multiple calendars with their default colors
const CALENDARS = [
  { id: 'maplopburi6@gmail.com', color: '#039BE5', name: 'ศูนย์ฯ เขต 6' },
  { id: 'rsec01@ssnb.ac.th', color: '#D50000', name: 'สำนักบริหารงาน' },
]

// Google Calendar API colorId → hex color mapping
const COLOR_MAP: Record<string, string> = {
  '1':  '#7986CB', // lavender
  '2':  '#33B679', // sage
  '3':  '#8E24AA', // grape
  '4':  '#E67C73', // flamingo
  '5':  '#F6BF26', // banana
  '6':  '#F4511E', // tangerine
  '7':  '#039BE5', // peacock
  '8':  '#616161', // graphite
  '9':  '#3F51B5', // blueberry
  '10': '#0B8043', // basil
  '11': '#D50000', // tomato
}

interface CalendarEvent {
  id: string
  summary: string
  description: string
  location: string
  start: string
  end: string
  allDay: boolean
  colorId: string
  color: string
  calendarName: string
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/  +/g, ' ')
    .trim()
}

async function fetchCalendarEvents(
  calendarId: string,
  defaultColor: string,
  calendarName: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const apiUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
  apiUrl.searchParams.set('key', GOOGLE_API_KEY)
  apiUrl.searchParams.set('timeMin', timeMin)
  apiUrl.searchParams.set('timeMax', timeMax)
  apiUrl.searchParams.set('singleEvents', 'true')
  apiUrl.searchParams.set('orderBy', 'startTime')
  apiUrl.searchParams.set('maxResults', '250')

  const response = await fetch(apiUrl.toString())

  if (!response.ok) {
    console.error(`Failed to fetch ${calendarId}: ${response.status}`)
    return []
  }

  const data = await response.json()
  const items = data.items || []

  return items.map((item: any) => {
    const colorId = item.colorId || ''
    // Use event-specific color if set, otherwise use the calendar's default color
    const color = colorId ? (COLOR_MAP[colorId] || defaultColor) : defaultColor

    const isAllDay = !!item.start?.date
    const start = isAllDay ? item.start.date : (item.start?.dateTime || '')
    const end = isAllDay ? item.end.date : (item.end?.dateTime || '')

    return {
      id: item.id || crypto.randomUUID(),
      summary: stripHtml(item.summary || '(ไม่มีชื่อ)'),
      description: stripHtml(item.description || ''),
      location: item.location || '',
      start,
      end,
      allDay: isAllDay,
      colorId,
      color,
      calendarName,
    }
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const month = url.searchParams.get('month') // YYYY-MM

    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_CALENDAR_API_KEY not configured')
    }

    let timeMin: string
    let timeMax: string
    if (month) {
      const [y, m] = month.split('-').map(Number)
      timeMin = new Date(y, m - 1, 1).toISOString()
      timeMax = new Date(y, m, 1).toISOString()
    } else {
      const now = new Date()
      timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString()
    }

    // Fetch all calendars in parallel
    const results = await Promise.all(
      CALENDARS.map(cal => fetchCalendarEvents(cal.id, cal.color, cal.name, timeMin, timeMax))
    )

    // Merge and sort by start time
    const events = results.flat().sort((a, b) => a.start.localeCompare(b.start))

    return new Response(JSON.stringify({
      events,
      count: events.length,
      calendars: CALENDARS.map(c => ({ name: c.name, color: c.color })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
