'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Boutons d'un signalement : chaque décision est confirmée, appliquée par
// le site, puis inscrite au journal des accès.
type Action = { id: string; label: string; confirmation: string; principal?: boolean }

export default function ActionsSignalement({ reportId, actions }: { reportId: string; actions: Action[] }) {
  const router = useRouter()
  const [enCours, setEnCours] = useState('')
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')

  async function faire(a: Action) {
    if (!window.confirm(a.confirmation)) return
    setEnCours(a.id)
    setErreur('')
    setMessage('')
    const r = await fetch('/api/admin/moderation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId, action: a.id }) })
    const j = await r.json().catch(() => ({}))
    setEnCours('')
    if (!r.ok) { setErreur(j.error || 'Erreur.'); return }
    setMessage(j.detail ? `Fait : ${j.detail}.` : 'Fait.')
    router.refresh()
  }

  return (
    <div>
      <div className="bo-acts" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        {actions.map((a) => (
          <button key={a.id} type="button" className={`bo-btn${a.principal ? ' main' : ''}`} disabled={Boolean(enCours)} onClick={() => faire(a)}>
            {enCours === a.id ? '…' : a.label}
          </button>
        ))}
      </div>
      {message ? <p className="bo-note">{message}</p> : null}
      {erreur ? <p className="bo-err">{erreur}</p> : null}
    </div>
  )
}
