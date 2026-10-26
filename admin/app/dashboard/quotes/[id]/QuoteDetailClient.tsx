'use client'

import Link from 'next/link'
import { ChevronLeft, Mail, Phone, FileSignature } from 'lucide-react'

type QuoteItem = {
  room?: string
  label?: string
  totalHt?: number
  totalTtc?: number
  [key: string]: unknown
}

type Quote = {
  id: string
  status: string | null
  total_ht: number | null
  total_ttc: number | null
  reference: string | null
  created_at: string
  items: QuoteItem[] | null
  metadata: { client?: { name?: string; email?: string; phone?: string } } | null
  web_extras: { signedAt?: string; signatureImage?: string } | null
  signature_url: string | null
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

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatEuro(value: number) {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function itemAmount(item: QuoteItem): number {
  return Number(item.totalHt ?? item.totalTtc ?? 0)
}

// Correction (26 oct, audit Selenium) : le vrai client est dans
// `metadata.client`, le vrai montant dans `total_ht`, la vraie signature
// dans `web_extras.signedAt` et les vraies lignes dans `items` (champ plat,
// chaque ligne porte deja son `room`) — pas de colonnes client_name/
// total_amount/rooms/tasks (toujours vides en pratique, verifie sur les 132
// devis reels en base).
export default function QuoteDetailClient({ quote }: { quote: Quote }) {
  const status = statusInfo(quote.status)
  const client = quote.metadata?.client
  const items = Array.isArray(quote.items) ? quote.items : []
  const signedAt = quote.web_extras?.signedAt || null
  const signatureImage = quote.web_extras?.signatureImage || quote.signature_url || null

  const byRoom = new Map<string, QuoteItem[]>()
  for (const item of items) {
    const room = item.room || 'Chantier'
    if (!byRoom.has(room)) byRoom.set(room, [])
    byRoom.get(room)!.push(item)
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/dashboard/quotes" className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-[#EDEDF3] text-gray-500 hover:text-[#16233F] transition-colors shadow-sm">
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </Link>
        <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Devis</h1>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mt-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-[30px] font-bold text-[#0E172C] font-outfit leading-none tracking-tight">{client?.name || 'Client non renseigné'}</h2>
            <span className="text-[12px] font-bold px-3 py-1 rounded-xl" style={{ background: status.bg, color: status.fg }}>{status.label}</span>
          </div>
          <p className="text-[14px] text-gray-500">
            {quote.reference ? `${quote.reference} · ` : ''}Émis le {formatDate(quote.created_at)}{signedAt ? ` · Signé le ${formatDate(signedAt)}` : ''}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Montant total (HT)</span>
          <span className="text-[30px] font-extrabold text-[#16233F] font-outfit">{formatEuro(Number(quote.total_ht ?? quote.total_ttc ?? 0))}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center gap-3">
          <Mail className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-[14px] font-semibold text-[#0E172C] truncate">{client?.email || '—'}</span>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center gap-3">
          <Phone className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-[14px] font-semibold text-[#0E172C] truncate">{client?.phone || '—'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <h3 className="font-bold text-[17px] text-[#0E172C] px-1">Détail du devis</h3>
          {byRoom.size === 0 ? (
            <div className="bg-white border border-gray-100 rounded-[1.2rem] px-6 py-10 text-center text-gray-500 text-[14px]">Aucune ligne détaillée pour ce devis.</div>
          ) : (
            Array.from(byRoom.entries()).map(([room, roomItems]) => (
              <div key={room} className="bg-white border border-gray-100 rounded-[1.2rem] overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50">
                  <h4 className="font-bold text-[14px] text-[#0E172C]">{room}</h4>
                </div>
                <div className="divide-y divide-gray-50">
                  {roomItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-3.5">
                      <span className="text-[14px] font-semibold text-[#0E172C]">{item.label || 'Ligne sans nom'}</span>
                      <span className="text-[14px] font-bold text-[#16233F]">{formatEuro(itemAmount(item))}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-[1.2rem] p-6 border border-gray-100">
            <h4 className="font-bold text-[13px] text-[#0E172C] tracking-widest uppercase mb-4 flex items-center gap-2">
              <FileSignature className="w-4 h-4" /> Signature
            </h4>
            {signatureImage ? (
              <img src={signatureImage} alt="Signature" className="w-full rounded-lg border border-gray-100 bg-gray-50" />
            ) : (
              <p className="text-[13px] text-gray-400">Pas encore signé.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
