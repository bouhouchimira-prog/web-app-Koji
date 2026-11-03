// Adapter for the shared koji_ouvrages table (see
// supabase/migrations/0002_koji_ouvrages.sql). Provides async helpers that
// read the catalogue from Supabase, with fallback to the legacy blob
// (db.kojiOuvrages) / JSON catalog so existing callers keep working during
// the migration.
//
// Web callers (lib/ouvrages.js, mergedOuvrages) still operate synchronously
// on the blob. This module is the bridge for new code paths (mobile-facing
// API routes, admin) that want to read from the shared table directly.

import { getSupabase, hasSupabase } from "./supabase.js";
import catalog from "../data/catalog-ouvrages.json";
import { fixText } from "./text.js";

export async function fetchSharedOuvrages({ famille, metier } = {}) {
  if (!hasSupabase()) return catalog.map(normalize);
  try {
    const supabase = getSupabase();
    let query = supabase.from("koji_ouvrages").select("*").eq("is_active", true);
    if (famille) query = query.eq("famille", famille);
    if (metier) query = query.eq("metier", metier);
    const { data, error } = await query.order("label", { ascending: true });
    if (error || !Array.isArray(data) || data.length === 0) {
      return catalog.map(normalize);
    }
    return data.map(normalize);
  } catch {
    return catalog.map(normalize);
  }
}

export async function fetchUserOuvrages(userId) {
  if (!userId || !hasSupabase()) return [];
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("koji_ouvrages")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("label", { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data.map(normalize);
  } catch {
    return [];
  }
}

function normalize(item) {
  const temps = Number(item.temps_unitaire || item.tempsUnitaire || item.normativeTime || 0);
  const unit = fixText(item.unite || item.unit || "u");
  return {
    id: item.original_id || item.id || item.code,
    code: fixText(item.code || item.id || ""),
    label: fixText(item.label || ""),
    description: fixText(item.description || ""),
    family: fixText(item.famille || item.family || "Autre"),
    category: fixText(item.famille || item.category || "General"),
    profession: fixText(item.metier || item.profession || ""),
    unit,
    unite: unit,
    normativeTime: temps,
    tempsUnitaire: temps,
    prixUnitaireHt: Number(item.prix_unitaire_ht || item.prixUnitaireHt || 0),
    hourlyRate: Number(item.hourly_rate || item.hourlyRate || 0),
    coefficient: Number(item.coefficient || 1),
    isShared: Boolean(item.is_shared),
    userId: item.user_id || item.userId || null
  };
}
