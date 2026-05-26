-- Add ocr_docs_name_tag_match RPC
-- ใช้กับ /ocr-search เพื่อรับประกันว่าเอกสารที่ "ชื่อไฟล์" หรือ "แท๊ก" ตรง keyword
-- จะเข้าสู่ candidate set เสมอ แม้เนื้อหา chunk จะไม่ match กับ query
-- (เดิมการ search ทำ FTS+vector บน ocr_chunks.content เท่านั้น — file_name/tags
-- ของ ocr_documents จึงไม่เคยถูกใช้เป็นเงื่อนไขในการดึงผู้สมัคร)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index ช่วย ILIKE '%token%' บน file_name (ใช้ได้กับ pattern ที่มี ≥3 chars)
CREATE INDEX IF NOT EXISTS ocr_documents_file_name_trgm_idx
  ON ocr_documents USING gin (file_name gin_trgm_ops);

DROP FUNCTION IF EXISTS ocr_docs_name_tag_match(text[], int);

CREATE OR REPLACE FUNCTION ocr_docs_name_tag_match(
  tokens text[],
  match_count int DEFAULT 30
)
RETURNS TABLE (
  chunk_id uuid,
  chunk_index int,
  content text,
  context_summary text,
  created_at timestamptz,
  document_id uuid,
  file_name text,
  file_size bigint,
  file_type text,
  file_url text,
  fts_rank double precision,
  page_number int,
  rrf_score double precision,
  semantic_rank double precision,
  tags text[]
)
LANGUAGE sql
STABLE
AS $$
  WITH cleaned_tokens AS (
    SELECT DISTINCT trim(t) AS t
    FROM unnest(tokens) AS t
    WHERE length(coalesce(trim(t), '')) >= 2
  ),
  matched_docs AS (
    SELECT d.id
    FROM ocr_documents d
    WHERE d.status = 'completed'
      AND (
        EXISTS (
          SELECT 1 FROM cleaned_tokens ct
          WHERE d.file_name ILIKE '%' || ct.t || '%'
        )
        OR EXISTS (
          SELECT 1
          FROM unnest(coalesce(d.tags, ARRAY[]::text[])) AS tag,
               cleaned_tokens ct
          WHERE tag ILIKE '%' || ct.t || '%'
        )
      )
    LIMIT match_count
  ),
  best_chunks AS (
    SELECT
      c.id AS chunk_id,
      c.chunk_index,
      c.content,
      c.context_summary,
      c.created_at,
      c.document_id,
      d.file_name,
      d.file_size,
      d.file_type,
      d.file_url,
      d.tags,
      c.page_number,
      ROW_NUMBER() OVER (
        PARTITION BY c.document_id
        ORDER BY c.chunk_index ASC
      ) AS rn
    FROM matched_docs md
    JOIN ocr_documents d ON d.id = md.id
    JOIN ocr_chunks c ON c.document_id = d.id
  )
  SELECT
    chunk_id,
    chunk_index,
    content,
    context_summary,
    created_at,
    document_id,
    file_name,
    file_size,
    file_type,
    file_url,
    NULL::double precision AS fts_rank,
    page_number,
    0::double precision AS rrf_score,
    NULL::double precision AS semantic_rank,
    tags
  FROM best_chunks
  WHERE rn = 1;
$$;

GRANT EXECUTE ON FUNCTION ocr_docs_name_tag_match(text[], int)
  TO anon, authenticated, service_role;
