// @ts-nocheck
// Synthetic health check — pings the OTP send endpoint with a bogus phone
// to exercise the rate-limit + profile-lookup DB path. Records result in
// health_check_log and pings Telegram on healthy→unhealthy state transitions.
//
// Triggered by pg_cron every 5 minutes (see migration
// 20260526070100_health_check_cron.sql).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// A bogus phone that exists in no profile — hits DB (rate-limit + profile
// lookup) but returns 400 user_not_found quickly when system is healthy.
const PROBE_PHONE = '+660000000000'

// Thresholds. If you change LATENCY_BUDGET_MS, also revisit the bail-out
// values in telegram-otp/index.ts so the budget here is wider than what
// the function itself enforces.
const LATENCY_BUDGET_MS = 5000
const HEALTHY_HTTP_STATUSES = [400] // 400 user_not_found is the expected healthy answer

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''

  const admin = createClient(supabaseUrl, serviceKey)

  // 1. Probe send-otp
  const start = Date.now()
  let statusCode = 0
  let bodyText = ''
  let networkError: string | null = null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LATENCY_BUDGET_MS + 5000)
    const resp = await fetch(`${supabaseUrl}/functions/v1/telegram-otp/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ phone: PROBE_PHONE }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    statusCode = resp.status
    bodyText = (await resp.text()).slice(0, 200)
  } catch (err) {
    networkError = (err as Error).message
  }
  const latencyMs = Date.now() - start

  const healthy =
    networkError === null &&
    HEALTHY_HTTP_STATUSES.includes(statusCode) &&
    latencyMs <= LATENCY_BUDGET_MS

  // 2. Read previous state for dedupe — was the last run healthy?
  const { data: lastRow } = await admin
    .from('health_check_log')
    .select('healthy')
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const wasHealthy = lastRow?.healthy ?? true // assume healthy if no history

  // 3. Insert this run
  await admin.from('health_check_log').insert({
    status_code: statusCode,
    latency_ms: latencyMs,
    healthy,
    details: { body: bodyText, network_error: networkError },
  })

  // 4. Alert on state transition healthy → unhealthy
  if (wasHealthy && !healthy && botToken) {
    const { data: recipients } = await admin
      .from('admin_otp_recipients')
      .select('telegram_chat_id, recipient_name')
      .eq('is_active', true)

    const reason = networkError
      ? `network error: ${networkError}`
      : !HEALTHY_HTTP_STATUSES.includes(statusCode)
        ? `unexpected HTTP ${statusCode}`
        : `slow: ${latencyMs}ms > ${LATENCY_BUDGET_MS}ms`

    const msg = `🚨 <b>FastDoc health alert</b>\n\nOTP endpoint became unhealthy.\n\n• Reason: ${reason}\n• Status: ${statusCode}\n• Latency: ${latencyMs}ms\n• Body: <code>${bodyText.replace(/[<>&]/g, '')}</code>\n\nCheck Supabase Dashboard.`

    for (const r of recipients ?? []) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: r.telegram_chat_id,
            text: msg,
            parse_mode: 'HTML',
          }),
        })
      } catch (_) { /* ignore — alert is best effort */ }
    }
  }

  // Recovery alert: unhealthy → healthy
  if (!wasHealthy && healthy && botToken) {
    const { data: recipients } = await admin
      .from('admin_otp_recipients')
      .select('telegram_chat_id')
      .eq('is_active', true)
    const msg = `✅ <b>FastDoc recovered</b>\n\nOTP endpoint healthy again (${latencyMs}ms, HTTP ${statusCode}).`
    for (const r of recipients ?? []) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: r.telegram_chat_id,
            text: msg,
            parse_mode: 'HTML',
          }),
        })
      } catch (_) { /* ignore */ }
    }
  }

  return new Response(
    JSON.stringify({ healthy, statusCode, latencyMs, transition: wasHealthy !== healthy }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
