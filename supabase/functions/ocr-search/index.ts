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

// Common Thai particles/stopwords that shouldn't drive file_name matching
const THAI_STOPWORDS = new Set([
  'ของ', 'และ', 'ใน', 'ที่', 'เป็น', 'มี', 'ให้', 'จาก', 'ได้', 'ไป',
  'มา', 'เพื่อ', 'หรือ', 'ก็', 'แต่', 'จะ', 'นี้', 'นั้น', 'กับ', 'แก่',
  'โดย', 'ตาม', 'ถึง', 'การ', 'ความ', 'ทุก', 'อยู่', 'เลย', 'นะ', 'ครับ', 'คะ', 'ค่ะ',
])

// Returns the share of meaningful query tokens that appear in file_name (0..1)
function fileNameMatchRatio(query: string, fileName: string): number {
  if (!fileName) return 0
  const seen = new Set<string>()
  const tokens = segmentThai(query)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => {
      if (t.length < 2) return false
      if (THAI_STOPWORDS.has(t)) return false
      if (seen.has(t)) return false
      seen.add(t)
      return true
    })
  if (tokens.length === 0) return 0
  let matched = 0
  for (const t of tokens) {
    if (fileName.includes(t)) matched++
  }
  return matched / tokens.length
}

// --- Step 1: Query Rewriting (for semantic search only) ---

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

// --- Step 3: Embedding (Vertex only — dims must match stored vectors) ---

async function generateQueryEmbedding(text: string): Promise<number[]> {
  const data = await callVertexAI('gemini-embedding-001', 'predict', {
    instances: [{ content: text, task_type: 'RETRIEVAL_QUERY' }],
    parameters: { outputDimensionality: 768 },
  })
  return data.predictions[0].embeddings.values
}

// --- Dedup: best chunk per page, max 3 pages per document ---

const MAX_PAGES_PER_DOC = 3

function deduplicateResults(results: any[]): any[] {
  const bestByDocPage = new Map<string, any>()
  for (const r of results) {
    const key = `${r.document_id}:${r.page_number}`
    const existing = bestByDocPage.get(key)
    if (!existing || r.rrf_score > existing.rrf_score) {
      bestByDocPage.set(key, r)
    }
  }

  const sorted = [...bestByDocPage.values()].sort((a, b) => b.rrf_score - a.rrf_score)
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

// --- Step 4.5: Boost candidates whose file_name matches query tokens ---
// RRF scores live in ~0.01–0.04 range; multiplying by (1 + 2*ratio) means a
// fully-matching file_name triples the score, which is enough to overpower
// near-ties from semantic search on long unrelated documents.
const FILENAME_BOOST_WEIGHT = 2.0

function applyFileNameBoost(query: string, results: any[]): any[] {
  const ratioCache = new Map<string, number>()
  const boosted = results.map((r: any) => {
    const fname = r.file_name || ''
    let ratio = ratioCache.get(fname)
    if (ratio === undefined) {
      ratio = fileNameMatchRatio(query, fname)
      ratioCache.set(fname, ratio)
    }
    return {
      ...r,
      _filename_match_ratio: ratio,
      _boosted_score: r.rrf_score * (1 + FILENAME_BOOST_WEIGHT * ratio),
    }
  })
  boosted.sort((a, b) => b._boosted_score - a._boosted_score)
  return boosted
}

function stripInternalFields(results: any[]): any[] {
  return results.map(({ _filename_match_ratio, _boosted_score, ...rest }) => rest)
}

// --- Step 5: Reranking ---

async function rerankResults(
  query: string,
  results: any[],
  topK: number = 10
): Promise<any[]> {
  if (results.length <= topK) return results

  try {
    const numbered = results
      .map((r: any, i: number) => {
        const fname = r.file_name ? `📄 ชื่อไฟล์: ${r.file_name}\n` : ''
        const summary = (r.context_summary || '').substring(0, 100)
        const content = r.content.substring(0, 300)
        return `[${i}] ${fname}${summary}\n${content}`
      })
      .join('\n\n')

    const prompt = `คุณเป็นผู้เชี่ยวชาญในการจัดลำดับความเกี่ยวข้องของเอกสาร\n\nคำค้นหา: "${query}"\n\nเอกสารที่พบ:\n${numbered}\n\nให้จัดลำดับเอกสารตามความเกี่ยวข้องกับคำค้นหา จากมากไปน้อย\nเลือกแค่ ${topK} อันดับแรกที่เกี่ยวข้องที่สุด\nให้น้ำหนักสูงสุดกับ "ชื่อไฟล์" (📄) ที่ตรงกับคำค้นหา รองลงมาคือเนื้อหาและชื่อเฉพาะหรือตัวเลขที่ตรงกัน\nตอบเป็น JSON array ของ index numbers เท่านั้น เช่น [3, 0, 7, 1, 5]\nไม่ต้องมีคำอธิบาย:`

    const text = await generateText(prompt, { maxTokens: 100, temperature: 0.0 })
    const cleaned = text.replace(/```json|```/g, '').trim()
    const rankedIndices: number[] = JSON.parse(cleaned)
    const reranked = rankedIndices
      .filter((i: number) => i >= 0 && i < results.length)
      .map((i: number) => results[i])
    return reranked.length > 0 ? reranked : results.slice(0, topK)
  } catch (err) {
    console.warn('Reranking failed, using original order:', err)
    return results.slice(0, topK)
  }
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
    const useAI = searchMode !== 'fulltext'

    const segmentedOriginalQuery = segmentThai(query)

    let semanticQuery = query
    let embeddingStr = `[${new Array(768).fill(0).join(',')}]` // zero vector; unused when semantic_weight=0

    if (useAI) {
      semanticQuery = await rewriteQueryForSemantic(query)
      const queryEmbedding = await generateQueryEmbedding(semanticQuery)
      embeddingStr = `[${queryEmbedding.join(',')}]`
    }

    const fullTextWeight = searchMode === 'semantic' ? 0.0 : 1.0
    const semanticWeight = searchMode === 'fulltext' ? 0.0 : 1.0

    const { data: searchResults, error: searchError } = await supabase.rpc(
      'ocr_chunk_hybrid_search',
      {
        query_text: segmentedOriginalQuery,
        query_embedding: embeddingStr,
        match_count: 30,
        full_text_weight: fullTextWeight,
        semantic_weight: semanticWeight,
        rrf_k: 50,
      }
    )

    if (searchError) throw new Error(`Search RPC error: ${searchError.message}`)

    const dedupedResults = deduplicateResults(searchResults || [])
    const boostedResults = applyFileNameBoost(query, dedupedResults)
    const rankedResults = useAI
      ? await rerankResults(query, boostedResults, 10)
      : boostedResults.slice(0, 10)
    const results = stripInternalFields(rankedResults)

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
          segmented_query: segmentedOriginalQuery,
          semantic_query: semanticQuery,
          total_candidates: (searchResults || []).length,
          after_dedup: dedupedResults.length,
          reranked: useAI && results.length < dedupedResults.length,
          elapsed_ms: elapsed,
          ai_used: useAI,
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
