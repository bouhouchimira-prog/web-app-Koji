"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientTopbar, CHARTE_CLIENT } from "../../../components/ClientTopbar";
import { THEMES_AIDE, chercherAide, resumeTheme } from "../../../lib/aide-client";
import "../cli03.css";

// Koji Client · Aide (maquette CLI-06). Une question en tête, qui filtre la
// liste sur place (pas d'IA) ; quatre thèmes ; puis l'ordre de recours :
// l'entreprise (Messages), Koji (contact@getkoji.io), le médiateur de la
// consommation (à désigner). Le signalement d'un problème avec une
// entreprise passe toujours par /api/support/report.
//
// Délai de réponse de Koji : promis seulement sur le site entreprise, il
// n'est pas écrit ici.

function Theme({ theme, ouvert, onBascule }) {
  return (
    <div>
      <button type="button" className="kc3-row" aria-expanded={ouvert} onClick={onBascule}>
        <div><strong>{theme.titre}</strong><small>{resumeTheme(theme)}</small></div>
        <span aria-hidden="true">{ouvert ? "⌄" : "›"}</span>
      </button>
      {ouvert ? (
        <div className="kc3-qr">
          {theme.questions.map(([q, r]) => <div key={q}><b>{q}</b><p>{r}</p></div>)}
        </div>
      ) : null}
    </div>
  );
}

function Signalement() {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);
  const [erreur, setErreur] = useState("");

  async function envoyer(event) {
    event.preventDefault();
    if (!texte.trim()) return;
    setEnvoi(true);
    setErreur("");
    try {
      const r = await fetch("/api/support/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message: `[Signalement artisan] ${texte.trim()}`, accountType: "particulier", page: "/client/aide" })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Le signalement n'est pas parti.");
      setFait(true);
      setTexte("");
    } catch (e) {
      setErreur(e.message || "Le signalement n'est pas parti.");
    } finally {
      setEnvoi(false);
    }
  }

  if (fait) return <p className="kc3-ok" role="status">Signalement envoyé à l'équipe Koji, qui revient vers vous par e-mail.</p>;
  if (!ouvert) return <button type="button" className="kc-sec" onClick={() => setOuvert(true)}>Signaler un problème avec une entreprise</button>;
  return (
    <form className="kc3-list" onSubmit={envoyer}>
      <div className="kc-fld">
        <label htmlFor="kc3-sig">Ce qui s'est passé</label>
        <textarea id="kc3-sig" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Quelle entreprise, quel chantier, ce qui s'est passé…" maxLength={3000} />
      </div>
      {erreur ? <p className="kc3-err" role="alert">{erreur}</p> : null}
      <div className="kc3-outils" style={{ alignItems: "center", marginTop: 0 }}>
        <button type="submit" className="kc-sec" disabled={envoi || !texte.trim()}>{envoi ? "Envoi…" : "Envoyer"}</button>
        <button type="button" className="kc3-lien" onClick={() => setOuvert(false)}>Annuler</button>
      </div>
    </form>
  );
}

export default function ClientAidePage() {
  const [question, setQuestion] = useState("");
  const [ouvert, setOuvert] = useState("");
  const resultats = chercherAide(question);
  const cherche = question.trim().length > 0;

  const champ = (id) => (
    <div className="kc-fld">
      <label htmlFor={id}>Votre question</label>
      <input id={id} type="search" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex. : puis-je annuler après avoir signé ?" autoComplete="off" />
    </div>
  );

  const faq = cherche ? (
    resultats.length ? (
      <div className="kc3-list" aria-live="polite">
        {resultats.map((r) => (
          <div key={r.question} className="kc3-qr seul"><div><b>{r.question}</b><p>{r.reponse}</p><small className="kc-s">{r.theme}</small></div></div>
        ))}
      </div>
    ) : (
      <p className="kc-s" aria-live="polite">Pas de réponse toute prête. Écrivez à l'entreprise depuis Messages, ou à Koji : contact@getkoji.io.</p>
    )
  ) : (
    <div className="kc3-list">
      {THEMES_AIDE.map((t) => <Theme key={t.cle} theme={t} ouvert={ouvert === t.cle} onBascule={() => setOuvert((o) => (o === t.cle ? "" : t.cle))} />)}
    </div>
  );

  const MEDIATEUR = "Si le désaccord persiste, vous pouvez recourir gratuitement à un médiateur de la consommation. Celui de Koji est à désigner ; ses coordonnées seront données ici. Pour une entreprise d'un autre pays de l'Union, le Centre européen des consommateurs peut aussi vous aider.";

  return (
    <div className={`${CHARTE_CLIENT} kc`}>
      <ClientTopbar titre="Aide" sousTitre="Koji Client" backHref="/client/profil" />
      <main className="kc-m">
        {/* Ordinateur */}
        <div className="kc-d">
          <h1 className="kc-h">Aide</h1>
          <div className="kc3-cols large">
            <div className="kc3-list">
              {champ("kc3-q-d")}
              <div className="kc3-faq" style={{ marginTop: 6 }}>{faq}</div>
            </div>
            <aside className="kc3-a">
              <h3>Un problème avec une entreprise ?</h3>
              <p>Écrivez-lui d'abord depuis <Link className="kc3-lien" href="/client/messages">Messages</Link> : la plupart des questions se règlent là.</p>
              <h3>Contacter Koji</h3>
              <p><a className="kc3-lien" href="mailto:contact@getkoji.io">contact@getkoji.io</a>. Koji met en relation ; le contrat est entre vous et l'entreprise.</p>
              <div style={{ margin: "0 0 16px" }}><Signalement /></div>
              <h3>Médiateur de la consommation</h3>
              <p>{MEDIATEUR}</p>
            </aside>
          </div>
        </div>

        {/* Téléphone */}
        <div className="kc-t kc-body">
          {champ("kc3-q-t")}
          {faq}
          <p className="kc3-sec">Un problème avec une entreprise ?</p>
          <Link className="kc3-row" href="/client/messages"><div><strong>Écrire à l'entreprise</strong><small>la plupart des questions se règlent là</small></div><span aria-hidden="true">›</span></Link>
          <a className="kc3-row" href="mailto:contact@getkoji.io"><div><strong>Contacter Koji</strong><small>contact@getkoji.io · Koji met en relation, le contrat est avec l'entreprise</small></div><span aria-hidden="true">›</span></a>
          <div className="kc3-row fixe"><div><strong>Médiateur de la consommation</strong><small>si le désaccord persiste (à désigner)</small></div></div>
          <Signalement />
        </div>
      </main>
    </div>
  );
}
