import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Hard request timeout so a hung DB query can't burn the 150s worker
// wall-clock limit and return WORKER_RESOURCE_LIMIT to the client.
const REQUEST_TIMEOUT_MS = 30_000;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const timeoutPromise = new Promise<Response>((_, reject) =>
    setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), REQUEST_TIMEOUT_MS)
  );

  try {
    return await Promise.race([handleGetMyProfile(req), timeoutPromise]);
  } catch (err) {
    if ((err as Error)?.message === 'REQUEST_TIMEOUT') {
      console.error('⏱️ get-my-profile request timeout after 30s');
      return new Response(JSON.stringify({ error: 'service_timeout' }), {
        status: 504,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    throw err;
  }
});

async function handleGetMyProfile(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'missing_token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.slice(7);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Validate token
    const { data: tokenRecord } = await supabase
      .from('external_auth_tokens')
      .select('profile_id')
      .eq('token', token)
      .eq('is_revoked', false)
      .single();

    if (!tokenRecord) {
      return new Response(JSON.stringify({ error: 'invalid_token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch fresh profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('employee_id, first_name, last_name, position, job_position, current_position, profile_picture_url, workplace')
      .eq('id', tokenRecord.profile_id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'profile_not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      profile: {
        employee_id: profile.employee_id,
        name: `${profile.first_name} ${profile.last_name}`,
        position: profile.job_position || profile.current_position || profile.position,
        avatar_url: profile.profile_picture_url,
        workplace: profile.workplace || '',
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('get-my-profile error:', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
