import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// --- Vertex AI auth (same pattern as gemini-proxy) ---

const SERVICE_ACCOUNT = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT') || '{}')
const PROJECT_ID = SERVICE_ACCOUNT.project_id || 'tonal-plasma-472503-v8'
const REGION = 'us-central1'

// --- OpenRouter fallback (for Vertex AI timeouts / rate limits) ---

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || ''
const OPENROUTER_MODEL = Deno.env.get('OPENROUTER_MODEL') || 'google/gemini-2.0-flash-001'
const VERTEX_TIMEOUT_MS = 10_000

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const privateKeyPem = SERVICE_ACCOUNT.private_key
  if (!privateKeyPem) throw new Error('Service Account private key not found')

  const pemContents = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(pemContents), (c: string) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const now = Math.floor(Date.now() / 1000)
  const jwt = await create(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: SERVICE_ACCOUNT.client_email,
      sub: SERVICE_ACCOUNT.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
    },
    cryptoKey
  )

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) throw new Error(`Token error: ${await res.text()}`)
  const data = await res.json()

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 120) * 1000,
  }
  return data.access_token
}

async function callVertexAI(model: string, method: string, body: unknown): Promise<any> {
  const token = await getAccessToken()
  const url = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${model}:${method}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text()
    const err: any = new Error(`Vertex AI ${res.status}: ${errText}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

// --- OpenRouter text generation (fallback) ---

async function callOpenRouter(
  prompt: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }
  const { maxTokens = 200, temperature = 0.1 } = opts
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${errText}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// --- Unified text generation: Vertex primary, OpenRouter fallback on timeout/quota ---

async function generateText(
  prompt: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { maxTokens = 200, temperature = 0.1 } = opts

  const vertexCall = callVertexAI('gemini-2.0-flash-lite', 'generateContent', {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      thinkingConfig: { thinkingBudget: 0 },
    },
  })

  const timeoutCall = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(Object.assign(new Error('Vertex AI client timeout'), { status: 504 })),
      VERTEX_TIMEOUT_MS
    )
  )

  try {
    const data = await Promise.race([vertexCall, timeoutCall])
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  } catch (err: any) {
    const status = err?.status
    const msg = (err?.message || '').toLowerCase()
    const shouldFallback =
      status === 408 || status === 429 || status === 503 || status === 504 ||
      msg.includes('timeout') || msg.includes('timed out') ||
      msg.includes('quota') || msg.includes('resource_exhausted') ||
      msg.includes('overloaded') || msg.includes('unavailable') ||
      msg.includes('deadline')

    if (!shouldFallback) throw err

    console.warn(`[fallback] Vertex AI failed (${err?.message}) — falling back to OpenRouter`)
    return callOpenRouter(prompt, { maxTokens, temperature })
  }
}

// --- Supabase client ---

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// --- Thai Word Segmentation ---

function segmentThai(text: string): string {
  try {
    const segmenter = new Intl.Segmenter('th', { granularity: 'word' })
    return [...segmenter.segment(text)]
      .filter((s: any) => s.isWordLike)
      .map((s: any) => s.segment)
      .join(' ')
  } catch {
    return text
  }
}

// Thai particles + generic government-doc terms that would otherwise create
// false-positive name/tag matches across almost every document
const THAI_STOPWORDS = new Set([
  // particles / function words
  'ของ', 'และ', 'ใน', 'ที่', 'เป็น', 'มี', 'ให้', 'จาก', 'ได้', 'ไป',
  'มา', 'เพื่อ', 'หรือ', 'ก็', 'แต่', 'จะ', 'นี้', 'นั้น', 'กับ', 'แก่',
  'โดย', 'ตาม', 'ถึง', 'การ', 'ความ', 'ทุก', 'อยู่', 'เลย', 'นะ', 'ครับ', 'คะ', 'ค่ะ',
  // generic doc nouns — too common in filenames to be discriminative
  'เอกสาร', 'หนังสือ', 'บันทึก', 'ราชการ', 'เรื่อง', 'ฉบับ', 'แบบ', 'เลขที่',
])

// Returns deduplicated meaningful tokens from a query.
// Used for the name/tag candidate fetch and for filename / tag scoring.
function extractMeaningfulTokens(query: string): string[] {
  const segmented = segmentThai(query)
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of segmented.split(/\s+/)) {
    const t = raw.trim()
    if (t.length < 2) continue
    if (THAI_STOPWORDS.has(t)) continue
    // reject 1-2 digit pure-numeric tokens (e.g., "1", "12") — too noisy
    if (/^\d{1,2}$/.test(t)) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

// --- Step 1: Query Rewriting (for semantic/vector channel only) ---

async function rewriteQueryForSemantic(query: string): Promise<string> {
  const prompt = `คุณเป็นผู้เชี่ยวชาญในการค้นหาเอกสารราชการไทย\n\nผู้ใช้ค้นหา: "${query}"\n\nให้สร้างประโยคเต็มที่อธิบายสิ่งที่ต้องการค้นหา เพื่อใช้กับ vector search\nรวมชื่อเฉพาะ ตัวเลข และคำสำคัญจาก query เดิมไว้ด้วยเสมอ\n\nตอบเป็นข้อความเท่านั้น ไม่ต้องมี JSON หรือ markdown`

  try {
    const text = await generateText(prompt, { maxTokens: 150, temperature: 0.1 })
    return text.trim() || query
  } catch (err) {
    console.warn('Query rewrite failed, using original:', err)
    return query
  }
}

// --- Embedding (Vertex only — dims must match stored vectors) ---

async function generateQueryEmbedding(text: string): Promise<number[]> {
  const data = await callVertexAI('gemini-embedding-001', 'predict', {
    instances: [{ content: text, task_type: 'RETRIEVAL_QUERY' }],
    parameters: { outputDimensionality: 768 },
  })
  return data.predictions[0].embeddings.values
}

// --- Deterministic scoring ---
//
// score = WEIGHT_NAME * nameMatch + WEIGHT_TAG * tagMatch + WEIGHT_CONTENT * contentRRFNorm
//
// nameMatch (0..1.5):
//   token_match_ratio (= matched / total_meaningful_tokens) ∈ [0,1]
//   + 0.5 bonus if the full raw query appears as a substring of file_name
//
// tagMatch (0..1.5):
//   token_match_ratio against the union of all tag strings
//   + 0.5 bonus if any tag exact-matches (case-insensitive) the full raw query
//
// contentRRFNorm (0..1):
//   chunk's rrf_score / max(rrf_score in batch). Rows from the name/tag-only
//   RPC carry rrf_score=0, so they contribute nothing to the content channel —
//   their score comes entirely from name/tag signals.
//
// With weights 4 / 3 / 1, a full file_name match (≥ 4.0) always outranks any
// content-only match (≤ 1.0). Partial name (0.5×4=2) still beats content (1),
// and partial tag (0.5×3=1.5) does too — name/tag dominate as intended.

const WEIGHT_NAME = 4.0
const WEIGHT_TAG = 3.0
const WEIGHT_CONTENT = 1.0
const FULL_MATCH_BONUS = 0.5
const MAX_PAGES_PER_DOC = 3
const RESULT_LIMIT = 10
const RPC_MATCH_COUNT = 30

function nameMatchScore(tokens: string[], fileName: string | null, rawQuery: string): number {
  if (!fileName || tokens.length === 0) return 0
  const fnLower = fileName.toLowerCase()
  let matched = 0
  for (const t of tokens) {
    if (fnLower.includes(t.toLowerCase())) matched++
  }
  const ratio = matched / tokens.length
  const qLower = rawQuery.trim().toLowerCase()
  if (qLower.length >= 2 && fnLower.includes(qLower)) {
    return ratio + FULL_MATCH_BONUS
  }
  return ratio
}

function tagMatchScore(tokens: string[], tags: string[] | null, rawQuery: string): number {
  if (!tags || tags.length === 0 || tokens.length === 0) return 0
  const tagsLower = tags.map((t) => (t || '').toLowerCase()).filter(Boolean)
  if (tagsLower.length === 0) return 0
  let matched = 0
  for (const t of tokens) {
    const tLower = t.toLowerCase()
    if (tagsLower.some((tag) => tag.includes(tLower))) matched++
  }
  const ratio = matched / tokens.length
  const qLower = rawQuery.trim().toLowerCase()
  if (qLower.length >= 2 && tagsLower.some((tag) => tag === qLower)) {
    return ratio + FULL_MATCH_BONUS
  }
  return ratio
}

// Union of chunk-search results and name/tag-only results.
// For docs present in chunk-search, drop the name/tag representative chunk
// (the chunk-search rows already carry the name/tag signal through scoring,
//  and they have non-zero rrf_score which is more informative).
function mergeCandidates(chunkRows: any[], nameTagRows: any[]): any[] {
  const docsCovered = new Set(chunkRows.map((r) => r.document_id))
  const merged = [...chunkRows]
  for (const r of nameTagRows) {
    if (!docsCovered.has(r.document_id)) merged.push(r)
  }
  return merged
}

function scoreAndRank(query: string, tokens: string[], candidates: any[]): any[] {
  const maxRrf = candidates.reduce((m, r) => Math.max(m, r.rrf_score || 0), 0) || 1
  return candidates.map((r) => {
    const nameScore = nameMatchScore(tokens, r.file_name, query)
    const tagScore = tagMatchScore(tokens, r.tags, query)
    const contentScore = (r.rrf_score || 0) / maxRrf
    const total =
      WEIGHT_NAME * nameScore +
      WEIGHT_TAG * tagScore +
      WEIGHT_CONTENT * contentScore
    return {
      ...r,
      _name_score: nameScore,
      _tag_score: tagScore,
      _content_score: contentScore,
      _score: total,
    }
  })
}

// Best chunk per (doc, page) by combined score, then cap pages per doc.
function dedupeAndCap(scored: any[]): any[] {
  const bestByDocPage = new Map<string, any>()
  for (const r of scored) {
    const key = `${r.document_id}:${r.page_number}`
    const existing = bestByDocPage.get(key)
    if (!existing || r._score > existing._score) {
      bestByDocPage.set(key, r)
    }
  }
  const sorted = [...bestByDocPage.values()].sort((a, b) => b._score - a._score)

  const docPageCount = new Map<string, number>()
  const filtered: any[] = []
  for (const r of sorted) {
    const count = docPageCount.get(r.document_id) || 0
    if (count < MAX_PAGES_PER_DOC) {
      filtered.push(r)
      docPageCount.set(r.document_id, count + 1)
    }
  }
  return filtered
}

function stripInternalFields(results: any[]): any[] {
  return results.map(
    ({ _name_score, _tag_score, _content_score, _score, ...rest }) => rest
  )
}

// --- Main Handler ---

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { query, mode, user_id } = await req.json()

    if (!query || !query.trim()) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const searchMode = mode || 'hybrid'
    const startTime = Date.now()
    const useVector = searchMode !== 'fulltext'

    const segmentedQuery = segmentThai(query)
    const tokens = extractMeaningfulTokens(query)

    let semanticQuery = query
    let embeddingStr = `[${new Array(768).fill(0).join(',')}]`

    if (useVector) {
      semanticQuery = await rewriteQueryForSemantic(query)
      const queryEmbedding = await generateQueryEmbedding(semanticQuery)
      embeddingStr = `[${queryEmbedding.join(',')}]`
    }

    const chunkPromise = supabase.rpc('ocr_chunk_hybrid_search', {
      query_text: segmentedQuery,
      query_embedding: embeddingStr,
      match_count: RPC_MATCH_COUNT,
      full_text_weight: 1.0,
      semantic_weight: useVector ? 1.0 : 0.0,
      rrf_k: 50,
    })

    const nameTagPromise =
      tokens.length > 0
        ? supabase.rpc('ocr_docs_name_tag_match', {
            tokens,
            match_count: RPC_MATCH_COUNT,
          })
        : Promise.resolve({ data: [], error: null })

    const [chunkRes, nameTagRes] = await Promise.all([chunkPromise, nameTagPromise])

    if (chunkRes.error) throw new Error(`Chunk search error: ${chunkRes.error.message}`)
    if (nameTagRes.error) throw new Error(`Name/tag search error: ${nameTagRes.error.message}`)

    const candidates = mergeCandidates(chunkRes.data || [], nameTagRes.data || [])
    const scored = scoreAndRank(query, tokens, candidates)
    const deduped = dedupeAndCap(scored)
    const results = stripInternalFields(deduped.slice(0, RESULT_LIMIT))

    if (user_id) {
      supabase
        .from('ocr_search_history')
        .insert({
          user_id,
          query: query.trim(),
          mode: searchMode,
          result_count: results.length,
        })
        .then(() => {})
        .catch((err: any) => console.warn('Failed to save search history:', err))
    }

    const elapsed = Date.now() - startTime

    return new Response(
      JSON.stringify({
        results,
        metadata: {
          original_query: query,
          segmented_query: segmentedQuery,
          semantic_query: semanticQuery,
          meaningful_tokens: tokens,
          chunk_candidates: (chunkRes.data || []).length,
          name_tag_candidates: (nameTagRes.data || []).length,
          merged_candidates: candidates.length,
          elapsed_ms: elapsed,
          vector_used: useVector,
        },
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (err: any) {
    console.error('ocr-search error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})
