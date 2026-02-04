// Grammar Check Edge Function using Vertex AI with Gemini
// Uses Google Cloud Service Account for authentication

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GrammarCheckRequest {
  text: string
  field_label?: string
}

interface GrammarCheckResponse {
  success: boolean
  original: string
  corrected: string
  changes: Array<{
    original: string
    corrected: string
    reason: string
  }>
  error?: string
}

// Service Account credentials from environment
const SERVICE_ACCOUNT = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT') || '{}')
const PROJECT_ID = SERVICE_ACCOUNT.project_id || 'tonal-plasma-472503-v8'
const REGION = 'us-central1' // US region

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

// Call Vertex AI Gemini
async function callVertexAI(text: string, fieldLabel: string): Promise<{ corrected: string, changes: any[] }> {
  const accessToken = await getAccessToken()

  const endpoint = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/gemini-2.5-flash:generateContent`

  const prompt = `ตรวจสอบคำสะกดผิดในข้อความนี้ (${fieldLabel}):

"${text}"

กฎสำคัญ:
1. แก้เฉพาะ "คำสะกดผิด" เท่านั้น เช่น "เเละ" → "และ", "เปน" → "เป็น"
2. ห้ามเปลี่ยนสำนวน ห้ามปรับประโยค ห้ามเปลี่ยนคำที่ถูกต้องแล้ว
3. original และ corrected ต้องเป็นคำสั้นๆ (1-3 คำ) ไม่ใช่ทั้งประโยค
4. ถ้าไม่มีคำผิด ให้ changes เป็น []

ตอบ JSON:
{
  "corrected": "ข้อความที่แก้แล้ว",
  "changes": [
    {"original": "คำผิด", "corrected": "คำถูก", "reason": "สะกดผิด"}
  ]
}`

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
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Vertex AI error: ${response.status} - ${error}`)
  }

  const data = await response.json()

  // Extract text from response
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  try {
    // Parse JSON response
    const result = JSON.parse(responseText)
    return {
      corrected: result.corrected || text,
      changes: result.changes || []
    }
  } catch {
    // If JSON parsing fails, return original text
    console.error('Failed to parse AI response:', responseText)
    return { corrected: text, changes: [] }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, field_label = 'ข้อความ' }: GrammarCheckRequest = await req.json()

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Text is required'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log(`📝 Checking grammar for: ${field_label} (${text.length} chars)`)

    const result = await callVertexAI(text, field_label)

    console.log(`✅ Grammar check complete: ${result.changes.length} changes`)

    return new Response(
      JSON.stringify({
        success: true,
        original: text,
        corrected: result.corrected,
        changes: result.changes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('❌ Grammar check error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
