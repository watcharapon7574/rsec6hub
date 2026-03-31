// @ts-nocheck
// This file runs in Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_CALENDAR_API_KEY') || 'AIzaSyACXC0P_lc2SCv29IntKtG_GjddGpG1yNI'

// Google Calendar API colorId → hex color mapping
// https://developers.google.com/calendar/api/v3/reference/colors
const COLOR_MAP: Record<string, { bg: string; fg: string; name: string }> = {
  '1':  { bg: '#7986CB', fg: '#1d1d1d', name: 'lavender' },
  '2':  { bg: '#33B679', fg: '#1d1d1d', name: 'sage' },
  '3':  { bg: '#8E24AA', fg: '#ffffff', name: 'grape' },
  '4':  { bg: '#E67C73', fg: '#1d1d1d', name: 'flamingo' },
  '5':  { bg: '#F6BF26', fg: '#1d1d1d', name: 'banana' },
  '6':  { bg: '#F4511E', fg: '#ffffff', name: 'tangerine' },
  '7':  { bg: '#039BE5', fg: '#ffffff', name: 'peacock' },
  '8':  { bg: '#616161', fg: '#ffffff', name: 'graphite' },
  '9':  { bg: '#3F51B5', fg: '#ffffff', name: 'blueberry' },
  '10': { bg: '#0B8043', fg: '#ffffff', name: 'basil' },
  '11': { bg: '#D50000', fg: '#ffffff', name: 'tomato' },
}

// Default calendar color (when no colorId is set on event)
const DEFAULT_COLOR = { bg: '#039BE5', fg: '#ffffff', name: 'default' }

interface CalendarEvent {
  id: string
  summary: string
  description: string
  location: string
  start: string
  end: string
  allDay: boolean
  colorId: string
  color: string      // hex bg color
  colorName: string   // human-readable name
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const calendarId = url.searchParams.get('calendarId') || 'maplopburi6@gmail.com'
    const month = url.searchParams.get('month') // YYYY-MM

    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_CALENDAR_API_KEY not configured')
    }

    // Build time range for the month
    let timeMin: string
    let timeMax: string
    if (month) {
      const [y, m] = month.split('-').map(Number)
      timeMin = new Date(y, m - 1, 1).toISOString()
      timeMax = new Date(y, m, 1).toISOString()
    } else {
      // Default: current month ± 1 month
      const now = new Date()
      timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString()
    }

    const apiUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
    apiUrl.searchParams.set('key', GOOGLE_API_KEY)
    apiUrl.searchParams.set('timeMin', timeMin)
    apiUrl.searchParams.set('timeMax', timeMax)
    apiUrl.searchParams.set('singleEvents', 'true')
    apiUrl.searchParams.set('orderBy', 'startTime')
    apiUrl.searchParams.set('maxResults', '250')

    const response = await fetch(apiUrl.toString())

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Google API error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const items = data.items || []

    const events: CalendarEvent[] = items.map((item: any) => {
      const colorId = item.colorId || ''
      const colorInfo = COLOR_MAP[colorId] || DEFAULT_COLOR

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
        color: colorInfo.bg,
        colorName: colorInfo.name,
      }
    })

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
