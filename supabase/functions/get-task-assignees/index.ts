// @ts-nocheck - This is a Deno Edge Function
// Get Task Assignees - Public API for Telegram Mini App
// Returns assignee list for a given document ID (bypasses RLS)

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const documentId = url.searchParams.get('document_id')

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'document_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get task assignments for this document (simple query without joins)
    const { data: assignments, error: assignError } = await supabase
      .from('task_assignments')
      .select('assigned_to, is_team_leader, is_reporter, memo_id, doc_receive_id, status, report_memo_id')
      .or(`memo_id.eq.${documentId},doc_receive_id.eq.${documentId}`)
      .is('deleted_at', null)

    if (assignError) {
      console.error('Error fetching assignments:', assignError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch assignments', detail: assignError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (!assignments || assignments.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No assignments found', assignees: [], subject: '' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Get user IDs and fetch profiles separately
    const userIds = assignments.map((a: any) => a.assigned_to).filter(Boolean)
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', userIds)

    if (profileError) {
      console.error('Error fetching profiles:', profileError)
    }

    // Create profile lookup map
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]))

    // Get document subject and type
    let subject = ''
    let documentType = ''
    const firstAssignment = assignments[0]

    if (firstAssignment.memo_id) {
      documentType = 'memo'
      const { data: memo } = await supabase
        .from('memos')
        .select('subject')
        .eq('id', firstAssignment.memo_id)
        .single()
      subject = memo?.subject || 'ไม่ระบุเรื่อง'
    } else if (firstAssignment.doc_receive_id) {
      documentType = 'doc_receive'
      const { data: doc } = await supabase
        .from('doc_receive')
        .select('subject')
        .eq('id', firstAssignment.doc_receive_id)
        .single()
      subject = doc?.subject || 'ไม่ระบุเรื่อง'
    }

    // Map and sort assignees
    const assignees = assignments
      .map((a: any) => {
        const profile = profileMap.get(a.assigned_to)

        // Compute display status:
        // - "รอ" = pending (not yet acknowledged)
        // - "ทราบแล้ว" = in_progress or completed (acknowledged but not reported)
        // - "รายงานแล้ว" = is_reporter AND has report_memo_id (submitted report)
        let displayStatus = 'รอ'
        if (a.status === 'pending') {
          displayStatus = 'รอ'
        } else if (a.is_reporter && a.report_memo_id) {
          displayStatus = 'รายงานแล้ว'
        } else {
          displayStatus = 'ทราบแล้ว'
        }

        return {
          user_id: a.assigned_to,
          first_name: profile?.first_name || '',
          last_name: profile?.last_name || '',
          is_team_leader: a.is_team_leader || false,
          is_reporter: a.is_reporter || false,
          status: displayStatus,
        }
      })
      .sort((a: any, b: any) => {
        // Leaders first
        if (a.is_team_leader && !b.is_team_leader) return -1
        if (!a.is_team_leader && b.is_team_leader) return 1
        // Then reporters
        if (a.is_reporter && !b.is_reporter) return -1
        if (!a.is_reporter && b.is_reporter) return 1
        return 0
      })

    return new Response(
      JSON.stringify({ assignees, subject, document_type: documentType }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
