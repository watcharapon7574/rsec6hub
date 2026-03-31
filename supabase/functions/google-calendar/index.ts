// @ts-nocheck
// This file runs in Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CalendarEvent {
  id: string
  summary: string
  description: string
  location: string
  start: string
  end: string
  allDay: boolean
}

function parseICS(icsText: string): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const lines = icsText.replace(/\r\n /g, '').replace(/\r/g, '').split('\n')

  let inEvent = false
  let current: Partial<CalendarEvent> = {}

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      inEvent = false
      if (current.summary) {
        events.push({
          id: current.id || crypto.randomUUID(),
          summary: current.summary || '',
          description: current.description || '',
          location: current.location || '',
          start: current.start || '',
          end: current.end || '',
          allDay: current.allDay ?? false,
        })
      }
      continue
    }
    if (!inEvent) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const keyPart = line.substring(0, colonIdx)
    const value = line.substring(colonIdx + 1).replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\\\/g, '\\')
    const key = keyPart.split(';')[0]

    switch (key) {
      case 'UID':
        current.id = value
        break
      case 'SUMMARY':
        current.summary = value
        break
      case 'DESCRIPTION':
        current.description = value
        break
      case 'LOCATION':
        current.location = value
        break
      case 'DTSTART': {
        // VALUE=DATE means all-day event (YYYYMMDD)
        // Otherwise it's a datetime (YYYYMMDDTHHMMSSZ or with TZID)
        if (keyPart.includes('VALUE=DATE') || value.length === 8) {
          current.allDay = true
          current.start = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
        } else {
          current.allDay = false
          // Parse YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
          const d = value.replace('Z', '')
          current.start = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}`
          if (value.endsWith('Z')) current.start += 'Z'
        }
        break
      }
      case 'DTEND': {
        if (keyPart.includes('VALUE=DATE') || value.length === 8) {
          current.end = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
        } else {
          const d = value.replace('Z', '')
          current.end = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}`
          if (value.endsWith('Z')) current.end += 'Z'
        }
        break
      }
    }
  }

  // Sort by start date descending (newest first)
  events.sort((a, b) => b.start.localeCompare(a.start))

  return events
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const calendarId = url.searchParams.get('calendarId') || 'maplopburi6@gmail.com'
    const month = url.searchParams.get('month') // optional: YYYY-MM to filter

    const icsUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`

    const response = await fetch(icsUrl, {
      headers: { 'User-Agent': 'RSEC6Hub/1.0' },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status}`)
    }

    const icsText = await response.text()
    let events = parseICS(icsText)

    // Filter by month if specified
    if (month) {
      events = events.filter(e => e.start.startsWith(month))
    }

    return new Response(JSON.stringify({ events, count: events.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
