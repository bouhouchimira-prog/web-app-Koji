"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "../lib/client-api";

// Paiement en ligne des factures, côté entreprise (maquettes PRO-15.2,
// carte « Encaissement », et PRO-06.3, carte « Paiement en ligne »).
// L'état vient de GET /api/paiement-en-ligne, relu chez Stripe : le
// commutateur n'est allumé que lorsque Stripe a confirmé que le compte
// encaisse et verse sur la banque de l'entreprise. Interrupteur général
// éteint (PAIEMENT_EN_LIGNE_ACTIF) : le texte « Bientôt » d'avant.

function useCompte(depuis) {
  const [vue, setVue] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState("");
  const [retour, setRetour] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("paiement");
    if (p === "retour" || p === "relancer") setRetour(p);
    apiGet("/api/paiement-en-ligne").then(setVue).catch(() => setVue({ disponible: false, etat: "indisponible" }));
  }, []);

  async function agir(action) {
    if (occupe || !action) return;
    setOccupe(true);
    setMessage("");
    try {
      const r = await apiSend("/api/paiement-en-ligne", { action, depuis });
      if (r.url) {
        if (action === "tableau") window.open(r.url, "_blank", "noopener");
        else { window.location.assign(r.url); return; }
      } else setVue(r);
    } catch (e) {
      setMessage(e.message || "Le prestataire de paiement ne répond pas.");
    }
    setOccupe(false);
  }
  return { vue, occupe, message, retour, agir };
}

const TEXTE_RETOUR = {
  retour: "Inscription transmise : l'état ci-dessous vient du prestataire de paiement.",
  relancer: "Le lien d'inscription a expiré : reprenez l'inscription pour en ouvrir un nouveau."
};

function Commutateur({ vue, occupe, agir, titre, sous }) {
  const action = vue.action?.id || "";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={vue.actif}
      className={`kj-tg${vue.actif ? " on" : ""}`}
      disabled={occupe || !action}
      onClick={() => agir(action)}
      title={vue.action?.libelle || ""}
    >
      <span>{titre}<small>{sous}</small></span><i><b /></i>
    </button>
  );
}

function Suite({ vue, occupe, message, retour, agir }) {
  const lien = vue.action && !["pause", "reprendre"].includes(vue.action.id);
  return (
    <>
      {retour ? <p className="sm2" role="status">{TEXTE_RETOUR[retour]}</p> : null}
      {vue.avertissement ? <p className="sm2" role="status">{vue.avertissement}</p> : null}
      {lien || vue.tableau ? (
        <div className="pel-actions" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {lien ? <button type="button" className="btn btn-sec" disabled={occupe} onClick={() => agir(vue.action.id)}>{occupe ? "…" : vue.action.libelle}</button> : null}
          {vue.tableau ? <button type="button" className="btn btn-sec" disabled={occupe} onClick={() => agir("tableau")}>Tableau de bord du prestataire</button> : null}
        </div>
      ) : null}
      {message ? <p className="notice" role="alert">{message}</p> : null}
    </>
  );
}

// PRO-15.2 · Profil › Devis et factures › Encaissement.
export function PaiementEnLigneProfil() {
  const c = useCompte("profil");
  if (!c.vue?.disponible) {
    return <div className="row"><div className="t"><strong>Paiement en ligne par carte et virement</strong><small>bientôt · prestataire et frais par paiement à fixer</small></div><span className="tag tag-o">Bientôt</span></div>;
  }
  return (
    <>
      <Commutateur vue={c.vue} occupe={c.occupe} agir={c.agir} titre="Paiement en ligne par carte et virement" sous={c.vue.detail} />
      <Suite {...c} />
    </>
  );
}

// PRO-06.3 · Factures › Encaissements › Paiement en ligne.
export function PaiementEnLigneEncaissements() {
  const c = useCompte("encaissements");
  if (!c.vue?.disponible) {
    return (
      <section className="card">
        <div className="card-h"><h2>Paiement en ligne</h2><span className="enc-etat off">Bientôt</span></div>
        <p className="sm2">Carte et virement instantané par notre prestataire de paiement · reçu automatique au client.</p>
        <p className="sm2">Frais à la charge de l'entreprise, affichés avant activation. Koji ne détient pas les fonds.</p>
      </section>
    );
  }
  const ton = c.vue.actif ? "ok" : c.vue.etat === "verification" ? "" : "off";
  const libelle = { actif: "Actif", suspendu: "En pause", verification: "Vérification", a_finaliser: "À terminer", a_activer: "À activer" }[c.vue.etat] || "";
  return (
    <section className="card">
      <div className="card-h"><h2>Paiement en ligne</h2>{libelle ? <span className={`enc-etat ${ton}`}>{libelle}</span> : null}</div>
      <Commutateur vue={c.vue} occupe={c.occupe} agir={c.agir} titre="Carte et virement instantané" sous={`par notre prestataire de paiement · reçu automatique au client · ${c.vue.detail}`} />
      <div className="row"><div className="t"><strong>Frais</strong><small>par paiement, à fixer · Koji ne détient pas les fonds</small></div></div>
      <Suite {...c} />
    </section>
  );
}
