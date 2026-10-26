'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

// Correction (26 oct, audit Selenium) : le devis koji n'a PAS de colonnes
// client_name/total_amount/signed_at/rooms/tasks (verifie sur les 132 vrais
// devis en base : 0 sur 132 ont ces colonnes remplies). Le vrai client est
// dans `metadata.client`, le vrai montant dans `total_ht`, la vraie date de
// signature dans `web_extras.signedAt`, les vraies lignes dans `items`. La
// version precedente affichait donc "Nouveau prospect"/"0,00 €" pour les 132
// devis reels — l'audit initial qui a servi de base avait decrit le mauvais
// schema.
export type QuoteRow = {
  id: string
  status: string | null
  created_at: string
  total_ht: number | null
  total_ttc: number | null
  reference: string | null
  metadata: { client?: { name?: string; email?: string; phone?: string } } | null
  web_extras: { signedAt?: string } | null
}

const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  signe: { label: 'Signé', bg: '#E6F5EE', fg: '#1E8E5A' },
  envoye: { label: 'Envoyé', bg: '#E8ECFD', fg: '#3B5BDB' },
  brouillon: { label: 'Brouillon', bg: '#F0F1F5', fg: '#6B7280' },
  draft: { label: 'Brouillon', bg: '#F0F1F5', fg: '#6B7280' },
  refuse: { label: 'Refusé', bg: '#FBE9E5', fg: '#C4452D' },
}

function statusInfo(status: string | null) {
  const key = (status || '').toLowerCase()
  return STATUS_STYLE[key] || { label: status || 'Autre', bg: '#F0F1F5', fg: '#6B7280' }
}

function clientName(q: QuoteRow): string | null {
  return q.metadata?.client?.name || null
}
function amountHt(q: QuoteRow): number {
  return Number(q.total_ht ?? q.total_ttc ?? 0)
}
function signedAt(q: QuoteRow): string | null {
  return q.web_extras?.signedAt || null
}

function initials(name: string | null) {
  const value = (name || '').trim()
  if (!value) return '?'
  const parts = value.split(/\s+/)
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : value.slice(0, 2).toUpperCase()
}

