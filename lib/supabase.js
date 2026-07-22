import { createClient } from "@supabase/supabase-js";

// Same Supabase project as koji-admin and the koji-main Flutter app.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);
export const hasSupabaseAdmin = Boolean(supabaseUrl && supabaseServiceRoleKey);

let client = null;
let adminClient = null;

export function getSupabase() {
  if (!hasSupabase) {
    throw new Error(
      "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });
  }
  return client;
}

// Client bound to a signed-in user's access token: queries run under that
// user's identity, so the RLS policies shared with the Flutter app apply.
export function getSupabaseForToken(accessToken) {
  if (!hasSupabase) {
    throw new Error(
      "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

// Bypasses RLS entirely via the service_role key — server-only, never import
// this from client code or expose the key with a NEXT_PUBLIC_ prefix. Reserved
// for routes that must read/write rows across users without an owning
// session (e.g. public quote-signature links, client-portal access).
export function getSupabaseAdmin() {
  if (!hasSupabaseAdmin) {
    throw new Error(
      "Supabase admin client is not configured — set SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }
  if (!adminClient) {
    adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return adminClient;
}
