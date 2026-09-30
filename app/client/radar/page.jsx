"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClientTopbar } from "../../../components/ClientTopbar";
import "../client-home.css";
import { DemandeItem, IconPlus, useSuivis } from "../demandes-ui";

// « Mes demandes » du particulier (refonte UX, septembre 2026) : toutes ses
// demandes, en cours puis terminées. Mêmes routes qu'avant :
// GET /api/chantier-offres, plus l'état de chaque demande
// (GET .../positionner et .../messages, voir demandes-ui.jsx).

const TERMINEES = new Set(["Terminee", "SansSuite"]);

export default function ClientRadarPage() {
  const [offres, setOffres] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/chantier-offres")
      .then((r) => r.json())
      .then((data) => setOffres(data.offres || []))
      .catch(() => setOffres([]))
      .finally(() => setLoading(false));
  }, []);

  const suivis = useSuivis(offres);
  const enCours = offres.filter((o) => !TERMINEES.has(o.status));
  const terminees = offres.filter((o) => TERMINEES.has(o.status));

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client" />

      <div className="kc">
        <div className="kc-page-head">
          <div>
            <h1 className="kc-page-title">Mes demandes</h1>
            <p className="kc-page-sub">Gratuit et sans limite. Les artisans de votre secteur vous répondent.</p>
          </div>
          <Link href="/client/radar/new" className="kc-btn kc-btn-navy"><IconPlus /> Publier un chantier</Link>
        </div>

        {loading ? (
          <div className="kc-empty">Chargement…</div>
        ) : offres.length === 0 ? (
          <div className="kc-empty">
            <strong>Aucune demande pour l'instant</strong>
            <span>Publiez votre premier chantier : c'est gratuit et sans engagement.</span>
          </div>
        ) : (
          <>
            <section className="kc-block">
              <div className="kc-block-head">
                <h2 className="kc-block-title">
                  En cours
                  <span className="kc-count">{enCours.length}</span>
                </h2>
              </div>
              {enCours.length ? (
                <ul className="kc-list">
                  {enCours.map((offre) => <DemandeItem key={offre.id} offre={offre} suivi={suivis[offre.id]} />)}
                </ul>
              ) : (
                <div className="kc-empty">Aucune demande en cours.</div>
              )}
            </section>

            {terminees.length ? (
              <section className="kc-block">
                <div className="kc-block-head">
                  <h2 className="kc-block-title">
                    Terminées
                    <span className="kc-count">{terminees.length}</span>
                  </h2>
                </div>
                <ul className="kc-list">
                  {terminees.map((offre) => <DemandeItem key={offre.id} offre={offre} suivi={suivis[offre.id]} />)}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
