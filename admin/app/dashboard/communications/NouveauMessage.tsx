'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Nouveau message (maquette PRO-24.9) : cible, objet, texte, envoi par
// e-mail (un e-mail par destinataire). Vers les particuliers, l'envoi
// exige de confirmer qu'il s'agit d'un message de service.
const CIBLES: { id: string; label: string }[] = [
  { id: 'entreprises', label: 'Entreprises, toutes' },
  { id: 'abonnes', label: 'Entreprises Pro et Business' },
  { id: 'essai', label: 'Entreprises en essai' },
  { id: 'particuliers', label: 'Particuliers (service)' },
  { id: 'custom', label: 'Adresses saisies' }
]

export default function NouveauMessage({ comptes }: { comptes: Record<string, number> }) {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [cible, setCible] = useState('entreprises')
  const [adresses, setAdresses] = useState('')
  const [objet, setObjet] = useState('')
  const [texte, setTexte] = useState('')
  const [service, setService] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null)
  const liste = adresses.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean)
  const nombre = cible === 'custom' ? liste.length : comptes[cible] || 0

  async function envoyer() {
    setEnvoi(true)
    setRetour(null)
    const r = await fetch('/api/admin/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ segment: cible, customEmails: liste, subject: objet, message: texte, service }) })
    const j = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) return setRetour({ ok: false, texte: j.error || 'Envoi impossible.' })
    setRetour({ ok: true, texte: `Envoyé à ${j.sentCount} destinataire${j.sentCount > 1 ? 's' : ''} sur ${j.total}.` })
    setObjet('')
    setTexte('')
    setService(false)
    router.refresh()
  }

  if (!ouvert) return <div className="bo-acts"><button type="button" className="bo-btn main" onClick={() => setOuvert(true)}>Nouveau message</button>{retour ? <span className={retour.ok ? 'bo-ok' : 'bo-err'}>{retour.texte}</span> : null}</div>

  return (
    <div className="bo-card">
      <h2>Nouveau message</h2>
      <div className="bo-tabs">{CIBLES.map((c) => <button key={c.id} type="button" className={cible === c.id ? 'on' : ''} onClick={() => setCible(c.id)}>{c.label}{c.id !== 'custom' ? <span>{comptes[c.id] ?? 0}</span> : null}</button>)}</div>
      <div className="bo-form" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        {cible === 'custom' ? <input value={adresses} onChange={(e) => setAdresses(e.target.value)} placeholder="adresse@exemple.fr, autre@exemple.fr" aria-label="Adresses" /> : null}
        <input value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="Objet…" aria-label="Objet" />
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Message…" aria-label="Message" rows={7} style={{ border: '1px solid #D9D9D4', borderRadius: 2, padding: 10, font: 'inherit' }} />
        {cible === 'particuliers' ? <label className="bo-note"><input type="checkbox" checked={service} onChange={(e) => setService(e.target.checked)} /> C&apos;est un message de service (compte, demande, sécurité), pas une publicité.</label> : null}
      </div>
      <div className="bo-pages" style={{ marginTop: 10 }}>
        <span>{nombre} destinataire{nombre > 1 ? 's' : ''}</span>
        <span className="bo-acts">
          <button type="button" className="bo-btn" onClick={() => setOuvert(false)}>Fermer</button>
          <button type="button" className="bo-btn main" disabled={envoi || !objet.trim() || !texte.trim() || !nombre || (cible === 'particuliers' && !service)} onClick={envoyer}>{envoi ? 'Envoi…' : 'Envoyer'}</button>
        </span>
      </div>
      {retour ? <p className={retour.ok ? 'bo-ok' : 'bo-err'}>{retour.texte}</p> : null}
    </div>
  )
}
