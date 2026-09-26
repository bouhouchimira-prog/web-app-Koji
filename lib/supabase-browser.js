import { createClient } from "@supabase/supabase-js";

// Client-only Supabase instance (persistSession: true, unlike lib/supabase.js's
// server-side clients) — needed for the Google OAuth redirect dance: Supabase's
// SDK stores the PKCE code verifier before leaving for Google, then reads it
// back from the same browser storage once Google redirects back to us (see
// app/auth/google/callback/page.jsx). Never import this from a server file.
let client = null;

export function getSupabaseBrowser() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
  }
  return client;
}
