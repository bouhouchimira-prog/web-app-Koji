'use client'

import { useState } from 'react'

// Deux actions sur une demande sans réponse (maquette PRO-24.13).
export default function RelanceDemande({ offreId }: { offreId: string }) {
  const [etat, setEtat] = useState<{ cible: string; texte: string; erreur?: boolean } | null>(null)
  const [occupe, setOccupe] = useState('')
  async function envoyer(cible: 'entreprises' | 'particulier') {
    setOccupe(cible)
    setEtat(null)
    const r = await fetch('/api/admin/demandes/relance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offreId, cible }) })
    const j = await r.json().catch(() => ({}))
    setOccupe('')
    if (!r.ok) return setEtat({ cible, texte: j.error || 'Envoi impossible.', erreur: true })
    setEtat({ cible, texte: cible === 'entreprises' ? `${j.envoyes} entreprise${j.envoyes > 1 ? 's' : ''} relancée${j.envoyes > 1 ? 's' : ''} sur ${j.total}.` : 'Particulier prévenu.' })
  }
  return (
    <div className="bo-acts" style={{ alignItems: 'center' }}>
      {etat ? <span className={etat.erreur ? 'bo-err' : 'bo-note'}>{etat.texte}</span> : null}
      <button type="button" className="bo-btn main" disabled={Boolean(occupe)} onClick={() => envoyer('entreprises')}>{occupe === 'entreprises' ? 'Envoi…' : 'Relancer les entreprises de la zone'}</button>
      <button type="button" className="bo-btn" disabled={Boolean(occupe)} onClick={() => envoyer('particulier')}>{occupe === 'particulier' ? 'Envoi…' : 'Prévenir le particulier'}</button>
    </div>
  )
}
