import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/require-admin'
import { moisParis, revenusDuMois } from '@/lib/bo/revenus'

// Export comptable du mois (maquette PRO-24.11) : un mouvement par ligne
// (abonnement, jetons, remboursement), HT, TVA, TTC, séparateur « ; ».
export async function GET(request: Request) {
  const admin = await requireAdminSession()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const demande = new URL(request.url).searchParams.get('mois') || ''
  const mois = /^\d{4}-\d{2}$/.test(demande) ? demande : moisParis()
  const r = await revenusDuMois(mois)
  const n = (v: number) => v.toFixed(2).replace('.', ',')
  const lignes = [['Date', 'Type', 'Référence', 'Client', 'HT', 'TVA', 'TTC'], ...[...r.mouvements].reverse().map((m) => [m.quand.slice(0, 10), m.type, m.reference, m.client, n(m.ht), n(m.ttc - m.ht), n(m.ttc)])]
  const csv = '﻿' + lignes.map((l) => l.map((x) => (/[;"\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(';')).join('\r\n')
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="koji-revenus-${mois}.csv"`, 'Cache-Control': 'no-store' } })
}
