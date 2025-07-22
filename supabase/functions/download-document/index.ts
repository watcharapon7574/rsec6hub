import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const documentId = url.searchParams.get('documentId')
    const bucket = url.searchParams.get('bucket') || 'documents'
    const filePath = url.searchParams.get('filePath')

    if (!documentId && !filePath) {
      return new Response(
        JSON.stringify({ error: 'Document ID หรือ file path ต้องระบุ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let actualFilePath = filePath
    
    // ถ้าให้ documentId มา ให้หาไฟล์ path จากฐานข้อมูล
    if (documentId && !filePath) {
      const { data: memo, error: memoError } = await supabaseClient
        .from('memos')
        .select('pdf_final_path, pdf_draft_path')
        .eq('id', documentId)
        .single()

      if (memoError) {
        return new Response(
          JSON.stringify({ error: 'ไม่พบเอกสาร' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      actualFilePath = memo.pdf_final_path || memo.pdf_draft_path
    }

    if (!actualFilePath) {
      return new Response(
        JSON.stringify({ error: 'ไม่พบไฟล์ PDF' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ดาวน์โหลดไฟล์จาก Storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from(bucket)
      .download(actualFilePath)

    if (downloadError) {
      console.error('Download error:', downloadError)
      return new Response(
        JSON.stringify({ error: 'ไม่สามารถดาวน์โหลดไฟล์ได้' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ส่งไฟล์กลับ
    return new Response(fileData, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="document-${documentId}.pdf"`,
      },
    })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})