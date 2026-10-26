import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { TrendingUp, TrendingDown } from 'lucide-react'

type QuoteRow = {
  client_name: string | null
  total_amount: number | null
  status: string | null
  created_at: string
  signed_at: string | null
}

function isSigned(status: string | null) {
  const key = (status || '').toLowerCase()
  return ['signed', 'signe', 'signé', 'accepted', 'accepte'].includes(key)
}

function formatEuro(value: number) {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
}

const MONTH_LABELS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC']

// Refonte maquette (25 oct, AdminCA.dc.html) — l'ancienne page n'avait
// AUCUNE requete reelle (clients/chiffres entierement inventes dans le
// code). Reconstruite sur les vraies donnees de `quotes` : CA signe reel,
// evolution mensuelle reelle (12 derniers mois), comptes les plus
// performants reels. "Part koji" n'a aucune donnee source (pas de suivi de
// commission dans le schema) : affiche honnêtement "Non suivi" plutot
// qu'un chiffre invente.
export default async function RevenuePage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() { } } }
  )

  const { data } = await supabase.from('quotes').select('client_name, total_amount, status, created_at, signed_at')
  const quotes = (data || []) as QuoteRow[]
  const signedQuotes = quotes.filter((q) => isSigned(q.status))

  const totalCa = signedQuotes.reduce((sum, q) => sum + Number(q.total_amount || 0), 0)
  const distinctClients = new Set(signedQuotes.map((q) => (q.client_name || '').trim().toLowerCase()).filter(Boolean))
  const arpu = distinctClients.size > 0 ? totalCa / distinctClients.size : 0

  const now = new Date()
  const months = Array.from({ length: 12 }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1)
    return { year: d.getFullYear(), month: d.getMonth(), label: MONTH_LABELS[d.getMonth()], total: 0 }
  })
  for (const q of signedQuotes) {
    const d = new Date(q.signed_at || q.created_at)
    const bucket = months.find((m) => m.year === d.getFullYear() && m.month === d.getMonth())
    if (bucket) bucket.total += Number(q.total_amount || 0)
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.total))
  const lastMonth = months[months.length - 1]
  const prevMonth = months[months.length - 2]
  const momChange = prevMonth && prevMonth.total > 0 ? ((lastMonth.total - prevMonth.total) / prevMonth.total) * 100 : null

  const byClient = new Map<string, number>()
  for (const q of signedQuotes) {
    const name = q.client_name || 'Client'
    byClient.set(name, (byClient.get(name) || 0) + Number(q.total_amount || 0))
  }
  const topAccounts = Array.from(byClient.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Suivi du chiffre d’affaires</h1>
        <p className="text-[14px] text-gray-500 mt-1">Analyse financière en temps réel.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#EDEDF3] rounded-2xl p-4 flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-semibold">Chiffre d’affaires signé</span>
          <span className="text-[26px] font-extrabold text-[#16233F]">{formatEuro(totalCa)}</span>
          {momChange != null ? (
            <span className={`text-[12px] font-bold flex items-center gap-1 ${momChange >= 0 ? 'text-[#1E8E5A]' : 'text-[#C4452D]'}`}>
              {momChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {momChange >= 0 ? '+' : ''}{momChange.toFixed(1)} % vs mois dernier
            </span>
          ) : <span className="text-[12px] text-gray-400">Pas assez d’historique</span>}
        </div>
        <div className="bg-white border border-[#EDEDF3] rounded-2xl p-4 flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-semibold">Part koji (plateforme)</span>
          <span className="text-[26px] font-extrabold text-[#16233F]">—</span>
          <span className="text-[12px] text-gray-400">Non suivi aujourd’hui</span>
        </div>
        <div className="bg-white border border-[#EDEDF3] rounded-2xl p-4 flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-semibold">ARPU moyen</span>
          <span className="text-[26px] font-extrabold text-[#16233F]">{formatEuro(arpu)}</span>
          <span className="text-[12px] text-gray-500">sur {distinctClients.size} client{distinctClients.size > 1 ? 's' : ''} signé{distinctClients.size > 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="flex gap-5">
        <div className="flex-[1.8] min-w-0 bg-white border border-[#EDEDF3] rounded-[18px] p-6 flex flex-col gap-3">
          <span className="text-[16px] font-extrabold text-[#16233F]">Évolution temporelle</span>
          <span className="text-[13px] text-gray-500">Revenus signés sur les 12 derniers mois.</span>
          <div className="flex items-end gap-2.5 h-[230px] pt-2.5">
            {months.map((m) => (
              <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
                <div
                  className={`w-full max-w-[52px] rounded-lg ${m === lastMonth ? 'bg-[#16233F]' : 'bg-[#C9D3F5]'}`}
                  style={{ height: `${Math.max(2, (m.total / maxMonth) * 100)}%` }}
                  title={formatEuro(m.total)}
                />
                <span className="text-[11px] font-bold text-gray-400 tracking-wide">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-0 bg-white border border-[#EDEDF3] rounded-[18px] p-6 flex flex-col gap-4">
          <span className="text-[16px] font-extrabold text-[#16233F]">Top comptes</span>
          {topAccounts.length === 0 ? (
            <p className="text-[13.5px] text-gray-500">Aucun devis signé pour l’instant.</p>
          ) : topAccounts.map(([name, total]) => (
            <div key={name} className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-[#1E2430] truncate">{name}</span>
              <span className="text-[14px] font-extrabold text-[#16233F]">{formatEuro(total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
