import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set(
  (Deno.env.get('DELETE_ACCOUNT_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

function headersFor(request: Request): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  };
  const origin = request.headers.get('Origin');
  // Native requests commonly omit Origin. Browser callers must be explicitly allowlisted.
  if (origin && allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function response(request: Request, status: number, body: { error: string } | { deleted: true }): Response {
  return new Response(JSON.stringify(body), { status, headers: headersFor(request) });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins.has(origin)) return response(request, 403, { error: 'Request could not be completed.' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersFor(request) });
  if (request.method !== 'POST') return response(request, 405, { error: 'Request could not be completed.' });

  const authorization = request.headers.get('Authorization');
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return response(request, 401, { error: 'Request could not be completed.' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey) return response(request, 500, { error: 'Request could not be completed.' });

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return response(request, 401, { error: 'Request could not be completed.' });

  // The request body is intentionally ignored. The verified JWT is the sole source of the account ID.
  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await adminClient.auth.admin.deleteUser(user.id);
  if (error) return response(request, 500, { error: 'Request could not be completed.' });

  return response(request, 200, { deleted: true });
});
