import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET = 'report-images';
const STALE_MINUTES = 30;

// Hard request timeout so a hung storage/DB call can't burn the 150s worker
// wall-clock limit and return WORKER_RESOURCE_LIMIT to the client.
// Uploads need a larger budget than pure DB calls.
const REQUEST_TIMEOUT_MS = 60_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-file-name, x-session-id',
};

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const timeoutPromise = new Promise<Response>((_, reject) =>
    setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), REQUEST_TIMEOUT_MS)
  );

  try {
    return await Promise.race([handleUploadReportImage(req), timeoutPromise]);
  } catch (err) {
    if ((err as Error)?.message === 'REQUEST_TIMEOUT') {
      console.error('⏱️ upload-report-image request timeout after 60s');
      return json({ error: 'service_timeout' }, 504);
    }
    throw err;
  }
});

async function handleUploadReportImage(req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Auto-cleanup: delete files from stale uncommitted sessions (>30 min)
  const cleanupStale = async () => {
    try {
      const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
      const { data: stale } = await supabaseAdmin
        .from('upload_sessions')
        .select('id, files')
        .eq('committed', false)
        .lt('created_at', cutoff);
      if (stale && stale.length > 0) {
        const allFiles = stale.flatMap((s: any) => s.files || []);
        if (allFiles.length > 0) {
          await supabaseAdmin.storage.from(BUCKET).remove(allFiles);
        }
        await supabaseAdmin
          .from('upload_sessions')
          .delete()
          .in('id', stale.map((s: any) => s.id));
      }
      // Also remove committed sessions older than 24h (no longer needed)
      await supabaseAdmin
        .from('upload_sessions')
        .delete()
        .eq('committed', true)
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    } catch { /* best effort */ }
  };

  // DELETE: explicit file removal (client-side fast path)
  if (req.method === 'DELETE') {
    try {
      const { files } = await req.json();
      if (!Array.isArray(files) || files.length === 0) {
        return json({ error: 'files array required' }, 400);
      }
      const { error } = await supabaseAdmin.storage.from(BUCKET).remove(files);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, deleted: files.length });
    } catch (e: any) {
      return json({ error: e.message || 'Delete failed' }, 500);
    }
  }

  // POST
  if (req.method === 'POST') {
    const contentType = req.headers.get('Content-Type') || '';

    // JSON body → session management actions
    if (contentType.includes('application/json')) {
      try {
        const body = await req.json();

        if (body.action === 'start-session') {
          await cleanupStale();
          const { data, error } = await supabaseAdmin
            .from('upload_sessions')
            .insert({ files: [], committed: false })
            .select('id')
            .single();
          if (error) return json({ error: error.message }, 500);
          return json({ session_id: data.id });
        }

        if (body.action === 'commit-session' && body.session_id) {
          await supabaseAdmin
            .from('upload_sessions')
            .update({ committed: true })
            .eq('id', body.session_id);
          return json({ success: true });
        }

        return json({ error: 'Unknown action' }, 400);
      } catch (e: any) {
        return json({ error: e.message || 'Bad request' }, 400);
      }
    }

    // Binary body → file upload
    try {
      const fileName = req.headers.get('x-file-name') ||
        `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const sessionId = req.headers.get('x-session-id');

      const fileBuffer = await req.arrayBuffer();

      const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(fileName, fileBuffer, { contentType, upsert: false });

      if (error) return json({ error: error.message }, 400);

      // Track file in session
      if (sessionId) {
        try {
          const { data: session } = await supabaseAdmin
            .from('upload_sessions')
            .select('files')
            .eq('id', sessionId)
            .single();
          if (session) {
            await supabaseAdmin
              .from('upload_sessions')
              .update({ files: [...(session.files || []), fileName] })
              .eq('id', sessionId);
          }
        } catch { /* non-critical: file uploaded but session tracking failed */ }
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${fileName}`;

      return json({ url: publicUrl });
    } catch (e: any) {
      return json({ error: e.message || 'Internal error' }, 500);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
}