function formatEuro(value: number) {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function csvEscape(value: string) {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

// Refonte (25 oct) : passage en composant client pour que les puces de
// filtre et "Exporter" soient reellement fonctionnels (avant : 100%
// decoratif) ; lignes cliquables -> fiche detail reelle.
export default function QuotesClientPage({ initialQuotes }: { initialQuotes: QuoteRow[] }) {
  const [filter, setFilter] = useState<'all' | 'brouillon' | 'envoye' | 'signe'>('all')
  const router = useRouter()
  const quotes = initialQuotes

  const brouillon = quotes.filter((q) => statusInfo(q.status).label === 'Brouillon').length
  const envoye = quotes.filter((q) => statusInfo(q.status).label === 'Envoyé').length
  const signe = quotes.filter((q) => statusInfo(q.status).label === 'Signé').length
  const totalVolume = quotes.reduce((sum, q) => sum + amountHt(q), 0)

  const filteredQuotes = quotes.filter((q) => {
    const label = statusInfo(q.status).label
    if (filter === 'brouillon') return label === 'Brouillon'
    if (filter === 'envoye') return label === 'Envoyé'
    if (filter === 'signe') return label === 'Signé'
    return true
  })

  const handleExport = () => {
    const header = ['reference', 'client', 'montant_ht', 'statut', 'created_at', 'signed_at']
    const lines = [header.join(',')]
    for (const q of filteredQuotes) {
      lines.push([
        csvEscape(q.reference || ''),
        csvEscape(clientName(q) || ''),
        String(amountHt(q)),
        csvEscape(statusInfo(q.status).label),
        q.created_at || '',
        signedAt(q) || ''
      ].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `devis-koji-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Devis</h1>
          <p className="text-[14px] text-gray-500 mt-1">Tous les devis créés par les entreprises sur koji.</p>
        </div>
        <button onClick={handleExport} className="h-11 px-5 rounded-xl border border-[#DADDE6] bg-white text-[#16233F] text-[14px] font-bold">Exporter</button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-[#EDEDF3] rounded-2xl p-4 flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-semibold">Total devis</span>
          <span className="text-[26px] font-extrabold text-[#16233F]">{quotes.length}</span>
        </div>
        <div className="bg-white border border-[#EDEDF3] rounded-2xl p-4 flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-semibold">Brouillons</span>
          <span className="text-[26px] font-extrabold text-[#16233F]">{brouillon}</span>
        </div>
        <div className="bg-white border border-[#EDEDF3] rounded-2xl p-4 flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-semibold">Signés</span>
          <span className="text-[26px] font-extrabold text-[#16233F]">{signe}</span>
          <span className="text-[12px] text-gray-500">taux {quotes.length ? Math.round((signe / quotes.length) * 100) : 0} %</span>
        </div>
        <div className="bg-white border border-[#EDEDF3] rounded-2xl p-4 flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-semibold">Volume total</span>
          <span className="text-[26px] font-extrabold text-[#16233F]">{formatEuro(totalVolume)}</span>
          <span className="text-[12px] text-gray-500">HT</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setFilter('all')} className={`text-[13px] font-semibold px-3.5 py-2.5 rounded-full border transition-colors ${filter === 'all' ? 'bg-[#16233F] text-white border-[#16233F]' : 'bg-white text-gray-500 border-[#EDEDF3]'}`}>Tous · {quotes.length}</button>
        <button onClick={() => setFilter('brouillon')} className={`text-[13px] font-semibold px-3.5 py-2.5 rounded-full border transition-colors ${filter === 'brouillon' ? 'bg-[#16233F] text-white border-[#16233F]' : 'bg-white text-gray-500 border-[#EDEDF3]'}`}>Brouillons · {brouillon}</button>
        <button onClick={() => setFilter('envoye')} className={`text-[13px] font-semibold px-3.5 py-2.5 rounded-full border transition-colors ${filter === 'envoye' ? 'bg-[#16233F] text-white border-[#16233F]' : 'bg-white text-gray-500 border-[#EDEDF3]'}`}>Envoyés · {envoye}</button>
        <button onClick={() => setFilter('signe')} className={`text-[13px] font-semibold px-3.5 py-2.5 rounded-full border transition-colors ${filter === 'signe' ? 'bg-[#16233F] text-white border-[#16233F]' : 'bg-white text-gray-500 border-[#EDEDF3]'}`}>Signés · {signe}</button>
      </div>

      <div className="bg-white border border-[#EDEDF3] rounded-[18px] overflow-hidden">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#F1F2F6]">
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Client</th>
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Montant HT</th>
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Statut</th>
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Émission</th>
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Signature</th>
              <th className="px-5 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F6F6FA]">
            {filteredQuotes.map((quote) => {
              const status = statusInfo(quote.status)
              const name = clientName(quote)
              return (
                <tr key={quote.id} onClick={() => router.push(`/dashboard/quotes/${quote.id}`)} className="cursor-pointer hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#EDEFFB] text-[#16233F] text-[13px] font-extrabold flex items-center justify-center shrink-0">
                        {initials(name)}
                      </div>
                      <div>
                        <span className="text-[14px] font-bold text-[#1E2430] block">{name || 'Client non renseigné'}</span>
                        {quote.reference && <span className="text-[12px] text-gray-400">{quote.reference}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[14px] font-extrabold text-[#16233F]">{formatEuro(amountHt(quote))}</td>
                  <td className="px-5 py-4">
                    <span className="text-[12px] font-bold px-3 py-1 rounded-xl" style={{ background: status.bg, color: status.fg }}>{status.label}</span>
                  </td>
                  <td className="px-5 py-4 text-[14px] text-gray-500">{formatDate(quote.created_at)}</td>
                  <td className="px-5 py-4 text-[14px] text-gray-500">{formatDate(signedAt(quote))}</td>
                  <td className="px-5 py-4 text-right"><ChevronRight className="w-4 h-4 text-gray-400 inline-block" /></td>
                </tr>
              )
            })}
            {filteredQuotes.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-500">Aucun devis trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
