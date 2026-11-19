"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClientTopbar, CHARTE_CLIENT } from "../../../components/ClientTopbar";
import { BoutonPayer, ListePaiements, RetourPaiement } from "../../../components/PaiementsClient";
import "../cli02.css";

// Koji Client · « Paiements » (maquette CLI-02) : les factures de tous les
// chantiers du particulier, regroupées par chantier, avec le même rendu que
// l'onglet Paiements d'un chantier (GET /api/client/paiements). « Payer »
// seulement quand l'entreprise encaisse en ligne ; sinon, le virement.

export default function PaiementsClient() {
  const [etat, setEtat] = useState("chargement"); // chargement | pret | deconnecte | erreur
  const [vue, setVue] = useState(null);

  const charger = useCallback(() => {
    setEtat("chargement");
    fetch("/api/client/paiements", { credentials: "same-origin", cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) { setEtat("deconnecte"); return; }
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Lecture impossible.");
        setVue(data);
        setEtat("pret");
      })
      .catch(() => setEtat("erreur"));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  let corps;
  if (etat === "deconnecte") {
    corps = (
      <div className="kc-body" style={{ maxWidth: 520 }}>
        <p className="kc-p">Votre session a expiré. Connectez-vous pour retrouver vos paiements.</p>
        <Link className="kc-btn" href="/login?type=particulier">Se connecter</Link>
      </div>
    );
  } else if (etat === "erreur") {
    corps = (
      <div className="kc-body" style={{ maxWidth: 520 }}>
        <p className="kc-p">Les paiements n'ont pas pu être chargés.</p>
        <button type="button" className="kc-sec" onClick={charger}>Réessayer</button>
      </div>
    );
  } else if (etat === "chargement") {
    corps = <div className="kc-body"><p className="kc-s">Chargement des paiements…</p></div>;
  } else {
    corps = (
      <div className="kc2-in">
        <h1 className="kc-h kc-d">Paiements</h1>
        <h1 className="kc-ph kc-t">Paiements</h1>
        <RetourPaiement />
        {vue.groupes.length ? vue.groupes.map((g) => (
          <section key={g.id} className="kc2-groupe" aria-label={g.titre}>
            <div className="kc2-gh">
              <div><h2>{g.titre}</h2><small>{g.entreprise}</small></div>
              <Link href={g.lien} className="kc-lien">Voir le chantier</Link>
            </div>
            <ListePaiements paiements={g.paiements} />
            {g.paiements.aPayer ? (
              <div className="kc2-price" style={{ flexDirection: "column" }}>
                <span>{g.paiements.aPayer.titre}</span>
                <b>{g.paiements.aPayer.montant}</b>
                <small>{g.paiements.aPayer.detail}</small>
                {g.paiements.aPayer.payer ? <div style={{ marginTop: 10 }}><BoutonPayer aPayer={g.paiements.aPayer} retour="paiements" className="kc-btn sm" /></div> : null}
                <a className="kc-sec" style={{ marginTop: 10, background: "#FFFFFF" }} href={g.paiements.aPayer.pdf} download>Télécharger la facture</a>
              </div>
            ) : null}
          </section>
        )) : <p className="kc2-vide" style={{ maxWidth: 760 }}>{vue.vide}</p>}
        <p className="kc-n" style={{ maxWidth: 760 }}>{vue.note}</p>
      </div>
    );
  }

  return (
    <div className={`${CHARTE_CLIENT} kc kc2`}>
      <ClientTopbar />
      <main className="kc-m">{corps}</main>
    </div>
  );
}
