"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "../../../lib/client-api";

// Abonnement et jetons (maquette PRO-15.3) : prochain prélèvement, moyen de
// paiement, jetons du Radar, factures Koji (PDF Stripe). Lecture seule :
// changer d'offre et résilier passent par le portail Stripe.
const euros = (n) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0).replace(/ /g, " ")} €`;
const dateCourte = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "");

export function AbonnementDetails({ plan }) {
  const [f, setF] = useState(null);
  const [jetons, setJetons] = useState(null);
  useEffect(() => {
    apiGet("/api/billing/factures").then(setF).catch(() => setF({ abonnement: null, factures: [], jetons: [] }));
    apiGet("/api/compte").then((d) => setJetons(d.jetons)).catch(() => null);
  }, []);
  const a = f?.abonnement;
  return (
    <>
      {a ? (
        <section className="card">
          <div className="card-h"><h2>Prélèvement</h2>{a.seTermine ? <span className="tag tag-o">résiliée</span> : null}</div>
          <div className="kv"><span>{a.seTermine ? "Fin de l'offre" : "Prochain prélèvement"}</span><b>{dateCourte(a.prochainLe)}{!a.seTermine && a.montantTtc ? ` · ${euros(a.montantTtc)} TTC` : ""}</b></div>
          {a.paiement ? <div className="kv"><span>Paiement</span><b>{a.paiement}</b></div> : null}
          <p className="muted">Changer d'offre ou résilier : « Gérer l'abonnement », sans parcours dissuasif.</p>
        </section>
      ) : null}
      <section className="card">
        <div className="card-h"><h2>Jetons du Radar</h2>{jetons ? <span className="tag tag-b">{jetons.solde} disponible{jetons.solde > 1 ? "s" : ""}</span> : null}</div>
        {jetons ? (
          <>
            <div className="kv"><span>Inclus chaque mois</span><b>{jetons.inclus}{plan === "start" ? " · offre Start" : ""}</b></div>
            <div className="kv"><span>Réservés</span><b>{jetons.reserves} · rendus si aucun rendez-vous</b></div>
            <div className="kv"><span>Utilisés ce mois</span><b>{jetons.debitesMois}</b></div>
            <div className="kv"><span>Achetés (gardés d'un mois sur l'autre)</span><b>{jetons.achetes}</b></div>
          </>
        ) : <p className="muted">Chargement…</p>}
        <div className="ed-act ab-act"><Link className="btn btn-sec" href="/marketplace/positions">Historique et recharge</Link></div>
      </section>
      <section className="card">
        <div className="card-h"><h2>Factures Koji</h2></div>
        {!f ? <p className="muted">Chargement…</p> : !f.factures.length && !f.jetons.length ? <p className="muted">Pas encore de facture Koji.</p> : null}
        {(f?.factures || []).map((x) => (
          <div className="row" key={x.numero}><div className="t"><strong>{x.numero}</strong><small>{dateCourte(x.le)} · {x.libelle}{x.payee ? "" : " · à payer"}</small></div><b>{euros(x.ttc)}</b>{x.pdf ? <a className="link" href={x.pdf} target="_blank" rel="noreferrer">PDF</a> : null}</div>
        ))}
        {(f?.jetons || []).map((x) => (
          <div className="row" key={x.id}><div className="t"><strong>{x.quantite} jetons</strong><small>{dateCourte(x.le)} · achat de jetons</small></div><b>{euros(x.ttc)}</b>{x.recu ? <a className="link" href={x.recu} target="_blank" rel="noreferrer">Reçu</a> : null}</div>
        ))}
      </section>
    </>
  );
}
