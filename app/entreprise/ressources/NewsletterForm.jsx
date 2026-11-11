'use client';

import { useState } from 'react';

// Inscription à la fiche du mois (SITE-05) : un champ, un bouton secondaire,
// une case de consentement jamais pré-cochée, la mention d'information RGPD
// (art. 13) sous le champ.
export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState({ status: 'idle', message: '' });

  async function submit(event) {
    event.preventDefault();
    if (!consent) {
      setState({ status: 'error', message: 'Cochez la case pour accepter de recevoir la fiche du mois.' });
      return;
    }
    setState({ status: 'sending', message: '' });
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent, website: event.target.website?.value || '' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "L'inscription n'a pas pu être enregistrée.");
      setState({ status: 'done', message: 'C’est noté : vous recevrez la prochaine fiche.' });
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  }

  if (state.status === 'done') {
    return <p className="lp-nok" role="status">{state.message}</p>;
  }

  return (
    <form className="lp-nform" onSubmit={submit} noValidate>
      <div className="lp-nf">
        <label className="lp-sr" htmlFor="lp-nl-email">Adresse e-mail</label>
        <input
          id="lp-nl-email"
          className="lp-fi"
          type="email"
          autoComplete="email"
          placeholder="votre@email.fr"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className="lp-sec" disabled={state.status === 'sending'}>
          {state.status === 'sending' ? 'Envoi…' : "M'inscrire"}
        </button>
      </div>
      {/* Piège à robots : invisible pour une personne. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="lp-hp" aria-hidden="true" />
      <label className="lp-nc">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>J'accepte de recevoir une fiche par mois de Koji à cette adresse.</span>
      </label>
      <p className="lp-nr">
        Votre adresse sert uniquement à l'envoi de la fiche du mois. Responsable : ABL Expert Renov, éditeur de Koji. Désinscription à tout moment par le lien présent dans chaque e-mail ou à contact@getkoji.io. <a href="/legal" className="lp-ul">Confidentialité</a>
      </p>
      {state.status === 'error' ? <p className="lp-nerr" role="alert">{state.message}</p> : null}
    </form>
  );
}
