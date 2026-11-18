'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Valider (date de fin) ou refuser (motif obligatoire) un document
// d'entreprise (maquette PRO-24.2).
export default function ActionDocument({ userId, doc, avecDate, finActuelle = '' }: { userId: string; doc: string; avecDate: boolean; finActuelle?: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<'' | 'valider' | 'refuser'>('')
  const [jusqua, setJusqua] = useState(finActuelle)
  const [motif, setMotif] = useState('')
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')

  async function envoyer() {
    setBusy(true)
    setErreur('')
    const r = await fetch('/api/admin/verifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, doc, action: mode, jusqua, motif }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErreur(j.error || 'Erreur.'); return }
    setMode('')
    router.refresh()
  }

  if (!mode) {
    return (
      <span className="bo-acts">
        <button type="button" className="bo-btn" onClick={() => setMode('valider')}>Valider</button>
        <button type="button" className="bo-btn" onClick={() => setMode('refuser')}>Refuser</button>
      </span>
    )
  }
  return (
    <span className="bo-form">
      {mode === 'valider' && avecDate ? <label>Valable jusqu&apos;au <input type="date" value={jusqua} onChange={(e) => setJusqua(e.target.value)} /></label> : null}
      {mode === 'refuser' ? <input placeholder="Motif (envoyé à l'entreprise)" value={motif} onChange={(e) => setMotif(e.target.value)} style={{ minWidth: 260 }} /> : null}
      <button type="button" className="bo-btn main" disabled={busy} onClick={envoyer}>{busy ? '…' : mode === 'valider' ? 'Confirmer la validation' : 'Refuser et prévenir'}</button>
      <button type="button" className="bo-btn" onClick={() => setMode('')}>Annuler</button>
      {erreur ? <span className="bo-err">{erreur}</span> : null}
    </span>
  )
}
