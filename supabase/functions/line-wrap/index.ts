// Line-Wrap Edge Function using Vertex AI with Gemini
// Wraps Thai text at 80 characters without splitting words

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CHARS_PER_LINE = 70

// Service Account credentials from environment
const SERVICE_ACCOUNT = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT') || '{}')
const PROJECT_ID = SERVICE_ACCOUNT.project_id || 'tonal-plasma-472503-v8'
const REGION = 'us-central1'

// Generate JWT for Google OAuth2
async function getAccessToken(): Promise<string> {
  const privateKeyPem = SERVICE_ACCOUNT.private_key
  if (!privateKeyPem) {
    throw new Error('Service Account private key not found')
  }

  // Parse PEM private key
  const pemHeader = "-----BEGIN PRIVATE KEY-----"
  const pemFooter = "-----END PRIVATE KEY-----"
  const pemContents = privateKeyPem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: SERVICE_ACCOUNT.client_email,
    sub: SERVICE_ACCOUNT.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform'
  }

  // Create JWT
  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    payload,
    cryptoKey
  )

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    throw new Error(`Failed to get access token: ${error}`)
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

// Call Vertex AI Gemini for line-wrapping
async function wrapThaiText(text: string): Promise<string> {
  const accessToken = await getAccessToken()

  const endpoint = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/gemini-2.5-flash:generateContent`

  const prompt = `จัดรูปแบบข้อความภาษาไทยต่อไปนี้ให้มีความยาวไม่เกิน ${CHARS_PER_LINE} ตัวอักษรต่อบรรทัด
(ไม่นับวรรณยุกต์: ่ ้ ๊ ๋ และสระลอย: ิ ี ึ ื ุ ู ็ ั) โดย:
1. ตัดคำให้ถูกต้องตามหลักภาษาไทย (ห้ามตัดกลางคำ เช่น "โรงเรียน" ห้ามแยกเป็น "โรงเ" + "รียน")
2. เมื่อถึงความยาวที่กำหนดและจะตัดกลางคำ ให้ย้ายทั้งคำไปบรรทัดใหม่
3. คืนค่าเฉพาะข้อความที่จัดแล้ว ไม่ต้องมีคำอธิบายหรือข้อความอื่น
4. รักษาการขึ้นบรรทัดใหม่เดิมที่มีอยู่ในข้อความ

ข้อความ:
${text}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096
      }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Vertex AI error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || text
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text } = await req.json()

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Text is required'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log(`📝 Wrapping text (${text.length} chars)`)

    const wrapped = await wrapThaiText(text)

    console.log(`✅ Line-wrap complete`)

    return new Response(
      JSON.stringify({
        success: true,
        original: text,
        wrapped: wrapped
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('❌ Line-wrap error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
