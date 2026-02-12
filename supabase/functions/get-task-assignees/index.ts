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

    // Get task assignments for this document
    const { data: assignments, error: assignError } = await supabase
      .from('task_assignments')
      .select(`
        assigned_to,
        is_team_leader,
        is_reporter,
        memo_id,
        doc_receive_id,
        profiles!task_assignments_assigned_to_fkey (
          first_name,
          last_name
        )
      `)
      .or(`memo_id.eq.${documentId},doc_receive_id.eq.${documentId}`)
      .is('deleted_at', null)

    if (assignError) {
      console.error('Error fetching assignments:', assignError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch assignments' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (!assignments || assignments.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No assignments found', assignees: [], subject: '' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Get document subject
    let subject = ''
    const firstAssignment = assignments[0]

    if (firstAssignment.memo_id) {
      const { data: memo } = await supabase
        .from('memos')
        .select('subject')
        .eq('id', firstAssignment.memo_id)
        .single()
      subject = memo?.subject || 'ไม่ระบุเรื่อง'
    } else if (firstAssignment.doc_receive_id) {
      const { data: doc } = await supabase
        .from('doc_receive')
        .select('subject')
        .eq('id', firstAssignment.doc_receive_id)
        .single()
      subject = doc?.subject || 'ไม่ระบุเรื่อง'
    }

    // Map and sort assignees
    const assignees = assignments
      .map((a: any) => ({
        user_id: a.assigned_to,
        first_name: a.profiles?.first_name || '',
        last_name: a.profiles?.last_name || '',
        is_team_leader: a.is_team_leader || false,
        is_reporter: a.is_reporter || false,
      }))
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
      JSON.stringify({ assignees, subject }),
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
