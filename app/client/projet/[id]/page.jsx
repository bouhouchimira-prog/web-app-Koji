"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ClientTopbar, CHARTE_CLIENT } from "../../../../components/ClientTopbar";

// Koji Client · « Comparer les propositions » (maquette CLI-01).
// Ordinateur : un tableau, une colonne par entreprise. Téléphone : une carte
// par entreprise et un seul bouton, pour la proposition choisie.
//
// Les entreprises sont classées par date de réponse. Les prix sont ceux des
// entreprises (devis envoyé, sinon estimation jointe à leur proposition).
// La maquette ajoute un « prix recommandé Koji » et une ligne « Écart au
// prix recommandé » : non repris (décision du 10 novembre, aucun prix
// calculé par Koji côté particulier).

const LIGNES = [
  ["avis", "Avis"],
  ["debut", "Début et durée"],
  ["visite", "Visite"],
  ["decennale", "Assurance décennale"],
  ["garanties", "Garanties"]
];

function Action({ action, large = false }) {
  const classe = action.principale ? `kc-btn${large ? "" : " sm"}` : large ? "kc-btn" : "kc-sec";
  return /^https?:/.test(action.lien)
    ? <a href={action.lien} className={classe}>{action.libelle}</a>
    : <Link href={action.lien} className={classe}>{action.libelle}</Link>;
}

export default function ComparerPropositions() {
  const { id } = useParams();
  const [etat, setEtat] = useState("chargement"); // chargement | pret | introuvable | deconnecte | erreur
  const [vue, setVue] = useState(null);
  const [choix, setChoix] = useState(0);

  const charger = useCallback(() => {
    setEtat("chargement");
    fetch(`/api/client/projets/${encodeURIComponent(id)}`, { credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 401) { setEtat("deconnecte"); return; }
        if (r.status === 404) { setEtat("introuvable"); return; }
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Lecture impossible.");
        setVue(data);
        setChoix(0);
        setEtat("pret");
      })
      .catch(() => setEtat("erreur"));
  }, [id]);

  useEffect(() => { if (id) charger(); }, [id, charger]);

  const propositions = vue?.propositions || [];
  const choisie = propositions[Math.min(choix, propositions.length - 1)] || null;
  const titreBarre = etat === "pret" ? vue.titre : etat === "introuvable" ? "Projet introuvable" : "Propositions";
  const fiche = `/client/radar/${encodeURIComponent(id || "")}`;

  let corps = null;
  if (etat === "deconnecte") {
    corps = (
      <div className="kc-body" style={{ maxWidth: 520 }}>
        <p className="kc-p">Votre session a expiré. Connectez-vous pour retrouver vos propositions.</p>
        <Link className="kc-btn" href="/login?type=particulier">Se connecter</Link>
      </div>
    );
  } else if (etat === "introuvable") {
    corps = (
      <div className="kc-body" style={{ maxWidth: 520 }}>
        <p className="kc-p">Ce projet n'existe pas, ou il n'est pas rattaché à votre compte.</p>
        <Link className="kc-btn" href="/client">Retour à mes projets</Link>
      </div>
    );
  } else if (etat === "erreur") {
    corps = (
      <div className="kc-body" style={{ maxWidth: 520 }}>
        <p className="kc-p">Les propositions n'ont pas pu être chargées.</p>
        <button type="button" className="kc-sec" onClick={charger}>Réessayer</button>
      </div>
    );
  } else if (etat === "chargement") {
    corps = <div className="kc-body"><p className="kc-s">Chargement des propositions…</p></div>;
  }

  return (
    <div className={`${CHARTE_CLIENT} kc sans-barre`}>
      <ClientTopbar titre={titreBarre} sousTitre={vue?.projet?.titre || ""} backHref="/client" sansBarre />
      <main className="kc-m">
        {corps || (
          <>
            {/* Ordinateur */}
            <div className="kc-d">
              <span className="kc-ey">{vue.projet.titre}</span>
              <h1 className="kc-h">Comparer les propositions</h1>
              {propositions.length ? (
                <div className="kc-tw">
                  <table className="kc-tb">
                    <thead>
                      <tr><th />{propositions.map((p) => <th key={p.entrepriseId} scope="col">{p.nom}</th>)}</tr>
                    </thead>
                    <tbody>
                      <tr className="prix">
                        <td>Prix TTC</td>
                        {propositions.map((p) => <td key={p.entrepriseId}>{p.prix}{p.prixNote ? <small>{p.prixNote}</small> : null}</td>)}
                      </tr>
                      {LIGNES.map(([cle, libelle]) => (
                        <tr key={cle}><td>{libelle}</td>{propositions.map((p) => <td key={p.entrepriseId}>{p[cle]}</td>)}</tr>
                      ))}
                      <tr><td />{propositions.map((p) => <td key={p.entrepriseId}><Action action={p.action} /></td>)}</tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="kc-vide">{vue.vide}</p>
              )}
              <p className="kc-n">{vue.note}</p>
              <p className="kc-n"><Link href={fiche} className="kc-lien">Voir ma demande et mes échanges avec les entreprises</Link></p>
            </div>

            {/* Téléphone */}
            <div className="kc-t kc-body">
              {propositions.length ? propositions.map((p, i) => (
                <button type="button" key={p.entrepriseId} className={`kc-of${i === choix ? " on" : ""}`} aria-pressed={i === choix} onClick={() => setChoix(i)}>
                  <span className="t"><b>{p.nom}</b><em>{p.prix}</em></span>
                  {p.prixNote ? <small>{p.prixNote}</small> : null}
                  {p.resume.map((ligne) => <small key={ligne}>{ligne}</small>)}
                </button>
              )) : <div className="kc-info">{vue.vide}</div>}
              <p className="kc-s">{vue.note}</p>
              <Link href={fiche} className="kc-lien">Voir ma demande</Link>
              {choisie ? (
                /^https?:/.test(choisie.action.lien)
                  ? <a href={choisie.action.lien} className="kc-btn" style={{ marginTop: "auto" }}>{choisie.voir}</a>
                  : <Link href={choisie.action.lien} className="kc-btn" style={{ marginTop: "auto" }}>{choisie.voir}</Link>
              ) : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
