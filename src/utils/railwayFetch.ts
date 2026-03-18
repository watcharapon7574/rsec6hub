import { supabase } from '@/integrations/supabase/client';

export const RAILWAY_PDF_API = 'https://pdf-memo-docx-production-25de.up.railway.app';

/**
 * Fetch wrapper for Railway PDF API that automatically attaches Supabase JWT
 */
export async function railwayFetch(endpoint: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  return fetch(`${RAILWAY_PDF_API}${endpoint}`, {
    ...init,
    headers,
  });
}
