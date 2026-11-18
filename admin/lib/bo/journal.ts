import { createAdminClient } from '@/lib/supabase-admin'

// Journal des accès (BO_JOURNAL_ACCES.sql) : chaque ouverture d'un contenu
// privé (fil de conversation, devis, export de données) est tracée avec
// son motif. Si la table n'a pas encore été créée, l'accès n'est pas
// bloqué et la page l'indique (journalActif = false).
export type Entree = { admin: string; action: string; cibleType: string; cibleId: string; motif: string }

export async function journaliser(e: Entree): Promise<boolean> {
  const { error } = await createAdminClient().from('bo_journal_acces').insert({
    admin_email: e.admin, action: e.action, cible_type: e.cibleType, cible_id: e.cibleId, motif: e.motif
  })
  return !error
}

export async function lireJournal(limite = 200, cibleId?: string) {
  let q = createAdminClient().from('bo_journal_acces').select('*').order('created_at', { ascending: false }).limit(limite)
  if (cibleId) q = q.eq('cible_id', cibleId)
  const { data, error } = await q
  return { actif: !error, lignes: (data || []) as { id: string; created_at: string; admin_email: string; action: string; cible_type: string; cible_id: string; motif: string }[] }
}
