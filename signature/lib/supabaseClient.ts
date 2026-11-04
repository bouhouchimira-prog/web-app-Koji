// Re-export du client Supabase partage (@koji/shared), avec repli placeholder
// pour les builds statiques sans credentials (comportement inchange).
// Le client partage est un singleton ; signature/lib/supabaseClient.ts
// conservait deja ce pattern.
import { getSupabase, hasSupabase } from "@koji/shared";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function makeClient() {
  if (hasSupabase) {
    try {
      return getSupabase();
    } catch {
      // tomber sur le repli placeholder (build time)
    }
  }
  return createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-key"
  );
}

export const supabase = makeClient();
