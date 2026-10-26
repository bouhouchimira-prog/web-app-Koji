import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

type ConversationRow = {
  id: string
  kind: 'radar' | 'devis'
  conversation_id: string
  particulier_user_id: string | null
  entreprise_user_id: string | null
  turns: { role: 'user' | 'assistant'; text: string }[]
  started_at: string
  updated_at: string
}

// Refonte maquette (25 oct) — renommee "Discussions" dans la sidebar (voir
// AdminSidebar.dc.html), palette navy/dore ; recherche/notifications
// deplacees dans la barre partagee TopBar (components/layout/TopBar.tsx).
export default async function ConversationsPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { }
      }
    }
  )

  const { data: conversations } = await supabase
    .from('ai_conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .returns<ConversationRow[]>()

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Discussions</h1>
        <p className="text-[14px] text-gray-500 mt-1">Radar des Chantiers (client) et "Avec l&apos;IA" (devis entreprise).</p>
      </div>

      <div className="bg-white border border-[#EDEDF3] rounded-[18px] overflow-hidden">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#F1F2F6]">
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Type</th>
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Compte</th>
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Dernier message</th>
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Messages</th>
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Démarrée le</th>
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide text-right">Mise à jour</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F6F6FA]">
            {conversations?.map((conv) => {
              const lastTurn = conv.turns?.[conv.turns.length - 1]
              const userId = conv.kind === 'radar' ? conv.particulier_user_id : conv.entreprise_user_id
              return (
                <tr key={conv.id}>
                  <td className="px-5 py-4">
                    {conv.kind === 'radar' ? (
                      <span className="text-[11px] font-extrabold px-3 py-1 rounded-xl bg-[#E8ECFD] text-[#3B5BDB] uppercase tracking-wide">Client</span>
                    ) : (
                      <span className="text-[11px] font-extrabold px-3 py-1 rounded-xl bg-[#FDF3DC] text-[#B7791F] uppercase tracking-wide">Entreprise</span>
                    )}
                  </td>
                  <td className="px-5 py-4"><span className="font-mono text-[12px] text-gray-500">{userId ? `${userId.slice(0, 8)}…` : '—'}</span></td>
                  <td className="px-5 py-4 max-w-sm"><span className="text-[13px] text-gray-600 truncate block">{lastTurn?.text || '—'}</span></td>
                  <td className="px-5 py-4"><span className="font-bold text-[#1E2430] text-[13.5px]">{conv.turns?.length || 0}</span></td>
                  <td className="px-5 py-4 text-[13.5px] text-gray-500">
                    {new Date(conv.started_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/dashboard/conversations/${conv.id}`} className="inline-flex items-center gap-1 text-[#3B5BDB] font-bold text-[13px]">
                      Voir <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              )
            })}
            {(!conversations || conversations.length === 0) && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-500">Aucune conversation pour l&apos;instant.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
