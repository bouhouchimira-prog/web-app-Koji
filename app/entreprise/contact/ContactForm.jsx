'use client';

import { useEffect, useState } from 'react';

// Formulaire « Écrivez-nous » (SITE-06) : nom, entreprise, téléphone ou
// e-mail, objet, deux lignes de contexte, case de consentement non cochée,
// un seul bouton jaune, information RGPD sous le bouton. `?objet=` (lien
// « Choisir un créneau ») présélectionne l'objet.
const OBJETS = [
  ['demonstration', 'Une démonstration'],
  ['question', 'Une question'],
  ['reprise', 'Reprendre mon existant'],
  ['autre', 'Autre chose'],
];

export function ContactForm() {
  const [form, setForm] = useState({ nom: '', entreprise: '', coordonnees: '', objet: 'demonstration', message: '' });
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    try {
      const objet = new URLSearchParams(window.location.search).get('objet');
      if (OBJETS.some(([cle]) => cle === objet)) setForm((current) => ({ ...current, objet }));
    } catch { /* pas de paramètre : démonstration par défaut */ }
  }, []);

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setState({ status: 'sending', message: '' });
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, consent, website: event.target.website?.value || '' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Votre message n'a pas pu partir. Écrivez-nous à contact@getkoji.io.");
      setState({ status: 'done', message: '' });
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  }

  if (state.status === 'done') {
    return (
      <div className="lp-card lp-cf" id="ecrire" role="status">
        <b>Message reçu</b>
        <p className="lp-cok">Merci {form.nom.split(' ')[0]}. On vous répond sous un jour ouvré, au {form.coordonnees}.</p>
      </div>
    );
  }

  return (
    <form className="lp-card lp-cf" id="ecrire" onSubmit={submit} noValidate>
      <b>Écrivez-nous</b>
      <div className="lp-fg">
        <label className="lp-sr" htmlFor="ct-nom">Votre nom</label>
        <input id="ct-nom" className="lp-fi" placeholder="Votre nom" autoComplete="name" required value={form.nom} onChange={set('nom')} />
        <label className="lp-sr" htmlFor="ct-ent">Entreprise</label>
        <input id="ct-ent" className="lp-fi" placeholder="Entreprise" autoComplete="organization" value={form.entreprise} onChange={set('entreprise')} />
        <label className="lp-sr" htmlFor="ct-coord">Téléphone ou e-mail</label>
        <input id="ct-coord" className="lp-fi" placeholder="Téléphone ou e-mail" autoComplete="email" required value={form.coordonnees} onChange={set('coordonnees')} />
        <label className="lp-sr" htmlFor="ct-objet">Je souhaite…</label>
        <select id="ct-objet" className="lp-fi" value={form.objet} onChange={set('objet')}>
          {OBJETS.map(([cle, libelle]) => (
            <option key={cle} value={cle}>{libelle}</option>
          ))}
        </select>
      </div>
      <label className="lp-sr" htmlFor="ct-msg">Votre message</label>
      <textarea
        id="ct-msg"
        className="lp-fi ta"
        rows={3}
        maxLength={2000}
        placeholder="Dites-nous en deux lignes où vous en êtes (métier, nombre de devis par mois, outil actuel)."
        value={form.message}
        onChange={set('message')}
      />
      {/* Piège à robots : invisible pour une personne. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="lp-hp" aria-hidden="true" />
      <label className="lp-ck">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>J'accepte d'être recontacté par Koji à ce sujet.</span>
      </label>
      {state.status === 'error' ? <p className="lp-cerr" role="alert">{state.message}</p> : null}
      <button type="submit" className="lp-y" disabled={state.status === 'sending'}>
        {state.status === 'sending' ? 'Envoi…' : 'Envoyer'}
      </button>
      <small className="lp-fine">
        Réponse sous un jour ouvré. Vos coordonnées servent à cette demande, pas à autre chose : ABL Expert Renov, éditeur de Koji, les garde le temps de vous répondre et de suivre l'échange. <a href="/legal" className="lp-ul">Confidentialité et vos droits</a>
      </small>
    </form>
  );
}
