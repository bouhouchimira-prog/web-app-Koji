'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Décision sur un fil (maquette PRO-24.7) : aucune suite, ou rappel des
// règles envoyé aux deux parties. La décision est inscrite au journal.
export default function DecisionFil({ fil }: { fil: string }) {
  const router = useRouter()
  const [occupe, setOccupe] = useState('')
  const [retour, setRetour] = useState<{ texte: string; erreur?: boolean } | null>(null)
  async function decider(decision: 'aucune_suite' | 'rappel') {
    setOccupe(decision)
    setRetour(null)
    const r = await fetch('/api/admin/conversations/decision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fil, decision }) })
    const j = await r.json().catch(() => ({}))
    setOccupe('')
    if (!r.ok) return setRetour({ texte: j.error || 'Action impossible.', erreur: true })
    setRetour({ texte: decision === 'rappel' ? `Rappel envoyé (${j.envoyes} sur 2).` : 'Noté : aucune suite.' })
    router.refresh()
  }
  return (
    <div className="bo">
      <div className="bo-alerte"><div><b>Aucune suite</b><small>message conforme</small></div><button type="button" className="bo-btn" disabled={Boolean(occupe)} onClick={() => decider('aucune_suite')}>{occupe === 'aucune_suite' ? '…' : 'Aucune suite'}</button></div>
      <div className="bo-alerte"><div><b>Rappel des règles</b><small>aux deux parties, modèle</small></div><button type="button" className="bo-btn main" disabled={Boolean(occupe)} onClick={() => decider('rappel')}>{occupe === 'rappel' ? 'Envoi…' : 'Rappel des règles'}</button></div>
      {retour ? <p className={retour.erreur ? 'bo-err' : 'bo-ok'}>{retour.texte}</p> : null}
    </div>
  )
}
