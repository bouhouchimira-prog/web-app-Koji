import { createClient } from "@supabase/supabase-js";

// Same Supabase project as koji-admin and the koji-main Flutter app.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);

let client = null;

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
